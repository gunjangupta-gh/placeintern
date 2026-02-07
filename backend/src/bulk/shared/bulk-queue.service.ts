import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { BulkJobType, BulkJobStatus } from '../../generated/prisma/client';
import { BulkJobService } from './bulk-job.service';
import { QueueJobResponseDto } from './dto/bulk-job.dto';
import { PrismaService } from '../../core/database/prisma.service';

export interface BulkOperationJobData {
  bulkJobId: string;
  type: BulkJobType;
  data: any; // Parsed file data
  institutionId: string;
  createdById: string;
  fileName: string;
}

@Injectable()
export class BulkQueueService {
  private readonly logger = new Logger(BulkQueueService.name);

  constructor(
    @InjectQueue('bulk-operations') private readonly bulkQueue: Queue,
    private readonly bulkJobService: BulkJobService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Queue a bulk student upload job
   */
  async queueStudentUpload(
    students: any[],
    institutionId: string,
    createdById: string,
    fileName: string,
    fileSize: number,
  ): Promise<QueueJobResponseDto> {
    return this.queueBulkOperation({
      type: BulkJobType.STUDENTS,
      data: students,
      institutionId,
      createdById,
      fileName,
      fileSize,
      totalRows: students.length,
      jobName: 'bulk-upload-students',
    });
  }

  /**
   * Queue a bulk user upload job
   */
  async queueUserUpload(
    users: any[],
    institutionId: string,
    createdById: string,
    fileName: string,
    fileSize: number,
  ): Promise<QueueJobResponseDto> {
    return this.queueBulkOperation({
      type: BulkJobType.USERS,
      data: users,
      institutionId,
      createdById,
      fileName,
      fileSize,
      totalRows: users.length,
      jobName: 'bulk-upload-users',
    });
  }

  /**
   * Queue a bulk institution upload job
   */
  async queueInstitutionUpload(
    institutions: any[],
    createdById: string,
    fileName: string,
    fileSize: number,
    institutionId: string = 'SYSTEM', // For state-level uploads
  ): Promise<QueueJobResponseDto> {
    return this.queueBulkOperation({
      type: BulkJobType.INSTITUTIONS,
      data: institutions,
      institutionId,
      createdById,
      fileName,
      fileSize,
      totalRows: institutions.length,
      jobName: 'bulk-upload-institutions',
    });
  }

  /**
   * Queue a bulk self-identified internship upload job
   */
  async queueSelfInternshipUpload(
    internships: any[],
    institutionId: string,
    createdById: string,
    fileName: string,
    fileSize: number,
  ): Promise<QueueJobResponseDto> {
    return this.queueBulkOperation({
      type: BulkJobType.SELF_INTERNSHIPS,
      data: internships,
      institutionId,
      createdById,
      fileName,
      fileSize,
      totalRows: internships.length,
      jobName: 'bulk-upload-self-internships',
    });
  }

  /**
   * Generic method to queue bulk operations
   * FIXED: Now properly persists BullMQ job ID to database
   */
  private async queueBulkOperation(params: {
    type: BulkJobType;
    data: any[];
    institutionId: string;
    createdById: string;
    fileName: string;
    fileSize: number;
    totalRows: number;
    jobName: string;
  }): Promise<QueueJobResponseDto> {
    const {
      type,
      data,
      institutionId,
      createdById,
      fileName,
      fileSize,
      totalRows,
      jobName,
    } = params;

    // Generate a temporary job ID
    const tempJobId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // First, create a job record in the database with temp ID
    const bulkJob = await this.prisma.bulkJob.create({
      data: {
        jobId: tempJobId,
        type,
        status: BulkJobStatus.QUEUED,
        fileName,
        fileSize,
        totalRows,
        institutionId,
        createdById,
      },
    });

    try {
      // Add job to the queue
      const queueJob = await this.bulkQueue.add(
        jobName,
        {
          bulkJobId: bulkJob.id,
          type,
          data,
          institutionId,
          createdById,
          fileName,
        } as BulkOperationJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            count: 100,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 50,
          },
        },
      );

      // Create a unique job ID combining timestamp and BullMQ job ID to avoid conflicts
      const uniqueJobId = `${Date.now()}-${queueJob.id}`;

      // Update the database record with unique job ID
      await this.prisma.bulkJob.update({
        where: { id: bulkJob.id },
        data: { jobId: uniqueJobId },
      });

      this.logger.log(
        `Bulk operation queued: ${jobName}, bullMQJobId: ${queueJob.id}, bulkJobId: ${bulkJob.id}`,
      );

      return {
        success: true,
        message: `Bulk ${type.toLowerCase()} upload queued successfully`,
        jobId: uniqueJobId,
        bulkJobId: bulkJob.id,
        status: BulkJobStatus.QUEUED,
      };
    } catch (error) {
      // Mark the job as failed if queueing fails
      await this.prisma.bulkJob.update({
        where: { id: bulkJob.id },
        data: {
          status: BulkJobStatus.FAILED,
          errorMessage: `Failed to queue job: ${error.message}`,
          completedAt: new Date(),
        },
      });

      this.logger.error(`Failed to queue bulk operation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.bulkQueue.getWaitingCount(),
      this.bulkQueue.getActiveCount(),
      this.bulkQueue.getCompletedCount(),
      this.bulkQueue.getFailedCount(),
      this.bulkQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get job from queue
   */
  async getQueueJob(jobId: string): Promise<Job | null> {
    return this.bulkQueue.getJob(jobId);
  }

  /**
   * Pause the queue
   */
  async pauseQueue() {
    await this.bulkQueue.pause();
    this.logger.warn('Bulk operations queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue() {
    await this.bulkQueue.resume();
    this.logger.log('Bulk operations queue resumed');
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string) {
    const job = await this.bulkQueue.getJob(jobId);
    if (job) {
      await job.retry();
      this.logger.log(`Job ${jobId} queued for retry`);
      return true;
    }
    return false;
  }

  /**
   * Remove a job from queue
   */
  async removeJob(jobId: string) {
    const job = await this.bulkQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Job ${jobId} removed from queue`);
      return true;
    }
    return false;
  }
}
