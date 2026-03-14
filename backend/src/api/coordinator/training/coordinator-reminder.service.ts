import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationSenderService } from '../../../infrastructure/notification/notification-sender.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../../generated/prisma/client';
import { SendReminderDto, PendingActionsFilterDto, PendingActionType } from './dto/send-reminder.dto';

interface CoordinatorUser {
  userId: string;
  institutionId?: string;
  branchId?: string;
  branchName?: string;
  name: string;
}

@Injectable()
export class CoordinatorReminderService {
  private readonly logger = new Logger(CoordinatorReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationSender: NotificationSenderService,
    private readonly auditService: AuditService,
  ) {}

  private getUserBranchScope(branchId?: string, branchName?: string) {
    if (branchId) {
      return { branchId };
    }

    if (branchName?.trim()) {
      return { branchName: { equals: branchName.trim(), mode: 'insensitive' as const } };
    }

    return {};
  }

  /**
   * Send enrollment reminder to faculty who haven't enrolled for a training
   */
  async sendEnrollmentReminder(dto: SendReminderDto, coordinator: CoordinatorUser) {
    this.logger.log(`Coordinator ${coordinator.userId} sending enrollment reminder for training ${dto.trainingId}`);

    // Get training details
    const training = await this.prisma.training.findUnique({
      where: { id: dto.trainingId },
      select: { id: true, title: true, applicationDeadline: true, startDate: true },
    });

    if (!training) {
      return { success: false, message: 'Training not found', sentCount: 0 };
    }

    // Get faculty in institution who haven't enrolled for this training
    const targetUsers = await this.prisma.user.findMany({
      where: {
        ...(coordinator.institutionId ? { institutionId: coordinator.institutionId } : {}),
        role: Role.TEACHER,
        active: true,
        ...this.getUserBranchScope(coordinator.branchId, coordinator.branchName),
        ...(dto.userIds?.length ? { id: { in: dto.userIds } } : {}),
        trainingApplications: {
          none: { trainingId: dto.trainingId },
        },
      },
      select: { id: true, email: true, name: true },
    });

    if (targetUsers.length === 0) {
      return { success: true, message: 'No faculty pending enrollment', sentCount: 0 };
    }

    const deadline = training.applicationDeadline.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const body = dto.customMessage ||
      `Please enroll for the training "${training.title}" before ${deadline}. Don't miss this opportunity!`;

    const results = await this.notificationSender.sendBulk({
      userIds: targetUsers.map(u => u.id),
      type: 'CUSTOM',
      title: 'Training Enrollment Reminder',
      body,
      sendInApp: dto.sendInApp ?? true,
      sendEmail: dto.sendEmail ?? true,
      emailTemplate: 'training-enrollment-reminder',
      emailContext: {
        trainingTitle: training.title,
        deadline,
        startDate: training.startDate.toLocaleDateString('en-IN'),
        customMessage: dto.customMessage,
      },
      data: { trainingId: dto.trainingId, reminderType: 'enrollment' },
    });

    const sentCount = Array.from(results.values()).filter(r => r.success).length;

    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'Training',
      entityId: dto.trainingId,
      userId: coordinator.userId,
      userRole: Role.FACULTY_COORDINATOR,
      category: AuditCategory.TRAINING,
      severity: AuditSeverity.LOW,
      description: `Enrollment reminder sent to ${sentCount} faculty for training "${training.title}"`,
    }).catch(() => {});

    return {
      success: true,
      message: `Enrollment reminder sent to ${sentCount} faculty`,
      sentCount,
      totalTargeted: targetUsers.length,
    };
  }

  /**
   * Send pre-test reminder to faculty who haven't completed pre-test
   */
  async sendPreTestReminder(dto: SendReminderDto, coordinator: CoordinatorUser) {
    this.logger.log(`Coordinator ${coordinator.userId} sending pre-test reminder for training ${dto.trainingId}`);

    const training = await this.prisma.training.findUnique({
      where: { id: dto.trainingId },
      include: { preTestForm: true },
    });

    if (!training) {
      return { success: false, message: 'Training not found', sentCount: 0 };
    }

    if (!training.preTestForm) {
      return { success: false, message: 'Training does not have a pre-test', sentCount: 0 };
    }

    // Get approved faculty who haven't submitted pre-test
    const approvedApplications = await this.prisma.trainingApplication.findMany({
      where: {
        trainingId: dto.trainingId,
        status: 'APPROVED',
        isActive: true,
        user: {
          ...(coordinator.institutionId ? { institutionId: coordinator.institutionId } : {}),
          ...this.getUserBranchScope(coordinator.branchId, coordinator.branchName),
        },
        ...(dto.userIds?.length ? { userId: { in: dto.userIds } } : {}),
      },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    });

    const preTestResponses = await this.prisma.preTestResponse.findMany({
      where: {
        trainingId: dto.trainingId,
        preTestFormId: training.preTestForm.id,
      },
      select: { userId: true },
    });

    const respondedUserIds = new Set(preTestResponses.map(r => r.userId));
    const pendingUsers = approvedApplications
      .filter(app => !respondedUserIds.has(app.userId))
      .map(app => app.user);

    if (pendingUsers.length === 0) {
      return { success: true, message: 'All faculty have completed pre-test', sentCount: 0 };
    }

    const body = dto.customMessage ||
      `Please complete the pre-test for training "${training.title}" before the training begins.`;

    const results = await this.notificationSender.sendBulk({
      userIds: pendingUsers.map(u => u.id),
      type: 'CUSTOM',
      title: 'Pre-Test Reminder',
      body,
      sendInApp: dto.sendInApp ?? true,
      sendEmail: dto.sendEmail ?? true,
      emailTemplate: 'training-pre-test-reminder',
      emailContext: {
        trainingTitle: training.title,
        startDate: training.startDate.toLocaleDateString('en-IN'),
        customMessage: dto.customMessage,
      },
      data: { trainingId: dto.trainingId, reminderType: 'pre_test' },
    });

    const sentCount = Array.from(results.values()).filter(r => r.success).length;

    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'Training',
      entityId: dto.trainingId,
      userId: coordinator.userId,
      userRole: Role.FACULTY_COORDINATOR,
      category: AuditCategory.TRAINING,
      severity: AuditSeverity.LOW,
      description: `Pre-test reminder sent to ${sentCount} faculty for training "${training.title}"`,
    }).catch(() => {});

    return {
      success: true,
      message: `Pre-test reminder sent to ${sentCount} faculty`,
      sentCount,
      totalTargeted: pendingUsers.length,
    };
  }

  /**
   * Send post-test reminder to faculty who haven't completed post-test
   */
  async sendPostTestReminder(dto: SendReminderDto, coordinator: CoordinatorUser) {
    this.logger.log(`Coordinator ${coordinator.userId} sending post-test reminder for training ${dto.trainingId}`);

    const training = await this.prisma.training.findUnique({
      where: { id: dto.trainingId },
      include: { postTestForm: true },
    });

    if (!training) {
      return { success: false, message: 'Training not found', sentCount: 0 };
    }

    if (!training.postTestForm) {
      return { success: false, message: 'Training does not have a post-test', sentCount: 0 };
    }

    // Get approved faculty who haven't submitted post-test
    const approvedApplications = await this.prisma.trainingApplication.findMany({
      where: {
        trainingId: dto.trainingId,
        status: 'APPROVED',
        isActive: true,
        user: {
          ...(coordinator.institutionId ? { institutionId: coordinator.institutionId } : {}),
          ...this.getUserBranchScope(coordinator.branchId, coordinator.branchName),
        },
        ...(dto.userIds?.length ? { userId: { in: dto.userIds } } : {}),
      },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    });

    const postTestResponses = await this.prisma.postTestResponse.findMany({
      where: {
        trainingId: dto.trainingId,
        postTestFormId: training.postTestForm.id,
      },
      select: { userId: true },
    });

    const respondedUserIds = new Set(postTestResponses.map(r => r.userId));
    const pendingUsers = approvedApplications
      .filter(app => !respondedUserIds.has(app.userId))
      .map(app => app.user);

    if (pendingUsers.length === 0) {
      return { success: true, message: 'All faculty have completed post-test', sentCount: 0 };
    }

    const body = dto.customMessage ||
      `Please complete the post-test for training "${training.title}" to receive your completion certificate.`;

    const results = await this.notificationSender.sendBulk({
      userIds: pendingUsers.map(u => u.id),
      type: 'CUSTOM',
      title: 'Post-Test Reminder',
      body,
      sendInApp: dto.sendInApp ?? true,
      sendEmail: dto.sendEmail ?? true,
      emailTemplate: 'training-post-test-reminder',
      emailContext: {
        trainingTitle: training.title,
        endDate: training.endDate.toLocaleDateString('en-IN'),
        customMessage: dto.customMessage,
      },
      data: { trainingId: dto.trainingId, reminderType: 'post_test' },
    });

    const sentCount = Array.from(results.values()).filter(r => r.success).length;

    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'Training',
      entityId: dto.trainingId,
      userId: coordinator.userId,
      userRole: Role.FACULTY_COORDINATOR,
      category: AuditCategory.TRAINING,
      severity: AuditSeverity.LOW,
      description: `Post-test reminder sent to ${sentCount} faculty for training "${training.title}"`,
    }).catch(() => {});

    return {
      success: true,
      message: `Post-test reminder sent to ${sentCount} faculty`,
      sentCount,
      totalTargeted: pendingUsers.length,
    };
  }

  /**
   * Send lesson plan reminder to faculty who haven't submitted lesson plan
   */
  async sendLessonPlanReminder(dto: SendReminderDto, coordinator: CoordinatorUser) {
    this.logger.log(`Coordinator ${coordinator.userId} sending lesson plan reminder for training ${dto.trainingId}`);

    const training = await this.prisma.training.findUnique({
      where: { id: dto.trainingId },
      select: { id: true, title: true, endDate: true },
    });

    if (!training) {
      return { success: false, message: 'Training not found', sentCount: 0 };
    }

    // Get approved faculty who haven't submitted lesson plan
    const approvedApplications = await this.prisma.trainingApplication.findMany({
      where: {
        trainingId: dto.trainingId,
        status: 'APPROVED',
        isActive: true,
        user: {
          ...(coordinator.institutionId ? { institutionId: coordinator.institutionId } : {}),
          ...this.getUserBranchScope(coordinator.branchId, coordinator.branchName),
        },
        ...(dto.userIds?.length ? { userId: { in: dto.userIds } } : {}),
      },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    });

    const lessonPlans = await this.prisma.lessonPlan.findMany({
      where: { trainingId: dto.trainingId },
      select: { userId: true },
    });

    const submittedUserIds = new Set(lessonPlans.map(lp => lp.userId));
    const pendingUsers = approvedApplications
      .filter(app => !submittedUserIds.has(app.userId))
      .map(app => app.user);

    if (pendingUsers.length === 0) {
      return { success: true, message: 'All faculty have submitted lesson plans', sentCount: 0 };
    }

    const body = dto.customMessage ||
      `Please submit your lesson plan for training "${training.title}" to share how you'll apply the learning.`;

    const results = await this.notificationSender.sendBulk({
      userIds: pendingUsers.map(u => u.id),
      type: 'CUSTOM',
      title: 'Lesson Plan Submission Reminder',
      body,
      sendInApp: dto.sendInApp ?? true,
      sendEmail: dto.sendEmail ?? true,
      emailTemplate: 'training-lesson-plan-reminder',
      emailContext: {
        trainingTitle: training.title,
        customMessage: dto.customMessage,
      },
      data: { trainingId: dto.trainingId, reminderType: 'lesson_plan' },
    });

    const sentCount = Array.from(results.values()).filter(r => r.success).length;

    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'Training',
      entityId: dto.trainingId,
      userId: coordinator.userId,
      userRole: Role.FACULTY_COORDINATOR,
      category: AuditCategory.TRAINING,
      severity: AuditSeverity.LOW,
      description: `Lesson plan reminder sent to ${sentCount} faculty for training "${training.title}"`,
    }).catch(() => {});

    return {
      success: true,
      message: `Lesson plan reminder sent to ${sentCount} faculty`,
      sentCount,
      totalTargeted: pendingUsers.length,
    };
  }

  /**
   * Send feedback reminder to faculty who haven't submitted feedback
   */
  async sendFeedbackReminder(dto: SendReminderDto, coordinator: CoordinatorUser) {
    this.logger.log(`Coordinator ${coordinator.userId} sending feedback reminder for training ${dto.trainingId}`);

    const training = await this.prisma.training.findUnique({
      where: { id: dto.trainingId },
      include: { feedbackForm: true },
    });

    if (!training) {
      return { success: false, message: 'Training not found', sentCount: 0 };
    }

    if (!training.feedbackForm) {
      return { success: false, message: 'Training does not have a feedback form', sentCount: 0 };
    }

    // Get approved faculty who haven't submitted feedback
    const approvedApplications = await this.prisma.trainingApplication.findMany({
      where: {
        trainingId: dto.trainingId,
        status: 'APPROVED',
        isActive: true,
        user: {
          ...(coordinator.institutionId ? { institutionId: coordinator.institutionId } : {}),
          ...this.getUserBranchScope(coordinator.branchId, coordinator.branchName),
        },
        ...(dto.userIds?.length ? { userId: { in: dto.userIds } } : {}),
      },
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    });

    const feedbackResponses = await this.prisma.feedbackResponse.findMany({
      where: {
        trainingId: dto.trainingId,
        feedbackFormId: training.feedbackForm.id,
      },
      select: { userId: true },
    });

    const respondedUserIds = new Set(feedbackResponses.map((response) => response.userId));
    const pendingUsers = approvedApplications
      .filter((application) => !respondedUserIds.has(application.userId))
      .map((application) => application.user);

    if (pendingUsers.length === 0) {
      return { success: true, message: 'All faculty have submitted feedback', sentCount: 0 };
    }

    const body = dto.customMessage ||
      `Please submit your feedback for training "${training.title}". Your response helps improve future sessions.`;

    const results = await this.notificationSender.sendBulk({
      userIds: pendingUsers.map((user) => user.id),
      type: 'CUSTOM',
      title: 'Training Feedback Reminder',
      body,
      sendInApp: dto.sendInApp ?? true,
      sendEmail: dto.sendEmail ?? true,
      emailTemplate: 'training-feedback-reminder',
      emailContext: {
        trainingTitle: training.title,
        customMessage: dto.customMessage,
      },
      data: { trainingId: dto.trainingId, reminderType: 'feedback' },
    });

    const sentCount = Array.from(results.values()).filter((result) => result.success).length;

    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'Training',
      entityId: dto.trainingId,
      userId: coordinator.userId,
      userRole: Role.FACULTY_COORDINATOR,
      category: AuditCategory.TRAINING,
      severity: AuditSeverity.LOW,
      description: `Feedback reminder sent to ${sentCount} faculty for training "${training.title}"`,
    }).catch(() => {});

    return {
      success: true,
      message: `Feedback reminder sent to ${sentCount} faculty`,
      sentCount,
      totalTargeted: pendingUsers.length,
    };
  }

  /**
   * Get faculty with pending actions (for targeted reminders)
   */
  async getFacultyWithPendingActions(
    institutionId: string | undefined,
    filters: PendingActionsFilterDto,
    branchId?: string,
    branchName?: string,
  ) {
    // Get all faculty from institution
    const faculty = await this.prisma.user.findMany({
      where: {
        ...(institutionId ? { institutionId } : {}),
        role: Role.TEACHER,
        active: true,
        ...this.getUserBranchScope(branchId, branchName),
      },
      select: {
        id: true,
        name: true,
        email: true,
        branchName: true,
        designation: true,
      },
    });

    // Get published trainings with application deadline in future or recently ended
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const trainings = await this.prisma.training.findMany({
      where: {
        isActive: true,
        isPublished: true,
        endDate: { gte: threeMonthsAgo },
        ...(filters.trainingId ? { id: filters.trainingId } : {}),
      },
      include: {
        feedbackForm: true,
        preTestForm: true,
        postTestForm: true,
        applications: {
          where: {
            user: {
              ...(institutionId ? { institutionId } : {}),
              ...this.getUserBranchScope(branchId, branchName),
            },
            status: 'APPROVED',
            isActive: true,
          },
          select: { userId: true },
        },
      },
    });

    const facultyActions: Record<string, {
      user: typeof faculty[0];
      pendingEnrollments: { trainingId: string; trainingTitle: string; deadline: Date; startDate: Date; endDate: Date }[];
      pendingPreTests: { trainingId: string; trainingTitle: string; startDate: Date; endDate: Date }[];
      pendingPostTests: { trainingId: string; trainingTitle: string; startDate: Date; endDate: Date }[];
      pendingLessonPlans: { trainingId: string; trainingTitle: string; startDate: Date; endDate: Date }[];
      pendingFeedbacks: { trainingId: string; trainingTitle: string; startDate: Date; endDate: Date }[];
    }> = {};

    // Initialize faculty actions
    for (const user of faculty) {
      facultyActions[user.id] = {
        user,
        pendingEnrollments: [],
        pendingPreTests: [],
        pendingPostTests: [],
        pendingLessonPlans: [],
        pendingFeedbacks: [],
      };
    }

    for (const training of trainings) {
      const enrolledUserIds = new Set(training.applications.map(a => a.userId));

      // Check pending enrollments (deadline not passed)
      if (training.applicationDeadline > now) {
        if (!filters.actionType || filters.actionType === PendingActionType.ENROLLMENT) {
          for (const user of faculty) {
            if (!enrolledUserIds.has(user.id)) {
              facultyActions[user.id].pendingEnrollments.push({
                trainingId: training.id,
                trainingTitle: training.title,
                deadline: training.applicationDeadline,
                startDate: training.startDate,
                endDate: training.endDate,
              });
            }
          }
        }
      }

      // For enrolled faculty, check other pending actions
      const enrolledFaculty = faculty.filter(u => enrolledUserIds.has(u.id));

      // Check pending pre-tests
      if (training.preTestForm && (!filters.actionType || filters.actionType === PendingActionType.PRE_TEST)) {
        const preTestResponses = await this.prisma.preTestResponse.findMany({
          where: {
            trainingId: training.id,
            preTestFormId: training.preTestForm.id,
          },
          select: { userId: true },
        });
        const respondedIds = new Set(preTestResponses.map(r => r.userId));

        for (const user of enrolledFaculty) {
          if (!respondedIds.has(user.id)) {
            facultyActions[user.id].pendingPreTests.push({
              trainingId: training.id,
              trainingTitle: training.title,
              startDate: training.startDate,
              endDate: training.endDate,
            });
          }
        }
      }

      // Check pending post-tests (only if training ended)
      if (training.postTestForm && training.endDate < now &&
          (!filters.actionType || filters.actionType === PendingActionType.POST_TEST)) {
        const postTestResponses = await this.prisma.postTestResponse.findMany({
          where: {
            trainingId: training.id,
            postTestFormId: training.postTestForm.id,
          },
          select: { userId: true },
        });
        const respondedIds = new Set(postTestResponses.map(r => r.userId));

        for (const user of enrolledFaculty) {
          if (!respondedIds.has(user.id)) {
            facultyActions[user.id].pendingPostTests.push({
              trainingId: training.id,
              trainingTitle: training.title,
              startDate: training.startDate,
              endDate: training.endDate,
            });
          }
        }
      }

      // Check pending lesson plans (only if training ended)
      if (training.endDate < now && (!filters.actionType || filters.actionType === PendingActionType.LESSON_PLAN)) {
        const lessonPlans = await this.prisma.lessonPlan.findMany({
          where: { trainingId: training.id },
          select: { userId: true },
        });
        const submittedIds = new Set(lessonPlans.map(lp => lp.userId));

        for (const user of enrolledFaculty) {
          if (!submittedIds.has(user.id)) {
            facultyActions[user.id].pendingLessonPlans.push({
              trainingId: training.id,
              trainingTitle: training.title,
              startDate: training.startDate,
              endDate: training.endDate,
            });
          }
        }
      }

      // Check pending feedback submissions (only if training ended)
      if (training.feedbackForm && training.endDate < now &&
          (!filters.actionType || filters.actionType === PendingActionType.FEEDBACK)) {
        const feedbackResponses = await this.prisma.feedbackResponse.findMany({
          where: {
            trainingId: training.id,
            feedbackFormId: training.feedbackForm.id,
          },
          select: { userId: true },
        });

        const submittedIds = new Set(feedbackResponses.map((response) => response.userId));

        for (const user of enrolledFaculty) {
          if (!submittedIds.has(user.id)) {
            facultyActions[user.id].pendingFeedbacks.push({
              trainingId: training.id,
              trainingTitle: training.title,
              startDate: training.startDate,
              endDate: training.endDate,
            });
          }
        }
      }
    }

    // Filter out faculty with no pending actions
    const facultyWithPendingActions = Object.values(facultyActions).filter(
      f => f.pendingEnrollments.length > 0 ||
           f.pendingPreTests.length > 0 ||
           f.pendingPostTests.length > 0 ||
         f.pendingLessonPlans.length > 0 ||
         f.pendingFeedbacks.length > 0
    );

    return {
      faculty: facultyWithPendingActions,
      totalFaculty: faculty.length,
      facultyWithPendingActions: facultyWithPendingActions.length,
    };
  }
}
