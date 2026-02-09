import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';

export interface QueueJobData {
  [key: string]: any;
}

// Queue names - simple names for DragonflyDB compatibility
const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  FILE_PROCESSING: 'file-processing',
  DATA_SYNC: 'data-sync',
  BULK_OPERATIONS: 'bulk-operations',
} as const;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private redisAvailable = true;

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('file-processing') private fileProcessingQueue: Queue,
    @InjectQueue('data-sync') private dataSyncQueue: Queue,
    @InjectQueue('bulk-operations') private bulkOperationsQueue: Queue,
  ) {
    // Check Redis availability on init
    this.checkRedisConnection();
  }

  private async checkRedisConnection() {
    try {
      const client = await this.emailQueue.client;
      await client.ping();
      this.redisAvailable = true;
    } catch (error) {
      this.redisAvailable = false;
      this.logger.warn('Redis is not available. Queue operations will be disabled.');
    }
  }

  async addEmailJob(data: QueueJobData, options?: JobsOptions): Promise<Job | null> {
    if (!this.redisAvailable) {
      this.logger.warn('Skipping email job - Redis unavailable');
      return null;
    }
    try {
      return await this.emailQueue.add('send-email', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to add email job', error);
      return null;
    }
  }

  async addNotificationJob(data: QueueJobData, options?: JobsOptions): Promise<Job | null> {
    if (!this.redisAvailable) {
      this.logger.warn('Skipping notification job - Redis unavailable');
      return null;
    }
    try {
      return await this.notificationsQueue.add('send-notification', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to add notification job', error);
      return null;
    }
  }

  async addFileProcessingJob(data: QueueJobData, options?: JobsOptions): Promise<Job | null> {
    if (!this.redisAvailable) {
      this.logger.warn('Skipping file processing job - Redis unavailable');
      return null;
    }
    try {
      return await this.fileProcessingQueue.add('process-file', data, {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to add file processing job', error);
      return null;
    }
  }

  async addDataSyncJob(data: QueueJobData, options?: JobsOptions): Promise<Job | null> {
    if (!this.redisAvailable) {
      this.logger.warn('Skipping data sync job - Redis unavailable');
      return null;
    }
    try {
      return await this.dataSyncQueue.add('sync-data', data, {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to add data sync job', error);
      return null;
    }
  }

  async addBulkOperationJob(data: QueueJobData, options?: JobsOptions): Promise<Job | null> {
    if (!this.redisAvailable) {
      this.logger.warn('Skipping bulk operation job - Redis unavailable');
      return null;
    }
    try {
      return await this.bulkOperationsQueue.add('bulk-operation', data, {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        ...options,
      });
    } catch (error) {
      this.logger.error('Failed to add bulk operation job', error);
      return null;
    }
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: QueueJobData,
    options?: JobsOptions,
  ): Promise<Job | null> {
    if (!this.redisAvailable) {
      this.logger.warn(`Skipping job ${jobName} - Redis unavailable`);
      return null;
    }
    try {
      const queue = this.getQueue(queueName);
      return await queue.add(jobName, data, options);
    } catch (error) {
      this.logger.error(`Failed to add job ${jobName}`, error);
      return null;
    }
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    if (!this.redisAvailable) {
      return undefined;
    }
    try {
      const queue = this.getQueue(queueName);
      return await queue.getJob(jobId);
    } catch (error) {
      this.logger.error(`Failed to get job ${jobId}`, error);
      return undefined;
    }
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    if (!this.redisAvailable) {
      return;
    }
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      this.logger.error(`Failed to remove job ${jobId}`, error);
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    if (!this.redisAvailable) {
      return;
    }
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}`, error);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    if (!this.redisAvailable) {
      return;
    }
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
    } catch (error) {
      this.logger.error(`Failed to resume queue ${queueName}`, error);
    }
  }

  async drainQueue(queueName: string): Promise<void> {
    if (!this.redisAvailable) {
      return;
    }
    try {
      const queue = this.getQueue(queueName);
      await queue.drain();
    } catch (error) {
      this.logger.error(`Failed to drain queue ${queueName}`, error);
    }
  }

  async obliterateQueue(queueName: string): Promise<void> {
    if (!this.redisAvailable) {
      return;
    }
    try {
      const queue = this.getQueue(queueName);
      await queue.obliterate();
    } catch (error) {
      this.logger.error(`Failed to obliterate queue ${queueName}`, error);
    }
  }

  async getQueueStats(queueName: string) {
    if (!this.redisAvailable) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
    try {
      const queue = this.getQueue(queueName);
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats for ${queueName}`, error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  private getQueue(queueName: string): Queue {
    // Normalize queue name - accept both with and without hash tags
    const normalizedName = queueName.replace(/^\{|\}$/g, '');

    switch (normalizedName) {
      case 'email':
        return this.emailQueue;
      case 'notifications':
        return this.notificationsQueue;
      case 'file-processing':
        return this.fileProcessingQueue;
      case 'data-sync':
        return this.dataSyncQueue;
      case 'bulk-operations':
        return this.bulkOperationsQueue;
      default:
        throw new Error(`Queue ${queueName} not found`);
    }
  }
}
