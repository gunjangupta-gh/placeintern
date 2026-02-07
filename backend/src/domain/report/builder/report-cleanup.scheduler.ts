import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportBuilderService } from './report-builder.service';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class ReportCleanupScheduler {
  private readonly logger = new Logger(ReportCleanupScheduler.name);

  constructor(
    private reportBuilderService: ReportBuilderService,
    private prisma: PrismaService,
  ) {}

  /**
   * Clean up expired reports daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredReports(): Promise<void> {
    this.logger.log('Starting cleanup of expired reports');
    try {
      const result = await this.reportBuilderService.cleanupExpiredReports();
      this.logger.log(`Cleaned up ${result.count} expired reports`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired reports', error.stack);
    }
  }

  /**
   * Clean up stale processing reports (stuck for more than 1 hour)
   * Runs every 30 minutes
   */
  @Cron('0 */30 * * * *')
  async cleanupStaleReports(): Promise<void> {
    this.logger.log('Checking for stale processing reports');
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Find stale reports first
      const staleReports = await this.prisma.generatedReport.findMany({
        where: {
          status: 'processing',
          createdAt: { lt: oneHourAgo },
        },
        select: { id: true },
      });

      // Update each one individually (avoids MongoDB replica set requirement)
      let updatedCount = 0;
      for (const report of staleReports) {
        try {
          await this.prisma.generatedReport.update({
            where: { id: report.id },
            data: {
              status: 'failed',
              errorMessage: 'Report processing timed out after 1 hour',
            },
          });
          updatedCount++;
        } catch (updateError) {
          this.logger.warn(`Failed to update stale report ${report.id}: ${updateError.message}`);
        }
      }

      if (updatedCount > 0) {
        this.logger.warn(`Marked ${updatedCount} stale reports as failed`);
      }
    } catch (error) {
      // Handle MongoDB replica set limitation gracefully
      if (error.code === 'P2031') {
        this.logger.warn('Stale report cleanup skipped: MongoDB replica set not configured');
      } else {
        this.logger.error('Failed to cleanup stale reports', error.stack);
      }
    }
  }

  /**
   * Clean up old failed/cancelled reports (older than 30 days)
   * Runs weekly on Sunday at 4 AM
   */
  @Cron('0 0 4 * * 0')
  async cleanupOldFailedReports(): Promise<void> {
    this.logger.log('Cleaning up old failed/cancelled reports');
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Find old reports first
      const oldReports = await this.prisma.generatedReport.findMany({
        where: {
          status: { in: ['failed', 'cancelled'] },
          createdAt: { lt: thirtyDaysAgo },
        },
        select: { id: true },
      });

      // Delete each one individually (avoids MongoDB replica set requirement)
      let deletedCount = 0;
      for (const report of oldReports) {
        try {
          await this.prisma.generatedReport.delete({
            where: { id: report.id },
          });
          deletedCount++;
        } catch (deleteError) {
          this.logger.warn(`Failed to delete old report ${report.id}: ${deleteError.message}`);
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Deleted ${deletedCount} old failed/cancelled reports`);
      }
    } catch (error) {
      // Handle MongoDB replica set limitation gracefully
      if (error.code === 'P2031') {
        this.logger.warn('Old report cleanup skipped: MongoDB replica set not configured');
      } else {
        this.logger.error('Failed to cleanup old failed reports', error.stack);
      }
    }
  }
}
