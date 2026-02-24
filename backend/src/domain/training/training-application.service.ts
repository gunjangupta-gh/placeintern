import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, TrainingApplicationStatus, Prisma } from '../../generated/prisma/client';
import { CreateApplicationDto, ReviewApplicationDto, BulkReviewApplicationDto, ApplicationFilterDto, ApplyForTrainingDto } from './dto';

@Injectable()
export class TrainingApplicationService {
  private readonly logger = new Logger(TrainingApplicationService.name);
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  private async resolveUserBranchId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true, branchName: true },
    });

    if (!user) {
      return null;
    }

    if (user.branchId) {
      return user.branchId;
    }

    const normalizedBranchName = user.branchName?.trim();
    if (!normalizedBranchName) {
      return null;
    }

    const matchedBranch = await this.prisma.branch.findFirst({
      where: {
        OR: [
          { code: { equals: normalizedBranchName, mode: 'insensitive' } },
          { shortName: { equals: normalizedBranchName, mode: 'insensitive' } },
          { name: { equals: normalizedBranchName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    return matchedBranch?.id || null;
  }

  /**
   * Apply for a training (Faculty)
   */
  async apply(trainingId: string, dto: CreateApplicationDto, userId: string) {
    try {
      this.logger.log(`User ${userId} applying for training ${trainingId}`);

      // Check if training exists and is published
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
        include: {
          targetBranches: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (!training.isPublished) {
        throw new BadRequestException('Training is not available for applications');
      }

      if (!training.isActive) {
        throw new BadRequestException('Training is no longer active');
      }

      // Enforce branch eligibility only when training is branch-targeted
      if (training.targetBranches?.length > 0) {
        const resolvedBranchId = await this.resolveUserBranchId(userId);

        if (!resolvedBranchId) {
          throw new ForbiddenException('Your profile is not mapped to a branch');
        }

        const isBranchAllowed = training.targetBranches.some((branch) => branch.id === resolvedBranchId);
        if (!isBranchAllowed) {
          throw new ForbiddenException('This training is not available for your branch');
        }
      }

      // Check deadline
      if (new Date() > training.applicationDeadline) {
        throw new BadRequestException('Application deadline has passed');
      }

      // Check capacity
      const approvedCount = await this.prisma.trainingApplication.count({
        where: { trainingId, status: 'APPROVED' },
      });

      if (approvedCount >= training.capacity) {
        throw new BadRequestException('Training is at full capacity');
      }

      // Check if already applied
      const existing = await this.prisma.trainingApplication.findUnique({
        where: { userId_trainingId: { userId, trainingId } },
      });

      if (existing) {
        // If application was withdrawn (isActive: false), reactivate it
        if (!existing.isActive) {
          const application = await this.prisma.trainingApplication.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              relevanceToTeaching: dto.relevanceToTeaching,
              expectedApplication: dto.expectedApplication,
              status: TrainingApplicationStatus.SUBMITTED,
              appliedAt: new Date(),
              reviewedAt: null,
              reviewedById: null,
              reviewComments: null,
            },
            include: {
              user: { select: { id: true, name: true, email: true, institutionId: true } },
              training: { select: { id: true, title: true, startDate: true, endDate: true } },
            },
          });

          await this.invalidateCache(userId, trainingId);

          this.auditService.log({
            action: AuditAction.TRAINING_APPLICATION_SUBMIT,
            entityType: 'TrainingApplication',
            entityId: application.id,
            userId,
            category: AuditCategory.APPLICATION_PROCESS,
            severity: AuditSeverity.LOW,
            description: `Re-applied for training "${training.title}"`,
          }).catch(() => {});

          return application;
        }

        throw new BadRequestException('You have already applied for this training');
      }

      const application = await this.prisma.trainingApplication.create({
        data: {
          userId,
          trainingId,
          relevanceToTeaching: dto.relevanceToTeaching,
          expectedApplication: dto.expectedApplication,
          status: TrainingApplicationStatus.SUBMITTED,
        },
        include: {
          user: { select: { id: true, name: true, email: true, institutionId: true } },
          training: { select: { id: true, title: true, startDate: true, endDate: true } },
        },
      });

      await this.invalidateCache(userId, trainingId);

      this.auditService.log({
        action: AuditAction.TRAINING_APPLICATION_SUBMIT,
        entityType: 'TrainingApplication',
        entityId: application.id,
        userId,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.LOW,
        description: `Applied for training "${training.title}"`,
      }).catch(() => {});

      return application;
    } catch (error) {
      this.logger.error(`Failed to apply for training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Withdraw application (Faculty)
   */
  async withdraw(applicationId: string, userId: string) {
    try {
      const application = await this.prisma.trainingApplication.findUnique({
        where: { id: applicationId },
        include: { training: true },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (application.userId !== userId) {
        throw new ForbiddenException('You can only withdraw your own application');
      }

      if (application.status === 'APPROVED') {
        throw new BadRequestException('Cannot withdraw an approved application. Contact administrator.');
      }

      await this.prisma.trainingApplication.update({
        where: { id: applicationId },
        data: { isActive: false },
      });

      await this.invalidateCache(userId, application.trainingId);

      return { success: true, message: 'Application withdrawn successfully' };
    } catch (error) {
      this.logger.error(`Failed to withdraw application: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's applications (Faculty)
   */
  async getMyApplications(userId: string, filters: ApplicationFilterDto) {
    try {
      const { status, trainingId } = filters;
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 20;

      const where: Prisma.TrainingApplicationWhereInput = {
        userId,
        isActive: true,
        ...(status ? { status } : {}),
        ...(trainingId ? { trainingId } : {}),
      };

      const [applications, total] = await Promise.all([
        this.prisma.trainingApplication.findMany({
          where,
          include: {
            training: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                deliveryMode: true,
                venue: true,
                city: true,
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.trainingApplication.count({ where }),
      ]);

      // Get today's attendance status for approved applications
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const approvedTrainingIds = applications
        .filter(app => app.status === 'APPROVED')
        .map(app => app.trainingId);

      const todayAttendance = approvedTrainingIds.length > 0
        ? await this.prisma.trainingAttendance.findMany({
            where: {
              userId,
              trainingId: { in: approvedTrainingIds },
              attendanceDate: {
                gte: today,
                lt: tomorrow,
              },
            },
            select: { trainingId: true },
          })
        : [];

      const attendanceMarkedToday = new Set(todayAttendance.map(a => a.trainingId));

      // Add attendance status to each application
      const applicationsWithAttendance = applications.map(app => ({
        ...app,
        hasMarkedAttendanceToday: attendanceMarkedToday.has(app.trainingId),
      }));

      return {
        data: applicationsWithAttendance,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get applications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Review application (Principal/State)
   */
  async review(applicationId: string, dto: ReviewApplicationDto, reviewerId: string, institutionId?: string) {
    try {
      const application = await this.prisma.trainingApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: { select: { id: true, name: true, institutionId: true } },
          training: { select: { id: true, title: true, capacity: true } },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (institutionId && application.user.institutionId !== institutionId) {
        throw new ForbiddenException('You can only review applications from your institution');
      }

      // Check capacity if approving
      if (dto.status === 'APPROVED') {
        const approvedCount = await this.prisma.trainingApplication.count({
          where: { trainingId: application.trainingId, status: 'APPROVED' },
        });

        if (approvedCount >= application.training.capacity) {
          throw new BadRequestException('Training is at full capacity. Consider waitlisting instead.');
        }
      }

      const updated = await this.prisma.trainingApplication.update({
        where: { id: applicationId },
        data: {
          status: dto.status,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewComments: dto.reviewComments,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          training: { select: { id: true, title: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      });

      await this.invalidateCache(application.userId, application.trainingId);

      this.auditService.log({
        action: AuditAction.TRAINING_APPLICATION_REVIEW,
        entityType: 'TrainingApplication',
        entityId: applicationId,
        userId: reviewerId,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.MEDIUM,
        description: `Application ${dto.status.toLowerCase()} for "${application.training.title}"`,
        institutionId: application.user.institutionId,
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to review application: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Bulk review applications (State/Principal)
   */
  async bulkReview(dto: BulkReviewApplicationDto, reviewerId: string, institutionId?: string) {
    try {
      const { applicationIds, status, reviewComments } = dto;

      // Validate applications exist
      const applications = await this.prisma.trainingApplication.findMany({
        where: {
          id: { in: applicationIds },
          ...(institutionId ? { user: { institutionId } } : {}),
        },
        include: { user: { select: { id: true, institutionId: true } } },
      });

      if (applications.length !== applicationIds.length) {
        throw new BadRequestException('Some applications not found or not accessible');
      }

      // Update all
      await this.prisma.trainingApplication.updateMany({
        where: { id: { in: applicationIds } },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          reviewComments,
        },
      });

      // Invalidate cache for all affected users
      await Promise.all(
        applications.map((app) => this.invalidateCache(app.userId, app.trainingId))
      );

      return {
        success: true,
        message: `${applications.length} applications ${status.toLowerCase()}`,
        count: applications.length,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk review applications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get applications by training (State/Principal)
   */
  async getByTraining(trainingId: string, filters: ApplicationFilterDto, institutionId?: string) {
    try {
      const { status, search } = filters;
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 20;

      const where: Prisma.TrainingApplicationWhereInput = {
        trainingId,
        isActive: true,
        ...(status ? { status } : {}),
        ...(institutionId ? { user: { institutionId } } : {}),
        ...(search
          ? {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      };

      const [applications, total] = await Promise.all([
        this.prisma.trainingApplication.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNo: true,
                designation: true,
                branchName: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              },
            },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { appliedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.trainingApplication.count({ where }),
      ]);

      // Get status counts
      const statusCounts = await this.prisma.trainingApplication.groupBy({
        by: ['status'],
        where: { trainingId, isActive: true, ...(institutionId ? { user: { institutionId } } : {}) },
        _count: true,
      });

      return {
        data: applications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      };
    } catch (error) {
      this.logger.error(`Failed to get applications by training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get applications by institution (Principal)
   */
  async getByInstitution(institutionId: string, filters: ApplicationFilterDto) {
    try {
      const { status, trainingId, search } = filters;
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 20;

      const where: Prisma.TrainingApplicationWhereInput = {
        user: { institutionId },
        isActive: true,
        ...(status ? { status } : {}),
        ...(trainingId ? { trainingId } : {}),
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { training: { title: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [applications, total] = await Promise.all([
        this.prisma.trainingApplication.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, branchName: true, designation: true } },
            training: { select: { id: true, title: true, startDate: true, endDate: true, deliveryMode: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: { appliedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.trainingApplication.count({ where }),
      ]);

      return {
        data: applications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get institution applications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get application details
   */
  async getById(id: string, institutionId?: string) {
    const application = await this.prisma.trainingApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            designation: true,
            branchName: true,
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
            deliveryMode: true,
            venue: true,
            city: true,
          },
        },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (institutionId && application.user.Institution?.id !== institutionId) {
      throw new ForbiddenException('You do not have access to this application');
    }

    return application;
  }

  /**
   * Check capacity
   */
  async checkCapacity(trainingId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      select: { capacity: true },
    });

    if (!training) {
      throw new NotFoundException('Training not found');
    }

    const approvedCount = await this.prisma.trainingApplication.count({
      where: { trainingId, status: 'APPROVED' },
    });

    return {
      total: training.capacity,
      approved: approvedCount,
      available: training.capacity - approvedCount,
      isFull: approvedCount >= training.capacity,
    };
  }

  /**
   * Get applications by user (Faculty)
   */
  async getByUser(userId: string, filters: ApplicationFilterDto) {
    return this.getMyApplications(userId, filters);
  }

  /**
   * Get application by ID for user (validates ownership)
   */
  async getByIdForUser(id: string, userId: string) {
    const application = await this.getById(id);
    if (application.user.id !== userId) {
      throw new ForbiddenException('You do not have access to this application');
    }
    return application;
  }

  /**
   * Apply for training using ApplyForTrainingDto (Faculty)
   */
  async applyWithDto(dto: ApplyForTrainingDto, userId: string, institutionId: string) {
    return this.apply(dto.trainingId, {
      relevanceToTeaching: dto.relevanceToTeaching,
      expectedApplication: dto.expectedApplication,
    }, userId);
  }

  /**
   * Get application status for a specific training (Faculty)
   */
  async getStatusForTraining(trainingId: string, userId: string) {
    // Use findFirst to filter by isActive (withdrawn applications have isActive: false)
    const application = await this.prisma.trainingApplication.findFirst({
      where: {
        userId,
        trainingId,
        isActive: true,
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        reviewedAt: true,
        reviewComments: true,
      },
    });

    if (!application) {
      return { hasApplied: false };
    }

    return {
      hasApplied: true,
      ...application,
    };
  }

  /**
   * Get applications by training and institution (Principal)
   */
  async getByTrainingAndInstitution(trainingId: string, institutionId: string, filters: ApplicationFilterDto) {
    return this.getByTraining(trainingId, filters, institutionId);
  }

  /**
   * Get institution application statistics (Principal)
   */
  async getInstitutionStats(institutionId: string) {
    const [totalApplications, statusCounts, recentApplications] = await Promise.all([
      this.prisma.trainingApplication.count({
        where: { user: { institutionId }, isActive: true },
      }),
      this.prisma.trainingApplication.groupBy({
        by: ['status'],
        where: { user: { institutionId }, isActive: true },
        _count: true,
      }),
      this.prisma.trainingApplication.findMany({
        where: { user: { institutionId }, isActive: true },
        take: 10,
        orderBy: { appliedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          training: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      totalApplications,
      byStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      recentApplications,
    };
  }

  private async invalidateCache(userId: string, trainingId: string) {
    await Promise.all([
      this.cache.del(`training:applications:user:${userId}`),
      this.cache.del(`training:applications:training:${trainingId}`),
    ]).catch(() => {});
  }
}
