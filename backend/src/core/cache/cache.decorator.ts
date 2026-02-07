import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache_ttl';

/**
 * Decorator to set cache TTL for a method
 * @param ttl Time to live in seconds
 */
export const CacheTTL = (ttl: number) => SetMetadata(CACHE_TTL_KEY, ttl);

/**
 * Decorator to mark a method as cacheable
 */
export const CACHE_KEY_METADATA = 'cache_key';
export const CacheKey = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

/**
 * Advanced Cacheable decorator for automatic method-level caching
 * @param options Cache configuration options
 */
export interface CacheableOptions {
  key: string;
  ttl?: number;
  tags?: string[];
}

export function Cacheable(options: CacheableOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Get the cache service from the instance
      const cacheService = this.cacheService || this.lruCacheService;

      if (!cacheService) {
        // If no cache service is available, just execute the method
        return originalMethod.apply(this, args);
      }

      // Generate cache key from options and arguments
      const cacheKey = generateCacheKey(options.key, args);

      // Try to get from cache
      const cached = await cacheService.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        return cached;
      }

      // Execute the original method
      const result = await originalMethod.apply(this, args);

      const ttlSeconds = options.ttl ?? 300;
      const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 300000;

      // Cache the result
      await cacheService.set(cacheKey, result, {
        ttl: ttlMs,
        tags: options.tags,
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Generate cache key from template and arguments
 */
function generateCacheKey(keyTemplate: string, args: any[]): string {
  let key = keyTemplate;

  // Replace placeholders like {0}, {1} with argument values
  args.forEach((arg, index) => {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      // If argument is an object, replace named placeholders
      Object.keys(arg).forEach((prop) => {
        key = key.replace(new RegExp(`\\{${prop}\\}`, 'g'), arg[prop]);
      });
    }
    // Replace numbered placeholders
    key = key.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
  });

  return key;
}
