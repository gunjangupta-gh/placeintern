import { Injectable, Logger } from '@nestjs/common';
import { LruCacheService, CacheOptions } from './lru-cache.service';

/**
 * Simplified CacheService that delegates to LruCacheService
 * LruCacheService provides L1 (local LRU) + L2 (Redis/DragonflyDB) caching with circuit breaker
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private lruCacheService: LruCacheService) {}

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.lruCacheService.get<T>(key);
    return result === null ? undefined : result;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.lruCacheService.set(key, value, {
      ttl: this.toMs(ttl),
    });
  }

  async del(key: string): Promise<void> {
    await this.lruCacheService.delete(key);
  }

  async clear(): Promise<void> {
    await this.lruCacheService.clear();
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    return this.lruCacheService.getOrSet(key, factory, { ttl: this.toMs(ttl) });
  }

  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    return this.lruCacheService.getOrSet(key, fn, { ttl: this.toMs(ttl) });
  }

  async mget<T>(...keys: string[]): Promise<(T | undefined)[]> {
    const results = await this.lruCacheService.mget<T>(...keys);
    return results.map(r => r === null ? undefined : r);
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    await this.lruCacheService.mset(
      entries.map(e => ({ key: e.key, value: e.value, options: { ttl: this.toMs(e.ttl) } })),
    );
  }

  async mdel(...keys: string[]): Promise<void> {
    await this.lruCacheService.mdel(...keys);
  }

  /**
   * Invalidate cache entries by pattern (e.g., 'institution:*')
   */
  async invalidate(pattern: string): Promise<void> {
    await this.lruCacheService.invalidate(pattern);
  }

  /**
   * Invalidate cache entries by tags
   * Use this for efficient cache invalidation after write operations
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    await this.lruCacheService.invalidateByTags(tags);
  }

  /**
   * Set value with tags for grouped invalidation
   */
  async setWithTags(key: string, value: any, tags: string[], ttl?: number): Promise<void> {
    await this.lruCacheService.set(key, value, {
      ttl: this.toMs(ttl),
      tags,
    });
  }

  /**
   * Get cache metrics
   */
  getMetrics() {
    return this.lruCacheService.getMetrics();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.lruCacheService.getStats();
  }

  private toMs(ttlSeconds?: number): number | undefined {
    if (ttlSeconds === undefined || ttlSeconds === null) {
      return undefined;
    }
    const parsed = Number(ttlSeconds);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }
    return Math.round(parsed * 1000);
  }
}
