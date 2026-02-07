import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Role, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationService } from './notification.service';
import { WebSocketService } from '../websocket/websocket.service';
import { MailService } from '../mail/mail.service';
import { NotificationPayload } from '../websocket/dto';
import { BulkNotificationJobData } from './notification.processor';

/**
 * Notification types supported by the system
 */
export type NotificationType =
  | 'INTERNSHIP_DEADLINE'
  | 'INTERNSHIP_APPLICATION'
  | 'INTERNSHIP_ACCEPTED'
  | 'INTERNSHIP_REJECTED'
  | 'ELIGIBLE_INTERNSHIPS'
  | 'PLACEMENT_UPDATE'
  | 'PLACEMENT_OFFER'
  | 'MONTHLY_REPORT_REMINDER'
  | 'MONTHLY_REPORT_URGENT'
  | 'ASSIGNMENT_NEW'
  | 'ASSIGNMENT_DUE'
  | 'ATTENDANCE_MARKED'
  | 'ATTENDANCE_WARNING'
  | 'EXAM_SCHEDULED'
  | 'EXAM_REMINDER'
  | 'ANNOUNCEMENT'
  | 'GRIEVANCE_ASSIGNED'
  | 'GRIEVANCE_UPDATE'
  | 'GRIEVANCE_STATUS_CHANGED'
  | 'SUPPORT_TICKET_NEW'
  | 'WEEKLY_SUMMARY'
  | 'FEE_DUE'
  | 'FEE_REMINDER'
  | 'GRADE_PUBLISHED'
  | 'GRADE_UPDATE'
  | 'FACULTY_VISIT_REMINDER'
  | 'SYSTEM_ALERT'
  | 'CUSTOM';

/**
 * Options for sending a notification
 */
export interface SendNotificationOptions {
  /** User ID to send notification to */
  userId: string;

  /** Notification type */
  type: NotificationType;

  /** Notification title */
  title: string;

  /** Notification body/message */
  body: string;

  /** Additional data payload */
  data?: Record<string, any>;

  // === Delivery Options ===

  /** Save notification to database (default: true) */
  saveToDatabase?: boolean;

  /** Send real-time via WebSocket (default: true) */
  sendRealtime?: boolean;

  /** Send email notification (default: false) */
  sendEmail?: boolean;

  /** Email template name (required if sendEmail: true) */
  emailTemplate?: string;

  /** Additional email context data */
  emailContext?: Record<string, any>;

  // === Behavior Options ===

  /** Respect user notification settings (default: true) */
  respectUserSettings?: boolean;

  /** Force send even if user disabled this type (default: false) */
  force?: boolean;
}

/**
 * Options for bulk notification sending
 */
export interface BulkNotificationOptions extends Omit<SendNotificationOptions, 'userId'> {
  /** Array of user IDs */
  userIds: string[];
}

/**
 * Result of a notification send operation
 */
export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  skippedReason?: string;
  emailQueued?: boolean;
}

/**
 * High-level notification sender service
 * Provides a unified API for sending notifications via multiple channels
 */
@Injectable()
export class NotificationSenderService {
  private readonly logger = new Logger(NotificationSenderService.name);

