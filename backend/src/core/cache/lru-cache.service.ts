import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import LRUCacheImport from 'lru-cache';
import Redis from 'ioredis';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

// Tag store configuration to prevent unbounded growth
// OPTIMIZED: Reduced limits to conserve memory in 600MB heap per instance
const TAG_STORE_MAX_TAGS = 1000; // Maximum number of unique tags
const TAG_STORE_MAX_KEYS_PER_TAG = 500; // Maximum keys per tag
const TAG_STORE_CLEANUP_THRESHOLD = 0.8; // Cleanup when 80% full (more aggressive)

@Injectable()
export class LruCacheService implements OnModuleInit {
  private readonly logger = new Logger(LruCacheService.name);
  private localCache: any;
  private redis: Redis;
  private tagStore: Map<string, Set<string>>; // tag -> Set of cache keys
  private redisCircuitBreaker: CircuitBreaker;
  private redisReady = false;
  private redisUnavailableSince: number | null = null;
  private redisLastErrorLogAt: number | null = null;
  private redisDisabledUntil = 0;
  private readonly redisErrorDelayMs = 5 * 60 * 1000;
  private readonly redisCooldownMs = 5 * 60 * 1000;
  private readonly l1MaxTtlMs = 60000;
  private readonly l1FallbackTtlMs = 300000;

  // Metrics
  private l1Hits = 0;
  private l1Misses = 0;
  private l2Hits = 0;
  private l2Misses = 0;

  constructor(private configService: ConfigService) {
    // Try to initialize LRU cache, fallback to Map if not available
    try {
      const LRUCacheCtor = (LRUCacheImport as any)?.LRUCache ?? (LRUCacheImport as any);
      if (typeof LRUCacheCtor === 'function') {
        this.localCache = new LRUCacheCtor({
          max: 1000, // Maximum 1000 items in local cache (increased for better hit rate)
          ttl: 60000, // 1 minute TTL for local cache
          updateAgeOnGet: true,
          updateAgeOnHas: true,
        });
      } else {
        throw new Error('LRU cache constructor not found');
      }
    } catch (error) {
      this.logger.warn('LRU cache not available, using Map fallback');
      // Fallback to a simple Map with manual TTL management
      this.localCache = new Map();
    }

    // Initialize tag store
    this.tagStore = new Map();

    // Initialize circuit breaker for Redis
    this.redisCircuitBreaker = new CircuitBreaker('redis', {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      halfOpenMaxCalls: 3,
    });
  }

