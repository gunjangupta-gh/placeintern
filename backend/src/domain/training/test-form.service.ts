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

      this.validateLiveWindowConfig(dto);

      const form = await this.prisma.preTestForm.create({
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose || TestFormPurpose.PRE_TEST,
          passingScore: dto.passingScore,
          isPublished: dto.publish || false,
          isLiveWindowEnabled: dto.isLiveWindowEnabled || false,
          liveFrom: this.toDateOrUndefined(dto.liveFrom),
          liveUntil: this.toDateOrUndefined(dto.liveUntil),
          enforceTimer: dto.enforceTimer ?? true,
          durationMinutes: dto.durationMinutes,
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

      this.validateLiveWindowConfig(dto, existing);

      // Check if form has responses
      const responseCount = await this.prisma.preTestResponse.count({
        where: { preTestFormId: id },
      });

      const mergedQuestionsForAnswerKeyUpdate =
        responseCount > 0 && dto.questions
          ? this.mergeAnswerKeyOnlyUpdates(existing.questions as any[], dto.questions as any[])
          : undefined;

      if (responseCount > 0 && dto.questions) {
        if (!mergedQuestionsForAnswerKeyUpdate) {
          throw new BadRequestException(
            'Cannot modify question structure for a form that has responses. You can only update correct answers and passing score.'
          );
        }
      }

      const shouldRecalculateScores =
        responseCount > 0 && (dto.passingScore !== undefined || !!dto.questions);

      const form = await this.prisma.preTestForm.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          questions: (mergedQuestionsForAnswerKeyUpdate || dto.questions) as any,
          purpose: dto.purpose,
          passingScore: dto.passingScore,
          isActive: dto.isActive,
          isLiveWindowEnabled: dto.isLiveWindowEnabled,
          liveFrom: this.toDateOrUndefined(dto.liveFrom),
          liveUntil: this.toDateOrUndefined(dto.liveUntil),
          enforceTimer: dto.enforceTimer,
          durationMinutes: dto.durationMinutes,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      if (shouldRecalculateScores) {
        await this.recalculatePreTestScores(
          id,
          form.questions as any[],
          form.passingScore,
        );
      }

      await this.invalidateCache('pretest');

      const changedFields = Object.keys(dto).filter((key) => dto[key] !== undefined);
      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PreTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.MEDIUM,
        description: `Pre-test form "${form.title}" updated`,
        changedFields,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to update pre-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update pre-test form answer keys and passing score only (State only)
   * This method allows updating correct answers without requiring full question structure
   */
  async updatePreTestAnswerKeys(
    id: string,
    dto: {
      answerKeys?: Record<string, any>;
      passingScore?: number;
      isLiveWindowEnabled?: boolean;
      liveFrom?: string;
      liveUntil?: string;
      enforceTimer?: boolean;
      durationMinutes?: number;
    },
    userId: string,
  ) {
    try {
      const existing = await this.prisma.preTestForm.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException('Pre-test form not found');
      }

      this.validateLiveWindowConfig(dto, existing);

      const existingQuestions = existing.questions as any[];
      let updatedQuestions = existingQuestions;

      // Update answer keys if provided
      if (dto.answerKeys && Object.keys(dto.answerKeys).length > 0) {
        const questionIds = new Set(existingQuestions.map((q) => q.id));

        // Validate all provided question IDs exist
        for (const questionId of Object.keys(dto.answerKeys)) {
          if (!questionIds.has(questionId)) {
            throw new BadRequestException(`Question with ID "${questionId}" not found in form`);
          }
        }

        // Update correct answers
        updatedQuestions = existingQuestions.map((question) => {
          if (dto.answerKeys && dto.answerKeys.hasOwnProperty(question.id)) {
            return {
              ...question,
              correctAnswer: dto.answerKeys[question.id],
            };
          }
          return question;
        });
      }

      const form = await this.prisma.preTestForm.update({
        where: { id },
        data: {
          questions: updatedQuestions as any,
          ...(dto.passingScore !== undefined && { passingScore: dto.passingScore }),
          ...(dto.isLiveWindowEnabled !== undefined && {
            isLiveWindowEnabled: dto.isLiveWindowEnabled,
          }),
          ...(dto.liveFrom !== undefined && {
            liveFrom: this.toDateOrUndefined(dto.liveFrom),
          }),
          ...(dto.liveUntil !== undefined && {
            liveUntil: this.toDateOrUndefined(dto.liveUntil),
          }),
          ...(dto.enforceTimer !== undefined && { enforceTimer: dto.enforceTimer }),
          ...(dto.durationMinutes !== undefined && {
            durationMinutes: dto.durationMinutes,
          }),
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      // Recalculate scores for existing responses
      const responseCount = await this.prisma.preTestResponse.count({
        where: { preTestFormId: id },
      });

      if (responseCount > 0) {
        await this.recalculatePreTestScores(
          id,
          form.questions as any[],
          form.passingScore,
        );
      }

      await this.invalidateCache('pretest');

      const changedFields: string[] = [];
      if (dto.answerKeys) changedFields.push('answerKeys');
      if (dto.passingScore !== undefined) changedFields.push('passingScore');
      if (dto.isLiveWindowEnabled !== undefined) changedFields.push('isLiveWindowEnabled');
      if (dto.liveFrom !== undefined) changedFields.push('liveFrom');
      if (dto.liveUntil !== undefined) changedFields.push('liveUntil');
      if (dto.enforceTimer !== undefined) changedFields.push('enforceTimer');
      if (dto.durationMinutes !== undefined) changedFields.push('durationMinutes');

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PreTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.MEDIUM,
        description: `Pre-test form "${form.title}" answer keys updated`,
        changedFields,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to update pre-test answer keys: ${error.message}`, error.stack);
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

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PreTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.HIGH,
        description: `Pre-test form "${form.title}" deleted`,
        oldValues: {
          title: form.title,
          isActive: form.isActive,
          isPublished: form.isPublished,
          purpose: form.purpose,
        },
      }).catch(() => {});

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

      this.validateLiveWindowConfig(form);

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

      this.validateLiveWindowConfig(dto);

      const form = await this.prisma.postTestForm.create({
        data: {
          title: dto.title,
          description: dto.description,
          questions: dto.questions as any,
          purpose: dto.purpose || TestFormPurpose.POST_TEST,
          passingScore: dto.passingScore,
          isPublished: dto.publish || false,
          isLiveWindowEnabled: dto.isLiveWindowEnabled || false,
          liveFrom: this.toDateOrUndefined(dto.liveFrom),
          liveUntil: this.toDateOrUndefined(dto.liveUntil),
          enforceTimer: dto.enforceTimer ?? true,
          durationMinutes: dto.durationMinutes,
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

      this.validateLiveWindowConfig(dto, existing);

      // Check if form has responses
      const responseCount = await this.prisma.postTestResponse.count({
        where: { postTestFormId: id },
      });

      const mergedQuestionsForAnswerKeyUpdate =
        responseCount > 0 && dto.questions
          ? this.mergeAnswerKeyOnlyUpdates(existing.questions as any[], dto.questions as any[])
          : undefined;

      if (responseCount > 0 && dto.questions) {
        if (!mergedQuestionsForAnswerKeyUpdate) {
          throw new BadRequestException(
            'Cannot modify question structure for a form that has responses. You can only update correct answers and passing score.'
          );
        }
      }

      const shouldRecalculateScores =
        responseCount > 0 && (dto.passingScore !== undefined || !!dto.questions);

      const form = await this.prisma.postTestForm.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          questions: (mergedQuestionsForAnswerKeyUpdate || dto.questions) as any,
          purpose: dto.purpose,
          passingScore: dto.passingScore,
          isActive: dto.isActive,
          isLiveWindowEnabled: dto.isLiveWindowEnabled,
          liveFrom: this.toDateOrUndefined(dto.liveFrom),
          liveUntil: this.toDateOrUndefined(dto.liveUntil),
          enforceTimer: dto.enforceTimer,
          durationMinutes: dto.durationMinutes,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      if (shouldRecalculateScores) {
        await this.recalculatePostTestScores(
          id,
          form.questions as any[],
          form.passingScore,
        );
      }

      await this.invalidateCache('posttest');

      const changedFields = Object.keys(dto).filter((key) => dto[key] !== undefined);
      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PostTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.MEDIUM,
        description: `Post-test form "${form.title}" updated`,
        changedFields,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to update post-test form: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update post-test form answer keys and passing score only (State only)
   * This method allows updating correct answers without requiring full question structure
   */
  async updatePostTestAnswerKeys(
    id: string,
    dto: {
      answerKeys?: Record<string, any>;
      passingScore?: number;
      isLiveWindowEnabled?: boolean;
      liveFrom?: string;
      liveUntil?: string;
      enforceTimer?: boolean;
      durationMinutes?: number;
    },
    userId: string,
  ) {
    try {
      const existing = await this.prisma.postTestForm.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException('Post-test form not found');
      }

      this.validateLiveWindowConfig(dto, existing);

      const existingQuestions = existing.questions as any[];
      let updatedQuestions = existingQuestions;

      // Update answer keys if provided
      if (dto.answerKeys && Object.keys(dto.answerKeys).length > 0) {
        const questionIds = new Set(existingQuestions.map((q) => q.id));

        // Validate all provided question IDs exist
        for (const questionId of Object.keys(dto.answerKeys)) {
          if (!questionIds.has(questionId)) {
            throw new BadRequestException(`Question with ID "${questionId}" not found in form`);
          }
        }

        // Update correct answers
        updatedQuestions = existingQuestions.map((question) => {
          if (dto.answerKeys && dto.answerKeys.hasOwnProperty(question.id)) {
            return {
              ...question,
              correctAnswer: dto.answerKeys[question.id],
            };
          }
          return question;
        });
      }

      const form = await this.prisma.postTestForm.update({
        where: { id },
        data: {
          questions: updatedQuestions as any,
          ...(dto.passingScore !== undefined && { passingScore: dto.passingScore }),
          ...(dto.isLiveWindowEnabled !== undefined && {
            isLiveWindowEnabled: dto.isLiveWindowEnabled,
          }),
          ...(dto.liveFrom !== undefined && {
            liveFrom: this.toDateOrUndefined(dto.liveFrom),
          }),
          ...(dto.liveUntil !== undefined && {
            liveUntil: this.toDateOrUndefined(dto.liveUntil),
          }),
          ...(dto.enforceTimer !== undefined && { enforceTimer: dto.enforceTimer }),
          ...(dto.durationMinutes !== undefined && {
            durationMinutes: dto.durationMinutes,
          }),
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { responses: true, trainings: true } },
        },
      });

      // Recalculate scores for existing responses
      const responseCount = await this.prisma.postTestResponse.count({
        where: { postTestFormId: id },
      });

      if (responseCount > 0) {
        await this.recalculatePostTestScores(
          id,
          form.questions as any[],
          form.passingScore,
        );
      }

      await this.invalidateCache('posttest');

      const changedFields: string[] = [];
      if (dto.answerKeys) changedFields.push('answerKeys');
      if (dto.passingScore !== undefined) changedFields.push('passingScore');
      if (dto.isLiveWindowEnabled !== undefined) changedFields.push('isLiveWindowEnabled');
      if (dto.liveFrom !== undefined) changedFields.push('liveFrom');
      if (dto.liveUntil !== undefined) changedFields.push('liveUntil');
      if (dto.enforceTimer !== undefined) changedFields.push('enforceTimer');
      if (dto.durationMinutes !== undefined) changedFields.push('durationMinutes');

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PostTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.MEDIUM,
        description: `Post-test form "${form.title}" answer keys updated`,
        changedFields,
      }).catch(() => {});

      return form;
    } catch (error) {
      this.logger.error(`Failed to update post-test answer keys: ${error.message}`, error.stack);
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

      this.auditService.log({
        action: AuditAction.CONFIGURATION_CHANGE,
        entityType: 'PostTestForm',
        entityId: form.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.HIGH,
        description: `Post-test form "${form.title}" deleted`,
        oldValues: {
          title: form.title,
          isActive: form.isActive,
          isPublished: form.isPublished,
          purpose: form.purpose,
        },
      }).catch(() => {});

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

      this.validateLiveWindowConfig(form);

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

  private mergeAnswerKeyOnlyUpdates(
    existingQuestions: any[],
    incomingQuestions: any[],
  ): any[] | null {
    if (!Array.isArray(existingQuestions) || !Array.isArray(incomingQuestions)) {
      return null;
    }

    const existingById = new Map<string, any>();
    for (const question of existingQuestions) {
      if (!question?.id) {
        return null;
      }
      existingById.set(String(question.id), question);
    }

    // Allow partial updates and any order. Every provided question must exist and
    // only differ in correctAnswer.
    const incomingAnswerById = new Map<string, any>();
    for (const incomingQuestion of incomingQuestions) {
      const questionId = String(incomingQuestion?.id || '');
      if (!questionId || !existingById.has(questionId)) {
        return null;
      }

      const existingQuestion = existingById.get(questionId);

      const { correctAnswer: _existingAnswer, ...existingComparable } =
        existingQuestion || {};
      const { correctAnswer: _incomingAnswer, ...incomingComparable } =
        incomingQuestion || {};

      if (
        this.toComparableJson(existingComparable) !==
        this.toComparableJson(incomingComparable)
      ) {
        return null;
      }

      incomingAnswerById.set(questionId, incomingQuestion?.correctAnswer);
    }

    return existingQuestions.map((question) => {
      const questionId = String(question.id);
      if (!incomingAnswerById.has(questionId)) {
        return question;
      }

      return {
        ...question,
        correctAnswer: incomingAnswerById.get(questionId),
      };
    });
  }

  private toComparableJson(value: any): string {
    return JSON.stringify(this.normalizeForComparison(value));
  }

  private normalizeForComparison(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForComparison(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
          acc[key] = this.normalizeForComparison(value[key]);
          return acc;
        }, {} as Record<string, any>);
    }

    return value;
  }

  private async recalculatePreTestScores(
    formId: string,
    questions: any[],
    passingScore: number | null,
  ) {
    const responses = await this.prisma.preTestResponse.findMany({
      where: { preTestFormId: formId },
      select: { id: true, responses: true },
    });

    if (responses.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      responses.map((response) => {
        const { score, passed } = this.calculateScore(
          questions,
          response.responses as Record<string, any>,
          passingScore,
        );

        return this.prisma.preTestResponse.update({
          where: { id: response.id },
          data: { score, passed },
        });
      }),
    );
  }

  private async recalculatePostTestScores(
    formId: string,
    questions: any[],
    passingScore: number | null,
  ) {
    const responses = await this.prisma.postTestResponse.findMany({
      where: { postTestFormId: formId },
      select: { id: true, responses: true },
    });

    if (responses.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      responses.map((response) => {
        const { score, passed } = this.calculateScore(
          questions,
          response.responses as Record<string, any>,
          passingScore,
        );

        return this.prisma.postTestResponse.update({
          where: { id: response.id },
          data: { score, passed },
        });
      }),
    );
  }

  private calculateScore(
    questions: any[],
    responses: Record<string, any>,
    passingScore: number | null,
  ): { score: number | null; passed: boolean | null } {
    const scorableQuestions = questions.filter(
      (question) => question.correctAnswer !== undefined,
    );

    if (scorableQuestions.length === 0) {
      return { score: null, passed: null };
    }

    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of scorableQuestions) {
      const points = question.points || 1;
      totalPoints += points;

      const userAnswer = responses[question.id];
      const correctAnswer = question.correctAnswer;

      if (this.isAnswerCorrect(userAnswer, correctAnswer, question.type)) {
        earnedPoints += points;
      }
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = passingScore !== null ? score >= passingScore : null;

    return { score: Math.round(score * 100) / 100, passed };
  }

  private isAnswerCorrect(userAnswer: any, correctAnswer: any, type: string): boolean {
    if (userAnswer === undefined || userAnswer === null) {
      return false;
    }

    switch (type) {
      case 'multiChoice':
      case 'yesNo':
        return userAnswer === correctAnswer;

      case 'checkbox':
        if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
          return false;
        }

        if (userAnswer.length !== correctAnswer.length) {
          return false;
        }

        return correctAnswer.every((answer) => userAnswer.includes(answer));

      case 'rating':
      case 'number':
        return Number(userAnswer) === Number(correctAnswer);

      case 'text':
        return (
          String(userAnswer).toLowerCase().trim() ===
          String(correctAnswer).toLowerCase().trim()
        );

      default:
        return userAnswer === correctAnswer;
    }
  }

  private async invalidateCache(type: 'pretest' | 'posttest') {
    await this.cache.invalidate(`${type}:forms:*`).catch(() => {});
  }

  private validateLiveWindowConfig(
    values: {
      isLiveWindowEnabled?: boolean;
      liveFrom?: string | Date | null;
      liveUntil?: string | Date | null;
      enforceTimer?: boolean;
      durationMinutes?: number | null;
    },
    existing?: {
      isLiveWindowEnabled?: boolean;
      liveFrom?: Date | null;
      liveUntil?: Date | null;
      enforceTimer?: boolean;
      durationMinutes?: number | null;
    },
  ) {
    const isLiveWindowEnabled =
      values.isLiveWindowEnabled !== undefined
        ? values.isLiveWindowEnabled
        : existing?.isLiveWindowEnabled || false;

    const enforceTimer =
      values.enforceTimer !== undefined
        ? values.enforceTimer
        : existing?.enforceTimer ?? true;

    const liveFromRaw =
      values.liveFrom !== undefined ? values.liveFrom : existing?.liveFrom;
    const liveUntilRaw =
      values.liveUntil !== undefined ? values.liveUntil : existing?.liveUntil;
    const durationMinutes =
      values.durationMinutes !== undefined
        ? values.durationMinutes
        : existing?.durationMinutes;

    const liveFrom = this.toDateOrUndefined(liveFromRaw as any);
    const liveUntil = this.toDateOrUndefined(liveUntilRaw as any);

    if (isLiveWindowEnabled) {
      if (!liveFrom || !liveUntil) {
        throw new BadRequestException(
          'liveFrom and liveUntil are required when live window is enabled',
        );
      }
      if (liveFrom >= liveUntil) {
        throw new BadRequestException('liveFrom must be before liveUntil');
      }
    }

    if (enforceTimer && isLiveWindowEnabled) {
      if (!durationMinutes || durationMinutes <= 0) {
        throw new BadRequestException(
          'durationMinutes is required when timer is enforced',
        );
      }
    }
  }

  private toDateOrUndefined(value?: string | Date | null): Date | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date value provided');
    }
    return parsed;
  }
}