  constructor(
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly wsService: WebSocketService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Send a notification to a single user
   */
  async send(options: SendNotificationOptions): Promise<NotificationResult> {
    const {
      userId,
      type,
      title,
      body,
      data,
      saveToDatabase = true,
      sendRealtime = true,
      sendEmail = false,
      emailTemplate,
      emailContext,
      respectUserSettings = true,
      force = false,
    } = options;

    try {
      // Check user settings if not forced
      if (respectUserSettings && !force) {
        const isEnabled = await this.isNotificationEnabled(userId, type);
        if (!isEnabled) {
          this.logger.debug(`Notification type ${type} disabled for user ${userId}, skipping`);
          return { success: false, skippedReason: 'User disabled this notification type' };
        }
      }

      let notificationId: string | undefined;

      // Save to database
      if (saveToDatabase) {
        if (force) {
          const notification = await this.notificationService.createForced(userId, type, title, body, data);
          notificationId = notification.id;
        } else {
          const notification = await this.notificationService.create(userId, type, title, body, data);
          if (notification) {
            notificationId = notification.id;
          }
        }

        // Send real-time notification via WebSocket after saving to database
        if (sendRealtime && notificationId) {
          const payload: NotificationPayload = {
            id: notificationId,
            title,
            body,
            type,
            data,
            read: false,
            createdAt: new Date(),
          };
          this.wsService.sendNotificationToUser(userId, payload);

          // Also update the unread count for the user
          const unreadCount = await this.notificationService.getUnreadCount(userId);
          this.wsService.sendUnreadCount(userId, unreadCount);
        }
      } else if (sendRealtime) {
        // Send realtime without saving to database
        const payload: NotificationPayload = {
          id: `temp-${Date.now()}`,
          title,
          body,
          type,
          data,
          read: false,
          createdAt: new Date(),
        };
        this.wsService.sendNotificationToUser(userId, payload);
      }

      // Queue email if requested
      let emailQueued = false;
      const template = emailTemplate || 'announcement'; // Default template for notifications
      if (sendEmail) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (user?.email) {
          await this.mailService.queueMail({
            to: user.email,
            subject: title,
            template,
            context: {
              name: user.name,
              title,
              body,
              ...data,
              ...emailContext,
            },
          });
          emailQueued = true;
        }
      }

      return { success: true, notificationId, emailQueued };
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${userId}`, error.stack);
      return { success: false, skippedReason: error.message };
    }
  }

  /**
   * Send notifications to multiple users (synchronous - blocks until complete)
   * Use sendBulkAsync for non-blocking bulk notifications
   */
  async sendBulk(options: BulkNotificationOptions): Promise<Map<string, NotificationResult>> {
    const { userIds, ...notificationOptions } = options;
    const results = new Map<string, NotificationResult>();

    // Process in batches of 50 to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userId) => {
        const result = await this.send({ ...notificationOptions, userId });
        results.set(userId, result);
      });
      await Promise.all(batchPromises);
    }

    this.logger.log(`Bulk notification sent to ${userIds.length} users`);
    return results;
  }

  /**
   * Queue bulk notifications for async processing (non-blocking)
   * Returns immediately with job ID - notifications are processed in the background
   */
  async sendBulkAsync(
    options: BulkNotificationOptions & { initiatedBy?: string },
  ): Promise<{ jobId: string; totalUsers: number; message: string }> {
    const { userIds, initiatedBy, ...notificationOptions } = options;

    const jobData: BulkNotificationJobData = {
      userIds,
      type: notificationOptions.type,
      title: notificationOptions.title,
      body: notificationOptions.body,
      data: notificationOptions.data,
      sendEmail: notificationOptions.sendEmail,
      emailTemplate: notificationOptions.emailTemplate,
      emailContext: notificationOptions.emailContext,
      saveToDatabase: notificationOptions.saveToDatabase,
      sendRealtime: notificationOptions.sendRealtime,
      force: notificationOptions.force,
      respectUserSettings: notificationOptions.respectUserSettings,
      initiatedBy,
    };

    const job = await this.notificationQueue.add('bulk-notification', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log(`Queued bulk notification job ${job.id} for ${userIds.length} users`);

    return {
      jobId: job.id as string,
      totalUsers: userIds.length,
      message: `Notification queued for ${userIds.length} users`,
    };
  }

  /**
   * Get the status of a bulk notification job
   */
  async getBulkJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: any;
  }> {
    const job = await this.notificationQueue.getJob(jobId);
    if (!job) {
      return { status: 'not_found', progress: 0 };
    }

    const state = await job.getState();
    const progress = job.progress as number || 0;

    return {
      status: state,
      progress,
      result: job.returnvalue,
    };
  }

  /**
   * Send notification to all users with a specific role (synchronous)
   */
  async sendToRole(
    role: Role,
    options: Omit<SendNotificationOptions, 'userId'>,
  ): Promise<{ sentCount: number; skippedCount: number }> {
    try {
      const users = await this.prisma.user.findMany({
        where: { role, active: true },
        select: { id: true },
      });

      const results = await this.sendBulk({
        ...options,
        userIds: users.map((u) => u.id),
      });

      let sentCount = 0;
      let skippedCount = 0;
      for (const result of results.values()) {
        if (result.success) sentCount++;
        else skippedCount++;
      }

      this.logger.log(`Sent notification to role ${role}: ${sentCount} sent, ${skippedCount} skipped`);
      return { sentCount, skippedCount };
    } catch (error) {
      this.logger.error(`Failed to send notification to role ${role}`, error.stack);
      throw error;
    }
  }

  /**
   * Queue notification to all users with a specific role (async, non-blocking)
   */
  async sendToRoleAsync(
    role: Role,
    options: Omit<SendNotificationOptions, 'userId'> & { initiatedBy?: string },
  ): Promise<{ jobId: string; totalUsers: number; message: string }> {
    try {
      const users = await this.prisma.user.findMany({
        where: { role, active: true },
        select: { id: true },
      });

      return this.sendBulkAsync({
        ...options,
        userIds: users.map((u) => u.id),
        initiatedBy: options.initiatedBy,
      });
    } catch (error) {
      this.logger.error(`Failed to queue notification to role ${role}`, error.stack);
      throw error;
    }
  }

  /**
   * Send notification to all users in an institution (synchronous)
   */
  async sendToInstitution(
    institutionId: string,
    options: Omit<SendNotificationOptions, 'userId'>,
    roleFilter?: Role[],
  ): Promise<{ sentCount: number; skippedCount: number }> {
    try {
      const whereClause: Prisma.UserWhereInput = {
        institutionId,
        active: true,
        ...(roleFilter && roleFilter.length > 0 ? { role: { in: roleFilter } } : {}),
      };

      const users = await this.prisma.user.findMany({
        where: whereClause,
        select: { id: true },
      });

      const results = await this.sendBulk({
        ...options,
        userIds: users.map((u) => u.id),
      });

      let sentCount = 0;
      let skippedCount = 0;
      for (const result of results.values()) {
        if (result.success) sentCount++;
        else skippedCount++;
      }

      this.logger.log(`Sent notification to institution ${institutionId}: ${sentCount} sent, ${skippedCount} skipped`);
      return { sentCount, skippedCount };
    } catch (error) {
      this.logger.error(`Failed to send notification to institution ${institutionId}`, error.stack);
      throw error;
    }
  }

  /**
   * Queue notification to all users in an institution (async, non-blocking)
   */
  async sendToInstitutionAsync(
    institutionId: string,
    options: Omit<SendNotificationOptions, 'userId'> & { initiatedBy?: string },
    roleFilter?: Role[],
  ): Promise<{ jobId: string; totalUsers: number; message: string }> {
    try {
      const whereClause: Prisma.UserWhereInput = {
        institutionId,
        active: true,
        ...(roleFilter && roleFilter.length > 0 ? { role: { in: roleFilter } } : {}),
      };

      const users = await this.prisma.user.findMany({
        where: whereClause,
        select: { id: true },
      });

      return this.sendBulkAsync({
        ...options,
        userIds: users.map((u) => u.id),
        initiatedBy: options.initiatedBy,
      });
    } catch (error) {
      this.logger.error(`Failed to queue notification to institution ${institutionId}`, error.stack);
      throw error;
    }
  }

  /**
   * Send a real-time only notification (no database save)
   */
  sendRealtime(userId: string, type: NotificationType, title: string, body: string, data?: any): void {
    const payload: NotificationPayload = {
      id: `realtime-${Date.now()}`,
      title,
      body,
      type,
      data,
      read: false,
      createdAt: new Date(),
    };
    this.wsService.sendNotificationToUser(userId, payload);
  }

  /**
   * Broadcast a notification to all connected users (real-time only)
   */
  broadcast(type: NotificationType, title: string, body: string, data?: any): void {
    const payload: NotificationPayload = {
      id: `broadcast-${Date.now()}`,
      title,
      body,
      type,
      data,
      read: false,
      createdAt: new Date(),
    };
    this.wsService.broadcast('notification', payload);
    this.logger.log(`Broadcast notification: ${title}`);
  }

  /**
   * Check if user has enabled notifications for a specific type
   * TODO: Implement NotificationSettings model and query user preferences
   * For now, allow all notifications by default
   */
  private async isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const TYPE_TO_SETTING_MAP: Record<string, string> = {
      INTERNSHIP_DEADLINE: 'internships',
      INTERNSHIP_APPLICATION: 'internships',
      INTERNSHIP_ACCEPTED: 'internships',
      INTERNSHIP_REJECTED: 'internships',
      ELIGIBLE_INTERNSHIPS: 'internships',
      PLACEMENT_UPDATE: 'placements',
      PLACEMENT_OFFER: 'placements',
      MONTHLY_REPORT_REMINDER: 'assignments',
      MONTHLY_REPORT_URGENT: 'assignments',
      ASSIGNMENT_NEW: 'assignments',
      ASSIGNMENT_DUE: 'assignments',
      ATTENDANCE_MARKED: 'attendance',
      ATTENDANCE_WARNING: 'attendance',
      EXAM_SCHEDULED: 'examSchedules',
      EXAM_REMINDER: 'examSchedules',
      ANNOUNCEMENT: 'announcements',
      GRIEVANCE_ASSIGNED: 'announcements',
      GRIEVANCE_UPDATE: 'announcements',
      GRIEVANCE_STATUS_CHANGED: 'announcements',
      SUPPORT_TICKET_NEW: 'announcements',
      WEEKLY_SUMMARY: 'announcements',
      FEE_DUE: 'feeReminders',
      FEE_REMINDER: 'feeReminders',
      GRADE_PUBLISHED: 'grades',
      GRADE_UPDATE: 'grades',
    };

    const settingKey = TYPE_TO_SETTING_MAP[type];

    // If not mapped, allow by default (system notifications)
    if (!settingKey) {
      return true;
    }

    // TODO: When NotificationSettings model is implemented, query user preferences:
    // const settings = await this.prisma.notificationSettings.findUnique({
    //   where: { userId },
    // });
    // if (settings) {
    //   return settings[settingKey] ?? true;
    // }

    // For now, allow all notifications by default
    return true;
  }
}
