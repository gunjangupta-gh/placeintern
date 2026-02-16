import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, TestFormPurpose, Prisma } from '../../generated/prisma/client';
import { CreateTestFormDto, UpdateTestFormDto, TestFormFilterDto } from './dto';

@Injectable()
export class TestFormService {
  private readonly logger = new Logger(TestFormService.name);
  private readonly CACHE_TTL = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  // ==================== PRE-TEST FORMS ====================

  /**
   * Create pre-test form (State only)
   */
  async createPreTestForm(dto: CreateTestFormDto, userId: string) {
    try {
      this.logger.log(`Creating pre-test form: ${dto.title}`);

      const form = await this.prisma.preTestForm.create({
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose || TestFormPurpose.PRE_TEST,
          passingScore: dto.passingScore,
          isPublished: dto.publish || false,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });

      await this.invalidateCache('pretest');

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PreTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.MEDIUM,
        description: `Pre-test form "${dto.title}" created`,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to create pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update pre-test form (State only)
   */
  async updatePreTestForm(id: string, dto: UpdateTestFormDto, userId: string) {
    try {
      const existing = await this.prisma.preTestForm.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException('Pre-test form not found');
      }

      // Check if form has responses
      const responseCount = await this.prisma.preTestResponse.count({
        where: { preTestFormId: id },
      });

      if (responseCount > 0 && dto.questions) {
        throw new BadRequestException(
          'Cannot modify questions for a form that has responses. Create a new form instead.'
        );
      }

      const form = await this.prisma.preTestForm.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose,
          passingScore: dto.passingScore,
          isActive: dto.isActive,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      await this.invalidateCache('pretest');

      return form;
    } catch (error) {
      this.logger.error(`Failed to update pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete pre-test form (State only)
   */
  async deletePreTestForm(id: string, userId: string) {
    try {
      const form = await this.prisma.preTestForm.findUnique({ where: { id } });

      if (!form) {
        throw new NotFoundException('Pre-test form not found');
      }

      const responseCount = await this.prisma.preTestResponse.count({
        where: { preTestFormId: id },
      });

      if (responseCount > 0) {
        throw new BadRequestException(
          `Cannot delete form with ${responseCount} responses. Deactivate it instead.`
        );
      }

      await this.prisma.preTestForm.delete({ where: { id } });
      await this.invalidateCache('pretest');

      return { success: true, message: 'Pre-test form deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Publish pre-test form (State only)
   */
  async publishPreTestForm(id: string, userId: string) {
    try {
      const form = await this.prisma.preTestForm.findUnique({ where: { id } });

      if (!form) {
        throw new NotFoundException('Pre-test form not found');
      }

      if (form.isPublished) {
        throw new BadRequestException('Form is already published');
      }

      const updated = await this.prisma.preTestForm.update({
        where: { id },
        data: { isPublished: true },
      });

      await this.invalidateCache('pretest');

      return updated;
    } catch (error) {
      this.logger.error(`Failed to publish pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Duplicate pre-test form (State only)
   */
  async duplicatePreTestForm(id: string, newTitle: string, userId: string) {
    try {
      const original = await this.prisma.preTestForm.findUnique({ where: { id } });

      if (!original) {
        throw new NotFoundException('Pre-test form not found');
      }

      const duplicate = await this.prisma.preTestForm.create({
        data: {
          title: newTitle || `${original.title} (Copy)`,
          description: original.description,
          questions: original.questions as any,
          purpose: original.purpose,
          passingScore: original.passingScore,
          isPublished: false,
          createdById: userId,
        },
      });

      return duplicate;
    } catch (error) {
      this.logger.error(`Failed to duplicate pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all pre-test forms
   */
  async findAllPreTestForms(filters: TestFormFilterDto, includeUnpublished = false) {
    try {
      const { purpose, isPublished, isActive, search, page = 1, limit = 20 } = filters;

      const where: Prisma.PreTestFormWhereInput = {
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
        this.prisma.preTestForm.findMany({
          where,
          include: {
            createdBy: { select: { id: true, name: true } },
            _count: { select: { responses: true, trainings: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.preTestForm.count({ where }),
      ]);

      return {
        data: forms,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get pre-test forms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get pre-test form by ID
   */
  async findOnePreTestForm(id: string) {
    const form = await this.prisma.preTestForm.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        trainings: { select: { id: true, title: true } },
        _count: { select: { responses: true } },
      },
    });

    if (!form) {
      throw new NotFoundException('Pre-test form not found');
    }

    return form;
  }

  /**
   * Get pre-test form by training
   */
  async getPreTestFormByTraining(trainingId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { preTestForm: true },
    });

    return training?.preTestForm || null;
  }

  // ==================== POST-TEST FORMS ====================

  /**
   * Create post-test form (State only)
   */
  async createPostTestForm(dto: CreateTestFormDto, userId: string) {
    try {
      this.logger.log(`Creating post-test form: ${dto.title}`);

      const form = await this.prisma.postTestForm.create({
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose || TestFormPurpose.POST_TEST,
          passingScore: dto.passingScore,
          isPublished: dto.publish || false,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });

      await this.invalidateCache('posttest');

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PostTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.MEDIUM,
        description: `Post-test form "${dto.title}" created`,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to create post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update post-test form (State only)
   */
  async updatePostTestForm(id: string, dto: UpdateTestFormDto, userId: string) {
    try {
      const existing = await this.prisma.postTestForm.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException('Post-test form not found');
      }

      // Check if form has responses
      const responseCount = await this.prisma.postTestResponse.count({
        where: { postTestFormId: id },
      });

      if (responseCount > 0 && dto.questions) {
        throw new BadRequestException(
          'Cannot modify questions for a form that has responses. Create a new form instead.'
        );
      }

      const form = await this.prisma.postTestForm.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose,
          passingScore: dto.passingScore,
          isActive: dto.isActive,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      await this.invalidateCache('posttest');

      return form;
    } catch (error) {
      this.logger.error(`Failed to update post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete post-test form (State only)
   */
  async deletePostTestForm(id: string, userId: string) {
    try {
      const form = await this.prisma.postTestForm.findUnique({ where: { id } });

      if (!form) {
        throw new NotFoundException('Post-test form not found');
      }

      const responseCount = await this.prisma.postTestResponse.count({
        where: { postTestFormId: id },
      });

      if (responseCount > 0) {
        throw new BadRequestException(
          `Cannot delete form with ${responseCount} responses. Deactivate it instead.`
        );
      }

      await this.prisma.postTestForm.delete({ where: { id } });
      await this.invalidateCache('posttest');

      return { success: true, message: 'Post-test form deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Publish post-test form (State only)
   */
  async publishPostTestForm(id: string, userId: string) {
    try {
      const form = await this.prisma.postTestForm.findUnique({ where: { id } });

      if (!form) {
        throw new NotFoundException('Post-test form not found');
      }

      if (form.isPublished) {
        throw new BadRequestException('Form is already published');
      }

      const updated = await this.prisma.postTestForm.update({
        where: { id },
        data: { isPublished: true },
      });

      await this.invalidateCache('posttest');

      return updated;
    } catch (error) {
      this.logger.error(`Failed to publish post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Duplicate post-test form (State only)
   */
  async duplicatePostTestForm(id: string, newTitle: string, userId: string) {
    try {
      const original = await this.prisma.postTestForm.findUnique({ where: { id } });

      if (!original) {
        throw new NotFoundException('Post-test form not found');
      }

      const duplicate = await this.prisma.postTestForm.create({
        data: {
          title: newTitle || `${original.title} (Copy)`,
          description: original.description,
          questions: original.questions as any,
          purpose: original.purpose,
          passingScore: original.passingScore,
          isPublished: false,
          createdById: userId,
        },
      });

      return duplicate;
    } catch (error) {
      this.logger.error(`Failed to duplicate post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all post-test forms
   */
  async findAllPostTestForms(filters: TestFormFilterDto, includeUnpublished = false) {
    try {
      const { purpose, isPublished, isActive, search, page = 1, limit = 20 } = filters;

      const where: Prisma.PostTestFormWhereInput = {
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
        this.prisma.postTestForm.findMany({
          where,
          include: {
            createdBy: { select: { id: true, name: true } },
            _count: { select: { responses: true, trainings: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.postTestForm.count({ where }),
      ]);

      return {
        data: forms,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get post-test forms: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get post-test form by ID
   */
  async findOnePostTestForm(id: string) {
    const form = await this.prisma.postTestForm.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        trainings: { select: { id: true, title: true } },
        _count: { select: { responses: true } },
      },
    });

    if (!form) {
      throw new NotFoundException('Post-test form not found');
    }

    return form;
  }

  /**
   * Get post-test form by training
   */
  async getPostTestFormByTraining(trainingId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { postTestForm: true },
    });

    return training?.postTestForm || null;
  }

  // ==================== ASSIGNMENT ====================

  /**
   * Assign pre-test form to training
   */
  async assignPreTestToTraining(formId: string, trainingId: string, userId: string) {
    try {
      const [form, training] = await Promise.all([
        this.prisma.preTestForm.findUnique({ where: { id: formId } }),
        this.prisma.training.findUnique({ where: { id: trainingId } }),
      ]);

      if (!form) {
        throw new NotFoundException('Pre-test form not found');
      }

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      await this.prisma.training.update({
        where: { id: trainingId },
        data: { preTestFormId: formId },
      });

      return { success: true, message: 'Pre-test form assigned to training' };
    } catch (error) {
      this.logger.error(`Failed to assign pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign post-test form to training
   */
  async assignPostTestToTraining(formId: string, trainingId: string, userId: string) {
    try {
      const [form, training] = await Promise.all([
        this.prisma.postTestForm.findUnique({ where: { id: formId } }),
        this.prisma.training.findUnique({ where: { id: trainingId } }),
      ]);

      if (!form) {
        throw new NotFoundException('Post-test form not found');
      }

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      await this.prisma.training.update({
        where: { id: trainingId },
        data: { postTestFormId: formId },
      });

      return { success: true, message: 'Post-test form assigned to training' };
    } catch (error) {
      this.logger.error(`Failed to assign post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async invalidateCache(type: 'pretest' | 'posttest') {
    await this.cache.invalidate(`${type}:forms:*`).catch(() => {});
  }
}
