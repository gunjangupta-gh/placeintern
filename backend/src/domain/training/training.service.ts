import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma } from '../../generated/prisma/client';
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
      const userBranchId = userId ? await this.getUserBranchId(userId) : null;
      const effectiveBranchIds = this.getEffectiveBranchIds(branchIds, userBranchId);

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
                  isActive: true,
                  user: { institutionId },
                },
              },
            }
          : {}),
        ...(effectiveBranchIds
          ? effectiveBranchIds.length > 0
            ? { targetBranches: { some: { id: { in: effectiveBranchIds } } } }
            : { id: '__no_training_match__' }
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
          where.AND = dateFilters;
        }
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
      const userBranchId = userId ? await this.getUserBranchId(userId) : null;
      const effectiveBranchIds = this.getEffectiveBranchIds(branchIds, userBranchId);

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
            ...(effectiveBranchIds
              ? effectiveBranchIds.length > 0
                ? { targetBranches: { some: { id: { in: effectiveBranchIds } } } }
                : { id: '__no_training_match__' }
              : {}),
            ...(deliveryMode ? { deliveryMode } : {}),
          };

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
      const userBranchId = userId ? await this.getUserBranchId(userId) : null;
      const effectiveBranchIds = this.getEffectiveBranchIds(branchIds, userBranchId);

      const trainings = await this.prisma.training.findMany({
        where: {
          isPublished: true,
          isActive: true,
          applicationDeadline: { gte: now },
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
          ...(effectiveBranchIds
            ? effectiveBranchIds.length > 0
              ? { targetBranches: { some: { id: { in: effectiveBranchIds } } } }
              : { id: '__no_training_match__' }
            : {}),
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
        const isBranchAllowed = !!userBranchId && training.targetBranches.some((branch) => branch.id === userBranchId);
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
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

      const [
        totalTrainings,
        publishedTrainings,
        upcomingTrainings,
        ongoingTrainings,
        completedTrainings,
        totalApplications,
        approvedApplications,
        totalAttendance,
        totalFeedback,
        totalLessonPlans,
        approvedLessonPlans,
        totalCertificates,
      ] = await Promise.all([
        this.prisma.training.count({ where: { createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.training.count({ where: { isPublished: true, createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.training.count({ where: { isPublished: true, startDate: { gt: now } } }),
        this.prisma.training.count({ where: { isPublished: true, startDate: { lte: now }, endDate: { gte: now } } }),
        this.prisma.training.count({ where: { isPublished: true, endDate: { lt: now }, createdAt: { gte: startOfYear } } }),
        this.prisma.trainingApplication.count({ where: { createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.trainingApplication.count({ where: { status: 'APPROVED', createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.trainingAttendance.count({ where: { createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.feedbackResponse.count({ where: { trainingId: { not: null }, createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.lessonPlan.count({ where: { createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.lessonPlan.count({ where: { status: 'APPROVED', createdAt: { gte: startOfYear, lte: endOfYear } } }),
        this.prisma.trainingCertificate.count({ where: { createdAt: { gte: startOfYear, lte: endOfYear } } }),
      ]);

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
        },
        certificates: {
          total: totalCertificates,
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
      const isBranchAllowed = !!user.branchId && training.targetBranches.some((branch) => branch.id === user.branchId);
      if (!isBranchAllowed) {
        return { eligible: false, reason: 'This training is not available for your branch' };
      }
    }

    // Check deadline
    if (training.applicationDeadline && new Date(training.applicationDeadline) < new Date()) {
      return { eligible: false, reason: 'Application deadline has passed' };
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

  // Get institution dashboard
  async getInstitutionDashboard(institutionId: string) {
    const [totalTrainings, participations, upcomingTrainings, certificates] = await Promise.all([
      this.prisma.training.count({
        where: { isPublished: true },
      }),
      this.prisma.trainingApplication.count({
        where: {
          user: { institutionId },
          status: 'APPROVED',
        },
      }),
      this.prisma.training.findMany({
        where: {
          isPublished: true,
          startDate: { gte: new Date() },
        },
        take: 5,
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.trainingCertificate.count({
        where: {
          user: { institutionId },
        },
      }),
    ]);

    return {
      totalTrainings,
      participations,
      certificates,
      upcomingTrainings,
    };
  }

  // Get institution participation report
  async getInstitutionParticipationReport(institutionId: string) {
    const applications = await this.prisma.trainingApplication.findMany({
      where: {
        user: { institutionId },
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
      select: { branchId: true },
    });
    return user?.branchId || null;
  }

  private getEffectiveBranchIds(requestedBranchIds?: string[], userBranchId?: string | null): string[] | undefined {
    if (!userBranchId) {
      return requestedBranchIds?.length ? requestedBranchIds : undefined;
    }

    if (!requestedBranchIds?.length) {
      return [userBranchId];
    }

    return requestedBranchIds.includes(userBranchId) ? [userBranchId] : [];
  }
}
