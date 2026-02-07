import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { BulkUserService } from '../bulk-user/bulk-user.service';
import { BulkStudentService } from '../bulk-student/bulk-student.service';
import { BulkInstitutionService } from '../bulk-institution/bulk-institution.service';
import { BulkSelfInternshipService } from '../bulk-self-internship/bulk-self-internship.service';
import { BulkJobService } from './bulk-job.service';
import { BulkOperationJobData } from './bulk-queue.service';
import { BulkJobType } from '../../generated/prisma/client';

@Processor('bulk-operations', {
  concurrency: 2, // Process 2 jobs at a time
})
export class BulkProcessor extends WorkerHost {
  private readonly logger = new Logger(BulkProcessor.name);

  constructor(
    private readonly bulkUserService: BulkUserService,
    private readonly bulkStudentService: BulkStudentService,
    private readonly bulkInstitutionService: BulkInstitutionService,
    @Inject(forwardRef(() => BulkSelfInternshipService))
    private readonly bulkSelfInternshipService: BulkSelfInternshipService,
    private readonly bulkJobService: BulkJobService,
  ) {
    super();
  }

  async process(job: Job<BulkOperationJobData, any, string>): Promise<any> {
    const { bulkJobId, type, data, institutionId, createdById, fileName } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Processing bulk operation job: ${job.name} (ID: ${job.id}, BulkJob: ${bulkJobId})`,
    );

    try {
      // Mark job as started using the database bulkJobId
      await this.bulkJobService.markAsStartedById(bulkJobId);

      let result: any;

      switch (job.name) {
        case 'bulk-upload-users':
          result = await this.processBulkUserUpload(job, data, institutionId, createdById);
          break;

        case 'bulk-upload-students':
          result = await this.processBulkStudentUpload(job, data, institutionId, createdById);
          break;

        case 'bulk-upload-institutions':
          result = await this.processBulkInstitutionUpload(job, data, createdById);
          break;

        case 'bulk-upload-self-internships':
          result = await this.processBulkSelfInternshipUpload(job, data, institutionId, createdById);
          break;

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
          throw new Error(`Unknown job type: ${job.name}`);
      }

      const processingTime = Date.now() - startTime;

      // Mark job as completed using bulkJobId
      await this.bulkJobService.markAsCompletedById(bulkJobId, {
        successCount: result.success,
        failedCount: result.failed,
        successReport: result.successRecords,
        errorReport: result.failedRecords,
        warnings: result.warnings,
        processingTime,
      });

      this.logger.log(
        `Bulk operation completed: ${job.name} - ${result.success} success, ${result.failed} failed in ${processingTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}: ${error.message}`, error.stack);

      // Mark job as failed using bulkJobId
      await this.bulkJobService.markAsFailedById(bulkJobId, error.message);

      throw error;
    }
  }

  /**
   * Process bulk user upload job with progress updates
   */
  private async processBulkUserUpload(
    job: Job,
    users: any[],
    institutionId: string,
    createdBy: string,
  ) {
    this.logger.log(
      `Processing bulk user upload: ${users.length} users for institution ${institutionId}`,
    );

    // Update progress at 10%
    await this.updateJobProgress(job, 10);

    const result = await this.bulkUserService.bulkUploadUsers(users, institutionId, createdBy);

    // Update progress to 100%
    await this.updateJobProgress(job, 100);

    return result;
  }

  /**
   * Process bulk student upload job with progress updates
   */
  private async processBulkStudentUpload(
    job: Job,
    students: any[],
    institutionId: string,
    createdBy: string,
  ) {
    this.logger.log(
      `Processing bulk student upload: ${students.length} students for institution ${institutionId}`,
    );

    await this.updateJobProgress(job, 10);

    const result = await this.bulkStudentService.bulkUploadStudents(
      students,
      institutionId,
      createdBy,
    );

    await this.updateJobProgress(job, 100);

    return result;
  }

  /**
   * Process bulk institution upload job with progress updates
   */
  private async processBulkInstitutionUpload(job: Job, institutions: any[], createdBy: string) {
    this.logger.log(`Processing bulk institution upload: ${institutions.length} institutions`);

    await this.updateJobProgress(job, 10);

    const result = await this.bulkInstitutionService.bulkUploadInstitutions(institutions, createdBy);

    await this.updateJobProgress(job, 100);

    return result;
  }

  /**
   * Process bulk self-identified internship upload job
   */
  private async processBulkSelfInternshipUpload(
    job: Job,
    internships: any[],
    institutionId: string,
    createdBy: string,
  ) {
    this.logger.log(
      `Processing bulk self-identified internship upload: ${internships.length} internships`,
    );

    await this.updateJobProgress(job, 10);

    const result = await this.bulkSelfInternshipService.bulkUploadInternships(
      internships,
      institutionId,
      createdBy,
    );

    await this.updateJobProgress(job, 100);

    return result;
  }

  /**
   * Helper to update job progress in both BullMQ and database
   */
  private async updateJobProgress(job: Job, progress: number) {
    await job.updateProgress(progress);

    const bulkJobId = job.data?.bulkJobId;
    const totalRows = job.data?.data?.length || 0;
    const processedRows = Math.floor((progress / 100) * totalRows);

    if (progress > 0 && progress < 100 && bulkJobId) {
      await this.bulkJobService.updateProgressById(bulkJobId, processedRows, totalRows);
    }
  }

  /**
   * Event handlers for job lifecycle
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number | object) {
    this.logger.debug(`Job ${job.id} progress: ${JSON.stringify(progress)}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} is now active`);
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} has stalled`);
  }
}
