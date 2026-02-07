import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../generated/prisma/client';

/**
 * Audit Retention Configuration
 */
const RETENTION_CONFIG = {
  // Days to retain audit logs (default 180 days per CERT-In guidelines)
  retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '180', 10),
  // Batch size for deletion
  batchSize: 1000,
  // Enable/disable retention cleanup
  enabled: process.env.AUDIT_RETENTION_ENABLED !== 'false',
};

/**
 * Audit Retention Service
 * Handles automatic cleanup of old audit logs per retention policy
 * - Default: 180 days (CERT-In guideline)
 * - Runs daily at 2 AM
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Daily cleanup of old audit logs
   * Runs at 2:00 AM every day
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldLogs() {
    if (!RETENTION_CONFIG.enabled) {
      return;
    }

    this.logger.log('Starting audit log retention cleanup...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_CONFIG.retentionDays);

      // Count logs to be deleted
      const count = await this.prisma.auditLog.count({
        where: { timestamp: { lt: cutoffDate } },
      });

      if (count === 0) {
        this.logger.log('No old audit logs to clean up');
        return;
      }

      this.logger.log(
        `Found ${count} audit logs older than ${RETENTION_CONFIG.retentionDays} days`,
      );

      // Delete in batches to avoid memory issues
      let totalDeleted = 0;

      while (totalDeleted < count) {
        const deleted = await this.prisma.auditLog.deleteMany({
          where: { timestamp: { lt: cutoffDate } },
        });

        totalDeleted += deleted.count;

        if (deleted.count === 0) break;

        this.logger.debug(`Deleted batch of ${deleted.count} logs`);
      }

      this.logger.log(
        `Audit log cleanup complete. Deleted ${totalDeleted} logs older than ${RETENTION_CONFIG.retentionDays} days`,
      );

      // Log the cleanup action itself
      await this.prisma.auditLog.create({
        data: {
          action: AuditAction.SYSTEM_BACKUP, // Using SYSTEM_BACKUP for system maintenance actions
          entityType: 'AuditLog',
          userRole: Role.SYSTEM_ADMIN,
          description: `Automatic cleanup: Deleted ${totalDeleted} audit logs older than ${RETENTION_CONFIG.retentionDays} days`,
          category: AuditCategory.SYSTEM,
          severity: AuditSeverity.LOW,
          newValues: {
            deletedCount: totalDeleted,
            retentionDays: RETENTION_CONFIG.retentionDays,
            cutoffDate: cutoffDate.toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error('Audit log cleanup failed', error.stack);
    }
  }

  /**
   * Manual cleanup trigger (for admin use)
   */
  async manualCleanup(olderThanDays?: number): Promise<{
    deletedCount: number;
    cutoffDate: Date;
  }> {
    const days = olderThanDays || RETENTION_CONFIG.retentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    });

    this.logger.log(`Manual cleanup: Deleted ${result.count} logs older than ${days} days`);

    return {
      deletedCount: result.count,
      cutoffDate,
    };
  }

  /**
   * Get retention statistics
   */
  async getRetentionStats(): Promise<{
    totalLogs: number;
    logsToBeDeleted: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    retentionDays: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_CONFIG.retentionDays);

    const [totalLogs, logsToBeDeleted, oldest, newest] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({ where: { timestamp: { lt: cutoffDate } } }),
      this.prisma.auditLog.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      }),
      this.prisma.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
    ]);

    return {
      totalLogs,
      logsToBeDeleted,
      oldestLogDate: oldest?.timestamp || null,
      newestLogDate: newest?.timestamp || null,
      retentionDays: RETENTION_CONFIG.retentionDays,
    };
  }

  /**
   * Get current retention configuration
   */
  getConfig() {
    return RETENTION_CONFIG;
  }
}