  async onModuleInit() {
    // Initialize Redis connection
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      lazyConnect: true, // Don't connect immediately, wait for first command
      retryStrategy: (times) => {
        // Stop retrying after 10 attempts (exponential backoff caps at ~30s)
        if (times > 10) {
          this.logger.warn('Redis: Max retry attempts reached, stopping reconnection');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 1000, 30000); // Max 30 seconds between retries
        return delay;
      },
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3, // Allow a few retries for transient failures
      connectTimeout: 10000, // 10 second connection timeout (increased for DragonflyDB)
      commandTimeout: 10000, // 10 second command timeout (increased for DragonflyDB)
      // DragonflyDB compatibility options
      enableReadyCheck: true,
      keepAlive: 30000, // Send keepalive every 30 seconds
      noDelay: true, // Disable Nagle's algorithm for lower latency
    });

    // Suppress continuous error logging - only log once per error type
    this.redis.on('error', (err) => {
      this.handleRedisError(err);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis cache connected');
    });

    this.redis.on('ready', () => {
      this.redisReady = true;
      this.redisUnavailableSince = null;
      this.redisLastErrorLogAt = null;
      this.redisDisabledUntil = 0;
      this.logger.log('Redis cache ready');
    });

    this.redis.on('end', () => {
      this.redisReady = false;
    });

    this.redis.on('close', () => {
      this.redisReady = false;
    });

    // Try to connect, but don't fail if Redis is unavailable
    try {
      await this.redis.connect();
    } catch (err) {
      this.logger.warn('Redis cache unavailable at startup, using local cache only');
      this.handleRedisError(err);
    }
  }

  /**
   * Get value from cache (checks local LRU first, then Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    if (this.localCache && typeof this.localCache.get === 'function') {
      const l1Value = this.localCache.get(key);
      if (l1Value !== undefined) {
        this.l1Hits++;
        return l1Value as T;
      }
    }
    this.l1Misses++;

    // Try Redis with circuit breaker
    if (this.isRedisUsable()) {
      try {
        const value = await this.redisCircuitBreaker.execute(async () => {
          const data = await this.redis.get(key);
          return data ? JSON.parse(data) : null;
        });

        if (value !== null) {
          this.l2Hits++;
          // Populate L1
          if (this.localCache && typeof this.localCache.set === 'function') {
            this.localCache.set(key, value);
          }
          return value;
        }
        this.l2Misses++;
      } catch (error) {
        this.logger.warn(`Redis get failed for key ${key}, using L1 only`);
      }
    }

    return null;
  }

  /**
   * Set value in both local and Redis cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    const ttlMsRaw = options?.ttl ?? 300000; // Default 5 minutes (in ms)
    const ttlMsParsed = Number(ttlMsRaw);
    const ttlMs = Number.isFinite(ttlMsParsed) && ttlMsParsed > 0 ? ttlMsParsed : 300000;

    // Set in local cache.
    // Newer lru-cache uses an options object with `ttl`, older versions use a numeric `maxAge` as the 3rd arg.
    const l1TtlLimit = this.isRedisUsable() ? this.l1MaxTtlMs : this.l1FallbackTtlMs;
    const l1TtlMs = Math.min(ttlMs, l1TtlLimit);
    if (this.localCache && typeof this.localCache.set === 'function') {
      try {
        this.localCache.set(key, value, { ttl: l1TtlMs });
      } catch {
        // Fallback for Map or older lru-cache versions
        this.localCache.set(key, value);
      }
    }

    // Set in Redis with circuit breaker
    if (this.isRedisUsable()) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          const serialized = JSON.stringify(value);
          // Use PX (milliseconds) instead of setex (seconds) to handle sub-second TTLs and avoid 0 seconds error
          await this.redis.set(key, serialized, 'PX', ttlMs);

          // Handle tags if provided
          if (options?.tags && options.tags.length > 0) {
            await this.setTags(key, options.tags);
          }
        });
      } catch (error) {
        this.logger.warn(`Redis set failed for key ${key}`, error);
      }
    }
  }

  /**
   * Get from cache or fetch and set
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch the value
    const value = await fetcher();

    // Set in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Delete a key from both local and Redis cache
   */
  async delete(key: string): Promise<void> {
    if (this.localCache && typeof this.localCache.delete === 'function') {
      this.localCache.delete(key);
    }
    if (this.isRedisUsable()) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          await this.redis.del(key);
          // Remove from tag store
          this.removeFromAllTags(key);
        });
      } catch (error) {
        this.logger.warn(`Redis delete failed for key ${key}`, error);
      }
    }
  }

  /**
   * Invalidate cache by pattern (e.g., 'institution:*')
   * Uses SCAN instead of KEYS for non-blocking Redis operations
   */
  async invalidate(pattern: string): Promise<void> {
    // Clear matching keys from local cache
    const l1Pattern = new RegExp(pattern.replace(/\*/g, '.*'));
    if (this.localCache && typeof this.localCache.keys === 'function') {
      for (const key of this.localCache.keys()) {
        if (l1Pattern.test(key)) {
          if (typeof this.localCache.delete === 'function') {
            this.localCache.delete(key);
          }
        }
      }
    }

    // Use SCAN instead of KEYS for L2 (Redis) - non-blocking
    if (this.isRedisUsable()) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          let cursor = '0';
          do {
            const [newCursor, keys] = await this.redis.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              100,
            );
            cursor = newCursor;
            if (keys.length > 0) {
              await this.redis.del(...keys);
              // Remove from tag store
              keys.forEach((key) => this.removeFromAllTags(key));
            }
          } while (cursor !== '0');
        });
      } catch (error) {
        this.logger.warn(`Cache invalidation failed: ${error.message}`);
      }
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToDelete = new Set<string>();

    // Collect all keys associated with these tags
    for (const tag of tags) {
      const keys = this.tagStore.get(tag);
      if (keys) {
        keys.forEach((key) => keysToDelete.add(key));
      }
    }

    // Delete all collected keys
    for (const key of keysToDelete) {
      await this.delete(key);
    }

    // Clear the tags
    tags.forEach((tag) => this.tagStore.delete(tag));
  }

  /**
   * Clear all cache (both local and Redis)
   */
  async clear(): Promise<void> {
    if (this.localCache && typeof this.localCache.clear === 'function') {
      this.localCache.clear();
    }
    this.tagStore.clear();
    if (this.isRedisUsable()) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          await this.redis.flushdb();
        });
      } catch (error) {
        this.logger.warn('Redis clear failed', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    // Calculate total keys across all tags
    let totalTaggedKeys = 0;
    for (const keys of this.tagStore.values()) {
      totalTaggedKeys += keys.size;
    }

    return {
      local: {
        size: this.localCache?.size ?? 0,
        max: this.localCache?.max ?? 0,
      },
      tags: {
        count: this.tagStore.size,
        maxTags: TAG_STORE_MAX_TAGS,
        totalTaggedKeys,
        maxKeysPerTag: TAG_STORE_MAX_KEYS_PER_TAG,
        utilizationPercent: Math.round((this.tagStore.size / TAG_STORE_MAX_TAGS) * 100),
      },
    };
  }

  /**
   * Get comprehensive metrics including circuit breaker status
   */
  getMetrics() {
    return {
      l1: {
        size: this.localCache?.size ?? 0,
        hits: this.l1Hits,
        misses: this.l1Misses,
        hitRate: this.l1Hits / (this.l1Hits + this.l1Misses) || 0,
      },
      l2: {
        connected: this.redisReady,
        circuitState: this.redisCircuitBreaker.getState(),
        hits: this.l2Hits,
        misses: this.l2Misses,
        hitRate: this.l2Hits / (this.l2Hits + this.l2Misses) || 0,
      },
      circuit: this.redisCircuitBreaker.getMetrics(),
    };
  }

  /**
   * Set tags for a cache key with size limits to prevent unbounded growth
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    // Check if we need to cleanup before adding more tags
    if (this.tagStore.size >= TAG_STORE_MAX_TAGS * TAG_STORE_CLEANUP_THRESHOLD) {
      this.cleanupOrphanedTags();
    }

    for (const tag of tags) {
      // Enforce max tags limit
      if (!this.tagStore.has(tag) && this.tagStore.size >= TAG_STORE_MAX_TAGS) {
        this.logger.warn(`Tag store at capacity (${TAG_STORE_MAX_TAGS}), skipping new tag: ${tag}`);
        continue;
      }

      if (!this.tagStore.has(tag)) {
        this.tagStore.set(tag, new Set());
      }

      const tagKeys = this.tagStore.get(tag)!;

      // Enforce max keys per tag limit
      if (tagKeys.size >= TAG_STORE_MAX_KEYS_PER_TAG) {
        this.logger.warn(`Tag '${tag}' at capacity (${TAG_STORE_MAX_KEYS_PER_TAG} keys), skipping key: ${key}`);
        continue;
      }

      tagKeys.add(key);
    }

    // Store tags in Redis as well for distributed systems
    if (this.isRedisUsable()) {
      try {
        await this.redisCircuitBreaker.execute(async () => {
          await this.redis.sadd(`tags:${key}`, ...tags);
          for (const tag of tags) {
            await this.redis.sadd(`tag:${tag}`, key);
          }
        });
      } catch (error) {
        this.logger.warn('Redis set tags error:', error);
      }
    }
  }

  /**
   * Cleanup orphaned tags (tags with no valid cache keys)
   * This prevents memory leaks from tags whose keys have been evicted
   */
  private cleanupOrphanedTags(): void {
    const startSize = this.tagStore.size;
    let cleanedTags = 0;
    let cleanedKeys = 0;

    for (const [tag, keys] of this.tagStore.entries()) {
      // Remove keys that no longer exist in local cache
      if (this.localCache && typeof this.localCache.has === 'function') {
        for (const key of keys) {
          if (!this.localCache.has(key)) {
            keys.delete(key);
            cleanedKeys++;
          }
        }
      }

      // Remove empty tags
      if (keys.size === 0) {
        this.tagStore.delete(tag);
        cleanedTags++;
      }
    }

    if (cleanedTags > 0 || cleanedKeys > 0) {
      this.logger.log(
        `Tag store cleanup: removed ${cleanedTags} orphaned tags, ${cleanedKeys} stale keys. ` +
        `Size: ${startSize} -> ${this.tagStore.size}`
      );
    }
  }

  /**
   * Remove key from all tag associations
   */
  private removeFromAllTags(key: string): void {
    for (const [tag, keys] of this.tagStore.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagStore.delete(tag);
      }
    }
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  private matchPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  /**
   * Batch set multiple keys
   */
  async mset(
    entries: Array<{ key: string; value: any; options?: CacheOptions }>,
  ): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.set(entry.key, entry.value, entry.options)),
    );
  }

  /**
   * Batch delete multiple keys
   */
  async mdel(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (this.localCache && typeof this.localCache.has === 'function' && this.localCache.has(key)) {
      return true;
    }

    if (this.isRedisUsable()) {
      try {
        const exists = await this.redisCircuitBreaker.execute(async () => {
          return await this.redis.exists(key);
        });
        return exists === 1;
      } catch (error) {
        this.logger.warn('Redis has error:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (this.isRedisUsable()) {
      try {
        return await this.redisCircuitBreaker.execute(async () => {
          return await this.redis.ttl(key);
        });
      } catch (error) {
        this.logger.warn('Redis TTL error:', error);
        return -1;
      }
    }
    return -1;
  }

  private isRedisUsable(): boolean {
    if (!this.redis) {
      return false;
    }
    if (!this.redisReady) {
      return false;
    }
    if (this.redisCircuitBreaker.getState() === CircuitState.OPEN) {
      return false;
    }
    if (Date.now() < this.redisDisabledUntil) {
      return false;
    }
    return true;
  }

  private handleRedisError(err: unknown): void {
    const now = Date.now();
    this.redisReady = false;

    // First time seeing error - log once and set timestamp
    if (this.redisUnavailableSince === null) {
      this.redisUnavailableSince = now;
      this.redisLastErrorLogAt = now;
      this.logger.warn('Redis cache unavailable, falling back to local cache');
      return;
    }

    this.redisDisabledUntil = Math.max(this.redisDisabledUntil, now + this.redisCooldownMs);

    // Only log every 5 minutes after initial error
    const timeSinceLastLog = now - (this.redisLastErrorLogAt ?? 0);
    if (timeSinceLastLog >= this.redisErrorDelayMs) {
      this.redisLastErrorLogAt = now;
      const unavailableMinutes = Math.round((now - this.redisUnavailableSince) / 60000);
      this.logger.warn(
        `Redis cache still unavailable (${unavailableMinutes} min), using local cache`,
      );
    }
    // Silently ignore all other errors to prevent log spam
  }
}
