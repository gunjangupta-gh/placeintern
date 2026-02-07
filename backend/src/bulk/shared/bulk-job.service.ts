import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { BulkJobType, BulkJobStatus } from '../../generated/prisma/client';
import {
  CreateBulkJobDto,
  UpdateBulkJobDto,
  BulkJobListQueryDto,
  BulkJobListResponseDto,
} from './dto/bulk-job.dto';

@Injectable()
export class BulkJobService {
  private readonly logger = new Logger(BulkJobService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new bulk job record
   */
  async createJob(jobId: string, data: CreateBulkJobDto) {
    this.logger.log(`Creating bulk job record for jobId: ${jobId}`);

    const job = await this.prisma.bulkJob.create({
      data: {
        jobId,
        type: data.type,
        status: BulkJobStatus.QUEUED,
        fileName: data.fileName,
        fileSize: data.fileSize,
        originalName: data.originalName,
        totalRows: data.totalRows,
        institutionId: data.institutionId,
        createdById: data.createdById,
      },
    });

    this.logger.log(`Bulk job record created: ${job.id}`);
    return job;
  }

  /**
   * Update job status and progress
   */
  async updateJob(jobId: string, data: UpdateBulkJobDto) {
    const job = await this.prisma.bulkJob.findUnique({
      where: { jobId },
    });

    if (!job) {
      throw new NotFoundException(`Bulk job not found: ${jobId}`);
    }

    const updatedJob = await this.prisma.bulkJob.update({
      where: { jobId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Bulk job updated: ${jobId}, status: ${updatedJob.status}`);
    return updatedJob;
  }

  /**
   * Mark job as started (by jobId field)
   */
  async markAsStarted(jobId: string) {
    return this.updateJob(jobId, {
      status: BulkJobStatus.PROCESSING,
      startedAt: new Date(),
    });
  }

  /**
   * Mark job as started (by database ID)
   */
  async markAsStartedById(id: string) {
    return this.prisma.bulkJob.update({
      where: { id },
      data: {
        status: BulkJobStatus.PROCESSING,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark job as completed with results (by jobId field)
   */
  async markAsCompleted(
    jobId: string,
    results: {
      successCount: number;
      failedCount: number;
      successReport?: any;
      errorReport?: any;
      warnings?: any;
      processingTime: number;
    },
  ) {
    return this.updateJob(jobId, {
      status: BulkJobStatus.COMPLETED,
      completedAt: new Date(),
      processedRows: results.successCount + results.failedCount,
      successCount: results.successCount,
      failedCount: results.failedCount,
      successReport: results.successReport,
      errorReport: results.errorReport,
      warnings: results.warnings,
      processingTime: results.processingTime,
      progress: 100,
    });
  }

  /**
   * Mark job as completed with results (by database ID)
   */
  async markAsCompletedById(
    id: string,
    results: {
      successCount: number;
      failedCount: number;
      successReport?: any;
      errorReport?: any;
      warnings?: any;
      processingTime: number;
    },
  ) {
    return this.prisma.bulkJob.update({
      where: { id },
      data: {
        status: BulkJobStatus.COMPLETED,
        completedAt: new Date(),
        processedRows: results.successCount + results.failedCount,
        successCount: results.successCount,
        failedCount: results.failedCount,
        successReport: results.successReport,
        errorReport: results.errorReport,
        warnings: results.warnings,
        processingTime: results.processingTime,
        progress: 100,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark job as failed (by jobId field)
   */
  async markAsFailed(jobId: string, errorMessage: string) {
    const job = await this.prisma.bulkJob.findUnique({
      where: { jobId },
    });

    return this.updateJob(jobId, {
      status: BulkJobStatus.FAILED,
      completedAt: new Date(),
      errorMessage,
      retryCount: (job?.retryCount || 0) + 1,
    });
  }

  /**
   * Mark job as failed (by database ID)
   */
  async markAsFailedById(id: string, errorMessage: string) {
    const job = await this.prisma.bulkJob.findUnique({
      where: { id },
    });

    return this.prisma.bulkJob.update({
      where: { id },
      data: {
        status: BulkJobStatus.FAILED,
        completedAt: new Date(),
        errorMessage,
        retryCount: (job?.retryCount || 0) + 1,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update progress during processing (by jobId field)
   */
  async updateProgress(jobId: string, processedRows: number, totalRows: number) {
    const progress = Math.round((processedRows / totalRows) * 100);
    return this.updateJob(jobId, {
      processedRows,
      progress,
    });
  }

  /**
   * Update progress during processing (by database ID)
   */
  async updateProgressById(id: string, processedRows: number, totalRows: number) {
    const progress = Math.round((processedRows / totalRows) * 100);
    return this.prisma.bulkJob.update({
      where: { id },
      data: {
        processedRows,
        progress,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get job by ID
   */
  async getJobById(id: string) {
    const job = await this.prisma.bulkJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Bulk job not found: ${id}`);
    }

    return job;
  }

  /**
   * Get job by BullMQ job ID
   */
  async getJobByJobId(jobId: string) {
    const job = await this.prisma.bulkJob.findUnique({
      where: { jobId },
    });

    if (!job) {
      throw new NotFoundException(`Bulk job not found: ${jobId}`);
    }

    return job;
  }

  /**
   * List jobs with filtering and pagination
   * STATE_DIRECTORATE: Can see all jobs (pass null/empty institutionId)
   * PRINCIPAL: Can only see their institution's jobs
   */
  async listJobs(
    institutionId: string | null,
    query: BulkJobListQueryDto,
  ): Promise<BulkJobListResponseDto> {
    const { type, status, page = 1, limit = 10, fromDate, toDate } = query;

    const where: any = {};

    // Only filter by institution if provided (PRINCIPAL role)
    // STATE_DIRECTORATE passes null to see all jobs
    if (institutionId && institutionId !== '' && institutionId !== 'SYSTEM') {
      where.institutionId = institutionId;
    }

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    const [jobs, total] = await Promise.all([
      this.prisma.bulkJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.bulkJob.count({ where }),
    ]);

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get jobs by user
   */
  async getJobsByUser(userId: string, limit = 10) {
    return this.prisma.bulkJob.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get active jobs (queued or processing)
   * STATE_DIRECTORATE: Pass null to see all active jobs
   * PRINCIPAL: Pass institutionId to see only their institution's jobs
   */
  async getActiveJobs(institutionId: string | null) {
    const where: any = {
      status: {
        in: [BulkJobStatus.QUEUED, BulkJobStatus.PROCESSING],
      },
    };

    // Only filter by institution if provided
    if (institutionId && institutionId !== '' && institutionId !== 'SYSTEM') {
      where.institutionId = institutionId;
    }

    return this.prisma.bulkJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, userId: string) {
    const job = await this.getJobByJobId(jobId);

    if (job.status !== BulkJobStatus.QUEUED) {
      throw new Error('Only queued jobs can be cancelled');
    }

    return this.updateJob(jobId, {
      status: BulkJobStatus.CANCELLED,
      completedAt: new Date(),
      errorMessage: `Cancelled by user`,
    });
  }

  /**
   * Get job statistics for an institution
   * STATE_DIRECTORATE: Pass null to see stats for all jobs
   * PRINCIPAL: Pass institutionId to see only their institution's stats
   */
  async getJobStats(institutionId: string | null) {
    const where: any = {};

    // Only filter by institution if provided
    if (institutionId && institutionId !== '' && institutionId !== 'SYSTEM') {
      where.institutionId = institutionId;
    }

    const [total, byStatus, byType, recentJobs] = await Promise.all([
      this.prisma.bulkJob.count({ where }),
      this.prisma.bulkJob.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.bulkJob.groupBy({
        by: ['type'],
        where,
        _count: { type: true },
      }),
      this.prisma.bulkJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          status: true,
          fileName: true,
          totalRows: true,
          successCount: true,
          failedCount: true,
          progress: true,
          createdAt: true,
        },
      }),
    ]);

    const statusCounts = byStatus.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    const typeCounts = byType.reduce(
      (acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      byStatus: statusCounts,
      byType: typeCounts,
      recentJobs,
    };
  }

  /**
   * Cleanup old completed jobs (older than 30 days)
   */
  async cleanupOldJobs(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.prisma.bulkJob.deleteMany({
      where: {
        status: {
          in: [BulkJobStatus.COMPLETED, BulkJobStatus.FAILED, BulkJobStatus.CANCELLED],
        },
        completedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old bulk jobs`);
    return result.count;
  }
}
