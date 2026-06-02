import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';

/**
 * Cache entry structure for bot query responses
 */
export interface CachedQueryResponse {
  answer: string;
  toolsUsed: string[];
  processingTimeMs: number;
  cachedAt: number;
  tokensUsed?: {
    input: number;
    output: number;
    cost: number;
  };
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalQueries: number;
  estimatedSavings: number; // in USD
}

/**
 * BotCacheService - Redis-based query caching for cost optimization
 *
 * Strategy 1: Query Caching
 * - Caches query responses for 5 minutes by default
 * - Uses query hash as cache key for deduplication
 * - Tracks cache statistics for monitoring
 * - Estimated 15-25% cost savings from duplicate queries
 */
@Injectable()
export class BotCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotCacheService.name);
  private redis: Redis | null = null;
  private isConnected = false;

  // Cache configuration
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'bot:query:';
  private readonly STATS_KEY = 'bot:cache:stats';

  // In-memory fallback cache when Redis is unavailable
  private readonly memoryCache: Map<string, { data: CachedQueryResponse; expiresAt: number }> =
    new Map();
  private readonly MAX_MEMORY_CACHE_SIZE = 100;

  // Statistics tracking
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalQueries: 0,
    estimatedSavings: 0,
  };

  // Estimated cost per query (GPT-4o-mini)
  private readonly COST_PER_QUERY = 0.0003;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis connection failed, using memory cache fallback');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to Redis for query caching');
      });

      this.redis.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}, using memory cache`);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        this.isConnected = false;
      });

      await this.redis.connect();
    } catch (error) {
      this.logger.warn(`Failed to connect to Redis: ${error.message}, using memory cache`);
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }

  /**
   * Generate a cache key from the query
   * Uses SHA-256 hash for consistent key generation
   */
  generateCacheKey(query: string, date?: string): string {
    // Normalize query: lowercase, trim whitespace, remove extra spaces
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');

    // Include current date to invalidate cache daily for time-sensitive queries
    const dateKey = date || new Date().toISOString().split('T')[0];

    const hash = createHash('sha256')
      .update(`${normalizedQuery}:${dateKey}`)
      .digest('hex')
      .substring(0, 16);

    return `${this.CACHE_PREFIX}${hash}`;
  }

  /**
   * Get cached response for a query
   * @returns Cached response or null if not found
   */
  async get(query: string): Promise<CachedQueryResponse | null> {
    const cacheKey = this.generateCacheKey(query);
    this.stats.totalQueries++;

    try {
      let cached: string | null = null;

      if (this.isConnected && this.redis) {
        cached = await this.redis.get(cacheKey);
      } else {
        // Fallback to memory cache
        const memoryEntry = this.memoryCache.get(cacheKey);
        if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
          cached = JSON.stringify(memoryEntry.data);
        } else if (memoryEntry) {
          this.memoryCache.delete(cacheKey);
        }
      }

      if (cached) {
        this.stats.hits++;
        this.stats.estimatedSavings += this.COST_PER_QUERY;
        this.updateHitRate();

        this.logger.debug(`Cache HIT for query: "${query.substring(0, 50)}..."`);
        return JSON.parse(cached);
      }

      this.stats.misses++;
      this.updateHitRate();

      this.logger.debug(`Cache MISS for query: "${query.substring(0, 50)}..."`);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error: ${error.message}`);
      return null;
    }
  }

  /**
   * Store a response in the cache
   */
  async set(query: string, response: CachedQueryResponse, ttl?: number): Promise<void> {
    const cacheKey = this.generateCacheKey(query);
    const cacheTTL = ttl || this.DEFAULT_TTL;

    try {
      const cacheData: CachedQueryResponse = {
        ...response,
        cachedAt: Date.now(),
      };

      const serialized = JSON.stringify(cacheData);

      if (this.isConnected && this.redis) {
        await this.redis.setex(cacheKey, cacheTTL, serialized);
      } else {
        // Fallback to memory cache
        this.setMemoryCache(cacheKey, cacheData, cacheTTL);
      }

      this.logger.debug(`Cached response for query: "${query.substring(0, 50)}..."`);
    } catch (error) {
      this.logger.error(`Cache set error: ${error.message}`);
    }
  }

  /**
   * Set value in memory cache with size management
   */
  private setMemoryCache(key: string, data: CachedQueryResponse, ttlSeconds: number): void {
    // Evict old entries if cache is full
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalidate cache for a specific query
   */
  async invalidate(query: string): Promise<void> {
    const cacheKey = this.generateCacheKey(query);

    try {
      if (this.isConnected && this.redis) {
        await this.redis.del(cacheKey);
      }
      this.memoryCache.delete(cacheKey);
    } catch (error) {
      this.logger.error(`Cache invalidate error: ${error.message}`);
    }
  }

  /**
   * Clear all bot query cache
   */
  async clearAll(): Promise<number> {
    try {
      let cleared = 0;

      if (this.isConnected && this.redis) {
        const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
        if (keys.length > 0) {
          cleared = await this.redis.del(...keys);
        }
      }

      const memoryCacheSize = this.memoryCache.size;
      this.memoryCache.clear();
      cleared += memoryCacheSize;

      this.logger.log(`Cleared ${cleared} cached queries`);
      return cleared;
    } catch (error) {
      this.logger.error(`Cache clear error: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalQueries: 0,
      estimatedSavings: 0,
    };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    if (this.stats.totalQueries > 0) {
      this.stats.hitRate = (this.stats.hits / this.stats.totalQueries) * 100;
    }
  }

  /**
   * Check if cache is available (Redis or memory fallback)
   */
  isAvailable(): boolean {
    return true; // Always available due to memory fallback
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Determine if a query should be cached
   * Some queries should skip caching (e.g., very specific or time-sensitive)
   */
  shouldCache(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    // Skip caching for queries that explicitly ask for "now", "current", "latest"
    // These might need fresh data
    const skipPatterns = ['right now', 'as of now', 'current time', 'latest update'];

    for (const pattern of skipPatterns) {
      if (lowerQuery.includes(pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get appropriate TTL based on query type
   */
  getTTLForQuery(query: string): number {
    const lowerQuery = query.toLowerCase();

    // Shorter TTL for time-sensitive queries (1 minute)
    if (
      lowerQuery.includes('today') ||
      lowerQuery.includes('this hour') ||
      lowerQuery.includes('pending') ||
      lowerQuery.includes('overdue')
    ) {
      return 60;
    }

    // Longer TTL for historical/aggregate queries (10 minutes)
    if (
      lowerQuery.includes('last month') ||
      lowerQuery.includes('last year') ||
      lowerQuery.includes('total') ||
      lowerQuery.includes('all time')
    ) {
      return 600;
    }

    // Default TTL (5 minutes)
    return this.DEFAULT_TTL;
  }
}
