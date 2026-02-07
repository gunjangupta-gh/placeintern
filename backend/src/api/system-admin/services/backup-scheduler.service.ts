import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import { BackupService } from './backup.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import { AdminChannel } from '../../../infrastructure/websocket/dto';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { StorageType } from '../dto/backup.dto';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../../generated/prisma/client';
import { CronJob } from 'cron';

export interface BackupScheduleConfig {
  id: string;
  name: string;
  cronExpression: string;
  storageType: StorageType;
  retentionDays: number;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  createdAt: Date;
  createdById: string;
}

@Injectable()
export class BackupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private schedules: Map<string, BackupScheduleConfig> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: BackupService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly wsService: WebSocketService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.loadSchedulesFromDatabase();
  }

  /**
   * Default daily backup at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'default-daily-backup' })
  async handleDefaultDailyBackup() {
    this.logger.log('Running default daily scheduled backup');
    await this.executeScheduledBackup('default-daily', StorageType.BOTH);
  }

  /**
   * Load backup schedules from database
   */
  private async loadSchedulesFromDatabase() {
    try {
      const configs = await this.prisma.backupSchedule.findMany({
        where: { isActive: true },
      });

      for (const config of configs) {
        this.registerSchedule({
          id: config.id,
          name: config.name,
          cronExpression: config.cronExpression,
          storageType: config.storageType as StorageType,
          retentionDays: config.retentionDays,
          isActive: config.isActive,
          lastRun: config.lastRun || undefined,
          createdAt: config.createdAt,
          createdById: config.createdById,
        });
      }

      this.logger.log(`Loaded ${configs.length} backup schedules from database`);
    } catch (error) {
      this.logger.warn('Could not load backup schedules, table may not exist yet');
    }
  }

  /**
   * Register a new backup schedule
   */
  private registerSchedule(config: BackupScheduleConfig) {
    const jobName = `backup-schedule-${config.id}`;

    try {
      // Remove existing job if present
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
      }

      const job = new CronJob(config.cronExpression, async () => {
        this.logger.log(`Running scheduled backup: ${config.name}`);
        await this.executeScheduledBackup(config.id, config.storageType);
      });

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();

      this.schedules.set(config.id, {
        ...config,
        nextRun: job.nextDate().toJSDate(),
      });

      this.logger.log(`Registered backup schedule: ${config.name} (${config.cronExpression})`);
    } catch (error) {
      this.logger.error(`Failed to register backup schedule: ${config.name}`, error);
    }
  }

  /**
   * Execute a scheduled backup
   */
  private async executeScheduledBackup(scheduleId: string, storageType: StorageType) {
    try {
      const result = await this.backupService.createBackup(
        {
          description: `Scheduled backup: ${scheduleId}`,
          storageType,
        },
        'system',
        Role.SYSTEM_ADMIN,
      );

      // Update last run time
      if (scheduleId !== 'default-daily') {
        await this.prisma.backupSchedule.update({
          where: { id: scheduleId },
          data: { lastRun: new Date() },
        });

        const schedule = this.schedules.get(scheduleId);
        if (schedule) {
          schedule.lastRun = new Date();
        }
      }

      // Cleanup old backups based on retention policy
      await this.cleanupOldBackups(scheduleId);

      // Notify admins
      this.wsService.sendToAdminChannel(AdminChannel.BACKUP, 'scheduledBackupComplete', {
        scheduleId,
        backupId: result.backup?.id,
        size: result.backup?.size,
        timestamp: new Date(),
      });

      this.logger.log(`Scheduled backup completed: ${scheduleId}`);
    } catch (error) {
      this.logger.error(`Scheduled backup failed: ${scheduleId}`, error);

      // Notify admins of failure
      this.wsService.sendToAdminChannel(AdminChannel.BACKUP, 'scheduledBackupFailed', {
        scheduleId,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Cleanup old backups based on retention policy
   */
  private async cleanupOldBackups(scheduleId: string) {
    try {
      const schedule = this.schedules.get(scheduleId);
      const retentionDays = schedule?.retentionDays || 30;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const oldBackups = await this.prisma.backupRecord.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          description: { contains: 'Scheduled backup' },
        },
      });

      for (const backup of oldBackups) {
        try {
          await this.backupService.deleteBackup(backup.id, 'system', Role.SYSTEM_ADMIN);
          this.logger.log(`Cleaned up old backup: ${backup.filename}`);
        } catch (error) {
          this.logger.warn(`Failed to cleanup backup ${backup.id}: ${error.message}`);
        }
      }

      if (oldBackups.length > 0) {
        this.logger.log(`Cleaned up ${oldBackups.length} old backups (retention: ${retentionDays} days)`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old backups', error);
    }
  }

  /**
   * Create a new backup schedule
   */
  async createSchedule(
    name: string,
    cronExpression: string,
    storageType: StorageType,
    retentionDays: number,
    userId: string,
    userRole: Role,
  ) {
    // Validate cron expression
    try {
      new CronJob(cronExpression, () => {});
    } catch (error) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const schedule = await this.prisma.backupSchedule.create({
      data: {
        name,
        cronExpression,
        storageType,
        retentionDays,
        isActive: true,
        createdById: userId,
      },
    });

    const config: BackupScheduleConfig = {
      id: schedule.id,
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      storageType: schedule.storageType as StorageType,
      retentionDays: schedule.retentionDays,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      createdById: schedule.createdById,
    };

    this.registerSchedule(config);

    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'BackupSchedule',
      entityId: schedule.id,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      description: `Created backup schedule: ${name} (${cronExpression})`,
    });

    return { schedule: config, message: 'Backup schedule created successfully' };
  }

  /**
   * Update a backup schedule
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<{ name: string; cronExpression: string; storageType: StorageType; retentionDays: number; isActive: boolean }>,
    userId: string,
    userRole: Role,
  ) {
    if (updates.cronExpression) {
      try {
        new CronJob(updates.cronExpression, () => {});
      } catch (error) {
        throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
      }
    }

    const schedule = await this.prisma.backupSchedule.update({
      where: { id: scheduleId },
      data: updates,
    });

    const jobName = `backup-schedule-${scheduleId}`;

    if (updates.isActive === false) {
      // Stop the job
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        const job = this.schedulerRegistry.getCronJob(jobName);
        job.stop();
      }
    } else {
      // Re-register with new settings
      this.registerSchedule({
        id: schedule.id,
        name: schedule.name,
        cronExpression: schedule.cronExpression,
        storageType: schedule.storageType as StorageType,
        retentionDays: schedule.retentionDays,
        isActive: schedule.isActive,
        lastRun: schedule.lastRun || undefined,
        createdAt: schedule.createdAt,
        createdById: schedule.createdById,
      });
    }

    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'BackupSchedule',
      entityId: scheduleId,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      description: `Updated backup schedule: ${schedule.name}`,
      newValues: updates,
    });

    return { schedule, message: 'Backup schedule updated successfully' };
  }

  /**
   * Delete a backup schedule
   */
  async deleteSchedule(scheduleId: string, userId: string, userRole: Role) {
    const schedule = await this.prisma.backupSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('Backup schedule not found');
    }

    const jobName = `backup-schedule-${scheduleId}`;
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }

    this.schedules.delete(scheduleId);

    await this.prisma.backupSchedule.delete({
      where: { id: scheduleId },
    });

    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'BackupSchedule',
      entityId: scheduleId,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      description: `Deleted backup schedule: ${schedule.name}`,
    });

    return { success: true, message: 'Backup schedule deleted successfully' };
  }

  /**
   * List all backup schedules
   */
  async listSchedules() {
    const dbSchedules = await this.prisma.backupSchedule.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return dbSchedules.map(schedule => {
      const cached = this.schedules.get(schedule.id);
      return {
        ...schedule,
        nextRun: cached?.nextRun,
      };
    });
  }

  /**
   * Get schedule status
   */
  getScheduleStatus() {
    const jobs = this.schedulerRegistry.getCronJobs();
    const status: { name: string; running: boolean; lastDate: Date | null; nextDate: Date | null }[] = [];

    jobs.forEach((job, name) => {
      if (name.startsWith('backup-schedule-') || name === 'default-daily-backup') {
        status.push({
          name,
          running: (job as any).running ?? false,
          lastDate: job.lastDate(),
          nextDate: job.nextDate()?.toJSDate() || null,
        });
      }
    });

    return status;
  }

  /**
   * Trigger a scheduled backup manually
   */
  async triggerNow(scheduleId: string, userId: string, userRole: Role) {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error('Backup schedule not found');
    }

    await this.auditService.log({
      action: AuditAction.SYSTEM_BACKUP,
      entityType: 'BackupSchedule',
      entityId: scheduleId,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.HIGH,
      description: `Manually triggered backup schedule: ${schedule.name}`,
    });

    await this.executeScheduledBackup(scheduleId, schedule.storageType);

    return { success: true, message: 'Backup triggered successfully' };
  }
}
