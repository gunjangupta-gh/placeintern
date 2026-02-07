import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('file-processing') private fileProcessingQueue: Queue,
    @InjectQueue('data-sync') private dataSyncQueue: Queue,
    @InjectQueue('bulk-operations') private bulkOperationsQueue: Queue,
  ) {}

  async addEmailJob(data: QueueJobData, options?: JobsOptions): Promise<Job> {
    return this.emailQueue.add('send-email', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    });
  }

  async addNotificationJob(data: QueueJobData, options?: JobsOptions): Promise<Job> {
    return this.notificationsQueue.add('send-notification', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...options,
    });
  }

  async addFileProcessingJob(data: QueueJobData, options?: JobsOptions): Promise<Job> {
    return this.fileProcessingQueue.add('process-file', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      ...options,
    });
  }

  async addDataSyncJob(data: QueueJobData, options?: JobsOptions): Promise<Job> {
    return this.dataSyncQueue.add('sync-data', data, {
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
      ...options,
    });
  }

  async addBulkOperationJob(data: QueueJobData, options?: JobsOptions): Promise<Job> {
    return this.bulkOperationsQueue.add('bulk-operation', data, {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      ...options,
    });
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: QueueJobData,
    options?: JobsOptions,
  ): Promise<Job> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, options);
  }

  async getJob(queueName: string, jobId: string): Promise<Job | undefined> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
    }
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
  }

  async obliterateQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.obliterate();
  }

  async getQueueStats(queueName: string) {
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
