import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationService } from './notification.service';
import { WebSocketService } from '../websocket/websocket.service';
import { MailService } from '../mail/mail.service';
import { NotificationPayload } from '../websocket/dto';

/**
 * Job data for bulk notification processing
 */
export interface BulkNotificationJobData {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
  emailTemplate?: string;
  emailContext?: Record<string, unknown>;
  saveToDatabase?: boolean;
  sendRealtime?: boolean;
  force?: boolean;
  respectUserSettings?: boolean;
  // Track progress
  jobId?: string;
  initiatedBy?: string;
}

/**
 * Job data for single notification
 */
export interface SingleNotificationJobData {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
  emailTemplate?: string;
  emailContext?: Record<string, unknown>;
  saveToDatabase?: boolean;
  sendRealtime?: boolean;
  force?: boolean;
}

@Processor('notifications')
@Injectable()
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  // Type to settings mapping for checking user preferences
  private readonly TYPE_TO_SETTING_MAP: Record<string, string> = {
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly wsService: WebSocketService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(job: Job<BulkNotificationJobData | SingleNotificationJobData>): Promise<any> {
    const jobName = job.name;

    this.logger.log(`Processing notification job: ${jobName} (${job.id})`);

    try {
      switch (jobName) {
        case 'bulk-notification':
          return this.processBulkNotification(job as Job<BulkNotificationJobData>);
        case 'single-notification':
          return this.processSingleNotification(job as Job<SingleNotificationJobData>);
        default:
          this.logger.warn(`Unknown job name: ${jobName}`);
          return { success: false, error: 'Unknown job type' };
      }
    } catch (error) {
      this.logger.error(`Failed to process notification job ${job.id}`, error.stack);
      throw error;
    }
  }

  /**
   * Process bulk notification job
   */
  private async processBulkNotification(job: Job<BulkNotificationJobData>): Promise<any> {
    const {
      userIds,
      type,
      title,
      body,
      data,
      sendEmail = false,
      emailTemplate = 'announcement',
      emailContext,
      saveToDatabase = true,
      sendRealtime = true,
      force = false,
      respectUserSettings = true,
    } = job.data;

    const totalUsers = userIds.length;
    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    this.logger.log(`Processing bulk notification for ${totalUsers} users: "${title}"`);

    // Process in batches of 100 for efficiency
    const batchSize = 100;
    const totalBatches = Math.ceil(userIds.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, userIds.length);
      const batchUserIds = userIds.slice(start, end);

      // Update job progress
      const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
      await job.updateProgress(progress);

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batchUserIds.map((userId) =>
          this.sendToUser({
            userId,
            type,
            title,
            body,
            data,
            sendEmail,
            emailTemplate,
            emailContext,
            saveToDatabase,
            sendRealtime,
            force,
            respectUserSettings,
          }),
        ),
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            sentCount++;
          } else {
            skippedCount++;
          }
        } else {
          errorCount++;
        }
      }

      // Small delay between batches to prevent overwhelming the system
      if (batchIndex < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const result = {
      success: true,
      totalUsers,
      sentCount,
      skippedCount,
      errorCount,
      title,
    };

    this.logger.log(
      `Bulk notification completed: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`,
    );

    return result;
  }

  /**
   * Process single notification job
   */
  private async processSingleNotification(job: Job<SingleNotificationJobData>): Promise<any> {
    const result = await this.sendToUser(job.data);
    return result;
  }

  /**
   * Send notification to a single user
   */
  private async sendToUser(options: SingleNotificationJobData & { respectUserSettings?: boolean }): Promise<{
    success: boolean;
    skippedReason?: string;
    notificationId?: string;
    emailQueued?: boolean;
  }> {
    const {
      userId,
      type,
      title,
      body,
      data,
      sendEmail = false,
      emailTemplate = 'announcement',
      emailContext,
      saveToDatabase = true,
      sendRealtime = true,
      force = false,
      respectUserSettings = true,
    } = options;

    try {
      // Check user settings if not forced
      if (respectUserSettings && !force) {
        const isEnabled = await this.isNotificationEnabled(userId, type);
        if (!isEnabled) {
          return { success: false, skippedReason: 'User disabled this notification type' };
        }
      }

      let notificationId: string | undefined;

      // Save to database
      if (saveToDatabase) {
        if (force) {
          const notification = await this.notificationService.createForced(
            userId,
            type as any,
            title,
            body,
            data,
          );
          notificationId = notification.id;
        } else {
          const notification = await this.notificationService.create(
            userId,
            type as any,
            title,
            body,
            data,
          );
          if (notification) {
            notificationId = notification.id;
          }
        }

        // Send real-time notification
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

          // Update unread count
          const unreadCount = await this.notificationService.getUnreadCount(userId);
          this.wsService.sendUnreadCount(userId, unreadCount);
        }
      } else if (sendRealtime) {
        // Send realtime without saving
        const payload: NotificationPayload = {
          id: `temp-${Date.now()}-${userId}`,
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
      if (sendEmail) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (user?.email) {
          await this.mailService.queueMail({
            to: user.email,
            subject: title,
            template: emailTemplate,
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
   * Check if user has enabled notifications for a specific type
   * TODO: Implement NotificationSettings model and query user preferences
   * For now, allow all notifications by default
   */
  private async isNotificationEnabled(userId: string, type: string): Promise<boolean> {
    const settingKey = this.TYPE_TO_SETTING_MAP[type];

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
