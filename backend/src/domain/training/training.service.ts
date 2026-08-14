import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma, Role, Designation } from '../../generated/prisma/client';
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
          targetDesignations: dto.targetDesignations || [],
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
          targetDesignations: dto.targetDesignations,
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
   * @param myOnly - If true, show only eligible trainings filtered by user's branch/designation. If false, show ALL trainings.
   */
  async findAll(filters: TrainingFilterDto, includeUnpublished = false, userId?: string, institutionId?: string, myOnly = false) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        year,
        month,
        deliveryMode,
        difficulty,
        branchIds,
        isPublished,
        status,
        isActive,
        startDateFrom,
        startDateTo,
      } = filters;

      const statusDerivedIsPublished =
        status === 'PUBLISHED' ? true : status === 'DRAFT' ? false : undefined;
      const effectiveIsPublished =
        typeof isPublished === 'boolean' ? isPublished : statusDerivedIsPublished;

      // myOnly=true → Show eligible trainings (filtered by user's branch AND designation)
      // myOnly=false → Show ALL trainings (no branch/designation filter)
      let combinedScopeCondition: Prisma.TrainingWhereInput | undefined = undefined;

      if (myOnly && userId) {
        // Apply branch and designation filtering to show only eligible trainings
        const userBranchId = await this.getUserBranchId(userId);
        const userDesignation = await this.getUserDesignation(userId);
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

        // Build designation filtering condition
        const designationScopeCondition = this.buildDesignationScopeCondition(userDesignation ?? null);

        // Combine branch and designation conditions with AND logic (both must match)
        combinedScopeCondition = this.buildCombinedScopeCondition(
          branchScopeCondition,
          designationScopeCondition,
        );
      } else if (branchIds?.length) {
        // Apply explicit branch filter if provided in request (for non-myOnly requests)
        combinedScopeCondition = {
          OR: [
            { targetBranches: { some: { id: { in: branchIds } } } },
            { targetBranches: { none: {} } },
          ],
        };
      }
      // When myOnly=false and no branchIds filter, show ALL trainings (no restriction)

      const where: Prisma.TrainingWhereInput = {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(effectiveIsPublished !== undefined
          ? { isPublished: effectiveIsPublished }
          : {}),
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

      // Apply combined scope condition (branch AND designation must match)
      if (combinedScopeCondition) {
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), combinedScopeCondition];
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

          const branchNames = Array.isArray(training.targetBranches)
            ? training.targetBranches.map((branch) => branch.shortName || branch.name)
            : [];

          return {
            ...training,
            branchNames,
            branchLabel: branchNames.length > 0 ? branchNames.join(', ') : 'All Branches',
            isAllBranches: branchNames.length === 0,
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
   * @param myOnly - If true, show only eligible trainings filtered by user's branch/designation. If false, show ALL trainings.
   */
  async getCalendar(filters: CalendarFilterDto, userId?: string, institutionId?: string, myOnly = false) {
    try {
      const { year = new Date().getFullYear(), month, branchIds, deliveryMode } = filters;

      // myOnly=true → Show eligible trainings (filtered by user's branch AND designation)
      // myOnly=false → Show ALL trainings (no branch/designation filter)
      let combinedScopeCondition: Prisma.TrainingWhereInput | undefined = undefined;

      if (myOnly && userId) {
        // Apply branch and designation filtering to show only eligible trainings
        const userBranchId = await this.getUserBranchId(userId);
        const userDesignation = await this.getUserDesignation(userId);
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

        // Build designation filtering condition
        const designationScopeCondition = this.buildDesignationScopeCondition(userDesignation ?? null);

        // Combine branch and designation conditions with AND logic (both must match)
        combinedScopeCondition = this.buildCombinedScopeCondition(
          branchScopeCondition,
          designationScopeCondition,
        );
      } else if (branchIds?.length) {
        // Apply explicit branch filter if provided in request (for non-myOnly requests)
        combinedScopeCondition = {
          OR: [
            { targetBranches: { some: { id: { in: branchIds } } } },
            { targetBranches: { none: {} } },
          ],
        };
      }
      // When myOnly=false and no branchIds filter, show ALL trainings (no restriction)

      const cacheKey = `training:calendar:${year}:${month || 'all'}:${branchIds?.join(',') || 'all'}:${deliveryMode || 'all'}:${myOnly ? userId : 'all'}`;

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

          // Apply combined scope condition (branch AND designation must match)
          if (combinedScopeCondition) {
            where.AND = [...(Array.isArray(where.AND) ? where.AND : []), combinedScopeCondition];
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

              const branchNames = Array.isArray(training.targetBranches)
                ? training.targetBranches.map((branch) => branch.shortName || branch.name)
                : [];

              return {
                ...training,
                branchNames,
                branchLabel: branchNames.length > 0 ? branchNames.join(', ') : 'All Branches',
                isAllBranches: branchNames.length === 0,
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
  async getUpcoming(limit = 50, branchIds?: string[], userId?: string, institutionId?: string) {
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const userBranchId = userId ? await this.getUserBranchId(userId) : undefined;
      const userDesignation = userId ? await this.getUserDesignation(userId) : undefined;
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

      // Build designation filtering condition
      const designationScopeCondition = userId
        ? this.buildDesignationScopeCondition(userDesignation ?? null)
        : undefined;

      // Combine branch and designation conditions with AND logic (both must match)
      const combinedScopeCondition = this.buildCombinedScopeCondition(
        branchScopeCondition,
        designationScopeCondition,
      );

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
          ...(combinedScopeCondition ? { AND: [combinedScopeCondition] } : {}),
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
  async findOne(id: string, userId?: string, institutionId?: string, enforceBranchAccess = true) {
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

      if (userId && enforceBranchAccess && training.targetBranches?.length > 0) {
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
      const toDateOnly = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const today = toDateOnly(now);

      const [trainings, applications, attendanceAgg, teachers, feedbackResponses, lessonPlansByTraining, approvedLessonPlans, totalCertificates, activeBranches, preTestByTraining, postTestByTraining] =
        await Promise.all([
          this.prisma.training.findMany({
            select: {
              id: true,
              title: true,
              isPublished: true,
              startDate: true,
              endDate: true,
              duration: true,
              preTestFormId: true,
              postTestFormId: true,
              feedbackFormId: true,
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
            where: { role: { in: ['TEACHER', 'FACULTY_COORDINATOR'] }, active: true },
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
          this.prisma.lessonPlan.groupBy({
            by: ['trainingId'],
            _count: { _all: true },
          }),
          this.prisma.lessonPlan.count({ where: { status: 'APPROVED' } }),
          this.prisma.trainingCertificate.count(),
          this.prisma.branch.findMany({
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              shortName: true,
              code: true,
            },
          }),
          this.prisma.preTestResponse.groupBy({
            by: ['trainingId'],
            _count: { _all: true },
          }),
          this.prisma.postTestResponse.groupBy({
            by: ['trainingId'],
            _count: { _all: true },
          }),
        ]);

      const certificateFacultyUsers = (await this.prisma.trainingCertificate.findMany({
        distinct: ['userId'],
        select: {
          userId: true,
        },
      })) as Array<{ userId: string }>;

      // Build per-training lookup maps from groupBy results
      const lessonPlanCountByTraining = new Map<string, number>(
        lessonPlansByTraining.map((item) => [item.trainingId, item._count._all]),
      );
      const preTestCountByTraining = new Map<string, number>(
        preTestByTraining.map((item) => [item.trainingId, item._count._all]),
      );
      const postTestCountByTraining = new Map<string, number>(
        postTestByTraining.map((item) => [item.trainingId, item._count._all]),
      );
      const feedbackCountByTraining = new Map<string, number>();
      for (const response of feedbackResponses) {
        if (response.trainingId) {
          feedbackCountByTraining.set(
            response.trainingId,
            (feedbackCountByTraining.get(response.trainingId) || 0) + 1,
          );
        }
      }

      // Derive totals from grouped data
      const totalLessonPlans = lessonPlansByTraining.reduce((sum, item) => sum + item._count._all, 0);
      const totalPreTestResponses = preTestByTraining.reduce((sum, item) => sum + item._count._all, 0);
      const totalPostTestResponses = postTestByTraining.reduce((sum, item) => sum + item._count._all, 0);

      const approvedApplicationsByTraining = new Map<string, number>();
      const trainingById = new Map(trainings.map((training) => [training.id, training]));
      const attendanceMap = new Map(
        attendanceAgg.map((attendance) => [
          `${attendance.userId}:${attendance.trainingId}`,
          attendance._count._all,
        ])
      );

      const totalTrainings = trainings.length;
      const publishedTrainings = trainings.filter((training) => training.isPublished).length;
      const upcomingTrainings = trainings.filter((training) => training.isPublished && toDateOnly(training.startDate) > today).length;
      const ongoingTrainings = trainings.filter(
        (training) => training.isPublished && toDateOnly(training.startDate) <= today && toDateOnly(training.endDate) >= today
      ).length;
      const completedTrainings = trainings.filter((training) => training.isPublished && toDateOnly(training.endDate) < today).length;

      const totalApplications = applications.length;
      const approvedApplications = applications.filter((application) => application.status === 'APPROVED').length;
      const totalAttendance = attendanceAgg.reduce((sum, item) => sum + item._count._all, 0);

      const totalFaculty = teachers.length;
      const teacherIds = new Set(teachers.map((teacher) => teacher.id));

      const teacherCourseMap = new Map<string, string>();
      const branchLabelById = new Map<string, string>();
      const branchLookupByLabel = new Map<string, string>();
      const courseTrainingIds = new Map<string, Set<string>>();
      const courseWiseMap = new Map<
        string,
        {
          courseId: string;
          course: string;
          facultyCount: number;
          completedFacultyIds: Set<string>;
          feedbackFacultyIds: Set<string>;
        }
      >();

      const normalizeBranchLabel = (value?: string | null) => value?.trim().toLowerCase() || '';

      const getBranchLabel = (branch: { name: string | null; shortName: string | null; code: string | null }) =>
        branch.name || branch.shortName || branch.code || '';

      const ensureCourseBucket = (courseId: string, courseLabel: string) => {
        if (!courseWiseMap.has(courseId)) {
          courseWiseMap.set(courseId, {
            courseId,
            course: courseLabel,
            facultyCount: 0,
            completedFacultyIds: new Set<string>(),
            feedbackFacultyIds: new Set<string>(),
          });
        }

        if (!courseTrainingIds.has(courseId)) {
          courseTrainingIds.set(courseId, new Set<string>());
        }
      };

      const resolveCourseForTraining = (userId: string, trainingId?: string | null) => {
        const profileCourse = teacherCourseMap.get(userId);
        // Only return valid courses (those mapped to existing branches)
        if (profileCourse) {
          return profileCourse;
        }

        // For teachers without branch assignment, try to infer from training
        if (!trainingId) {
          return null; // No course can be resolved
        }

        const training = trainingById.get(trainingId);
        if (!training) {
          return null;
        }

        const targetBranches = Array.isArray(training.targetBranches)
          ? training.targetBranches
          : [];

        // If exactly one target branch exists, use it as an inferred course
        if (targetBranches.length === 1) {
          return targetBranches[0]?.id || null;
        }

        return null;
      };

      // Seed all active branch buckets so the dashboard always shows full branch coverage
      // even when a branch currently has zero faculty mapped in user records.
      // Use full branch name for display
      for (const branch of activeBranches) {
        const courseId = branch.id;
        const courseName = getBranchLabel(branch);

        if (courseId && courseName) {
          branchLabelById.set(courseId, courseName);
          branchLookupByLabel.set(normalizeBranchLabel(courseName), courseId);
          branchLookupByLabel.set(normalizeBranchLabel(branch.shortName), courseId);
          branchLookupByLabel.set(normalizeBranchLabel(branch.code), courseId);
          ensureCourseBucket(courseId, courseName);
        }
      }

      for (const teacher of teachers) {
        // Primary: Use branchId relationship (source of truth)
        // Only count teachers with valid branch assignment
        // Skip teachers without a proper branch link
        if (!teacher.branch) {
          continue; // Skip unassigned teachers - only show valid branches
        }

        const courseId = teacher.branch.id;
        const courseName = getBranchLabel(teacher.branch);
        if (!courseId || !courseName) {
          continue; // Skip if branch has no name
        }

        branchLabelById.set(courseId, courseName);
        branchLookupByLabel.set(normalizeBranchLabel(courseName), courseId);
        branchLookupByLabel.set(normalizeBranchLabel(teacher.branch.shortName), courseId);
        branchLookupByLabel.set(normalizeBranchLabel(teacher.branch.code), courseId);
        teacherCourseMap.set(teacher.id, courseId);
        const existing = courseWiseMap.get(courseId);
        if (existing) {
          existing.facultyCount += 1;
        } else {
          courseWiseMap.set(courseId, {
            courseId,
            course: courseName,
            facultyCount: 1,
            completedFacultyIds: new Set<string>(),
            feedbackFacultyIds: new Set<string>(),
          });
        }

        if (!courseTrainingIds.has(courseId)) {
          courseTrainingIds.set(courseId, new Set<string>());
        }
      }

      for (const training of trainings) {
        const targetBranches = Array.isArray(training.targetBranches) ? training.targetBranches : [];

        for (const branch of targetBranches) {
          const courseId = branch.id;
          const courseName = getBranchLabel(branch);

          if (!courseId || !courseName) {
            continue;
          }

          branchLabelById.set(courseId, courseName);
          branchLookupByLabel.set(normalizeBranchLabel(courseName), courseId);
          branchLookupByLabel.set(normalizeBranchLabel(branch.shortName), courseId);
          branchLookupByLabel.set(normalizeBranchLabel(branch.code), courseId);
          ensureCourseBucket(courseId, courseName);
          courseTrainingIds.get(courseId)?.add(training.id);
        }
      }

      const facultyHoursMap = new Map<string, number>();
      const processedFacultyTraining = new Set<string>();
      const facultyWithOngoingTrainings = new Set<string>();
      const facultyWithCompletedTrainings = new Set<string>();
      const facultyWithNotFullAttendance = new Set<string>();
      const facultyAttendees = new Set<string>();
      const completedFacultyIds = new Set<string>();
      for (const record of certificateFacultyUsers) {
        completedFacultyIds.add(record.userId);
      }

      for (const application of applications) {
        if (application.status !== 'APPROVED') {
          continue;
        }

        const facultyTrainingKey = `${application.userId}:${application.trainingId}`;
        if (processedFacultyTraining.has(facultyTrainingKey)) {
          continue;
        }
        processedFacultyTraining.add(facultyTrainingKey);

        if (!teacherIds.has(application.userId)) {
          continue;
        }

        approvedApplicationsByTraining.set(
          application.trainingId,
          (approvedApplicationsByTraining.get(application.trainingId) || 0) + 1,
        );

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

        const trainingStart = toDateOnly(training.startDate);
        const trainingEnd = toDateOnly(training.endDate);
        const isCompletedTraining = trainingEnd < today;
        const hasFullAttendance = attendedDays >= safeTrainingDays;
        const hasAnyAttendance = attendedDays > 0;

        if (isCompletedTraining && hasAnyAttendance) {
          facultyHoursMap.set(application.userId, (facultyHoursMap.get(application.userId) || 0) + attendedHours);
          // Attendee = at least one day of attendance marked, full attendance not required.
          facultyAttendees.add(application.userId);

          const courseId = resolveCourseForTraining(application.userId, application.trainingId);
          // Only track if we have a valid course (existing branch)
          if (courseId && courseWiseMap.has(courseId)) {
            courseWiseMap.get(courseId)?.completedFacultyIds.add(application.userId);
          }
        }

        if (isCompletedTraining && hasFullAttendance) {
          facultyWithCompletedTrainings.add(application.userId);
        } else if (isCompletedTraining && hasAnyAttendance) {
          facultyWithNotFullAttendance.add(application.userId);
        }

        if (trainingStart <= today && trainingEnd >= today) {
          facultyWithOngoingTrainings.add(application.userId);
        }
      }

      const facultyHoursValues = Array.from(facultyHoursMap.entries())
        .filter(([userId]) => facultyWithCompletedTrainings.has(userId))
        .map(([, hours]) => hours);
      const participatingFacultyCount = facultyHoursValues.length;
      const totalFacultyHours = facultyHoursValues.reduce((sum, hours) => sum + hours, 0);
      const averageHoursPerFaculty = participatingFacultyCount > 0 ? totalFacultyHours / participatingFacultyCount : 0;
      const highestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.max(...facultyHoursValues) : 0;
      const lowestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.min(...facultyHoursValues) : 0;

      const facultyCompleted40Hours = facultyHoursValues.filter((hours) => hours >= 40).length;
      const facultyCompletedUnder40Hours = Math.max(participatingFacultyCount - facultyCompleted40Hours, 0);

      for (const response of feedbackResponses) {
        const courseId = resolveCourseForTraining(response.userId, response.trainingId);
        // Only track if we have a valid course (existing branch)
        if (courseId && courseWiseMap.has(courseId)) {
          courseWiseMap.get(courseId)?.feedbackFacultyIds.add(response.userId);
        }
      }

      const courseWiseFaculty = Array.from(courseWiseMap.values())
        .map((item) => ({
          courseId: item.courseId,
          course: item.course,
          facultyCount: item.facultyCount,
          totalCourseTrainings: courseTrainingIds.get(item.courseId)?.size || 0,
          completedTrainingsCount: item.completedFacultyIds.size,
          feedbackSubmittedCount: item.feedbackFacultyIds.size,
        }))
        .sort((a, b) => b.facultyCount - a.facultyCount);

      const trainingWiseSummary = trainings
        .filter((training) => training.isPublished && training.endDate < now)
        .map((training) => {
          const trainingDays =
            Math.ceil(
              (training.endDate.getTime() - training.startDate.getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
          const safeTrainingDays = Math.max(trainingDays, 1);
          const approvedTrainingApplications = applications.filter(
            (application) =>
              application.status === 'APPROVED' &&
              application.trainingId === training.id
          );

          let facultyWithFullAttendanceMarked = 0;
          let facultyWithNotFullAttendance = 0;

          for (const application of approvedTrainingApplications) {
            const attendedDays = attendanceMap.get(`${application.userId}:${application.trainingId}`) || 0;

            if (attendedDays >= safeTrainingDays) {
              facultyWithFullAttendanceMarked += 1;
            } else if (attendedDays > 0) {
              facultyWithNotFullAttendance += 1;
            }
          }

          const approvedCount = approvedApplicationsByTraining.get(training.id) || 0;

          return {
            trainingId: training.id,
            trainingTitle: training.title,
            startDate: training.startDate,
            endDate: training.endDate,
            totalTrainings: 1,
            totalNominations: approvedTrainingApplications.length,
            facultyWithFullAttendanceMarked,
            facultyWithNotFullAttendance,
            // Per-training engagement data
            lessonPlanRequired: approvedCount,
            lessonPlanDone: lessonPlanCountByTraining.get(training.id) || 0,
            preTestRequired: training.preTestFormId ? approvedCount : 0,
            preTestDone: preTestCountByTraining.get(training.id) || 0,
            postTestRequired: training.postTestFormId ? approvedCount : 0,
            postTestDone: postTestCountByTraining.get(training.id) || 0,
            feedbackRequired: training.feedbackFormId ? approvedCount : 0,
            feedbackDone: feedbackCountByTraining.get(training.id) || 0,
          };
        })
        .sort((a, b) => b.totalNominations - a.totalNominations);

      const totalFeedback = feedbackResponses.length;
      const preTestRequired = trainings.reduce(
        (sum, training) => sum + (training.preTestFormId ? (approvedApplicationsByTraining.get(training.id) || 0) : 0),
        0,
      );
      const postTestRequired = trainings.reduce(
        (sum, training) => sum + (training.postTestFormId ? (approvedApplicationsByTraining.get(training.id) || 0) : 0),
        0,
      );
      const feedbackRequired = trainings.reduce(
        (sum, training) => sum + (training.feedbackFormId ? (approvedApplicationsByTraining.get(training.id) || 0) : 0),
        0,
      );

      const totalFacultyRegistered = new Set(applications.map((application) => application.userId)).size;
      const applicantFacultyCount = new Set(
        applications.map((application) => application.userId),
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
        preTestResponses: {
          total: totalPreTestResponses,
        },
        postTestResponses: {
          total: totalPostTestResponses,
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
        facultyTrainingDetails: {
          totalTrainings: totalTrainings,
          totalNominations: totalApplications,
          facultyWithFullAttendanceMarked: facultyWithCompletedTrainings.size,
          facultyWithNotFullAttendance: facultyWithNotFullAttendance.size,
          facultyAttendeesCount: facultyAttendees.size,
          completedFaculty: completedFacultyIds.size,
        },
        trainingWiseSummary,
        engagementDetails: {
          lessonPlan: {
            required: approvedApplications,
            done: totalLessonPlans,
          },
          preTest: {
            required: preTestRequired,
            done: totalPreTestResponses,
          },
          postTest: {
            required: postTestRequired,
            done: totalPostTestResponses,
          },
          feedback: {
            required: feedbackRequired,
            done: totalFeedback,
          },
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
  async checkUserEligibility(trainingId: string, userId: string, enforceBranchEligibility = true) {
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

    if (enforceBranchEligibility && training.targetBranches?.length > 0) {
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
            role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
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
        courseId: string;
        course: string;
        facultyCount: number;
        trainingIds: Set<string>;
        completedFacultyIds: Set<string>;
        feedbackFacultyIds: Set<string>;
      }
    >();

    const ensureCourseBucket = (courseId: string, courseLabel: string) => {
      if (!courseWiseMap.has(courseId)) {
        courseWiseMap.set(courseId, {
          courseId,
          course: courseLabel,
          facultyCount: 0,
          trainingIds: new Set<string>(),
          completedFacultyIds: new Set<string>(),
          feedbackFacultyIds: new Set<string>(),
        });
      }
    };

    const resolveCourseForTraining = (userId: string, trainingId?: string | null) => {
      const profileCourse = teacherCourseMap.get(userId);
      // Only return valid courses (those mapped to existing branches)
      if (profileCourse) {
        return profileCourse;
      }

      // For teachers without branch assignment, try to infer from training
      if (!trainingId) {
        return null;
      }

      const training = trainingById.get(trainingId);
      if (!training) {
        return null;
      }

      const targetBranches = Array.isArray(training.targetBranches)
        ? training.targetBranches
        : [];

      // If exactly one target branch exists, use it as an inferred course
      if (targetBranches.length === 1) {
        return targetBranches[0]?.id || null;
      }

      return null;
    };

    for (const teacher of teachers) {
      // Primary: Use branchId relationship (source of truth)
      // Only count teachers with valid branch assignment
      if (!teacher.branch) {
        continue; // Skip unassigned teachers - only show valid branches
      }

      const courseId = teacher.branch.id;
      const courseName = teacher.branch.name || teacher.branch.shortName || teacher.branch.code;
      if (!courseId || !courseName) {
        continue; // Skip if branch has no name
      }

      teacherCourseMap.set(teacher.id, courseId);
      const existing = courseWiseMap.get(courseId);
      if (existing) {
        existing.facultyCount += 1;
      } else {
        courseWiseMap.set(courseId, {
          courseId,
          course: courseName,
          facultyCount: 1,
          trainingIds: new Set<string>(),
          completedFacultyIds: new Set<string>(),
          feedbackFacultyIds: new Set<string>(),
        });
      }
    }

    for (const training of scopedTrainings) {
      const targetBranches = Array.isArray(training.targetBranches) ? training.targetBranches : [];

      for (const branch of targetBranches) {
        const courseId = branch.id;
        const courseName = branch.name || branch.shortName || branch.code;

        if (!courseId || !courseName) {
          continue;
        }

        ensureCourseBucket(courseId, courseName);
        courseWiseMap.get(courseId)?.trainingIds.add(training.id);
      }
    }

    const facultyHoursMap = new Map<string, number>();
    const processedFacultyTraining = new Set<string>();

    const facultyWithCompletedTrainings = new Set<string>();
    const facultyWithOngoingTrainings = new Set<string>();

    for (const application of approvedApplications) {
      if (!allFacultyIds.has(application.userId)) {
        continue;
      }

      const facultyTrainingKey = `${application.userId}:${application.trainingId}`;
      if (processedFacultyTraining.has(facultyTrainingKey)) {
        continue;
      }
      processedFacultyTraining.add(facultyTrainingKey);

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

      const attendedDays = attendanceMap.get(`${application.userId}:${application.trainingId}`) || 0;
      const attendedHours = Math.min(attendedDays, safeTrainingDays) * hoursPerDay;

      const isCompletedTraining = training.endDate < now;

      if (isCompletedTraining && attendedDays > 0) {
        facultyHoursMap.set(
          application.userId,
          (facultyHoursMap.get(application.userId) || 0) + attendedHours,
        );
      }

      if (training.endDate < now && attendedDays > 0) {
        facultyWithCompletedTrainings.add(application.userId);

        const courseId = resolveCourseForTraining(application.userId, application.trainingId);
        // Only track if we have a valid course (existing branch)
        if (courseId && courseWiseMap.has(courseId)) {
          courseWiseMap.get(courseId)?.completedFacultyIds.add(application.userId);
        }
      }

      if (training.startDate <= now && training.endDate >= now) {
        facultyWithOngoingTrainings.add(application.userId);
      }
    }

    const facultyHoursValues = Array.from(facultyHoursMap.entries())
      .filter(([userId]) => facultyWithCompletedTrainings.has(userId))
      .map(([, hours]) => hours);
    const participatingFacultyCount = facultyHoursValues.length;
    const totalFacultyHours = facultyHoursValues.reduce((sum, hours) => sum + hours, 0);
    const averageHoursPerFaculty = participatingFacultyCount > 0 ? totalFacultyHours / participatingFacultyCount : 0;
    const highestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.max(...facultyHoursValues) : 0;
    const lowestHoursSingleFaculty = facultyHoursValues.length > 0 ? Math.min(...facultyHoursValues) : 0;

    const facultyCompleted40Hours = facultyHoursValues.filter((hours) => hours >= 40).length;
    const facultyCompletedUnder40Hours = Math.max(participatingFacultyCount - facultyCompleted40Hours, 0);

    const scopedFeedbackResponses = feedbackResponses.filter((response) =>
      scopedTrainingIds.has(response.trainingId),
    );

    for (const response of scopedFeedbackResponses) {
        const courseId = resolveCourseForTraining(response.userId, response.trainingId);
      // Only track if we have a valid course (existing branch)
        if (courseId && courseWiseMap.has(courseId)) {
          courseWiseMap.get(courseId)?.feedbackFacultyIds.add(response.userId);
      }
    }

    const courseWiseFaculty = Array.from(courseWiseMap.values())
      .map((item) => ({
          courseId: item.courseId,
        course: item.course,
        facultyCount: item.facultyCount,
          totalCourseTrainings: item.trainingIds.size,
        completedTrainingsCount: item.completedFacultyIds.size,
        feedbackSubmittedCount: item.feedbackFacultyIds.size,
      }))
      .sort((a, b) => b.facultyCount - a.facultyCount);

    const trainingWiseSummary = scopedTrainings
      .filter((training) => training.isPublished && training.endDate < now)
      .map((training) => {
        const trainingDays =
          Math.ceil(
            (training.endDate.getTime() - training.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        const safeTrainingDays = Math.max(trainingDays, 1);
        const approvedTrainingApplications = scopedApplications.filter(
          (application) =>
            application.status === 'APPROVED' &&
            application.trainingId === training.id
        );

        let facultyWithFullAttendanceMarked = 0;
        let facultyWithNotFullAttendance = 0;

        for (const application of approvedTrainingApplications) {
          const attendedDays = attendanceMap.get(`${application.userId}:${application.trainingId}`) || 0;

          if (attendedDays >= safeTrainingDays) {
            facultyWithFullAttendanceMarked += 1;
          } else if (attendedDays > 0) {
            facultyWithNotFullAttendance += 1;
          }
        }

        return {
          trainingId: training.id,
          trainingTitle: training.title,
          startDate: training.startDate,
          endDate: training.endDate,
          totalTrainings: 1,
          totalNominations: approvedTrainingApplications.length,
          facultyWithFullAttendanceMarked,
          facultyWithNotFullAttendance,
        };
      })
      .sort((a, b) => b.totalNominations - a.totalNominations);

    const totalFeedback = scopedFeedbackResponses.length;

    const totalFacultyRegistered = new Set(approvedApplications.map((application) => application.userId)).size;
    const applicantFacultyCount = new Set(
      scopedApplications.map((application) => application.userId),
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

  /**
   * Get user's designation enum
   */
  private async getUserDesignation(userId: string): Promise<Designation | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { designationEnum: true },
    });

    return user?.designationEnum || null;
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

  /**
   * Build designation-based scope condition for training filtering
   * Logic: Training is visible if designation matches OR training has no target designations
   * Exception: OTHER designation cannot see trainings with specific target designations
   */
  private buildDesignationScopeCondition(
    userDesignation: Designation | null,
  ): Prisma.TrainingWhereInput | undefined {
    // If user has no designation, they can only see trainings without target designations
    if (!userDesignation) {
      return { targetDesignations: { isEmpty: true } };
    }

    // If user has OTHER designation, they can only see trainings without target designations
    if (userDesignation === Designation.OTHER) {
      return { targetDesignations: { isEmpty: true } };
    }

    // User can see trainings where:
    // - targetDesignations is empty (open to all), OR
    // - targetDesignations contains user's designation
    return {
      OR: [
        { targetDesignations: { isEmpty: true } },
        { targetDesignations: { has: userDesignation } },
      ],
    };
  }

  /**
   * Build combined branch AND designation scope condition (restrictive)
   * Training is visible if:
   * - Branch matches (or no target branches), AND
   * - Designation matches (or no target designations)
   */
  private buildCombinedScopeCondition(
    branchScopeCondition: Prisma.TrainingWhereInput | undefined,
    designationScopeCondition: Prisma.TrainingWhereInput | undefined,
  ): Prisma.TrainingWhereInput | undefined {
    // If neither scope is defined, no filtering needed
    if (!branchScopeCondition && !designationScopeCondition) {
      return undefined;
    }

    // If only one scope is defined, use it
    if (!branchScopeCondition) {
      return designationScopeCondition;
    }
    if (!designationScopeCondition) {
      return branchScopeCondition;
    }

    // Both scopes defined: use AND logic (restrictive - both must match)
    return {
      AND: [branchScopeCondition, designationScopeCondition],
    };
  }
}
