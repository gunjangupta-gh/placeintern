import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LruCacheService } from './lru-cache.service';
import { CACHE_TTL_KEY } from './cache.decorator';
import { getUserId } from '../common/utils/request.utils';
import * as crypto from 'crypto';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private cacheService: LruCacheService,
    private reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Get cache TTL from decorator
    const cacheTTL = this.reflector.get<number>(
      CACHE_TTL_KEY,
      context.getHandler(),
    );

    // If no cache TTL is set, skip caching
    if (!cacheTTL) {
      return next.handle();
    }

    // Generate cache key from URL and query params
    const cacheKey = this.generateCacheKey(request);

    // Check if cached response exists
    const cachedResponse = await this.cacheService.get(cacheKey);
    if (cachedResponse) {
      // Set ETag header for cache validation
      const etag = this.generateETag(cachedResponse);
      response.setHeader('ETag', etag);
      response.setHeader('X-Cache', 'HIT');

      // Check if client has the same ETag (304 Not Modified)
      if (request.headers['if-none-match'] === etag) {
        response.status(304);
        return of(null);
      }

      return of(cachedResponse);
    }

    // If not cached, execute the handler and cache the response
    response.setHeader('X-Cache', 'MISS');

    return next.handle().pipe(
      tap(async (data) => {
        // Cache the response
        const ttlSeconds = cacheTTL ?? 0;
        const ttlMs = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : 0;
        await this.cacheService.set(cacheKey, data, { ttl: ttlMs });

        // Set ETag header
        const etag = this.generateETag(data);
        response.setHeader('ETag', etag);
      }),
    );
  }

  /**
   * Generate cache key from request URL and user
   */
  private generateCacheKey(request: Request): string {
    return `cache:${getUserId(request)}:${request.url}`;
  }

  /**
   * Generate ETag from response data
   */
  private generateETag(data: any): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `"${hash}"`;
  }
}
