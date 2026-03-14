import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma, Role } from '../../generated/prisma/client';
import { CreateTrainingDto, UpdateTrainingDto, TrainingFilterDto, CalendarFilterDto } from './dto';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new training (State only)
   */
  async create(dto: CreateTrainingDto, userId: string) {
    try {
      this.logger.log(`Creating training: ${dto.title} by user ${userId}`);

      const training = await this.prisma.training.create({
        data: {
          title: dto.title,
          description: dto.description,
          providedBy: dto.providedBy,
          trainerName: dto.trainerName,
          trainerBio: dto.trainerBio,
          trainerContact: dto.trainerContact,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          duration: dto.duration,
          applicationDeadline: new Date(dto.applicationDeadline),
          deliveryMode: dto.deliveryMode,
          venue: dto.venue,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          meetingLink: dto.meetingLink,
          capacity: dto.capacity,
          prerequisites: dto.prerequisites,
          difficulty: dto.difficulty,
          learningOutcomes: dto.learningOutcomes || [],
          feedbackFormId: dto.feedbackFormId,
          preTestFormId: dto.preTestFormId,
          postTestFormId: dto.postTestFormId,
          createdById: userId,
          isPublished: dto.publish || false,
          publishedAt: dto.publish ? new Date() : null,
          targetBranches: dto.targetBranchIds?.length
            ? { connect: dto.targetBranchIds.map((id) => ({ id })) }
            : undefined,
        },
        include: {
          targetBranches: true,
          feedbackForm: true,
          preTestForm: true,
          postTestForm: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Invalidate cache
      await this.invalidateCache();

      // Audit log
      this.auditService.log({
        action: AuditAction.TRAINING_CREATE,
        entityType: 'Training',
        entityId: training.id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        description: `Training "${dto.title}" created`,
        newValues: { title: dto.title, startDate: dto.startDate, endDate: dto.endDate },
      }).catch(() => {});

      return training;
    } catch (error) {
      this.logger.error(`Failed to create training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a training (State only)
   */
  async update(id: string, dto: UpdateTrainingDto, userId: string) {
    try {
      this.logger.log(`Updating training ${id}`);

      const existing = await this.prisma.training.findUnique({
        where: { id },
        include: { targetBranches: true },
      });

      if (!existing) {
        throw new NotFoundException('Training not found');
      }

      const training = await this.prisma.training.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          providedBy: dto.providedBy,
          trainerName: dto.trainerName,
          trainerBio: dto.trainerBio,
          trainerContact: dto.trainerContact,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          duration: dto.duration,
          applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : undefined,
          deliveryMode: dto.deliveryMode,
          venue: dto.venue,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          meetingLink: dto.meetingLink,
          capacity: dto.capacity,
          prerequisites: dto.prerequisites,
          difficulty: dto.difficulty,
          learningOutcomes: dto.learningOutcomes,
          feedbackFormId: dto.feedbackFormId,
          preTestFormId: dto.preTestFormId,
          postTestFormId: dto.postTestFormId,
          targetBranches: dto.targetBranchIds
            ? {
                set: [], // Clear existing
                connect: dto.targetBranchIds.map((branchId) => ({ id: branchId })),
              }
            : undefined,
        },
        include: {
          targetBranches: true,
          feedbackForm: true,
          preTestForm: true,
          postTestForm: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      await this.invalidateCache();

      this.auditService.log({
        action: AuditAction.TRAINING_UPDATE,
        entityType: 'Training',
        entityId: id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        description: `Training "${training.title}" updated`,
        oldValues: { title: existing.title },
        newValues: { title: training.title },
      }).catch(() => {});

      return training;
    } catch (error) {
      this.logger.error(`Failed to update training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a training (State only)
   */
  async delete(id: string, userId: string) {
    try {
      this.logger.log(`Deleting training ${id}`);

      const training = await this.prisma.training.findUnique({ where: { id } });
      if (!training) {
        throw new NotFoundException('Training not found');
      }

      // Check if training has applications
      const applicationCount = await this.prisma.trainingApplication.count({
        where: { trainingId: id },
      });

      if (applicationCount > 0) {
        throw new BadRequestException(
          `Cannot delete training with ${applicationCount} applications. Deactivate it instead.`
        );
      }

      await this.prisma.training.delete({ where: { id } });
      await this.invalidateCache();

      this.auditService.log({
        action: AuditAction.TRAINING_DELETE,
        entityType: 'Training',
        entityId: id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.HIGH,
        description: `Training "${training.title}" deleted`,
      }).catch(() => {});

      return { success: true, message: 'Training deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Publish a training (State only)
   */
  async publish(id: string, userId: string) {
    try {
      const training = await this.prisma.training.findUnique({ where: { id } });
      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (training.isPublished) {
        throw new BadRequestException('Training is already published');
      }

      const updated = await this.prisma.training.update({
        where: { id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
        include: {
          targetBranches: true,
          feedbackForm: true,
        },
      });

      await this.invalidateCache();

      this.auditService.log({
        action: AuditAction.TRAINING_PUBLISH,
        entityType: 'Training',
        entityId: id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        description: `Training "${training.title}" published`,
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to publish training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Unpublish a training (State only)
   */
  async unpublish(id: string, userId: string) {
    try {
      const training = await this.prisma.training.findUnique({ where: { id } });
      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (!training.isPublished) {
        throw new BadRequestException('Training is not published');
      }

      const updated = await this.prisma.training.update({
        where: { id },
        data: {
          isPublished: false,
        },
        include: {
          targetBranches: true,
          feedbackForm: true,
        },
      });

      await this.invalidateCache();

      return updated;
    } catch (error) {
      this.logger.error(`Failed to unpublish training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all trainings with filters (State - all, others - published only)
   */
  async findAll(filters: TrainingFilterDto, includeUnpublished = false, userId?: string, institutionId?: string) {
    try {
      const { page = 1, limit = 20, search, year, month, deliveryMode, difficulty, branchIds, isPublished, isActive, startDateFrom, startDateTo } = filters;
      const userBranchId = userId ? await this.getUserBranchId(userId) : undefined;
      const effectiveBranchIds = this.getEffectiveBranchIds(branchIds, userBranchId);

      // Build branch filtering condition
      const branchScopeCondition: Prisma.TrainingWhereInput | undefined = effectiveBranchIds
        ? effectiveBranchIds.length > 0
          ? {
              OR: [
                { targetBranches: { some: { id: { in: effectiveBranchIds } } } },
                { targetBranches: { none: {} } },
              ],
            }
          : { targetBranches: { none: {} } }
        : undefined;

      const where: Prisma.TrainingWhereInput = {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(isPublished !== undefined ? { isPublished } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(deliveryMode ? { deliveryMode } : {}),
        ...(difficulty ? { difficulty } : {}),
        ...(institutionId
          ? {
              applications: {
                some: {
                  status: 'APPROVED',
                  user: { institutionId },
                },
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { providedBy: { contains: search, mode: 'insensitive' } },
                { trainerName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      // Date filters
      if (year || month || startDateFrom || startDateTo) {
        const dateFilters: Prisma.TrainingWhereInput[] = [];

        if (year && month) {
          const startOfMonth = new Date(year, month - 1, 1);
          const endOfMonth = new Date(year, month, 0, 23, 59, 59);
          dateFilters.push({
            OR: [
              { startDate: { gte: startOfMonth, lte: endOfMonth } },
              { endDate: { gte: startOfMonth, lte: endOfMonth } },
              { AND: [{ startDate: { lte: startOfMonth } }, { endDate: { gte: endOfMonth } }] },
            ],
          });
        } else if (year) {
          const startOfYear = new Date(year, 0, 1);
          const endOfYear = new Date(year, 11, 31, 23, 59, 59);
          dateFilters.push({ startDate: { gte: startOfYear, lte: endOfYear } });
        }

        if (startDateFrom) {
          dateFilters.push({ startDate: { gte: new Date(startDateFrom) } });
        }
        if (startDateTo) {
          dateFilters.push({ startDate: { lte: new Date(startDateTo) } });
        }

        if (dateFilters.length > 0) {
          where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...dateFilters];
        }
      }

      if (branchScopeCondition) {
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), branchScopeCondition];
      }

      const [trainings, total] = await Promise.all([
        this.prisma.training.findMany({
          where,
          include: {
            targetBranches: { select: { id: true, name: true, shortName: true } },
            feedbackForm: { select: { id: true, title: true } },
            preTestForm: { select: { id: true, title: true } },
            postTestForm: { select: { id: true, title: true } },
            createdBy: { select: { id: true, name: true } },
            _count: { select: { applications: true, attendances: true, certificates: true } },
          },
          orderBy: { startDate: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.training.count({ where }),
      ]);

      // Calculate available seats and enrolled faculty for each training
      const trainingsWithCapacity = await Promise.all(
        trainings.map(async (training) => {
          const [approvedApps, pendingCount, totalApplications] = await Promise.all([
            this.prisma.trainingApplication.findMany({
              where: {
                trainingId: training.id,
                status: 'APPROVED',
                ...(institutionId ? { user: { institutionId } } : {}),
              },
              select: { user: { select: { name: true } } },
            }),
            this.prisma.trainingApplication.count({
              where: {
                trainingId: training.id,
                status: { in: ['PENDING', 'SUBMITTED', 'WAITLISTED'] },
                ...(institutionId ? { user: { institutionId } } : {}),
              },
            }),
            this.prisma.trainingApplication.count({
              where: {
                trainingId: training.id,
                ...(institutionId ? { user: { institutionId } } : {}),
              },
            }),
          ]);

          const approvedCount = institutionId
            ? approvedApps.length
            : await this.prisma.trainingApplication.count({
                where: { trainingId: training.id, status: 'APPROVED' },
              });

          return {
            ...training,
            availableSeats: training.capacity - approvedCount,
            isFull: approvedCount >= training.capacity,
            enrolledFaculty: approvedApps.map((a) => a.user.name),
            applicationSummary: {
              total: totalApplications,
              approved: approvedCount,
              pending: pendingCount,
            },
          };
        }),
      );

      return {
        data: trainingsWithCapacity,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get trainings: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get training calendar
   */
  async getCalendar(filters: CalendarFilterDto, userId?: string, institutionId?: string) {
    try {
      const { year = new Date().getFullYear(), month, branchIds, deliveryMode } = filters;
      const userBranchId = userId ? await this.getUserBranchId(userId) : undefined;
      const effectiveBranchIds = this.getEffectiveBranchIds(branchIds, userBranchId);
      const branchScopeCondition: Prisma.TrainingWhereInput | undefined = effectiveBranchIds
        ? effectiveBranchIds.length > 0
          ? {
              OR: [
                { targetBranches: { some: { id: { in: effectiveBranchIds } } } },
                { targetBranches: { none: {} } },
              ],
            }
          : { targetBranches: { none: {} } }
        : undefined;

      const cacheKey = `training:calendar:${year}:${month || 'all'}:${effectiveBranchIds?.join(',') || 'all'}:${deliveryMode || 'all'}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          let startDate: Date;
          let endDate: Date;

          if (month) {
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
          } else {
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59);
          }

          const where: Prisma.TrainingWhereInput = {
            isPublished: true,
            isActive: true,
            ...(institutionId
              ? {
                  applications: {
                    some: {
                      isActive: true,
                      user: { institutionId },
                    },
                  },
                }
              : {}),
            OR: [
              { startDate: { gte: startDate, lte: endDate } },
              { endDate: { gte: startDate, lte: endDate } },
              { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: endDate } }] },
            ],
            ...(deliveryMode ? { deliveryMode } : {}),
          };

          if (branchScopeCondition) {
            where.AND = [...(Array.isArray(where.AND) ? where.AND : []), branchScopeCondition];
          }

          const trainings = await this.prisma.training.findMany({
            where,
            include: {
              targetBranches: { select: { id: true, name: true, shortName: true } },
              _count: { select: { applications: true } },
            },
            orderBy: { startDate: 'asc' },
          });

          // Calculate available seats for each training
          const trainingsWithCapacity = await Promise.all(
            trainings.map(async (training) => {
              const approvedCount = await this.prisma.trainingApplication.count({
                where: {
                  trainingId: training.id,
                  status: 'APPROVED',
                },
              });

              return {
                ...training,
                availableSeats: training.capacity - approvedCount,
                isFull: approvedCount >= training.capacity,
              };
            })
          );

          return {
            year,
            month,
            trainings: trainingsWithCapacity,
          };
        },
        this.CACHE_TTL
      );
    } catch (error) {
      this.logger.error(`Failed to get training calendar: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get upcoming trainings
   */
  async getUpcoming(limit = 5, branchIds?: string[], userId?: string, institutionId?: string) {
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const userBranchId = userId ? await this.getUserBranchId(userId) : undefined;
      const effectiveBranchIds = this.getEffectiveBranchIds(branchIds, userBranchId);
      const branchScopeCondition: Prisma.TrainingWhereInput | undefined = effectiveBranchIds
        ? effectiveBranchIds.length > 0
          ? {
              OR: [
                { targetBranches: { some: { id: { in: effectiveBranchIds } } } },
                { targetBranches: { none: {} } },
              ],
            }
          : { targetBranches: { none: {} } }
        : undefined;

      const trainings = await this.prisma.training.findMany({
        where: {
          isPublished: true,
          isActive: true,
          applicationDeadline: { gte: todayStart },
          ...(institutionId
            ? {
                applications: {
                  some: {
                    isActive: true,
                    user: { institutionId },
                  },
                },
              }
            : {}),
          ...(branchScopeCondition ? { AND: [branchScopeCondition] } : {}),
        },
        include: {
          targetBranches: { select: { id: true, name: true, shortName: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { startDate: 'asc' },
        take: limit,
      });

      // Calculate available seats for each training based on APPROVED applications
      const trainingsWithCapacity = await Promise.all(
        trainings.map(async (training) => {
          const approvedCount = await this.prisma.trainingApplication.count({
            where: {
              trainingId: training.id,
              status: 'APPROVED',
            },
          });

          return {
            ...training,
            availableSeats: training.capacity - approvedCount,
            isFull: approvedCount >= training.capacity,
          };
        })
      );

      return trainingsWithCapacity;
    } catch (error) {
      this.logger.error(`Failed to get upcoming trainings: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get training by ID
   */
  async findOne(id: string, userId?: string, institutionId?: string) {
    try {
      const training = await this.prisma.training.findUnique({
        where: { id },
        include: {
          targetBranches: { select: { id: true, name: true, shortName: true, code: true } },
          feedbackForm: true,
          preTestForm: true,
          postTestForm: true,
          createdBy: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              applications: true,
              attendances: true,
              lessonPlans: true,
              certificates: true,
              feedbackResponses: true,
              preTestResponses: true,
              postTestResponses: true,
            },
          },
        },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (institutionId) {
        const institutionApplicationCount = await this.prisma.trainingApplication.count({
          where: {
            trainingId: id,
            isActive: true,
            user: { institutionId },
          },
        });

        if (institutionApplicationCount === 0) {
          throw new NotFoundException('Training not found');
        }
      }

      if (userId && training.targetBranches?.length > 0) {
        const userBranchId = await this.getUserBranchId(userId);
        if (!userBranchId) {
          throw new ForbiddenException('Your profile is not mapped to a branch');
        }

        const isBranchAllowed = training.targetBranches.some((branch) => branch.id === userBranchId);
        if (!isBranchAllowed) {
          throw new ForbiddenException('This training is not available for your branch');
        }
      }

      // Get capacity info
      const approvedCount = await this.prisma.trainingApplication.count({
        where: { trainingId: id, status: 'APPROVED' },
      });

      // If user provided, check their application status
      let userApplication = null;
      let userAttendance = null;
      let userFeedback = null;
      let userLessonPlan = null;
      let userCertificate = null;

      if (userId) {
        [userApplication, userAttendance, userFeedback, userLessonPlan, userCertificate] = await Promise.all([
          // Use findFirst to filter by isActive (withdrawn applications have isActive: false)
          this.prisma.trainingApplication.findFirst({
            where: { userId, trainingId: id, isActive: true },
          }),
          this.prisma.trainingAttendance.findMany({
            where: { userId, trainingId: id },
          }),
          this.prisma.feedbackResponse.findFirst({
            where: { userId, trainingId: id },
          }),
          this.prisma.lessonPlan.findUnique({
            where: { userId_trainingId: { userId, trainingId: id } },
          }),
          this.prisma.trainingCertificate.findUnique({
            where: { userId_trainingId: { userId, trainingId: id } },
          }),
        ]);
      }

      return {
        ...training,
        capacity: {
          total: training.capacity,
          approved: approvedCount,
          available: training.capacity - approvedCount,
          isFull: approvedCount >= training.capacity,
        },
        userStatus: userId
          ? {
              hasApplied: !!userApplication,
              application: userApplication,
              attendanceCount: userAttendance?.length || 0,
              hasSubmittedFeedback: !!userFeedback,
              hasLessonPlan: !!userLessonPlan,
              lessonPlanStatus: userLessonPlan?.status,
              hasCertificate: !!userCertificate,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get training statistics (State)
   */
  async getTrainingStats(trainingId: string, institutionId?: string) {
    try {
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (institutionId) {
        const institutionApplicationCount = await this.prisma.trainingApplication.count({
          where: {
            trainingId,
            isActive: true,
            user: { institutionId },
          },
        });

        if (institutionApplicationCount === 0) {
          throw new NotFoundException('Training not found');
        }
      }

      const scopedUserFilter = institutionId ? { user: { institutionId } } : {};

      const [
        totalApplications,
        approvedApplications,
        pendingApplications,
        rejectedApplications,
        totalAttendance,
        uniqueAttendees,
        feedbackCount,
        lessonPlanCount,
        approvedLessonPlans,
        certificateCount,
      ] = await Promise.all([
        this.prisma.trainingApplication.count({ where: { trainingId, ...scopedUserFilter } }),
        this.prisma.trainingApplication.count({ where: { trainingId, status: 'APPROVED', ...scopedUserFilter } }),
        this.prisma.trainingApplication.count({
          where: { trainingId, status: { in: ['SUBMITTED', 'PENDING'] }, ...scopedUserFilter },
        }),
        this.prisma.trainingApplication.count({ where: { trainingId, status: 'REJECTED', ...scopedUserFilter } }),
        this.prisma.trainingAttendance.count({ where: { trainingId, ...scopedUserFilter } }),
        this.prisma.trainingAttendance
          .findMany({
            where: { trainingId, ...scopedUserFilter },
            select: { userId: true },
            distinct: ['userId'],
          })
          .then((rows) => rows.length),
        this.prisma.feedbackResponse.count({ where: { trainingId, ...scopedUserFilter } }),
        this.prisma.lessonPlan.count({ where: { trainingId, ...scopedUserFilter } }),
        this.prisma.lessonPlan.count({ where: { trainingId, status: 'APPROVED', ...scopedUserFilter } }),
        this.prisma.trainingCertificate.count({ where: { trainingId, ...scopedUserFilter } }),
      ]);

      // Calculate training days
      const trainingDays = Math.ceil(
        (training.endDate.getTime() - training.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      return {
        training: {
          id: training.id,
          title: training.title,
          startDate: training.startDate,
          endDate: training.endDate,
          trainingDays,
          capacity: training.capacity,
        },
        applications: {
          total: totalApplications,
          approved: approvedApplications,
          pending: pendingApplications,
          rejected: rejectedApplications,
          fillRate: training.capacity > 0 ? (approvedApplications / training.capacity) * 100 : 0,
        },
        attendance: {
          totalRecords: totalAttendance,
          uniqueAttendees,
          averageAttendanceRate: approvedApplications > 0 ? (uniqueAttendees / approvedApplications) * 100 : 0,
        },
        feedback: {
          count: feedbackCount,
          responseRate: approvedApplications > 0 ? (feedbackCount / approvedApplications) * 100 : 0,
        },
        lessonPlans: {
          total: lessonPlanCount,
          approved: approvedLessonPlans,
          submissionRate: approvedApplications > 0 ? (lessonPlanCount / approvedApplications) * 100 : 0,
        },
        certificates: {
          issued: certificateCount,
          issuanceRate: approvedApplications > 0 ? (certificateCount / approvedApplications) * 100 : 0,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get training stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get dashboard stats (State)
   */
  async getDashboardStats() {
    try {
      const now = new Date();

      const [trainings, applications, attendanceAgg, teachers, feedbackResponses, totalLessonPlans, approvedLessonPlans, totalCertificates] =
        await Promise.all([
          this.prisma.training.findMany({
            select: {
              id: true,
              title: true,
              isPublished: true,
              startDate: true,
              endDate: true,
              duration: true,
              targetBranches: { select: { id: true, name: true, shortName: true, code: true } },
            },
          }),
          this.prisma.trainingApplication.findMany({
            where: { isActive: true },
            select: {
              userId: true,
              trainingId: true,
              status: true,
            },
          }),
          this.prisma.trainingAttendance.groupBy({
            by: ['userId', 'trainingId'],
            _count: { _all: true },
          }),
          this.prisma.user.findMany({
            where: { role: 'TEACHER', active: true },
            select: {
              id: true,
              branchId: true,
              branchName: true,
              branch: { select: { id: true, name: true, shortName: true, code: true } },
            },
          }),
          this.prisma.feedbackResponse.findMany({
            where: { trainingId: { not: null } },
            select: {
              userId: true,
              trainingId: true,
            },
          }),
          this.prisma.lessonPlan.count(),
          this.prisma.lessonPlan.count({ where: { status: 'APPROVED' } }),
          this.prisma.trainingCertificate.count(),
        ]);

      const trainingById = new Map(trainings.map((training) => [training.id, training]));
      const attendanceMap = new Map(
        attendanceAgg.map((attendance) => [
          `${attendance.userId}:${attendance.trainingId}`,
          attendance._count._all,
        ])
      );

      const totalTrainings = trainings.length;
      const publishedTrainings = trainings.filter((training) => training.isPublished).length;
      const upcomingTrainings = trainings.filter((training) => training.isPublished && training.startDate > now).length;
      const ongoingTrainings = trainings.filter(
        (training) => training.isPublished && training.startDate <= now && training.endDate >= now
      ).length;
      const completedTrainings = trainings.filter((training) => training.isPublished && training.endDate < now).length;

      const totalApplications = applications.length;
      const approvedApplications = applications.filter((application) => application.status === 'APPROVED').length;
      const totalAttendance = attendanceAgg.reduce((sum, item) => sum + item._count._all, 0);

      const totalFaculty = teachers.length;
      const teacherIds = new Set(teachers.map((teacher) => teacher.id));

      const teacherCourseMap = new Map<string, string>();
      const courseWiseMap = new Map<
        string,
        {
          course: string;
          facultyCount: number;
          completedFacultyIds: Set<string>;
          feedbackFacultyIds: Set<string>;
        }
      >();

      const ensureCourseBucket = (courseName: string) => {
        if (!courseWiseMap.has(courseName)) {
          courseWiseMap.set(courseName, {
            course: courseName,
            facultyCount: 0,
            completedFacultyIds: new Set<string>(),
            feedbackFacultyIds: new Set<string>(),
          });
        }
      };

      const resolveCourseForTraining = (userId: string, trainingId?: string | null) => {
        const profileCourse = teacherCourseMap.get(userId) || 'Unassigned';
        if (profileCourse !== 'Unassigned') {
          return profileCourse;
        }

        if (!trainingId) {
          return profileCourse;
        }

        const training = trainingById.get(trainingId);
        if (!training) {
          return profileCourse;
        }

        const targetBranches = Array.isArray(training.targetBranches)
          ? training.targetBranches
          : [];

        // If exactly one target branch exists, use it as an inferred course for unassigned faculty.
        if (targetBranches.length === 1) {
          return (
            targetBranches[0]?.shortName ||
            targetBranches[0]?.name ||
            targetBranches[0]?.code ||
            profileCourse
          );
        }

        return profileCourse;
      };

      for (const teacher of teachers) {
        const courseName =
          teacher.branch?.shortName ||
          teacher.branch?.name ||
          teacher.branchName ||
          'Unassigned';
        teacherCourseMap.set(teacher.id, courseName);
        const existing = courseWiseMap.get(courseName);
        if (existing) {
          existing.facultyCount += 1;
        } else {
          courseWiseMap.set(courseName, {
            course: courseName,
            facultyCount: 1,
            completedFacultyIds: new Set<string>(),
            feedbackFacultyIds: new Set<string>(),
          });
        }
      }

      const facultyHoursMap = new Map<string, number>();
      for (const teacher of teachers) {
        facultyHoursMap.set(teacher.id, 0);
      }

      const facultyWithCompletedTrainings = new Set<string>();
      const facultyWithOngoingTrainings = new Set<string>();

      for (const application of applications) {
        if (application.status !== 'APPROVED') {
          continue;
        }

        if (!teacherIds.has(application.userId)) {
          continue;
        }

        const training = trainingById.get(application.trainingId);
        if (!training) {
          continue;
        }

        const startDateOnly = new Date(
          training.startDate.getFullYear(),
          training.startDate.getMonth(),
          training.startDate.getDate()
        );
        const endDateOnly = new Date(
          training.endDate.getFullYear(),
          training.endDate.getMonth(),
          training.endDate.getDate()
        );
        const trainingDays = Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const safeTrainingDays = Math.max(trainingDays, 1);

        const totalHoursForTraining = training.duration ?? safeTrainingDays * 8;
        const hoursPerDay = totalHoursForTraining / safeTrainingDays;

        const attendedDays = attendanceMap.get(`${application.userId}:${application.trainingId}`) || 0;
        const attendedHours = Math.min(attendedDays, safeTrainingDays) * hoursPerDay;

        facultyHoursMap.set(application.userId, (facultyHoursMap.get(application.userId) || 0) + attendedHours);

        if (training.endDate < now && attendedDays >= safeTrainingDays) {
          facultyWithCompletedTrainings.add(application.userId);

          const courseName = resolveCourseForTraining(application.userId, application.trainingId);
          if (courseName) {
            ensureCourseBucket(courseName);
            courseWiseMap.get(courseName)?.completedFacultyIds.add(application.userId);
          }
        }

        if (training.startDate <= now && training.endDate >= now) {
          facultyWithOngoingTrainings.add(application.userId);
        }
      }

      const facultyHoursValues = Array.from(facultyHoursMap.values());
      const totalFacultyHours = facultyHoursValues.reduce((sum, hours) => sum + hours, 0);
      const averageHoursPerFaculty = totalFaculty > 0 ? totalFacultyHours / totalFaculty : 0;
      const highestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.max(...facultyHoursValues) : 0;
      const lowestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.min(...facultyHoursValues) : 0;

      const facultyCompleted40Hours = facultyHoursValues.filter((hours) => hours >= 40).length;
      const facultyCompletedUnder40Hours = Math.max(totalFaculty - facultyCompleted40Hours, 0);

      for (const response of feedbackResponses) {
        const courseName = resolveCourseForTraining(response.userId, response.trainingId);
        if (courseName) {
          ensureCourseBucket(courseName);
          courseWiseMap.get(courseName)?.feedbackFacultyIds.add(response.userId);
        }
      }

      const courseWiseFaculty = Array.from(courseWiseMap.values())
        .map((item) => ({
          course: item.course,
          facultyCount: item.facultyCount,
          completedTrainingsCount: item.completedFacultyIds.size,
          feedbackSubmittedCount: item.feedbackFacultyIds.size,
        }))
        .sort((a, b) => b.facultyCount - a.facultyCount);

      const totalFeedback = feedbackResponses.length;

      const totalFacultyRegistered = new Set(applications.map((application) => application.userId)).size;
      const applicantFacultyCount = new Set(
        applications
          .filter((application) => teacherIds.has(application.userId))
          .map((application) => application.userId),
      ).size;
      const facultyApplicationCoveragePercentage =
        totalFaculty > 0 ? (applicantFacultyCount / totalFaculty) * 100 : 0;

      const completedPublishedTrainings = trainings.filter((training) => training.isPublished && training.endDate < now);
      const totalTrainingHoursDelivered = completedPublishedTrainings.reduce((sum, training) => {
        const startDateOnly = new Date(
          training.startDate.getFullYear(),
          training.startDate.getMonth(),
          training.startDate.getDate()
        );
        const endDateOnly = new Date(
          training.endDate.getFullYear(),
          training.endDate.getMonth(),
          training.endDate.getDate()
        );
        const days = Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const safeDays = Math.max(days, 1);
        const hours = training.duration ?? safeDays * 8;
        return sum + hours;
      }, 0);

      const peopleCompletedTraining = facultyWithCompletedTrainings.size;
      const facultyYetToStart = Math.max(totalFaculty - facultyWithCompletedTrainings.size - facultyWithOngoingTrainings.size, 0);

      return {
        trainings: {
          total: totalTrainings,
          published: publishedTrainings,
          upcoming: upcomingTrainings,
          ongoing: ongoingTrainings,
          completed: completedTrainings,
        },
        applications: {
          total: totalApplications,
          approved: approvedApplications,
          approvalRate: totalApplications > 0 ? (approvedApplications / totalApplications) * 100 : 0,
          nominations: totalApplications,
          facultyApplicationCoveragePercentage: Number(facultyApplicationCoveragePercentage.toFixed(2)),
        },
        attendance: {
          total: totalAttendance,
        },
        feedback: {
          total: totalFeedback,
        },
        lessonPlans: {
          total: totalLessonPlans,
          approved: approvedLessonPlans,
          approvalRate: totalLessonPlans > 0 ? (approvedLessonPlans / totalLessonPlans) * 100 : 0,
          created: totalLessonPlans,
        },
        certificates: {
          total: totalCertificates,
        },
        summary: {
          totalTrainingsPublished: publishedTrainings,
          completedTrainings,
          totalFaculty,
          facultyCompleted40Hours,
          nominations: totalApplications,
          peopleCompletedTraining,
          lessonPlanCreated: totalLessonPlans,
        },
        courseWiseFaculty,
        trainingMetrics: {
          totalTrainingsConducted: completedTrainings,
          totalFacultyRegistered,
          totalTrainingHoursDelivered: Number(totalTrainingHoursDelivered.toFixed(2)),
        },
        facultyMetrics: {
          facultyWithCompletedTrainings: facultyWithCompletedTrainings.size,
          facultyWithOngoingTrainings: facultyWithOngoingTrainings.size,
          facultyYetToStart,
        },
        completionMetrics: {
          facultyCompleted40Hours,
          facultyCompletedUnder40Hours,
        },
        hoursDistribution: {
          averageHoursPerFaculty: Number(averageHoursPerFaculty.toFixed(2)),
          highestHoursSingleFaculty: Number(highestHoursSingleFaculty.toFixed(2)),
          lowestHoursSingleFaculty: Number(lowestHoursSingleFaculty.toFixed(2)),
        },
        year: now.getFullYear(),
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async invalidateCache() {
    const patterns = ['training:calendar:*', 'training:upcoming:*', 'training:list:*'];
    await Promise.all(patterns.map((p) => this.cache.invalidate(p).catch(() => {})));
  }

  // Get trainings user is registered for
  async getUserTrainings(userId: string) {
    const applications = await this.prisma.trainingApplication.findMany({
      where: {
        userId,
        status: { in: ['APPROVED', 'SUBMITTED', 'PENDING'] },
      },
      include: {
        training: {
          include: {
            targetBranches: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    return applications.map((app) => ({
      training: app.training,
      applicationStatus: app.status,
      applicationId: app.id,
    }));
  }

  // Check user eligibility for a training
  async checkUserEligibility(trainingId: string, userId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { targetBranches: true },
    });

    if (!training) {
      return { eligible: false, reason: 'Training not found' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { Institution: true },
    });

    if (!user) {
      return { eligible: false, reason: 'User not found' };
    }

    if (training.targetBranches?.length > 0) {
      const userBranchId = await this.getUserBranchId(userId);

      if (!userBranchId) {
        return { eligible: false, reason: 'Your profile is not mapped to a branch' };
      }

      const isBranchAllowed = training.targetBranches.some((branch) => branch.id === userBranchId);
      if (!isBranchAllowed) {
        return { eligible: false, reason: 'This training is not available for your branch' };
      }
    }

    // Check deadline (inclusive): valid through the end of the deadline day.
    if (training.applicationDeadline) {
      const now = new Date();
      const deadlineEndOfDay = new Date(training.applicationDeadline);
      deadlineEndOfDay.setHours(23, 59, 59, 999);

      if (now > deadlineEndOfDay) {
        return { eligible: false, reason: 'Application deadline has passed' };
      }
    }

    // Check capacity
    const applicationCount = await this.prisma.trainingApplication.count({
      where: {
        trainingId,
        status: { in: ['APPROVED', 'SUBMITTED', 'PENDING'] },
      },
    });

    if (training.capacity && applicationCount >= training.capacity) {
      return { eligible: false, reason: 'Training is full' };
    }

    // Check if already applied
    const existingApplication = await this.prisma.trainingApplication.findFirst({
      where: { trainingId, userId },
    });

    if (existingApplication) {
      return { eligible: false, reason: 'Already applied', applicationId: existingApplication.id };
    }

    return { eligible: true };
  }

  // Get institution dashboard (Principal/Coordinator)
  // If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
  async getInstitutionDashboard(institutionId: string | undefined, branchName?: string, branchId?: string) {
    const now = new Date();

    const isBranchScopedRequest = !institutionId;
    const hasBranchScope = Boolean(branchId || branchName);

    if (isBranchScopedRequest && !hasBranchScope) {
      return {
        totalTrainings: 0,
        totalParticipants: 0,
        certificates: 0,
        upcomingTrainings: [],
        trainings: {
          total: 0,
          published: 0,
          upcoming: 0,
          ongoing: 0,
          completed: 0,
        },
        applications: {
          total: 0,
          approved: 0,
          approvalRate: 0,
          nominations: 0,
          facultyApplicationCoveragePercentage: 0,
        },
        attendance: {
          total: 0,
        },
        feedback: {
          total: 0,
        },
        lessonPlans: {
          total: 0,
          approved: 0,
          approvalRate: 0,
          created: 0,
        },
        certificatesSummary: {
          total: 0,
        },
        summary: {
          totalTrainingsPublished: 0,
          completedTrainings: 0,
          totalFaculty: 0,
          facultyCompleted40Hours: 0,
          nominations: 0,
          peopleCompletedTraining: 0,
          lessonPlanCreated: 0,
        },
        courseWiseFaculty: [],
        trainingMetrics: {
          totalTrainingsConducted: 0,
          totalFacultyRegistered: 0,
          totalTrainingHoursDelivered: 0,
        },
        facultyMetrics: {
          facultyWithCompletedTrainings: 0,
          facultyWithOngoingTrainings: 0,
          facultyYetToStart: 0,
        },
        completionMetrics: {
          facultyCompleted40Hours: 0,
          facultyCompletedUnder40Hours: 0,
        },
        hoursDistribution: {
          averageHoursPerFaculty: 0,
          highestHoursSingleFaculty: 0,
          lowestHoursSingleFaculty: 0,
        },
        year: now.getFullYear(),
      };
    }

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

    const [trainings, applications, attendanceRecords, teachers, feedbackResponses, totalLessonPlans, totalCertificates] =
      await Promise.all([
        this.prisma.training.findMany({
          select: {
            id: true,
            title: true,
            isPublished: true,
            startDate: true,
            endDate: true,
            duration: true,
            targetBranches: { select: { id: true, name: true, shortName: true, code: true } },
          },
        }),
        this.prisma.trainingApplication.findMany({
          where: { user: { is: userFilter }, isActive: true },
          select: {
            userId: true,
            trainingId: true,
            status: true,
          },
        }),
        this.prisma.trainingAttendance.findMany({
          where: { user: { is: userFilter } },
          select: {
            userId: true,
            trainingId: true,
          },
        }),
        this.prisma.user.findMany({
          where: {
            ...userFilter,
            role: Role.TEACHER,
            active: true,
          },
          select: {
            id: true,
            branchName: true,
            branch: { select: { id: true, name: true, shortName: true, code: true } },
          },
        }),
        this.prisma.feedbackResponse.findMany({
          where: {
            trainingId: { not: null },
            user: { is: userFilter },
          },
          select: {
            userId: true,
            trainingId: true,
          },
        }),
        this.prisma.lessonPlan.count({ where: { user: { is: userFilter } } }),
        this.prisma.trainingCertificate.count({ where: { user: { is: userFilter } } }),
      ]);

    const scopedTrainings = trainings.filter((training) => {
      if (!branchId && !branchName) {
        return true;
      }

      const targetBranches = Array.isArray(training.targetBranches)
        ? training.targetBranches
        : [];

      if (!targetBranches.length) {
        return true;
      }

      return targetBranches.some((branch) => {
        if (branchId && branch.id === branchId) {
          return true;
        }

        if (!branchName) {
          return false;
        }

        const normalizedRequested = branchName.trim().toLowerCase();
        const candidates = [branch.name, branch.shortName, branch.code]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        return candidates.includes(normalizedRequested);
      });
    });

    const scopedTrainingIds = new Set(scopedTrainings.map((training) => training.id));
    const scopedApplications = applications.filter((application) =>
      scopedTrainingIds.has(application.trainingId),
    );
    const scopedAttendance = attendanceRecords.filter((attendance) =>
      scopedTrainingIds.has(attendance.trainingId),
    );

    const trainingById = new Map(scopedTrainings.map((training) => [training.id, training]));
    const attendanceMap = new Map<string, number>();

    for (const attendance of scopedAttendance) {
      const key = `${attendance.userId}:${attendance.trainingId}`;
      attendanceMap.set(key, (attendanceMap.get(key) || 0) + 1);
    }

    const totalTrainings = scopedTrainings.length;
    const publishedTrainings = scopedTrainings.filter((training) => training.isPublished).length;
    const upcomingTrainings = scopedTrainings
      .filter((training) => training.isPublished && training.startDate > now)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .slice(0, 5)
      .map((training) => ({
        id: training.id,
        title: training.title,
        startDate: training.startDate,
        endDate: training.endDate,
      }));

    const ongoingTrainings = scopedTrainings.filter(
      (training) => training.isPublished && training.startDate <= now && training.endDate >= now,
    ).length;
    const completedTrainings = scopedTrainings.filter(
      (training) => training.isPublished && training.endDate < now,
    ).length;

    const totalApplications = scopedApplications.length;
    const approvedApplications = scopedApplications.filter(
      (application) => application.status === 'APPROVED',
    );
    const approvedApplicationsCount = approvedApplications.length;
    const totalAttendance = scopedAttendance.length;

    const totalFaculty = teachers.length;
    const allFacultyIds = new Set(teachers.map((teacher) => teacher.id));

    const teacherCourseMap = new Map<string, string>();
    const courseWiseMap = new Map<
      string,
      {
        course: string;
        facultyCount: number;
        completedFacultyIds: Set<string>;
        feedbackFacultyIds: Set<string>;
      }
    >();

    const ensureCourseBucket = (courseName: string) => {
      if (!courseWiseMap.has(courseName)) {
        courseWiseMap.set(courseName, {
          course: courseName,
          facultyCount: 0,
          completedFacultyIds: new Set<string>(),
          feedbackFacultyIds: new Set<string>(),
        });
      }
    };

    const resolveCourseForTraining = (userId: string, trainingId?: string | null) => {
      const profileCourse = teacherCourseMap.get(userId) || 'Unassigned';
      if (profileCourse !== 'Unassigned') {
        return profileCourse;
      }

      if (!trainingId) {
        return profileCourse;
      }

      const training = trainingById.get(trainingId);
      if (!training) {
        return profileCourse;
      }

      const targetBranches = Array.isArray(training.targetBranches)
        ? training.targetBranches
        : [];

      // If exactly one target branch exists, use it as an inferred course for unassigned faculty.
      if (targetBranches.length === 1) {
        return (
          targetBranches[0]?.shortName ||
          targetBranches[0]?.name ||
          targetBranches[0]?.code ||
          profileCourse
        );
      }

      return profileCourse;
    };

    for (const teacher of teachers) {
      const courseName =
        teacher.branch?.shortName ||
        teacher.branch?.name ||
        teacher.branchName ||
        'Unassigned';
      teacherCourseMap.set(teacher.id, courseName);
      const existing = courseWiseMap.get(courseName);
      if (existing) {
        existing.facultyCount += 1;
      } else {
        courseWiseMap.set(courseName, {
          course: courseName,
          facultyCount: 1,
          completedFacultyIds: new Set<string>(),
          feedbackFacultyIds: new Set<string>(),
        });
      }
    }

    const facultyHoursMap = new Map<string, number>();
    for (const teacher of teachers) {
      facultyHoursMap.set(teacher.id, 0);
    }

    const facultyWithCompletedTrainings = new Set<string>();
    const facultyWithOngoingTrainings = new Set<string>();

    for (const application of approvedApplications) {
      if (!allFacultyIds.has(application.userId)) {
        continue;
      }

      const training = trainingById.get(application.trainingId);
      if (!training) {
        continue;
      }

      const startDateOnly = new Date(
        training.startDate.getFullYear(),
        training.startDate.getMonth(),
        training.startDate.getDate(),
      );
      const endDateOnly = new Date(
        training.endDate.getFullYear(),
        training.endDate.getMonth(),
        training.endDate.getDate(),
      );

      const trainingDays =
        Math.ceil(
          (endDateOnly.getTime() - startDateOnly.getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1;
      const safeTrainingDays = Math.max(trainingDays, 1);

      const totalHoursForTraining = training.duration ?? safeTrainingDays * 8;
      const hoursPerDay = totalHoursForTraining / safeTrainingDays;

      const attendedDays =
        attendanceMap.get(`${application.userId}:${application.trainingId}`) || 0;
      const attendedHours = Math.min(attendedDays, safeTrainingDays) * hoursPerDay;

      facultyHoursMap.set(
        application.userId,
        (facultyHoursMap.get(application.userId) || 0) + attendedHours,
      );

      if (training.endDate < now && attendedDays >= safeTrainingDays) {
        facultyWithCompletedTrainings.add(application.userId);

        const courseName = resolveCourseForTraining(application.userId, application.trainingId);
        if (courseName) {
          ensureCourseBucket(courseName);
          courseWiseMap.get(courseName)?.completedFacultyIds.add(application.userId);
        }
      }

      if (training.startDate <= now && training.endDate >= now) {
        facultyWithOngoingTrainings.add(application.userId);
      }
    }

    const facultyHoursValues = Array.from(facultyHoursMap.values());
    const totalFacultyHours = facultyHoursValues.reduce((sum, hours) => sum + hours, 0);
    const averageHoursPerFaculty = totalFaculty > 0 ? totalFacultyHours / totalFaculty : 0;
    const highestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.max(...facultyHoursValues) : 0;
    const lowestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.min(...facultyHoursValues) : 0;

    const facultyCompleted40Hours = facultyHoursValues.filter((hours) => hours >= 40).length;
    const facultyCompletedUnder40Hours = Math.max(totalFaculty - facultyCompleted40Hours, 0);

    const scopedFeedbackResponses = feedbackResponses.filter((response) =>
      scopedTrainingIds.has(response.trainingId),
    );

    for (const response of scopedFeedbackResponses) {
      const courseName = resolveCourseForTraining(response.userId, response.trainingId);
      if (courseName) {
        ensureCourseBucket(courseName);
        courseWiseMap.get(courseName)?.feedbackFacultyIds.add(response.userId);
      }
    }

    const courseWiseFaculty = Array.from(courseWiseMap.values())
      .map((item) => ({
        course: item.course,
        facultyCount: item.facultyCount,
        completedTrainingsCount: item.completedFacultyIds.size,
        feedbackSubmittedCount: item.feedbackFacultyIds.size,
      }))
      .sort((a, b) => b.facultyCount - a.facultyCount);

    const totalFeedback = scopedFeedbackResponses.length;

    const totalFacultyRegistered = new Set(approvedApplications.map((application) => application.userId)).size;
    const applicantFacultyCount = new Set(
      scopedApplications
        .filter((application) => allFacultyIds.has(application.userId))
        .map((application) => application.userId),
    ).size;
    const facultyApplicationCoveragePercentage =
      totalFaculty > 0 ? (applicantFacultyCount / totalFaculty) * 100 : 0;
    const totalTrainingHoursDelivered = scopedTrainings
      .filter((training) => training.isPublished && training.endDate < now)
      .reduce((sum, training) => {
        const startDateOnly = new Date(
          training.startDate.getFullYear(),
          training.startDate.getMonth(),
          training.startDate.getDate(),
        );
        const endDateOnly = new Date(
          training.endDate.getFullYear(),
          training.endDate.getMonth(),
          training.endDate.getDate(),
        );
        const days =
          Math.ceil(
            (endDateOnly.getTime() - startDateOnly.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        const safeDays = Math.max(days, 1);
        const hours = training.duration ?? safeDays * 8;
        return sum + hours;
      }, 0);

    const facultyYetToStart = Math.max(
      totalFaculty - facultyWithCompletedTrainings.size - facultyWithOngoingTrainings.size,
      0,
    );

    return {
      totalTrainings,
      totalParticipants: approvedApplicationsCount,
      certificates: totalCertificates,
      upcomingTrainings,
      trainings: {
        total: totalTrainings,
        published: publishedTrainings,
        upcoming: upcomingTrainings.length,
        ongoing: ongoingTrainings,
        completed: completedTrainings,
      },
      applications: {
        total: totalApplications,
        approved: approvedApplicationsCount,
        approvalRate: totalApplications > 0 ? (approvedApplicationsCount / totalApplications) * 100 : 0,
        nominations: totalApplications,
        facultyApplicationCoveragePercentage: Number(facultyApplicationCoveragePercentage.toFixed(2)),
      },
      attendance: {
        total: totalAttendance,
      },
      feedback: {
        total: totalFeedback,
      },
      lessonPlans: {
        total: totalLessonPlans,
        approved: 0,
        approvalRate: 0,
        created: totalLessonPlans,
      },
      certificatesSummary: {
        total: totalCertificates,
      },
      summary: {
        totalTrainingsPublished: publishedTrainings,
        completedTrainings,
        totalFaculty,
        facultyCompleted40Hours,
        nominations: totalApplications,
        peopleCompletedTraining: facultyWithCompletedTrainings.size,
        lessonPlanCreated: totalLessonPlans,
      },
      courseWiseFaculty,
      trainingMetrics: {
        totalTrainingsConducted: completedTrainings,
        totalFacultyRegistered,
        totalTrainingHoursDelivered: Number(totalTrainingHoursDelivered.toFixed(2)),
      },
      facultyMetrics: {
        facultyWithCompletedTrainings: facultyWithCompletedTrainings.size,
        facultyWithOngoingTrainings: facultyWithOngoingTrainings.size,
        facultyYetToStart,
      },
      completionMetrics: {
        facultyCompleted40Hours,
        facultyCompletedUnder40Hours,
      },
      hoursDistribution: {
        averageHoursPerFaculty: Number(averageHoursPerFaculty.toFixed(2)),
        highestHoursSingleFaculty: Number(highestHoursSingleFaculty.toFixed(2)),
        lowestHoursSingleFaculty: Number(lowestHoursSingleFaculty.toFixed(2)),
      },
      year: now.getFullYear(),
    };
  }

  // Get institution participation report (Principal/Coordinator)
  // If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
  async getInstitutionParticipationReport(institutionId: string | undefined, branchName?: string, branchId?: string) {
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

    const applications = await this.prisma.trainingApplication.findMany({
      where: {
        user: { is: userFilter },
      },
      include: {
        training: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const groupedByStatus = applications.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalApplications: applications.length,
      byStatus: groupedByStatus,
      applications: applications.slice(0, 50),
    };
  }

  private async getUserBranchId(userId: string): Promise<string | null> {
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

  private getEffectiveBranchIds(
    requestedBranchIds?: string[],
    userBranchId?: string | null,
  ): string[] | undefined {
    if (userBranchId === undefined) {
      return requestedBranchIds?.length ? requestedBranchIds : undefined;
    }

    if (userBranchId === null) {
      return [];
    }

    if (!requestedBranchIds?.length) {
      return [userBranchId];
    }

    return requestedBranchIds.includes(userBranchId) ? [userBranchId] : [];
  }
}
