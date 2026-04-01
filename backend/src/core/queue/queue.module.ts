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
        // Prefer explicit write endpoint to avoid replica READONLY errors.
        const redisWriteUrl =
          configService.get<string>('REDIS_QUEUE_URL') ||
          configService.get<string>('REDIS_MASTER_URL') ||
          configService.get<string>('REDIS_URL');

        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisUsername = configService.get<string>('REDIS_USERNAME');
        const redisDb = configService.get<number>('REDIS_DB');
        const queuePrefix = configService.get<string>('QUEUE_PREFIX', 'bull');

        const connection: any = redisWriteUrl
          ? {
              ...(() => {
                try {
                  const parsed = new URL(redisWriteUrl);
                  return {
                    host: parsed.hostname,
                    port: parsed.port ? Number(parsed.port) : 6379,
                    username: parsed.username || redisUsername || undefined,
                    password:
                      parsed.password || redisPassword || undefined,
                    db:
                      parsed.pathname && parsed.pathname !== '/'
                        ? Number(parsed.pathname.replace('/', '')) || redisDb || 0
                        : redisDb || 0,
                    tls: parsed.protocol === 'rediss:' ? {} : undefined,
                  };
                } catch {
                  queueLogger.warn('Invalid REDIS_QUEUE_URL/REDIS_MASTER_URL/REDIS_URL. Falling back to REDIS_HOST/REDIS_PORT.');
                  return {
                    host: redisHost,
                    port: redisPort,
                    username: redisUsername || undefined,
                    password: redisPassword || undefined,
                    db: redisDb || 0,
                  };
                }
              })(),
            }
          : {
              host: redisHost,
              port: redisPort,
              username: redisUsername || undefined,
              password: redisPassword || undefined,
              db: redisDb || 0,
            };

        Object.assign(connection, {
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
        });

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
