import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, TrainingApplicationStatus, Prisma } from '../../generated/prisma/client';
import { CreateApplicationDto, ReviewApplicationDto, BulkReviewApplicationDto, ApplicationFilterDto, ApplyForTrainingDto } from './dto';
import { ExcelUtils } from '../../core/common/utils/excel.util';

interface BulkApplicationUploadRow {
  rowNumber: number;
  trainingName: string;
  trainingStartDate?: string;
  facultyName?: string;
  facultyEmail?: string;
  facultyPhone?: string;
  designation?: string;
  institutionName?: string;
  courseName?: string;
}

interface ResolvedBulkApplicationRow {
  rowNumber: number;
  trainingId: string;
  trainingTitle: string;
  userId: string;
  facultyName: string;
  facultyEmail?: string | null;
}

interface BulkApplicationFailedRow {
  rowNumber: number;
  reason: string;
  trainingName?: string;
  trainingStartDate?: string;
  facultyName?: string;
  facultyEmail?: string;
  facultyPhone?: string;
}

@Injectable()
export class TrainingApplicationService {
  private readonly logger = new Logger(TrainingApplicationService.name);
  private readonly CACHE_TTL = 300;
  private readonly BULK_UPLOAD_BATCH_SIZE = 100;
  private readonly TEMPLATE_ROWS_PER_TRAINING = 3;

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
  async apply(trainingId: string, dto: CreateApplicationDto, userId: string, enforceBranchEligibility = true) {
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

      // Enforce branch eligibility only when explicitly enabled.
      // Faculty flow can disable this to allow cross-branch applications.
      if (enforceBranchEligibility && training.targetBranches?.length > 0) {
        const resolvedBranchId = await this.resolveUserBranchId(userId);

        if (!resolvedBranchId) {
          throw new ForbiddenException('Your profile is not mapped to a branch');
        }

        const isBranchAllowed = training.targetBranches.some((branch) => branch.id === resolvedBranchId);
        if (!isBranchAllowed) {
          throw new ForbiddenException('This training is not available for your branch');
        }
      }

      // Check deadline (inclusive): allow applying until the end of the deadline day.
      const now = new Date();
      const deadlineEndOfDay = new Date(training.applicationDeadline);
      deadlineEndOfDay.setHours(23, 59, 59, 999);

      if (now > deadlineEndOfDay) {
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
  async review(
    applicationId: string,
    dto: ReviewApplicationDto,
    reviewerId: string,
    institutionId?: string,
    branchName?: string,
    branchId?: string,
  ) {
    try {
      const application = await this.prisma.trainingApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: { select: { id: true, name: true, institutionId: true, branchName: true } },
          training: { select: { id: true, title: true, capacity: true } },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      if (institutionId && application.user.institutionId !== institutionId) {
        throw new ForbiddenException('You can only review applications from your institution');
      }

      if (branchName && application.user.branchName?.toLowerCase() !== branchName.toLowerCase()) {
        throw new ForbiddenException('You can only review applications from your branch');
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
  async bulkReview(
    dto: BulkReviewApplicationDto,
    reviewerId: string,
    institutionId?: string,
    branchName?: string,
    branchId?: string,
  ) {
    try {
      const { applicationIds, status, reviewComments } = dto;

      // Validate applications exist
      const applications = await this.prisma.trainingApplication.findMany({
        where: {
          id: { in: applicationIds },
          ...(institutionId || branchName
            ? {
                user: {
                  ...(institutionId ? { institutionId } : {}),
                  ...(branchName ? { branchName: { equals: branchName, mode: 'insensitive' } } : {}),
                },
              }
            : {}),
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
   * Get applications by institution (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getByInstitution(institutionId: string | undefined, filters: ApplicationFilterDto, branchName?: string, branchId?: string) {
    try {
      const { status, trainingId, search } = filters;
      const page = Number(filters.page) || 1;
      const limit = Number(filters.limit) || 20;

      // Build user filter - if no institutionId, filter by branch across all institutions
      const userFilter: Prisma.UserWhereInput = institutionId
        ? {
            institutionId,
            ...(branchName
              ? { branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }
              : {}),
          }
        : branchName || branchId
          ? {
              OR: [
                ...(branchName
                  ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
                  : []),
                ...(branchId ? [{ branchId }] : []),
              ],
            }
          : {};

      const where: Prisma.TrainingApplicationWhereInput = {
        user: userFilter,
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
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                branchName: true,
                designation: true,
                phoneNo: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              }
            },
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
  async getById(id: string, institutionId?: string, branchName?: string, branchId?: string) {
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
            branchId: true,
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

    // Check branch access - either by branchName or branchId
    if (branchName || branchId) {
      const hasAccess =
        (branchName && application.user.branchName?.toLowerCase() === branchName.toLowerCase()) ||
        (branchId && application.user.branchId === branchId);

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this application');
      }
    }

    return application;
  }

  /**
   * Permanently delete an application (State only)
   */
  async permanentlyDelete(applicationId: string, deletedByUserId: string) {
    try {
      const application = await this.prisma.trainingApplication.findUnique({
        where: { id: applicationId },
        include: {
          user: { select: { id: true, institutionId: true, name: true } },
          training: { select: { id: true, title: true } },
        },
      });

      if (!application) {
        throw new NotFoundException('Application not found');
      }

      await this.prisma.trainingApplication.delete({
        where: { id: applicationId },
      });

      await this.invalidateCache(application.userId, application.trainingId);

      this.auditService.log({
        action: AuditAction.TRAINING_DELETE,
        entityType: 'TrainingApplication',
        entityId: applicationId,
        userId: deletedByUserId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.HIGH,
        description: `Permanently deleted application for "${application.training.title}" by ${application.user.name || 'faculty'}`,
        institutionId: application.user.institutionId || undefined,
      }).catch(() => {});

      return {
        success: true,
        id: applicationId,
        message: 'Application permanently deleted',
      };
    } catch (error) {
      this.logger.error(`Failed to permanently delete application: ${error.message}`, error.stack);
      throw error;
    }
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
    }, userId, false);
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
   * Get applications by training and institution (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getByTrainingAndInstitution(
    trainingId: string,
    institutionId: string | undefined,
    filters: ApplicationFilterDto,
    branchName?: string,
    branchId?: string,
  ) {
    // If no branch filtering needed, use the standard method
    if (!branchName && !branchId) {
      return this.getByTraining(trainingId, filters, institutionId);
    }

    const branchFilters: ApplicationFilterDto = {
      ...filters,
      search: filters.search?.trim(),
    };

    const page = Number(branchFilters.page) || 1;
    const limit = Number(branchFilters.limit) || 20;

    // Build user filter - if no institutionId, filter by branch across all institutions
    const userFilter: Prisma.UserWhereInput = institutionId
      ? {
          institutionId,
          ...(branchName || branchId
            ? {
                OR: [
                  ...(branchName
                    ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
                    : []),
                  ...(branchId ? [{ branchId }] : []),
                ],
              }
            : {}),
        }
      : {
          OR: [
            ...(branchName
              ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
              : []),
            ...(branchId ? [{ branchId }] : []),
          ],
        };

    const where: Prisma.TrainingApplicationWhereInput = {
      trainingId,
      isActive: true,
      user: userFilter,
      ...(branchFilters.status ? { status: branchFilters.status } : {}),
      ...(branchFilters.search
        ? {
            OR: [
              { user: { name: { contains: branchFilters.search, mode: 'insensitive' } } },
              { user: { email: { contains: branchFilters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [applications, total, statusCounts] = await Promise.all([
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
      this.prisma.trainingApplication.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    return {
      data: applications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
    };
  }

  /**
   * Get institution application statistics (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getInstitutionStats(institutionId: string | undefined, branchName?: string, branchId?: string) {
    // Build user filter - if no institutionId, filter by branch across all institutions
    const userFilter: Prisma.UserWhereInput = institutionId
      ? {
          institutionId,
          ...(branchName
            ? { branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }
            : {}),
        }
      : branchName || branchId
        ? {
            OR: [
              ...(branchName
                ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
                : []),
              ...(branchId ? [{ branchId }] : []),
            ],
          }
        : {};

    const [totalApplications, statusCounts, recentApplications] = await Promise.all([
      this.prisma.trainingApplication.count({
        where: { user: userFilter, isActive: true },
      }),
      this.prisma.trainingApplication.groupBy({
        by: ['status'],
        where: { user: userFilter, isActive: true },
        _count: true,
      }),
      this.prisma.trainingApplication.findMany({
        where: { user: userFilter, isActive: true },
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

  private normalizeText(value?: string | null): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[.,\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizePhone(value?: string | null): string {
    return String(value || '').replace(/\D/g, '');
  }

  private parseExcelDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate;
    }

    return null;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private pickColumn(row: Record<string, any>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private async parseBulkApplicationRows(buffer: Buffer): Promise<BulkApplicationUploadRow[]> {
    const { workbook } = await ExcelUtils.read(buffer);
    const rawRows = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });

    let lastTrainingName = '';
    let lastTrainingStartDate = '';

    return rawRows
      .map((row, index) => {
        const currentTrainingName = this.pickColumn(row, ['Training Name', 'Training Title', 'Training']);
        const currentTrainingStartDate = this.pickColumn(row, ['Training Start Date', 'Start Date']);

        if (currentTrainingName) {
          lastTrainingName = currentTrainingName;
        }
        if (currentTrainingStartDate) {
          lastTrainingStartDate = currentTrainingStartDate;
        }

        const mapped: BulkApplicationUploadRow = {
          rowNumber: index + 2,
          // Allow grouped Excel format where training is specified once and subsequent faculty rows keep it blank.
          trainingName: currentTrainingName || lastTrainingName,
          trainingStartDate: currentTrainingStartDate || lastTrainingStartDate,
          facultyName: this.pickColumn(row, [
            'Faculty Name',
            'Name of Faculty',
            'Name of the Faculty',
            'Faculty Details Name',
            'Name',
          ]),
          facultyEmail: this.pickColumn(row, ['Faculty Email', 'E-mail', 'Email']),
          facultyPhone: this.pickColumn(row, ['Faculty Phone', 'Phone', 'Mobile', 'Contact Number']),
          designation: this.pickColumn(row, ['Designation']),
          institutionName: this.pickColumn(row, ['College', 'Institution', 'Name of the College']),
          courseName: this.pickColumn(row, ['Course', 'Branch', 'Department']),
        };

        const hasFacultyInput = Boolean(
          mapped.facultyName ||
          mapped.facultyEmail ||
          mapped.facultyPhone,
        );

        // Skip template placeholder/blank rows silently.
        if (!hasFacultyInput) {
          return null;
        }

        return mapped;
      })
      .filter((row): row is BulkApplicationUploadRow => Boolean(row));
  }

  async getBulkApplicationTemplate(): Promise<Buffer> {
    const trainings = await this.prisma.training.findMany({
      where: { isActive: true },
      select: {
        title: true,
        startDate: true,
        endDate: true,
        applicationDeadline: true,
        isPublished: true,
      },
      orderBy: [{ startDate: 'desc' }, { title: 'asc' }],
      take: 250,
    });

    return ExcelUtils.buildWorkbook((workbook) => {
      const templateSheet = workbook.addWorksheet('Bulk Nominations');
      const catalogSheet = workbook.addWorksheet('Training Catalog');

      templateSheet.columns = [
        { header: 'Training Name', key: 'trainingName', width: 44 },
        { header: 'Training Start Date', key: 'trainingStartDate', width: 18 },
        { header: 'Faculty Name', key: 'facultyName', width: 28 },
        { header: 'Faculty Email', key: 'facultyEmail', width: 34 },
        { header: 'Faculty Phone', key: 'facultyPhone', width: 18 },
      ];

      templateSheet.getRow(1).font = { bold: true };
      templateSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F0FE' },
      };

      const baseRows = Math.max(20, trainings.length * this.TEMPLATE_ROWS_PER_TRAINING);

      if (trainings.length > 0) {
        trainings.forEach((training) => {
          for (let slot = 0; slot < this.TEMPLATE_ROWS_PER_TRAINING; slot += 1) {
            templateSheet.addRow({
              trainingName: training.title,
              trainingStartDate: this.formatDateKey(training.startDate),
              facultyName: '',
              facultyEmail: '',
              facultyPhone: '',
            });
          }
        });
      }

      while (templateSheet.rowCount - 1 < baseRows) {
        templateSheet.addRow({
          trainingName: '',
          trainingStartDate: '',
          facultyName: '',
          facultyEmail: '',
          facultyPhone: '',
        });
      }

      catalogSheet.columns = [
        { header: 'Training Name', key: 'title', width: 44 },
        { header: 'Start Date', key: 'startDate', width: 16 },
        { header: 'End Date', key: 'endDate', width: 16 },
        { header: 'Application Deadline', key: 'deadline', width: 20 },
        { header: 'Published', key: 'published', width: 14 },
      ];

      catalogSheet.getRow(1).font = { bold: true };
      trainings.forEach((training) => {
        catalogSheet.addRow({
          title: training.title,
          startDate: this.formatDateKey(training.startDate),
          endDate: this.formatDateKey(training.endDate),
          deadline: this.formatDateKey(training.applicationDeadline),
          published: training.isPublished ? 'Yes' : 'No',
        });
      });
    });
  }

  async bulkCreateFromExcel(buffer: Buffer, uploadedByUserId: string) {
    const rows = await this.parseBulkApplicationRows(buffer);

    if (!rows.length) {
      throw new BadRequestException('No nomination rows found in the uploaded file');
    }

    if (rows.length > 2000) {
      throw new BadRequestException('Maximum 2000 rows are allowed per upload');
    }

    const failedRows: BulkApplicationFailedRow[] = [];

    const trainings = await this.prisma.training.findMany({
      where: { isActive: true },
      select: { id: true, title: true, startDate: true },
    });

    const trainingMap = new Map<string, Array<{ id: string; title: string; startDate: Date }>>();
    trainings.forEach((training) => {
      const key = this.normalizeText(training.title);
      if (!trainingMap.has(key)) {
        trainingMap.set(key, []);
      }
      trainingMap.get(key)?.push(training);
    });

    const emailSet = new Set<string>();
    const phoneSet = new Set<string>();
    const nameSet = new Set<string>();

    rows.forEach((row) => {
      if (row.facultyEmail) {
        emailSet.add(row.facultyEmail.toLowerCase());
      }
      if (row.facultyPhone) {
        const normalized = this.normalizePhone(row.facultyPhone);
        if (normalized) {
          phoneSet.add(normalized);
        }
      }
      if (row.facultyName) {
        nameSet.add(row.facultyName);
      }
    });

    const userCandidates = await this.prisma.user.findMany({
      where: {
        active: true,
        role: {
          in: ['TEACHER', 'FACULTY_COORDINATOR', 'PRINCIPAL'],
        },
        OR: [
          ...(emailSet.size ? [{ email: { in: Array.from(emailSet) } }] : []),
          ...(phoneSet.size ? [{ phoneNo: { in: Array.from(phoneSet) } }] : []),
          ...(nameSet.size ? [{ name: { in: Array.from(nameSet) } }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        designation: true,
        branchName: true,
        Institution: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    });

    const resolvedRows: ResolvedBulkApplicationRow[] = [];

    const buildFailedRow = (row: BulkApplicationUploadRow, reason: string): BulkApplicationFailedRow => ({
      rowNumber: row.rowNumber,
      reason,
      trainingName: row.trainingName,
      trainingStartDate: row.trainingStartDate,
      facultyName: row.facultyName,
      facultyEmail: row.facultyEmail,
      facultyPhone: row.facultyPhone,
    });

    for (const row of rows) {
      if (!row.trainingName) {
        failedRows.push(buildFailedRow(row, 'Training Name is required'));
        continue;
      }

      const matchingTrainings = trainingMap.get(this.normalizeText(row.trainingName)) || [];
      if (!matchingTrainings.length) {
        failedRows.push(buildFailedRow(row, `Training not found: ${row.trainingName}`));
        continue;
      }

      let matchedTraining = matchingTrainings[0];
      if (matchingTrainings.length > 1) {
        const parsedStartDate = this.parseExcelDate(row.trainingStartDate);
        if (!parsedStartDate) {
          failedRows.push(
            buildFailedRow(
              row,
              `Multiple trainings matched "${row.trainingName}". Provide Training Start Date to disambiguate.`,
            ),
          );
          continue;
        }

        const dateKey = this.formatDateKey(parsedStartDate);
        const byDate = matchingTrainings.find((training) => this.formatDateKey(training.startDate) === dateKey);
        if (!byDate) {
          failedRows.push(buildFailedRow(row, `Training date mismatch for "${row.trainingName}" (${dateKey})`));
          continue;
        }
        matchedTraining = byDate;
      }

      if (!row.facultyName && !row.facultyEmail && !row.facultyPhone) {
        failedRows.push(buildFailedRow(row, 'Faculty identification is required (Name, Email, or Phone)'));
        continue;
      }

      const emailKey = row.facultyEmail ? row.facultyEmail.toLowerCase() : '';
      const phoneKey = row.facultyPhone ? this.normalizePhone(row.facultyPhone) : '';
      const nameKey = row.facultyName ? this.normalizeText(row.facultyName) : '';

      const scoredCandidates = userCandidates
        .map((candidate) => {
          const emailMatch = Boolean(
            emailKey && String(candidate.email || '').toLowerCase() === emailKey,
          );
          const phoneMatch = Boolean(
            phoneKey && this.normalizePhone(candidate.phoneNo) === phoneKey,
          );
          const nameMatch = Boolean(
            nameKey && this.normalizeText(candidate.name) === nameKey,
          );

          const score = Number(emailMatch) + Number(phoneMatch) + Number(nameMatch);
          return {
            candidate,
            score,
            emailMatch,
            phoneMatch,
            nameMatch,
          };
        })
        .filter((item) => item.score > 0);

      if (scoredCandidates.length === 0) {
        const hints: string[] = [];
        if (emailKey) hints.push(`email=${row.facultyEmail}`);
        if (phoneKey) hints.push(`phone=${row.facultyPhone}`);
        if (nameKey) hints.push(`name=${row.facultyName}`);

        failedRows.push(
          buildFailedRow(
            row,
            `Faculty member not found. Checked by ${hints.join(', ') || 'available identifiers'}`,
          ),
        );
        continue;
      }

      const bestScore = Math.max(...scoredCandidates.map((item) => item.score));
      const bestMatches = scoredCandidates.filter((item) => item.score === bestScore);

      if (bestMatches.length > 1) {
        const matchedBy = [
          bestMatches.some((m) => m.emailMatch) ? 'email' : null,
          bestMatches.some((m) => m.phoneMatch) ? 'phone' : null,
          bestMatches.some((m) => m.nameMatch) ? 'name' : null,
        ].filter(Boolean).join(', ');

        failedRows.push(
          buildFailedRow(
            row,
            `Faculty match is ambiguous (${bestMatches.length} users matched by ${matchedBy || 'provided identifiers'}). Add exact email or phone.`,
          ),
        );
        continue;
      }

      const matchedUser = bestMatches[0].candidate;
      resolvedRows.push({
        rowNumber: row.rowNumber,
        trainingId: matchedTraining.id,
        trainingTitle: matchedTraining.title,
        userId: matchedUser.id,
        facultyName: matchedUser.name,
        facultyEmail: matchedUser.email,
      });
    }

    if (!resolvedRows.length) {
      return {
        success: false,
        message: 'No valid rows found for processing',
        summary: {
          totalRows: rows.length,
          created: 0,
          reactivated: 0,
          skipped: 0,
          failed: failedRows.length,
        },
        failedRows,
        processedRows: [],
      };
    }

    const uniqueRowMap = new Map<string, ResolvedBulkApplicationRow>();
    for (const row of resolvedRows) {
      const key = `${row.userId}::${row.trainingId}`;
      if (!uniqueRowMap.has(key)) {
        uniqueRowMap.set(key, row);
      } else {
        failedRows.push({
          rowNumber: row.rowNumber,
          reason: 'Duplicate nomination row in file for the same faculty and training',
          trainingName: row.trainingTitle,
          facultyName: row.facultyName,
          facultyEmail: row.facultyEmail || undefined,
        });
      }
    }

    const uniqueRows = Array.from(uniqueRowMap.values());
    const uniqueUserIds = Array.from(new Set(uniqueRows.map((row) => row.userId)));
    const uniqueTrainingIds = Array.from(new Set(uniqueRows.map((row) => row.trainingId)));

    const existingApplications = await this.prisma.trainingApplication.findMany({
      where: {
        userId: { in: uniqueUserIds },
        trainingId: { in: uniqueTrainingIds },
      },
      select: {
        id: true,
        userId: true,
        trainingId: true,
        isActive: true,
      },
    });

    const existingMap = new Map<string, { id: string; isActive: boolean }>();
    existingApplications.forEach((application) => {
      existingMap.set(`${application.userId}::${application.trainingId}`, {
        id: application.id,
        isActive: application.isActive,
      });
    });

    const toCreate: Array<{
      userId: string;
      trainingId: string;
    }> = [];
    const toReactivate: Array<{
      id: string;
    }> = [];

    let skipped = 0;
    const processedRows: Array<{ rowNumber: number; action: 'CREATED' | 'REACTIVATED' | 'SKIPPED'; trainingName: string; facultyName: string }> = [];

    uniqueRows.forEach((row) => {
      const key = `${row.userId}::${row.trainingId}`;
      const existing = existingMap.get(key);

      if (!existing) {
        toCreate.push({
          userId: row.userId,
          trainingId: row.trainingId,
        });
        processedRows.push({
          rowNumber: row.rowNumber,
          action: 'CREATED',
          trainingName: row.trainingTitle,
          facultyName: row.facultyName,
        });
        return;
      }

      if (!existing.isActive) {
        toReactivate.push({
          id: existing.id,
        });
        processedRows.push({
          rowNumber: row.rowNumber,
          action: 'REACTIVATED',
          trainingName: row.trainingTitle,
          facultyName: row.facultyName,
        });
        return;
      }

      skipped += 1;
      processedRows.push({
        rowNumber: row.rowNumber,
        action: 'SKIPPED',
        trainingName: row.trainingTitle,
        facultyName: row.facultyName,
      });
    });

    for (let i = 0; i < toCreate.length; i += this.BULK_UPLOAD_BATCH_SIZE) {
      const batch = toCreate.slice(i, i + this.BULK_UPLOAD_BATCH_SIZE);
      const approvedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.trainingApplication.createMany({
          data: batch.map((item) => ({
            userId: item.userId,
            trainingId: item.trainingId,
            status: TrainingApplicationStatus.APPROVED,
            reviewedAt: approvedAt,
            reviewedById: uploadedByUserId,
          })),
          skipDuplicates: true,
        }),
      ]);
    }

    for (let i = 0; i < toReactivate.length; i += this.BULK_UPLOAD_BATCH_SIZE) {
      const batch = toReactivate.slice(i, i + this.BULK_UPLOAD_BATCH_SIZE);
      const approvedAt = new Date();
      await this.prisma.$transaction(
        batch.map((item) =>
          this.prisma.trainingApplication.update({
            where: { id: item.id },
            data: {
              isActive: true,
              status: TrainingApplicationStatus.APPROVED,
              appliedAt: new Date(),
              reviewedAt: approvedAt,
              reviewedById: uploadedByUserId,
            },
          }),
        ),
      );
    }

    await Promise.all(
      uniqueRows.map((row) => this.invalidateCache(row.userId, row.trainingId)),
    );

    this.auditService.log({
      action: AuditAction.TRAINING_APPLICATION_SUBMIT,
      entityType: 'TrainingApplication',
      entityId: 'bulk-upload',
      userId: uploadedByUserId,
      category: AuditCategory.APPLICATION_PROCESS,
      severity: AuditSeverity.MEDIUM,
      description: `Bulk nomination upload processed: created=${toCreate.length}, reactivated=${toReactivate.length}, skipped=${skipped}, failed=${failedRows.length}`,
    }).catch(() => {});

    return {
      success: true,
      message: 'Bulk nomination upload processed',
      summary: {
        totalRows: rows.length,
        created: toCreate.length,
        reactivated: toReactivate.length,
        skipped,
        failed: failedRows.length,
      },
      failedRows,
      processedRows,
    };
  }

  private async invalidateCache(userId: string, trainingId: string) {
    await Promise.all([
      this.cache.del(`training:applications:user:${userId}`),
      this.cache.del(`training:applications:training:${trainingId}`),
    ]).catch(() => {});
  }
}
