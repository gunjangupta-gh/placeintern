import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import {
  Role,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  MonthlyReportStatus,
  ApplicationStatus,
  InternshipPhase,
} from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { NotificationSenderService } from '../../infrastructure/notification/notification-sender.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  SendNotificationDto,
  SendStudentReminderDto,
  SendInstitutionAnnouncementDto,
  SendSystemAnnouncementDto,
  NotificationTarget,
} from './dto';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface NotificationSettingsDto {
  assignments?: boolean;
  attendance?: boolean;
  examSchedules?: boolean;
  announcements?: boolean;
  grades?: boolean;
  internships?: boolean;
  placements?: boolean;
  feeReminders?: boolean;
}

interface UserContext {
  userId: string;
  role: Role;
  institutionId?: string;
}

export interface FloatingNotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: number;
  source: 'role-generated' | 'unread';
  link?: string;
  createdAt?: Date;
}

export interface FloatingNotificationsResponse {
  data: FloatingNotificationItem[];
  role: Role;
  generatedAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get notifications for a user with pagination
   */
  async getNotifications(userId: string, pagination?: PaginationParams) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 20;
      const skip = (page - 1) * limit;

      const [notifications, total, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            title: true,
            body: true,
            type: true,
            data: true,
            read: true,
            createdAt: true,
          },
        }),
        this.prisma.notification.count({
          where: { userId },
        }),
        this.prisma.notification.count({
          where: { userId, read: false },
        }),
      ]);

      return {
        data: notifications,
        unreadCount,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    try {
      // Verify the notification belongs to the user
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      // Mark as read
      const updated = await this.prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });

      this.logger.log(`Notification ${notificationId} marked as read`);

      return {
        success: true,
        message: 'Notification marked as read',
        notification: {
          id: updated.id,
          read: updated.read,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to mark notification ${notificationId} as read`, error.stack);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

      return {
        success: true,
        message: 'All notifications marked as read',
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string) {
    try {
      // Verify the notification belongs to the user
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      // Delete the notification
      await this.prisma.notification.delete({
        where: { id: notificationId },
      });

      // Audit logging for notification deletion
      this.auditService.log({
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        entityId: notificationId,
        userId: userId,
        description: `Notification deleted: ${notification.title}`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        oldValues: {
          id: notification.id,
          title: notification.title,
          type: notification.type,
        },
      }).catch(() => {}); // Non-blocking audit

      this.logger.log(`Notification ${notificationId} deleted`);

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete notification ${notificationId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a notification by ID
   */
  async getNotificationById(userId: string, notificationId: string) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          data: true,
          read: true,
          createdAt: true,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to get notification ${notificationId}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(userId: string, notificationIds: string[]) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

      return {
        success: true,
        message: `${result.count} notifications marked as read`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to mark multiple notifications as read for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: { userId },
      });

      // Audit logging for clearing all notifications
      this.auditService.log({
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        entityId: userId,
        userId: userId,
        description: `Cleared all notifications (${result.count} items)`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        oldValues: { deletedCount: result.count },
      }).catch(() => {}); // Non-blocking audit

      this.logger.log(`Cleared ${result.count} notifications for user ${userId}`);

      return {
        success: true,
        message: `${result.count} notifications cleared`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to clear all notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear all read notifications for a user
   */
  async clearReadNotifications(userId: string) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          userId,
          read: true,
        },
      });

      // Audit logging for clearing read notifications
      this.auditService.log({
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        entityId: userId,
        userId: userId,
        description: `Cleared read notifications (${result.count} items)`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        oldValues: { deletedCount: result.count, filter: 'read' },
      }).catch(() => {}); // Non-blocking audit

      this.logger.log(`Cleared ${result.count} read notifications for user ${userId}`);

      return {
        success: true,
        message: `${result.count} read notifications cleared`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to clear read notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete multiple notifications
   */
  async deleteMultipleNotifications(userId: string, notificationIds: string[]) {
    try {
      const result = await this.prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId,
        },
      });

      // Audit logging for deleting multiple notifications
      this.auditService.log({
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        entityId: userId,
        userId: userId,
        description: `Deleted multiple notifications (${result.count} items)`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        oldValues: {
          deletedCount: result.count,
          requestedIds: notificationIds,
        },
      }).catch(() => {}); // Non-blocking audit

      this.logger.log(`Deleted ${result.count} notifications for user ${userId}`);

      return {
        success: true,
        message: `${result.count} notifications deleted`,
        count: result.count,
      };
    } catch (error) {
      this.logger.error(`Failed to delete multiple notifications for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string) {
    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      });

      return {
        unreadCount: count,
      };
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get role-aware floating notifications for login/dashboard entry.
   * Phase 2: combines role-generated action alerts + existing unread notifications.
   */
  async getFloatingNotifications(userId: string, limit = 3): Promise<FloatingNotificationsResponse> {
    const safeLimit = Math.min(Math.max(limit || 3, 1), 5);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, institutionId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let roleAlerts: FloatingNotificationItem[] = [];

    if (user.role === Role.STUDENT) {
      roleAlerts = await this.getStudentFloatingAlerts(userId);
    } else if (user.role === Role.TEACHER) {
      roleAlerts = await this.getFacultyFloatingAlerts(userId);
    } else if (user.role === Role.PRINCIPAL) {
      roleAlerts = await this.getPrincipalFloatingAlerts(user.institutionId);
    }

    const unreadNotifications = await this.prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        createdAt: true,
      },
    });

    const unreadAlerts: FloatingNotificationItem[] = unreadNotifications.map((item) => ({
      id: `unread-${item.id}`,
      title: item.title,
      body: item.body,
      type: 'info',
      priority: 60,
      source: 'unread',
      link: '/app/dashboard',
      createdAt: item.createdAt,
    }));

    const merged = [...roleAlerts, ...unreadAlerts]
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .filter((item, index, arr) => {
        const duplicateIndex = arr.findIndex(
          (x) => x.title === item.title && x.body === item.body,
        );
        return duplicateIndex === index;
      })
      .slice(0, safeLimit);

    return {
      data: merged,
      role: user.role,
      generatedAt: new Date(),
    };
  }

  private async getStudentFloatingAlerts(userId: string): Promise<FloatingNotificationItem[]> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) return [];

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [pendingReportsCount, submittedThisMonthCount, latestVisitWithFeedback] = await Promise.all([
      this.prisma.monthlyReport.count({
        where: {
          studentId: student.id,
          isDeleted: false,
          status: { in: [MonthlyReportStatus.DRAFT, MonthlyReportStatus.REVISION_REQUIRED] },
        },
      }),
      this.prisma.monthlyReport.count({
        where: {
          studentId: student.id,
          isDeleted: false,
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.APPROVED] },
        },
      }),
      this.prisma.facultyVisitLog.findFirst({
        where: {
          application: { studentId: student.id },
          isDeleted: false,
          OR: [
            { observationsAboutStudent: { not: null } },
            { feedbackSharedWithStudent: { not: null } },
          ],
        },
        orderBy: { visitDate: 'desc' },
        select: {
          id: true,
          visitDate: true,
          observationsAboutStudent: true,
          feedbackSharedWithStudent: true,
        },
      }),
    ]);

    const alerts: FloatingNotificationItem[] = [];

    if (pendingReportsCount > 0) {
      alerts.push({
        id: 'student-pending-reports',
        title: 'Monthly Progress Report Pending',
        body: `You have ${pendingReportsCount} pending monthly report(s). Please submit soon.`,
        type: 'warning',
        priority: 95,
        source: 'role-generated',
        link: '/app/dashboard',
      });
    } else if (submittedThisMonthCount > 0) {
      alerts.push({
        id: 'student-reports-submitted',
        title: 'Monthly Report Updated',
        body: 'Your monthly progress submission is up to date for this month.',
        type: 'success',
        priority: 65,
        source: 'role-generated',
        link: '/app/dashboard',
      });
    }

    const latestFeedbackText = latestVisitWithFeedback?.feedbackSharedWithStudent?.trim();
    const latestObservationText = latestVisitWithFeedback?.observationsAboutStudent?.trim();

    if (latestFeedbackText) {
      alerts.push({
        id: 'student-feedback-shared',
        title: 'New Feedback Shared',
        body: latestFeedbackText.length > 140
          ? `${latestFeedbackText.slice(0, 140)}...`
          : latestFeedbackText,
        type: 'info',
        priority: 90,
        source: 'role-generated',
        link: '/app/dashboard',
        createdAt: latestVisitWithFeedback?.visitDate || undefined,
      });
    } else if (latestObservationText) {
      alerts.push({
        id: 'student-observation-shared',
        title: 'New Observation Available',
        body: latestObservationText.length > 140
          ? `${latestObservationText.slice(0, 140)}...`
          : latestObservationText,
        type: 'info',
        priority: 85,
        source: 'role-generated',
        link: '/app/dashboard',
        createdAt: latestVisitWithFeedback?.visitDate || undefined,
      });
    }

    return alerts;
  }

  private async getFacultyFloatingAlerts(userId: string): Promise<FloatingNotificationItem[]> {
    const assignments = await this.prisma.mentorAssignment.findMany({
      where: { mentorId: userId, isActive: true },
      select: { studentId: true },
    });

    const studentIds = assignments.map((item) => item.studentId);
    if (studentIds.length === 0) return [];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendingReportReviews, draftVisitReports, visitsMissingFeedback] = await Promise.all([
      this.prisma.monthlyReport.count({
        where: {
          isDeleted: false,
          application: {
            studentId: { in: studentIds },
            isActive: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
          },
          status: MonthlyReportStatus.SUBMITTED,
        },
      }),
      this.prisma.facultyVisitLog.count({
        where: {
          facultyId: userId,
          isDeleted: false,
          status: 'DRAFT',
        },
      }),
      this.prisma.facultyVisitLog.count({
        where: {
          facultyId: userId,
          isDeleted: false,
          status: 'COMPLETED',
          visitDate: { gte: monthStart },
          OR: [
            { observationsAboutStudent: null },
            { observationsAboutStudent: '' },
            { feedbackSharedWithStudent: null },
            { feedbackSharedWithStudent: '' },
          ],
        },
      }),
    ]);

    const alerts: FloatingNotificationItem[] = [];

    if (pendingReportReviews > 0) {
      alerts.push({
        id: 'faculty-pending-report-reviews',
        title: 'Pending Report Submissions',
        body: `${pendingReportReviews} monthly report(s) are waiting for your review.`,
        type: 'warning',
        priority: 95,
        source: 'role-generated',
        link: '/app/dashboard',
      });
    }

    if (draftVisitReports > 0) {
      alerts.push({
        id: 'faculty-draft-visit-reports',
        title: 'Visit Reports In Draft',
        body: `${draftVisitReports} visit report(s) are saved as draft and need submission completion.`,
        type: 'warning',
        priority: 88,
        source: 'role-generated',
        link: '/app/dashboard',
      });
    }

    if (visitsMissingFeedback > 0) {
      alerts.push({
        id: 'faculty-missing-feedback',
        title: 'Feedback Details Missing',
        body: `${visitsMissingFeedback} recent visit report(s) need observation/feedback details updated.`,
        type: 'info',
        priority: 80,
        source: 'role-generated',
        link: '/app/dashboard',
      });
    }

    return alerts;
  }

  private async getPrincipalFloatingAlerts(institutionId?: string): Promise<FloatingNotificationItem[]> {
    if (!institutionId) return [];

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      activeStudents,
      studentsWithActiveMentors,
      activeInternships,
      joiningLettersUploaded,
      overdueReportsCount,
      missingVisitsCount,
    ] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, user: { active: true } } }),
      this.prisma.student.count({
        where: {
          institutionId,
          user: { active: true },
          mentorAssignments: { some: { isActive: true } },
        },
      }),
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
        },
      }),
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
          joiningLetterUrl: { not: null, notIn: [''] },
        },
      }),
      this.prisma.student.count({
        where: {
          institutionId,
          user: { active: true },
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
              startDate: { lt: startOfCurrentMonth },
            },
          },
          monthlyReports: {
            none: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.APPROVED] },
            },
          },
        },
      }),
      this.prisma.student.count({
        where: {
          institutionId,
          user: { active: true },
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
              startDate: { lte: thirtyDaysAgo },
              facultyVisitLogs: {
                none: {
                  visitDate: { gte: thirtyDaysAgo },
                },
              },
            },
          },
        },
      }),
    ]);

    const mentorRate = activeStudents > 0
      ? Math.round((studentsWithActiveMentors / activeStudents) * 100)
      : null;
    const joiningRate = activeInternships > 0
      ? Math.round((joiningLettersUploaded / activeInternships) * 100)
      : null;

    const overallScore = mentorRate !== null && joiningRate !== null
      ? Math.round((mentorRate + joiningRate) / 2)
      : null;

    const alerts: FloatingNotificationItem[] = [];

    if (overallScore !== null && overallScore < 75) {
      alerts.push({
        id: 'principal-overall-compliance-low',
        title: 'Compliance Score Needs Attention',
        body: `Overall compliance is ${overallScore}%. Please review mentor and joining-letter status.`,
        type: 'error',
        priority: 98,
        source: 'role-generated',
        link: '/app/principal-overview',
      });
    } else if (overallScore !== null) {
      alerts.push({
        id: 'principal-overall-compliance-status',
        title: 'Current Compliance Snapshot',
        body: `Overall compliance is ${overallScore}% (Mentor: ${mentorRate ?? 0}%, Joining Letter: ${joiningRate ?? 0}%).`,
        type: 'info',
        priority: 70,
        source: 'role-generated',
        link: '/app/principal-overview',
      });
    }

    if (overdueReportsCount > 0) {
      alerts.push({
        id: 'principal-overdue-reports',
        title: 'Monthly Report Compliance Pending',
        body: `${overdueReportsCount} student(s) have not submitted this month’s report.`,
        type: 'warning',
        priority: 94,
        source: 'role-generated',
        link: '/app/principal-overview',
      });
    }

    if (missingVisitsCount > 0) {
      alerts.push({
        id: 'principal-missing-visits',
        title: 'Visit Follow-up Required',
        body: `${missingVisitsCount} student(s) have no faculty visit recorded in the last 30 days.`,
        type: 'warning',
        priority: 90,
        source: 'role-generated',
        link: '/app/principal-overview',
      });
    }

    if (overdueReportsCount === 0 && missingVisitsCount === 0 && overallScore !== null && overallScore >= 90) {
      alerts.push({
        id: 'principal-compliance-healthy',
        title: 'Compliance On Track',
        body: 'No critical compliance gaps detected right now. Keep monitoring regularly.',
        type: 'success',
        priority: 65,
        source: 'role-generated',
        link: '/app/principal-overview',
      });
    }

    return alerts;
  }

  /**
   * Get notification settings for a user
   * STUB: NotificationSettings feature removed - returns default enabled state
   */
  async getNotificationSettings(userId: string) {
    // Return default settings (all enabled)
    return {
      assignments: true,
      attendance: true,
      examSchedules: true,
      announcements: true,
      grades: true,
      internships: true,
      placements: true,
      feeReminders: true,
    };
  }

  /**
   * Update notification settings for a user
   * STUB: NotificationSettings feature removed - returns success without persisting
   */
  async updateNotificationSettings(userId: string, settingsDto: NotificationSettingsDto) {
    this.logger.log(`Notification settings update requested for user ${userId} (feature disabled)`);

    return {
      success: true,
      message: 'Notification settings feature is currently disabled. All notifications are enabled by default.',
      settings: {
        assignments: true,
        attendance: true,
        examSchedules: true,
        announcements: true,
        grades: true,
        internships: true,
        placements: true,
        feeReminders: true,
      },
    };
  }

  // ============ NOTIFICATION SENDING METHODS ============

  /**
   * Send notification (generic - based on target type)
   */
  async sendNotification(user: UserContext, dto: SendNotificationDto) {
    const { target, title, body, sendEmail, data } = dto;

    try {
      let result: { sentCount: number; skippedCount: number } | any;

      switch (target) {
        case NotificationTarget.USER:
          if (!dto.userId) {
            throw new BadRequestException('userId is required for user target');
          }
          result = await this.notificationSender.send({
            userId: dto.userId,
            type: 'ANNOUNCEMENT',
            title,
            body,
            data,
            sendEmail,
          });
          break;

        case NotificationTarget.USERS:
          if (!dto.userIds || dto.userIds.length === 0) {
            throw new BadRequestException('userIds is required for users target');
          }
          // Use async queue for bulk operations (non-blocking)
          if (dto.userIds.length > 10) {
            const asyncResult = await this.notificationSender.sendBulkAsync({
              userIds: dto.userIds,
              type: 'ANNOUNCEMENT',
              title,
              body,
              data,
              sendEmail,
              initiatedBy: user.userId,
            });
            return {
              success: true,
              message: asyncResult.message,
              jobId: asyncResult.jobId,
              totalUsers: asyncResult.totalUsers,
              async: true,
            };
          }
          // For small batches, use synchronous sending
          result = await this.notificationSender.sendBulk({
            userIds: dto.userIds,
            type: 'ANNOUNCEMENT',
            title,
            body,
            data,
            sendEmail,
          });
          break;

        case NotificationTarget.ROLE:
          if (!dto.role) {
            throw new BadRequestException('role is required for role target');
          }
          // Only State/Admin can send to roles
          if (!([Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN] as Role[]).includes(user.role)) {
            throw new ForbiddenException('Only State/Admin can send to roles');
          }
          // Use async queue for role-based notifications (non-blocking)
          const roleAsyncResult = await this.notificationSender.sendToRoleAsync(dto.role, {
            type: 'ANNOUNCEMENT',
            title,
            body,
            data,
            sendEmail,
            initiatedBy: user.userId,
          });
          return {
            success: true,
            message: roleAsyncResult.message,
            jobId: roleAsyncResult.jobId,
            totalUsers: roleAsyncResult.totalUsers,
            async: true,
          };
          break;

        case NotificationTarget.INSTITUTION:
          const institutionId = dto.institutionId || user.institutionId;
          if (!institutionId) {
            throw new BadRequestException('institutionId is required');
          }
          // Principal can only send to their institution
          if (user.role === Role.PRINCIPAL && institutionId !== user.institutionId) {
            throw new ForbiddenException('Principals can only send to their own institution');
          }
          // Use async queue for institution notifications (non-blocking)
          const instAsyncResult = await this.notificationSender.sendToInstitutionAsync(
            institutionId,
            { type: 'ANNOUNCEMENT', title, body, data, sendEmail, initiatedBy: user.userId },
            dto.roleFilter,
          );
          return {
            success: true,
            message: instAsyncResult.message,
            jobId: instAsyncResult.jobId,
            totalUsers: instAsyncResult.totalUsers,
            async: true,
          };
          break;

        case NotificationTarget.MY_STUDENTS:
          // Faculty only - redirect to sendStudentReminder
          if (!([Role.TEACHER] as Role[]).includes(user.role)) {
            throw new ForbiddenException('Only faculty can send to their students');
          }
          return this.sendStudentReminder(user, {
            title,
            body,
            sendEmail,
            data,
          });

        case NotificationTarget.BROADCAST:
          // Only State/Admin can broadcast
          if (!([Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN] as Role[]).includes(user.role)) {
            throw new ForbiddenException('Only State/Admin can broadcast');
          }
          // Broadcast via WebSocket immediately for real-time delivery
          this.notificationSender.broadcast('ANNOUNCEMENT', title, body, data);

          // Queue database saves for all active users (non-blocking)
          const allUsers = await this.prisma.user.findMany({
            where: { active: true },
            select: { id: true },
          });

          const broadcastAsyncResult = await this.notificationSender.sendBulkAsync({
            userIds: allUsers.map((u) => u.id),
            type: 'ANNOUNCEMENT',
            title,
            body,
            data,
            sendEmail,
            sendRealtime: false, // Already broadcast via WebSocket
            initiatedBy: user.userId,
          });

          return {
            success: true,
            message: `Broadcast sent immediately. ${broadcastAsyncResult.message}`,
            jobId: broadcastAsyncResult.jobId,
            totalUsers: broadcastAsyncResult.totalUsers,
            async: true,
          };
          break;

        default:
          throw new BadRequestException('Invalid target type');
      }

      // Audit log
      await this.auditService.log({
        userId: user.userId,
        userRole: user.role,
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        description: `Notification sent: ${title}`,
        newValues: { target, title, recipientCount: result.sentCount || 1 },
      });

      this.logger.log(`Notification sent by ${user.userId}: ${target} - "${title}"`);

      return {
        success: true,
        message: 'Notification sent successfully',
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to send notification`, error.stack);
      throw error;
    }
  }

  /**
   * Faculty: Send reminder to assigned students
   */
  async sendStudentReminder(user: UserContext, dto: SendStudentReminderDto) {
    if (!([Role.TEACHER] as Role[]).includes(user.role)) {
      throw new ForbiddenException('Only faculty can send student reminders');
    }

    try {
      // Get assigned students
      let studentIds = dto.studentIds;

      if (!studentIds || studentIds.length === 0) {
        // Get all assigned students for this faculty
        const assignments = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: user.userId,
            isActive: true,
          },
          select: { studentId: true },
        });
        studentIds = assignments.map((a) => a.studentId);
      } else {
        // Verify faculty has access to these students
        const validAssignments = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: user.userId,
            studentId: { in: studentIds },
            isActive: true,
          },
          select: { studentId: true },
        });
        const validIds = validAssignments.map((a) => a.studentId);
        const invalidIds = studentIds.filter((id) => !validIds.includes(id));
        if (invalidIds.length > 0) {
          throw new ForbiddenException(`You are not assigned to students: ${invalidIds.join(', ')}`);
        }
      }

      if (studentIds.length === 0) {
        return {
          success: false,
          message: 'No assigned students found',
          sentCount: 0,
        };
      }

      // Use async queue for larger batches (non-blocking)
      if (studentIds.length > 10) {
        const asyncResult = await this.notificationSender.sendBulkAsync({
          userIds: studentIds,
          type: 'ANNOUNCEMENT',
          title: dto.title,
          body: dto.body,
          data: { ...dto.data, fromFaculty: user.userId },
          sendEmail: dto.sendEmail,
          initiatedBy: user.userId,
        });

        // Audit log
        await this.auditService.log({
          userId: user.userId,
          userRole: user.role,
          action: AuditAction.BULK_OPERATION,
          entityType: 'Notification',
          description: `Student reminder queued: ${dto.title}`,
          newValues: { type: 'student_reminder', title: dto.title, totalStudents: studentIds.length },
        });

        this.logger.log(`Faculty ${user.userId} queued reminder for ${studentIds.length} students`);

        return {
          success: true,
          message: asyncResult.message,
          jobId: asyncResult.jobId,
          totalStudents: asyncResult.totalUsers,
          async: true,
        };
      }

      // For small batches, use synchronous sending
      const result = await this.notificationSender.sendBulk({
        userIds: studentIds,
        type: 'ANNOUNCEMENT',
        title: dto.title,
        body: dto.body,
        data: { ...dto.data, fromFaculty: user.userId },
        sendEmail: dto.sendEmail,
      });

      let sentCount = 0;
      for (const r of result.values()) {
        if (r.success) sentCount++;
      }

      // Audit log
      await this.auditService.log({
        userId: user.userId,
        userRole: user.role,
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        description: `Student reminder sent: ${dto.title}`,
        newValues: { type: 'student_reminder', title: dto.title, sentCount },
      });

      this.logger.log(`Faculty ${user.userId} sent reminder to ${sentCount} students`);

      return {
        success: true,
        message: `Reminder sent to ${sentCount} students`,
        sentCount,
        totalStudents: studentIds.length,
      };
    } catch (error) {
      this.logger.error(`Failed to send student reminder`, error.stack);
      throw error;
    }
  }

  /**
   * Principal: Send announcement to institution (async, non-blocking)
   */
  async sendInstitutionAnnouncement(user: UserContext, dto: SendInstitutionAnnouncementDto) {
    if (user.role !== Role.PRINCIPAL) {
      throw new ForbiddenException('Only principals can send institution announcements');
    }

    if (!user.institutionId) {
      throw new BadRequestException('Principal must be associated with an institution');
    }

    try {
      // Use async queue for institution announcements (non-blocking)
      const asyncResult = await this.notificationSender.sendToInstitutionAsync(
        user.institutionId,
        {
          type: 'ANNOUNCEMENT',
          title: dto.title,
          body: dto.body,
          data: { ...dto.data, fromPrincipal: user.userId },
          sendEmail: dto.sendEmail,
          initiatedBy: user.userId,
        },
        dto.targetRoles,
      );

      // Audit log
      await this.auditService.log({
        userId: user.userId,
        userRole: user.role,
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        description: `Institution announcement queued: "${dto.title}" for ${asyncResult.totalUsers} recipients`,
        newValues: {
          type: 'institution_announcement',
          institutionId: user.institutionId,
          title: dto.title,
          totalUsers: asyncResult.totalUsers,
          targetRoles: dto.targetRoles,
          jobId: asyncResult.jobId,
        },
      });

      this.logger.log(`Principal ${user.userId} queued announcement for institution: ${asyncResult.totalUsers} recipients`);

      return {
        success: true,
        message: asyncResult.message,
        jobId: asyncResult.jobId,
        totalUsers: asyncResult.totalUsers,
        async: true,
      };
    } catch (error) {
      this.logger.error(`Failed to send institution announcement`, error.stack);
      throw error;
    }
  }

  /**
   * State/Admin: Send system-wide announcement (async, non-blocking)
   */
  async sendSystemAnnouncement(user: UserContext, dto: SendSystemAnnouncementDto) {
    if (!([Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN] as Role[]).includes(user.role)) {
      throw new ForbiddenException('Only State/Admin can send system announcements');
    }

    try {
      const jobIds: string[] = [];
      let totalUsers = 0;

      if (dto.targetRoles && dto.targetRoles.length > 0) {
        // OPTIMIZED: Send to all roles in parallel instead of sequentially
        const roleResults = await Promise.all(
          dto.targetRoles.map((role) =>
            this.notificationSender.sendToRoleAsync(role, {
              type: 'SYSTEM_ALERT',
              title: dto.title,
              body: dto.body,
              data: { ...dto.data, fromAdmin: user.userId },
              sendEmail: dto.sendEmail,
              force: dto.force,
              initiatedBy: user.userId,
            }),
          ),
        );
        for (const roleResult of roleResults) {
          jobIds.push(roleResult.jobId);
          totalUsers += roleResult.totalUsers;
        }
      } else {
        // Broadcast to all immediately via WebSocket
        this.notificationSender.broadcast('SYSTEM_ALERT', dto.title, dto.body, {
          ...dto.data,
          fromAdmin: user.userId,
        });

        // Queue database saves for all active users (non-blocking)
        const users = await this.prisma.user.findMany({
          where: { active: true },
          select: { id: true },
        });

        const asyncResult = await this.notificationSender.sendBulkAsync({
          userIds: users.map((u) => u.id),
          type: 'SYSTEM_ALERT',
          title: dto.title,
          body: dto.body,
          data: { ...dto.data, fromAdmin: user.userId },
          sendEmail: dto.sendEmail,
          force: dto.force,
          sendRealtime: false, // Already broadcast via WebSocket
          initiatedBy: user.userId,
        });

        jobIds.push(asyncResult.jobId);
        totalUsers = asyncResult.totalUsers;
      }

      // Audit log
      await this.auditService.log({
        userId: user.userId,
        userRole: user.role,
        action: AuditAction.BULK_OPERATION,
        entityType: 'Notification',
        description: `System announcement queued: "${dto.title}" for ${totalUsers} recipients`,
        newValues: {
          type: 'system_announcement',
          title: dto.title,
          totalUsers,
          targetRoles: dto.targetRoles,
          force: dto.force,
          jobIds,
        },
      });

      this.logger.log(`System announcement queued by ${user.userId}: ${totalUsers} recipients`);

      return {
        success: true,
        message: `System announcement queued for ${totalUsers} users`,
        jobIds,
        totalUsers,
        async: true,
      };
    } catch (error) {
      this.logger.error(`Failed to send system announcement`, error.stack);
      throw error;
    }
  }

  /**
   * Get status of a bulk notification job
   */
  async getBulkNotificationStatus(jobId: string) {
    try {
      const status = await this.notificationSender.getBulkJobStatus(jobId);
      return {
        success: true,
        ...status,
      };
    } catch (error) {
      this.logger.error(`Failed to get bulk notification status for job ${jobId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get notification history (sent by current user)
   */
  async getSentNotifications(user: UserContext, pagination?: PaginationParams) {
    // This would require a separate table to track sent notifications
    // For now, return a placeholder
    return {
      data: [],
      message: 'Sent notification history is not yet implemented',
    };
  }
}
