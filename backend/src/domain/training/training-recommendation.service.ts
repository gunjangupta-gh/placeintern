import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, TrainingRecommendationStatus, Prisma } from '../../generated/prisma/client';
import { CreateRecommendationDto, UpdateRecommendationDto, ReviewRecommendationDto, RecommendationFilterDto } from './dto';

@Injectable()
export class TrainingRecommendationService {
  private readonly logger = new Logger(TrainingRecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new training recommendation (Faculty)
   */
  async create(dto: CreateRecommendationDto, userId: string) {
    try {
      this.logger.log(`User ${userId} creating training recommendation: ${dto.title}`);

      const recommendation = await this.prisma.trainingRecommendation.create({
        data: {
          userId,
          title: dto.title,
          description: dto.description,
          targetAudience: dto.targetAudience,
          suggestedDuration: dto.suggestedDuration,
          suggestedMode: dto.suggestedMode,
          suggestedDifficulty: dto.suggestedDifficulty,
          topicsCovered: dto.topicsCovered,
          learningOutcomes: dto.learningOutcomes,
          relevanceReason: dto.relevanceReason,
          suggestedTrainer: dto.suggestedTrainer,
          resourceLinks: dto.resourceLinks || [],
          estimatedBudget: dto.estimatedBudget,
          priority: dto.priority,
          targetBranches: dto.targetBranchIds?.length
            ? { connect: dto.targetBranchIds.map((id) => ({ id })) }
            : undefined,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          targetBranches: { select: { id: true, name: true, code: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.TRAINING_CREATE,
        entityType: 'TrainingRecommendation',
        entityId: recommendation.id,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        description: `Created training recommendation: "${dto.title}"`,
      }).catch(() => {});

      return recommendation;
    } catch (error) {
      this.logger.error(`Failed to create recommendation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update a training recommendation (Faculty - own only)
   */
  async update(id: string, dto: UpdateRecommendationDto, userId: string) {
    try {
      const existing = await this.prisma.trainingRecommendation.findUnique({
        where: { id },
        include: { targetBranches: true },
      });

      if (!existing) {
        throw new NotFoundException('Recommendation not found');
      }

      if (existing.userId !== userId) {
        throw new ForbiddenException('You can only edit your own recommendations');
      }

      // Can only edit if status is PENDING
      if (existing.status !== TrainingRecommendationStatus.PENDING) {
        throw new BadRequestException('Cannot edit recommendation after it has been reviewed');
      }

      const recommendation = await this.prisma.trainingRecommendation.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          targetAudience: dto.targetAudience,
          suggestedDuration: dto.suggestedDuration,
          suggestedMode: dto.suggestedMode,
          suggestedDifficulty: dto.suggestedDifficulty,
          topicsCovered: dto.topicsCovered,
          learningOutcomes: dto.learningOutcomes,
          relevanceReason: dto.relevanceReason,
          suggestedTrainer: dto.suggestedTrainer,
          resourceLinks: dto.resourceLinks,
          estimatedBudget: dto.estimatedBudget,
          priority: dto.priority,
          targetBranches: dto.targetBranchIds
            ? {
                set: [],
                connect: dto.targetBranchIds.map((branchId) => ({ id: branchId })),
              }
            : undefined,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          targetBranches: { select: { id: true, name: true, code: true } },
        },
      });

      return recommendation;
    } catch (error) {
      this.logger.error(`Failed to update recommendation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a training recommendation (Faculty - own only, if PENDING)
   */
  async delete(id: string, userId: string) {
    try {
      const existing = await this.prisma.trainingRecommendation.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Recommendation not found');
      }

      if (existing.userId !== userId) {
        throw new ForbiddenException('You can only delete your own recommendations');
      }

      if (existing.status !== TrainingRecommendationStatus.PENDING) {
        throw new BadRequestException('Cannot delete recommendation after it has been reviewed');
      }

      await this.prisma.trainingRecommendation.delete({ where: { id } });

      return { success: true, message: 'Recommendation deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete recommendation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's own recommendations (Faculty)
   */
  async getMyRecommendations(userId: string, filters: RecommendationFilterDto) {
    try {
      const { status, priority, search, page = 1, limit = 20 } = filters;

      const where: Prisma.TrainingRecommendationWhereInput = {
        userId,
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [recommendations, total] = await Promise.all([
        this.prisma.trainingRecommendation.findMany({
          where,
          include: {
            targetBranches: { select: { id: true, name: true, code: true } },
            reviewedBy: { select: { id: true, name: true } },
            implementedTraining: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.trainingRecommendation.count({ where }),
      ]);

      return {
        data: recommendations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get recommendations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get recommendation by ID
   */
  async getById(id: string) {
    const recommendation = await this.prisma.trainingRecommendation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            branchName: true,
            Institution: { select: { id: true, name: true, shortName: true } },
          },
        },
        targetBranches: { select: { id: true, name: true, code: true } },
        reviewedBy: { select: { id: true, name: true } },
        implementedTraining: { select: { id: true, title: true, startDate: true, endDate: true } },
      },
    });

    if (!recommendation) {
      throw new NotFoundException('Recommendation not found');
    }

    return recommendation;
  }

  /**
   * Get all recommendations (State - Admin)
   */
  async getAll(filters: RecommendationFilterDto) {
    try {
      const { status, priority, search, page = 1, limit = 20 } = filters;

      const where: Prisma.TrainingRecommendationWhereInput = {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [recommendations, total] = await Promise.all([
        this.prisma.trainingRecommendation.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              },
            },
            targetBranches: { select: { id: true, name: true, code: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.trainingRecommendation.count({ where }),
      ]);

      // Get status counts
      const statusCounts = await this.prisma.trainingRecommendation.groupBy({
        by: ['status'],
        _count: true,
      });

      return {
        data: recommendations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      };
    } catch (error) {
      this.logger.error(`Failed to get all recommendations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Review a recommendation (State - Admin)
   */
  async review(id: string, dto: ReviewRecommendationDto, reviewerId: string) {
    try {
      const existing = await this.prisma.trainingRecommendation.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true } } },
      });

      if (!existing) {
        throw new NotFoundException('Recommendation not found');
      }

      // Validate status transition
      if (dto.status === TrainingRecommendationStatus.IMPLEMENTED && !dto.implementedTrainingId) {
        throw new BadRequestException('Training ID is required when marking as implemented');
      }

      const recommendation = await this.prisma.trainingRecommendation.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewComments: dto.reviewComments,
          rejectionReason: dto.status === TrainingRecommendationStatus.REJECTED ? dto.rejectionReason : null,
          implementedTrainingId: dto.status === TrainingRecommendationStatus.IMPLEMENTED ? dto.implementedTrainingId : null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          targetBranches: { select: { id: true, name: true, code: true } },
          reviewedBy: { select: { id: true, name: true } },
          implementedTraining: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.TRAINING_UPDATE,
        entityType: 'TrainingRecommendation',
        entityId: id,
        userId: reviewerId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        description: `Recommendation "${existing.title}" ${dto.status.toLowerCase()}`,
      }).catch(() => {});

      return recommendation;
    } catch (error) {
      this.logger.error(`Failed to review recommendation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get recommendation statistics (State - Admin)
   */
  async getStats() {
    try {
      const [statusCounts, priorityCounts, recentCount, thisMonthCount] = await Promise.all([
        this.prisma.trainingRecommendation.groupBy({
          by: ['status'],
          _count: true,
        }),
        this.prisma.trainingRecommendation.groupBy({
          by: ['priority'],
          _count: true,
        }),
        this.prisma.trainingRecommendation.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.trainingRecommendation.count({
          where: {
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        }),
      ]);

      return {
        byStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        byPriority: priorityCounts.reduce((acc, p) => ({ ...acc, [p.priority]: p._count }), {}),
        recentCount,
        thisMonthCount,
        total: statusCounts.reduce((sum, s) => sum + s._count, 0),
      };
    } catch (error) {
      this.logger.error(`Failed to get recommendation stats: ${error.message}`, error.stack);
      throw error;
    }
  }
}
