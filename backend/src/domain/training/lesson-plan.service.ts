import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, LessonPlanStatus, Prisma } from '../../generated/prisma/client';
import { CreateLessonPlanDto, UpdateLessonPlanDto, ReviewLessonPlanDto, LessonPlanFilterDto } from './dto';

@Injectable()
export class LessonPlanService {
  private readonly logger = new Logger(LessonPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create lesson plan (Faculty)
   */
  async create(dto: CreateLessonPlanDto, userId: string) {
    try {
      this.logger.log(`User ${userId} creating lesson plan for training ${dto.trainingId}`);

      // Verify training exists
      const training = await this.prisma.training.findUnique({
        where: { id: dto.trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      // Verify user has approved application and attended
      const application = await this.prisma.trainingApplication.findUnique({
        where: { userId_trainingId: { userId, trainingId: dto.trainingId } },
      });

      if (!application || application.status !== 'APPROVED') {
        throw new ForbiddenException('You must have an approved application to create a lesson plan');
      }

      // Check if lesson plan already exists
      const existing = await this.prisma.lessonPlan.findUnique({
        where: { userId_trainingId: { userId, trainingId: dto.trainingId } },
      });

      if (existing) {
        throw new BadRequestException('You already have a lesson plan for this training');
      }

      // Calculate due date (2-4 weeks after training ends)
      const dueDate = new Date(training.endDate);
      dueDate.setDate(dueDate.getDate() + 21); // 3 weeks default

      const lessonPlan = await this.prisma.lessonPlan.create({
        data: {
          userId,
          trainingId: dto.trainingId,
          title: dto.title,
          courseOrSemester: dto.courseOrSemester,
          connectionToTraining: dto.connectionToTraining,
          learningObjectives: dto.learningObjectives || [],
          newSkillsTechnologies: dto.newSkillsTechnologies,
          deliveryMethods: dto.deliveryMethods,
          handsOnActivities: dto.handsOnActivities,
          assessmentMethods: dto.assessmentMethods,
          industryConnections: dto.industryConnections,
          resourceRequirements: dto.resourceRequirements,
          implementationTimeline: dto.implementationTimeline,
          expectedOutcomes: dto.expectedOutcomes,
          attachments: dto.attachments || [],
          dueDate,
          status: LessonPlanStatus.DRAFT,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          training: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.LESSON_PLAN_SUBMIT,
        entityType: 'LessonPlan',
        entityId: lessonPlan.id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        description: `Created lesson plan for "${training.title}"`,
      }).catch(() => {});

      return lessonPlan;
    } catch (error) {
      this.logger.error(`Failed to create lesson plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update lesson plan (Faculty - only if draft)
   */
  async update(id: string, dto: UpdateLessonPlanDto, userId: string) {
    try {
      const existing = await this.prisma.lessonPlan.findUnique({
        where: { id },
        include: { training: { select: { title: true } } },
      });

      if (!existing) {
        throw new NotFoundException('Lesson plan not found');
      }

      if (existing.userId !== userId) {
        throw new ForbiddenException('You can only update your own lesson plan');
      }

      if (existing.status !== LessonPlanStatus.DRAFT && existing.status !== LessonPlanStatus.REVISION_REQUIRED) {
        throw new BadRequestException('Can only update lesson plans in draft or revision required status');
      }

      const updated = await this.prisma.lessonPlan.update({
        where: { id },
        data: {
          title: dto.title,
          courseOrSemester: dto.courseOrSemester,
          connectionToTraining: dto.connectionToTraining,
          learningObjectives: dto.learningObjectives,
          newSkillsTechnologies: dto.newSkillsTechnologies,
          deliveryMethods: dto.deliveryMethods,
          handsOnActivities: dto.handsOnActivities,
          assessmentMethods: dto.assessmentMethods,
          industryConnections: dto.industryConnections,
          resourceRequirements: dto.resourceRequirements,
          implementationTimeline: dto.implementationTimeline,
          expectedOutcomes: dto.expectedOutcomes,
          attachments: dto.attachments,
        },
        include: {
          user: { select: { id: true, name: true } },
          training: { select: { id: true, title: true } },
        },
      });

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update lesson plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Submit lesson plan for review (Faculty)
   */
  async submit(id: string, userId: string) {
    try {
      const lessonPlan = await this.prisma.lessonPlan.findUnique({
        where: { id },
        include: { training: { select: { title: true } } },
      });

      if (!lessonPlan) {
        throw new NotFoundException('Lesson plan not found');
      }

      if (lessonPlan.userId !== userId) {
        throw new ForbiddenException('You can only submit your own lesson plan');
      }

      if (lessonPlan.status === LessonPlanStatus.SUBMITTED || lessonPlan.status === LessonPlanStatus.UNDER_REVIEW) {
        throw new BadRequestException('Lesson plan is already submitted');
      }

      if (lessonPlan.status === LessonPlanStatus.APPROVED) {
        throw new BadRequestException('Lesson plan is already approved');
      }

      const updated = await this.prisma.lessonPlan.update({
        where: { id },
        data: {
          status: LessonPlanStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true } },
          training: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.LESSON_PLAN_SUBMIT,
        entityType: 'LessonPlan',
        entityId: id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        description: `Submitted lesson plan for "${lessonPlan.training.title}"`,
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to submit lesson plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Review lesson plan (Principal/State)
   */
  async review(id: string, dto: ReviewLessonPlanDto, reviewerId: string) {
    try {
      const lessonPlan = await this.prisma.lessonPlan.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, institutionId: true } },
          training: { select: { id: true, title: true } },
        },
      });

      if (!lessonPlan) {
        throw new NotFoundException('Lesson plan not found');
      }

      if (lessonPlan.status === LessonPlanStatus.DRAFT) {
        throw new BadRequestException('Cannot review a draft lesson plan');
      }

      const updated = await this.prisma.lessonPlan.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewComments: dto.reviewComments,
        },
        include: {
          user: { select: { id: true, name: true } },
          training: { select: { id: true, title: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.LESSON_PLAN_REVIEW,
        entityType: 'LessonPlan',
        entityId: id,
        userId: reviewerId,
        institutionId: lessonPlan.user.institutionId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        description: `Lesson plan ${dto.status.toLowerCase()} for "${lessonPlan.training.title}"`,
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to review lesson plan: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's lesson plans (Faculty)
   */
  async getMyLessonPlans(userId: string, filters: LessonPlanFilterDto) {
    try {
      const { status, trainingId } = filters;
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 20;

      const where: Prisma.LessonPlanWhereInput = {
        userId,
        ...(status ? { status } : {}),
        ...(trainingId ? { trainingId } : {}),
      };

      const [lessonPlans, total] = await Promise.all([
        this.prisma.lessonPlan.findMany({
          where,
          include: {
            training: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
              },
            },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.lessonPlan.count({ where }),
      ]);

      return {
        data: lessonPlans,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get lesson plans: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get lesson plans for review (Principal/State)
   */
  async getForReview(filters: LessonPlanFilterDto, institutionId?: string) {
    try {
      const { status, trainingId, search } = filters;
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 20;

      const where: Prisma.LessonPlanWhereInput = {
        status: status || { in: [LessonPlanStatus.SUBMITTED, LessonPlanStatus.UNDER_REVIEW] },
        ...(trainingId ? { trainingId } : {}),
        ...(institutionId ? { user: { institutionId } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { training: { title: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [lessonPlans, total] = await Promise.all([
        this.prisma.lessonPlan.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                branchName: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              },
            },
            training: { select: { id: true, title: true, startDate: true, endDate: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.lessonPlan.count({ where }),
      ]);

      // Status counts
      const statusCounts = await this.prisma.lessonPlan.groupBy({
        by: ['status'],
        where: institutionId ? { user: { institutionId } } : {},
        _count: true,
      });

      return {
        data: lessonPlans,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      };
    } catch (error) {
      this.logger.error(`Failed to get lesson plans for review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get lesson plan by ID
   */
  async getById(id: string) {
    const lessonPlan = await this.prisma.lessonPlan.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            branchName: true,
            designation: true,
            Institution: { select: { id: true, name: true, shortName: true } },
          },
        },
        training: {
          select: {
            id: true,
            title: true,
            description: true,
            startDate: true,
            endDate: true,
            learningOutcomes: true,
          },
        },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    if (!lessonPlan) {
      throw new NotFoundException('Lesson plan not found');
    }

    return lessonPlan;
  }

  /**
   * Get by training
   */
  async getByTraining(trainingId: string, institutionId?: string) {
    const lessonPlans = await this.prisma.lessonPlan.findMany({
      where: {
        trainingId,
        ...(institutionId ? { user: { institutionId } } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            branchName: true,
            Institution: { select: { id: true, name: true, shortName: true } },
          },
        },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return lessonPlans;
  }

  /**
   * Get pending count (Faculty)
   */
  async getPendingCount(userId: string) {
    const count = await this.prisma.lessonPlan.count({
      where: {
        userId,
        status: { in: [LessonPlanStatus.DRAFT, LessonPlanStatus.REVISION_REQUIRED] },
      },
    });

    return { pending: count };
  }

  /**
   * Get overdue lesson plans (Faculty)
   */
  async getOverdue(userId: string) {
    const now = new Date();

    const overdue = await this.prisma.lessonPlan.findMany({
      where: {
        userId,
        status: { in: [LessonPlanStatus.DRAFT, LessonPlanStatus.REVISION_REQUIRED] },
        dueDate: { lt: now },
      },
      include: {
        training: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return overdue;
  }

  /**
   * Get pending lesson plans for user dashboard (Faculty)
   * Rules:
   * - Applicable only after training completion
   * - Pending if no lesson plan exists, or lesson plan exists in DRAFT/REVISION_REQUIRED
   */
  async getPendingForUser(userId: string) {
    const now = new Date();

    const approvedApplications = await this.prisma.trainingApplication.findMany({
      where: {
        userId,
        status: 'APPROVED',
        isActive: true,
        training: {
          endDate: { lt: now },
        },
      },
      include: {
        training: {
          select: {
            id: true,
            title: true,
            endDate: true,
          },
        },
      },
    });

    if (approvedApplications.length === 0) {
      return { pendingLessonPlans: [], totalPending: 0 };
    }

    const trainingIds = approvedApplications.map((application) => application.trainingId);
    const lessonPlans = await this.prisma.lessonPlan.findMany({
      where: {
        userId,
        trainingId: { in: trainingIds },
      },
      select: {
        id: true,
        trainingId: true,
        status: true,
        dueDate: true,
      },
    });

    const lessonPlanByTrainingId = new Map(lessonPlans.map((lessonPlan) => [lessonPlan.trainingId, lessonPlan]));

    const pendingLessonPlans = approvedApplications
      .map((application) => {
        const lessonPlan = lessonPlanByTrainingId.get(application.trainingId);

        if (!lessonPlan) {
          return {
            type: 'CREATE_LESSON_PLAN',
            trainingId: application.training.id,
            trainingTitle: application.training.title,
            endDate: application.training.endDate,
          };
        }

        if (
          lessonPlan.status === LessonPlanStatus.DRAFT ||
          lessonPlan.status === LessonPlanStatus.REVISION_REQUIRED
        ) {
          return {
            type: 'SUBMIT_LESSON_PLAN',
            lessonPlanId: lessonPlan.id,
            trainingId: application.training.id,
            trainingTitle: application.training.title,
            status: lessonPlan.status,
            dueDate: lessonPlan.dueDate,
            endDate: application.training.endDate,
          };
        }

        return null;
      })
      .filter((item) => item !== null);

    return {
      pendingLessonPlans,
      totalPending: pendingLessonPlans.length,
    };
  }

  /**
   * Get lesson plans by user (Faculty)
   */
  async getByUser(userId: string, filters: LessonPlanFilterDto) {
    const { status, trainingId } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: Prisma.LessonPlanWhereInput = {
      userId,
      ...(status ? { status } : {}),
      ...(trainingId ? { trainingId } : {}),
    };

    const [lessonPlans, total] = await Promise.all([
      this.prisma.lessonPlan.findMany({
        where,
        include: {
          training: { select: { id: true, title: true, startDate: true, endDate: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lessonPlan.count({ where }),
    ]);

    return {
      data: lessonPlans,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get lesson plan by ID for user (validates ownership)
   */
  async getByIdForUser(id: string, userId: string) {
    const lessonPlan = await this.getById(id);
    if (lessonPlan.user.id !== userId) {
      throw new ForbiddenException('You do not have access to this lesson plan');
    }
    return lessonPlan;
  }

  /**
   * Delete lesson plan (Faculty - only draft)
   */
  async delete(id: string, userId: string) {
    const lessonPlan = await this.prisma.lessonPlan.findUnique({
      where: { id },
    });

    if (!lessonPlan) {
      throw new NotFoundException('Lesson plan not found');
    }

    if (lessonPlan.userId !== userId) {
      throw new ForbiddenException('You can only delete your own lesson plans');
    }

    if (lessonPlan.status !== LessonPlanStatus.DRAFT) {
      throw new BadRequestException('Only draft lesson plans can be deleted');
    }

    await this.prisma.lessonPlan.delete({ where: { id } });

    return { success: true, message: 'Lesson plan deleted' };
  }

  /**
   * Submit lesson plan for review (Faculty)
   */
  async submitForReview(id: string, userId: string) {
    const lessonPlan = await this.prisma.lessonPlan.findUnique({
      where: { id },
    });

    if (!lessonPlan) {
      throw new NotFoundException('Lesson plan not found');
    }

    if (lessonPlan.userId !== userId) {
      throw new ForbiddenException('You can only submit your own lesson plans');
    }

    if (lessonPlan.status !== LessonPlanStatus.DRAFT && lessonPlan.status !== LessonPlanStatus.REVISION_REQUIRED) {
      throw new BadRequestException('Only draft or revision-required lesson plans can be submitted');
    }

    const updated = await this.prisma.lessonPlan.update({
      where: { id },
      data: {
        status: LessonPlanStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get lesson plans by training for user (Faculty)
   */
  async getByTrainingForUser(trainingId: string, userId: string) {
    return this.prisma.lessonPlan.findMany({
      where: { trainingId, userId },
      include: {
        training: { select: { id: true, title: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get lesson plans by institution (Principal)
   */
  async getByInstitution(institutionId: string, filters: LessonPlanFilterDto) {
    const { status, trainingId } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: Prisma.LessonPlanWhereInput = {
      user: { institutionId },
      ...(status ? { status } : {}),
      ...(trainingId ? { trainingId } : {}),
    };

    const [lessonPlans, total] = await Promise.all([
      this.prisma.lessonPlan.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, branchName: true } },
          training: { select: { id: true, title: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lessonPlan.count({ where }),
    ]);

    return {
      data: lessonPlans,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get lesson plans by training and institution (Principal)
   */
  async getByTrainingAndInstitution(trainingId: string, institutionId: string) {
    return this.getByTraining(trainingId, institutionId);
  }

  /**
   * Get pending lesson plans for institution (Principal)
   */
  async getPendingForInstitution(institutionId: string) {
    return this.prisma.lessonPlan.findMany({
      where: {
        user: { institutionId },
        status: LessonPlanStatus.SUBMITTED,
      },
      include: {
        user: { select: { id: true, name: true, branchName: true } },
        training: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  /**
   * Get institution lesson plan statistics (Principal)
   */
  async getInstitutionStats(institutionId: string) {
    const [total, statusCounts] = await Promise.all([
      this.prisma.lessonPlan.count({
        where: { user: { institutionId } },
      }),
      this.prisma.lessonPlan.groupBy({
        by: ['status'],
        where: { user: { institutionId } },
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
    };
  }
}
