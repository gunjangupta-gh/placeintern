import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { RedlockService } from './redlock.service';

// Default job options for all queues
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: true,
  removeOnFail: false,
};

// Track Redis error state to prevent log spam
let redisErrorLogged = false;
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 5 * 60 * 1000; // 5 minutes

const queueLogger = new Logger('QueueModule');

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // Use host/port configuration directly (most compatible with DragonflyDB)
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        const connection: any = {
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          // Enable offline queue in development to prevent errors when Redis is unavailable
          enableOfflineQueue: process.env.NODE_ENV === 'production' ? false : true,
          // Required for BullMQ compatibility
          maxRetriesPerRequest: null,
          // Connection timeouts - increased for DragonflyDB stability
          connectTimeout: 10000,
          commandTimeout: 10000,
          // DragonflyDB compatibility options
          enableReadyCheck: true,
          keepAlive: 30000, // Send keepalive every 30 seconds
          noDelay: true, // Disable Nagle's algorithm for lower latency
          // Retry strategy - stop after fewer attempts in development
          retryStrategy: (times: number) => {
            const maxRetries = process.env.NODE_ENV === 'production' ? 10 : 3;
            if (times > maxRetries) {
              if (times === maxRetries + 1) {
                queueLogger.warn(`Redis connection failed after ${maxRetries} attempts. Queues will be disabled.`);
              }
              return null; // Stop retrying
            }
            return Math.min(times * 1000, 30000); // Max 30 seconds
          },
          // Suppress errors when Redis is unavailable in development
          lazyConnect: process.env.NODE_ENV !== 'production',
        };

        return {
          connection,
          // Prefix is configurable to isolate environments/workers on shared Redis.
          prefix: queuePrefix,
        };
      },
    }),
    // Queue registration with simple names for DragonflyDB compatibility
    BullModule.registerQueue(
      {
        name: 'email',
        defaultJobOptions,
      },
      {
        name: 'notifications',
        defaultJobOptions: {
          ...defaultJobOptions,
          removeOnComplete: 50, // Keep fewer completed jobs for notifications
        },
      },
      {
        name: 'file-processing',
        defaultJobOptions,
      },
      {
        name: 'data-sync',
        defaultJobOptions,
      },
      {
        name: 'bulk-operations',
        defaultJobOptions,
      },
      {
        name: 'report-generation',
        defaultJobOptions,
      },
      {
        name: 'dead-letter',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        },
      },
      {
        name: 'mail',
        defaultJobOptions,
      },
    ),
  ],
  providers: [QueueService, RedlockService],
  exports: [QueueService, RedlockService, BullModule],
})
export class QueueModule {}
