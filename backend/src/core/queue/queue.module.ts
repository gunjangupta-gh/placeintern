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
          // Disable offline queue to prevent memory issues
          enableOfflineQueue: false,
          // Required for BullMQ compatibility
          maxRetriesPerRequest: null,
          // Connection timeouts - increased for DragonflyDB stability
          connectTimeout: 10000,
          commandTimeout: 10000,
          // DragonflyDB compatibility options
          enableReadyCheck: true,
          keepAlive: 30000, // Send keepalive every 30 seconds
          noDelay: true, // Disable Nagle's algorithm for lower latency
          // Retry strategy - stop after 10 attempts to prevent infinite retries
          retryStrategy: (times: number) => {
            if (times > 10) {
              return null; // Stop retrying
            }
            return Math.min(times * 1000, 30000); // Max 30 seconds
          },
        };

        return {
          connection,
          // Simple prefix for DragonflyDB compatibility
          prefix: 'bull',
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
