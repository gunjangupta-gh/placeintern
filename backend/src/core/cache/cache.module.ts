import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheService } from './cache.service';
import { LruCacheService } from './lru-cache.service';
import { CacheWarmerService } from './cache-warmer.service';
import { CacheInterceptor } from './cache.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SharedModule } from '../../api/shared/shared.module';

// Consolidated cache module using LruCacheService with L1 (local) + L2 (Redis/DragonflyDB)
// Removed redundant NestCacheModule - LruCacheService already manages Redis via ioredis
@Global()
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    forwardRef(() => SharedModule), // For LookupService in CacheWarmerService
  ],
  providers: [
    CacheService,
    LruCacheService,
    CacheWarmerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [CacheService, LruCacheService, CacheWarmerService],
})
export class CacheModule {}
