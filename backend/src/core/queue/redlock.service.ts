import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import Redlock from 'redlock';
import Redis from 'ioredis';

@Injectable()
export class RedlockService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedlockService.name);
  private redlock: Redlock;
  private redis: Redis;
  private redisReady = false;
  private redisUnavailableSince: number | null = null;
  private redisLastErrorLogAt: number | null = null;
  private readonly redisErrorDelayMs = 5 * 60 * 1000;

  async onModuleInit() {
    const redisWriteUrl =
      process.env.REDIS_QUEUE_URL || process.env.REDIS_MASTER_URL || process.env.REDIS_URL;

    const baseConfig = redisWriteUrl
      ? this.parseRedisUrl(redisWriteUrl)
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          username: process.env.REDIS_USERNAME || undefined,
          password: process.env.REDIS_PASSWORD || undefined,
          db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
        };

    this.redis = new Redis({
      ...baseConfig,
      lazyConnect: true,
      enableOfflineQueue: process.env.NODE_ENV === 'production' ? false : true,
      maxRetriesPerRequest: 3, // Allow a few retries for transient failures
      connectTimeout: 10000, // 10 second connection timeout (increased for DragonflyDB)
      commandTimeout: 10000, // 10 second command timeout (increased for DragonflyDB)
      // DragonflyDB compatibility options
      enableReadyCheck: true,
      keepAlive: 30000, // Send keepalive every 30 seconds
      noDelay: true, // Disable Nagle's algorithm for lower latency
      retryStrategy: (times) => {
        const maxRetries = process.env.NODE_ENV === 'production' ? 10 : 3;
        if (times > maxRetries) {
          return null; // Stop retrying
        }
        return Math.min(times * 1000, 30000);
      },
    });

    this.redis.on('ready', () => {
      this.redisReady = true;
      this.redisUnavailableSince = null;
      this.redisLastErrorLogAt = null;
      this.logger.log('Redis lock service ready');
    });

    this.redis.on('error', (err) => {
      this.handleRedisError(err);
    });

    this.redis.on('close', () => {
      this.redisReady = false;
    });

    this.redis.on('end', () => {
      this.redisReady = false;
    });

    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01,
      retryCount: 3, // Reduced from 10
      retryDelay: 200,
      retryJitter: 200,
      automaticExtensionThreshold: 500,
    });

    this.redlock.on('error', (error) => {
      this.handleRedlockError(error);
    });

    // Try to connect but don't fail if unavailable
    try {
      await this.redis.connect();
    } catch (err) {
      this.logger.warn('Redis lock service unavailable at startup');
      this.handleRedisError(err);
    }
  }

  private parseRedisUrl(redisUrl: string): {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
    tls?: object;
  } {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        username: parsed.username || process.env.REDIS_USERNAME || undefined,
        password: parsed.password || process.env.REDIS_PASSWORD || undefined,
        db:
          parsed.pathname && parsed.pathname !== '/'
            ? Number(parsed.pathname.replace('/', '')) || (process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0)
            : process.env.REDIS_DB
              ? parseInt(process.env.REDIS_DB, 10)
              : 0,
        tls: parsed.protocol === 'rediss:' ? {} : undefined,
      };
    } catch {
      this.logger.warn('Invalid REDIS_QUEUE_URL/REDIS_MASTER_URL/REDIS_URL. Falling back to REDIS_HOST/REDIS_PORT.');
      return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
      };
    }
  }

  async acquireLock(resource: string, ttl: number = 5000) {
    if (!this.redisReady) {
      throw new Error('Redis lock service unavailable');
    }
    try {
      return await this.redlock.acquire([`lock:${resource}`], ttl);
    } catch (error) {
      // Only log if not a routine lock contention
      if (!error.message?.includes('exceeded')) {
        this.logger.warn(`Failed to acquire lock for ${resource}`);
      }
      throw error;
    }
  }

  async withLock<T>(
    resource: string,
    operation: () => Promise<T>,
    ttl: number = 5000,
  ): Promise<T> {
    const lock = await this.acquireLock(resource, ttl);
    try {
      return await operation();
    } finally {
      try {
        await lock.release();
      } catch (err) {
        // Silently ignore release errors (lock may have expired)
      }
    }
  }

  /**
   * Try to acquire lock, returns null if unavailable (non-blocking)
   */
  async tryAcquireLock(resource: string, ttl: number = 5000) {
    if (!this.redisReady) {
      return null;
    }
    try {
      return await this.redlock.acquire([`lock:${resource}`], ttl);
    } catch {
      return null;
    }
  }

  /**
   * Check if Redis is available for locking
   */
  isAvailable(): boolean {
    return this.redisReady;
  }

  private handleRedisError(err: unknown): void {
    const now = Date.now();
    this.redisReady = false;

    if (this.redisUnavailableSince === null) {
      this.redisUnavailableSince = now;
      this.redisLastErrorLogAt = now;
      this.logger.warn('Redis lock service unavailable');
      return;
    }

    const timeSinceLastLog = now - (this.redisLastErrorLogAt ?? 0);
    if (timeSinceLastLog >= this.redisErrorDelayMs) {
      this.redisLastErrorLogAt = now;
      const unavailableMinutes = Math.round((now - this.redisUnavailableSince) / 60000);
      this.logger.warn(`Redis lock service still unavailable (${unavailableMinutes} min)`);
    }
  }

  private handleRedlockError(error: unknown): void {
    // Redlock errors are already throttled by handleRedisError
    // Only log if it's a different type of error
    const err = error as Error;
    if (err.message && !err.message.includes('ECONNREFUSED') && !err.message.includes('ENOTFOUND')) {
      this.handleRedisError(error);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connect') {
        await this.redis.quit();
      } else {
        this.redis.disconnect();
      }
    } catch {
      this.redis.disconnect();
    } finally {
      this.redisReady = false;
    }
  }
}
