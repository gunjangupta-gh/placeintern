import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, FeedbackFormPurpose, Prisma } from '../../generated/prisma/client';
import { CreateFeedbackFormDto, UpdateFeedbackFormDto, FeedbackFilterDto } from './dto';

@Injectable()
export class FeedbackFormService {
  private readonly logger = new Logger(FeedbackFormService.name);
  private readonly CACHE_TTL = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create feedback form (State only)
   */
  async create(dto: CreateFeedbackFormDto, userId: string) {
    try {
      this.logger.log(`Creating feedback form: ${dto.title}`);

      const form = await this.prisma.feedbackForm.create({
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose || FeedbackFormPurpose.GENERAL,
          isPublished: dto.publish || false,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });

      await this.invalidateCache();

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'FeedbackForm',
        entityId: form.id,
        userId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.MEDIUM,
        description: `Feedback form "${dto.title}" created`,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to create feedback form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update feedback form (State only)
   */
  async update(id: string, dto: UpdateFeedbackFormDto, userId: string) {
    try {
      const existing = await this.prisma.feedbackForm.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException('Feedback form not found');
      }

      // Check if form has responses
      const responseCount = await this.prisma.feedbackResponse.count({
        where: { feedbackFormId: id },
      });

      if (responseCount > 0 && dto.questions) {
        throw new BadRequestException(
          'Cannot modify questions for a form that has responses. Create a new form instead.'
        );
      }

      const form = await this.prisma.feedbackForm.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose,
          isActive: dto.isActive,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      await this.invalidateCache();

      return form;
    } catch (error) {
      this.logger.error(`Failed to update feedback form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete feedback form (State only)
   */
  async delete(id: string, userId: string) {
    try {
      const form = await this.prisma.feedbackForm.findUnique({ where: { id } });

      if (!form) {
        throw new NotFoundException('Feedback form not found');
      }

      const responseCount = await this.prisma.feedbackResponse.count({
        where: { feedbackFormId: id },
      });

      if (responseCount > 0) {
        throw new BadRequestException(
          `Cannot delete form with ${responseCount} responses. Deactivate it instead.`
        );
      }

      await this.prisma.feedbackForm.delete({ where: { id } });
      await this.invalidateCache();

      return { success: true, message: 'Feedback form deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete feedback form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Publish feedback form (State only)
   */
  async publish(id: string, userId: string) {
    try {
      const form = await this.prisma.feedbackForm.findUnique({ where: { id } });

      if (!form) {
        throw new NotFoundException('Feedback form not found');
      }

      if (form.isPublished) {
        throw new BadRequestException('Form is already published');
      }

      const updated = await this.prisma.feedbackForm.update({
        where: { id },
        data: { isPublished: true },
      });

      await this.invalidateCache();

      return updated;
    } catch (error) {
      this.logger.error(`Failed to publish feedback form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Duplicate feedback form (State only)
   */
  async duplicate(id: string, newTitle: string, userId: string) {
    try {
      const original = await this.prisma.feedbackForm.findUnique({ where: { id } });

      if (!original) {
        throw new NotFoundException('Feedback form not found');
      }

      const duplicate = await this.prisma.feedbackForm.create({
        data: {
          title: newTitle || `${original.title} (Copy)`,
          description: original.description,
          questions: original.questions as any,
          purpose: original.purpose,
          isPublished: false,
          createdById: userId,
        },
      });

      return duplicate;
    } catch (error) {
      this.logger.error(`Failed to duplicate feedback form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign form to training (State only)
   */
  async assignToTraining(formId: string, trainingId: string, userId: string) {
    try {
      const [form, training] = await Promise.all([
        this.prisma.feedbackForm.findUnique({ where: { id: formId } }),
        this.prisma.training.findUnique({ where: { id: trainingId } }),
      ]);

      if (!form) {
        throw new NotFoundException('Feedback form not found');
      }

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      await this.prisma.training.update({
        where: { id: trainingId },
        data: { feedbackFormId: formId },
      });

      return { success: true, message: 'Feedback form assigned to training' };
    } catch (error) {
      this.logger.error(`Failed to assign form to training: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all feedback forms
   */
  async findAll(filters: FeedbackFilterDto, includeUnpublished = false) {
    try {
      const { purpose, isPublished, isActive, search, page = 1, limit = 20 } = filters;

      const where: Prisma.FeedbackFormWhereInput = {
        ...(includeUnpublished ? {} : { isPublished: true }),
        ...(isPublished !== undefined ? { isPublished } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(purpose ? { purpose } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [forms, total] = await Promise.all([
        this.prisma.feedbackForm.findMany({
          where,
          include: {
            createdBy: { select: { id: true, name: true } },
            _count: { select: { responses: true, trainings: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.feedbackForm.count({ where }),
      ]);

      return {
        data: forms,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get feedback forms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get feedback form by ID
   */
  async findOne(id: string) {
    const form = await this.prisma.feedbackForm.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        trainings: { select: { id: true, title: true } },
        _count: { select: { responses: true } },
      },
    });

    if (!form) {
      throw new NotFoundException('Feedback form not found');
    }

    return form;
  }

  private async invalidateCache() {
    await this.cache.invalidate('feedback:forms:*').catch(() => {});
  }

  // Get feedback form by training
  async getByTraining(trainingId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { feedbackForm: true },
    });

    if (!training?.feedbackForm) {
      return null;
    }

    return training.feedbackForm;
  }
}
