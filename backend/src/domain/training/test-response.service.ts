import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { CacheService } from '../../core/cache/cache.service';
import { Prisma } from '../../generated/prisma/client';
import { AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { SubmitTestResponseDto } from './dto';

@Injectable()
export class TestResponseService {
  private readonly logger = new Logger(TestResponseService.name);
  private readonly ATTEMPT_BUFFER_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cache: CacheService,
  ) {}

  // ==================== PRE-TEST RESPONSES ====================

  /**
   * Submit pre-test response (Faculty)
   */
  async submitPreTestResponse(dto: SubmitTestResponseDto, userId: string) {
    try {
      this.logger.log(`Submitting pre-test response for training ${dto.trainingId}`);

      // Check if pre-test form exists and is linked to training
      const training = await this.prisma.training.findUnique({
        where: { id: dto.trainingId },
        include: { preTestForm: true },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (!training.preTestForm) {
        throw new BadRequestException('This training does not have a pre-test form');
      }

      if (training.preTestForm.id !== dto.testFormId) {
        throw new BadRequestException('Invalid pre-test form for this training');
      }

      this.assertFormActiveAndPublished(training.preTestForm, 'pre-test');
      this.assertLiveWindow(training.preTestForm, 'pre-test');

      // Check if user has approved application
      const application = await this.prisma.trainingApplication.findFirst({
        where: {
          userId,
          trainingId: dto.trainingId,
          status: 'APPROVED',
          isActive: true,
        },
      });

      if (!application) {
        throw new BadRequestException('You must have an approved application to submit pre-test');
      }

      // Check if already submitted
      const existingResponse = await this.prisma.preTestResponse.findUnique({
        where: {
          userId_preTestFormId_trainingId: {
            userId,
            preTestFormId: dto.testFormId,
            trainingId: dto.trainingId,
          },
        },
      });

      if (existingResponse) {
        throw new BadRequestException('You have already submitted the pre-test for this training');
      }

      await this.assertTimerIfEnabled('pre', userId, dto.trainingId, dto.testFormId, training.preTestForm);

      // Calculate score if there are correct answers
      const { score, passed } = this.calculateScore(training.preTestForm.questions as any[], dto.responses, training.preTestForm.passingScore);

      const response = await this.prisma.preTestResponse.create({
        data: {
          userId,
          preTestFormId: dto.testFormId,
          trainingId: dto.trainingId,
          responses: dto.responses as any,
          score,
          passed,
        },
        include: {
          preTestForm: { select: { id: true, title: true, passingScore: true } },
          training: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.TRAINING_FEEDBACK_SUBMIT,
        entityType: 'PreTestResponse',
        entityId: response.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.LOW,
        description: `Pre-test submitted for training "${training.title}"`,
      }).catch(() => {});

      await this.clearAttemptKey('pre', userId, dto.trainingId, dto.testFormId);

      return response;
    } catch (error) {
      this.logger.error(`Failed to submit pre-test response: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get pre-test response status for user
   */
  async getPreTestStatus(trainingId: string, userId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { preTestForm: true },
    });

    if (!training?.preTestForm) {
      return { required: false, hasForm: false };
    }

    const response = await this.prisma.preTestResponse.findUnique({
      where: {
        userId_preTestFormId_trainingId: {
          userId,
          preTestFormId: training.preTestForm.id,
          trainingId,
        },
      },
    });

    const windowStatus = this.getLiveWindowStatus(training.preTestForm);
    const attempt = await this.getAttemptFromCache(
      'pre',
      userId,
      trainingId,
      training.preTestForm.id,
    );
    const remainingSeconds = this.getRemainingSeconds(attempt?.expiresAt);

    return {
      required: true,
      hasForm: true,
      isLiveNow: windowStatus.isLiveNow,
      lockReason: windowStatus.lockReason,
      liveWindowEnabled: training.preTestForm.isLiveWindowEnabled,
      opensAt: training.preTestForm.liveFrom,
      closesAt: training.preTestForm.liveUntil,
      timerEnabled: !!training.preTestForm.enforceTimer,
      durationMinutes: training.preTestForm.durationMinutes,
      timerStartedAt: attempt?.startedAt || null,
      timerExpiresAt: attempt?.expiresAt || null,
      remainingSeconds,
      canStart: !response && windowStatus.isLiveNow,
      canSubmit: !response && windowStatus.isLiveNow && (!training.preTestForm.enforceTimer || remainingSeconds > 0),
      submitted: !!response,
      response: response ? {
        id: response.id,
        score: response.score,
        passed: response.passed,
        submittedAt: response.submittedAt,
      } : null,
    };
  }

  async startPreTestAttempt(trainingId: string, userId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { preTestForm: true },
    });

    if (!training) {
      throw new NotFoundException('Training not found');
    }

    if (!training.preTestForm) {
      throw new BadRequestException('This training does not have a pre-test form');
    }

    this.assertFormActiveAndPublished(training.preTestForm, 'pre-test');
    this.assertLiveWindow(training.preTestForm, 'pre-test');

    const existingResponse = await this.prisma.preTestResponse.findUnique({
      where: {
        userId_preTestFormId_trainingId: {
          userId,
          preTestFormId: training.preTestForm.id,
          trainingId,
        },
      },
    });

    if (existingResponse) {
      throw new BadRequestException('You have already submitted the pre-test for this training');
    }

    const application = await this.prisma.trainingApplication.findFirst({
      where: {
        userId,
        trainingId,
        status: 'APPROVED',
        isActive: true,
      },
    });

    if (!application) {
      throw new BadRequestException('You must have an approved application to start pre-test');
    }

    if (!training.preTestForm.enforceTimer || !training.preTestForm.durationMinutes) {
      return {
        timerEnabled: false,
        durationMinutes: training.preTestForm.durationMinutes,
        startedAt: null,
        expiresAt: null,
        remainingSeconds: null,
      };
    }

    const attempt = await this.getOrCreateAttempt(
      'pre',
      userId,
      trainingId,
      training.preTestForm.id,
      training.preTestForm.durationMinutes,
    );

    return {
      timerEnabled: true,
      durationMinutes: training.preTestForm.durationMinutes,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingSeconds: this.getRemainingSeconds(attempt.expiresAt),
    };
  }

  /**
   * Get all pre-test responses for a training (State)
   */
  async getPreTestResponsesByTraining(trainingId: string) {
    const responses = await this.prisma.preTestResponse.findMany({
      where: { trainingId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        preTestForm: { select: { id: true, title: true, passingScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const stats = {
      total: responses.length,
      passed: responses.filter(r => r.passed === true).length,
      failed: responses.filter(r => r.passed === false).length,
      averageScore: responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length
        : 0,
    };

    return { responses, stats };
  }

  // ==================== POST-TEST RESPONSES ====================

  /**
   * Submit post-test response (Faculty)
   */
  async submitPostTestResponse(dto: SubmitTestResponseDto, userId: string) {
    try {
      this.logger.log(`Submitting post-test response for training ${dto.trainingId}`);

      // Check if post-test form exists and is linked to training
      const training = await this.prisma.training.findUnique({
        where: { id: dto.trainingId },
        include: { postTestForm: true },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      if (!training.postTestForm) {
        throw new BadRequestException('This training does not have a post-test form');
      }

      if (training.postTestForm.id !== dto.testFormId) {
        throw new BadRequestException('Invalid post-test form for this training');
      }

      this.assertFormActiveAndPublished(training.postTestForm, 'post-test');
      this.assertLiveWindow(training.postTestForm, 'post-test');

      // Check if user has approved application
      const application = await this.prisma.trainingApplication.findFirst({
        where: {
          userId,
          trainingId: dto.trainingId,
          status: 'APPROVED',
          isActive: true,
        },
      });

      if (!application) {
        throw new BadRequestException('You must have an approved application to submit post-test');
      }

      // Keep existing behavior when no explicit live window is configured.
      const now = new Date();
      if (!training.postTestForm.isLiveWindowEnabled && training.endDate > now) {
        throw new BadRequestException('Post-test can only be submitted after the training ends');
      }

      // Check if already submitted
      const existingResponse = await this.prisma.postTestResponse.findUnique({
        where: {
          userId_postTestFormId_trainingId: {
            userId,
            postTestFormId: dto.testFormId,
            trainingId: dto.trainingId,
          },
        },
      });

      if (existingResponse) {
        throw new BadRequestException('You have already submitted the post-test for this training');
      }

      await this.assertTimerIfEnabled('post', userId, dto.trainingId, dto.testFormId, training.postTestForm);

      // Calculate score if there are correct answers
      const { score, passed } = this.calculateScore(training.postTestForm.questions as any[], dto.responses, training.postTestForm.passingScore);

      const response = await this.prisma.postTestResponse.create({
        data: {
          userId,
          postTestFormId: dto.testFormId,
          trainingId: dto.trainingId,
          responses: dto.responses as any,
          score,
          passed,
        },
        include: {
          postTestForm: { select: { id: true, title: true, passingScore: true } },
          training: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.TRAINING_FEEDBACK_SUBMIT,
        entityType: 'PostTestResponse',
        entityId: response.id,
        userId,
        category: AuditCategory.TRAINING,
        severity: AuditSeverity.LOW,
        description: `Post-test submitted for training "${training.title}"`,
      }).catch(() => {});

      await this.clearAttemptKey('post', userId, dto.trainingId, dto.testFormId);

      return response;
    } catch (error) {
      this.logger.error(`Failed to submit post-test response: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get post-test response status for user
   */
  async getPostTestStatus(trainingId: string, userId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { postTestForm: true },
    });

    if (!training?.postTestForm) {
      return { required: false, hasForm: false };
    }

    const response = await this.prisma.postTestResponse.findUnique({
      where: {
        userId_postTestFormId_trainingId: {
          userId,
          postTestFormId: training.postTestForm.id,
          trainingId,
        },
      },
    });

    const trainingEnded = training.endDate < new Date();
    const windowStatus = this.getLiveWindowStatus(training.postTestForm);
    const attempt = await this.getAttemptFromCache(
      'post',
      userId,
      trainingId,
      training.postTestForm.id,
    );
    const remainingSeconds = this.getRemainingSeconds(attempt?.expiresAt);
    const postTestWindowSatisfied =
      training.postTestForm.isLiveWindowEnabled ? windowStatus.isLiveNow : trainingEnded;

    return {
      required: true,
      hasForm: true,
      trainingEnded,
      isLiveNow: windowStatus.isLiveNow,
      lockReason: windowStatus.lockReason,
      liveWindowEnabled: training.postTestForm.isLiveWindowEnabled,
      opensAt: training.postTestForm.liveFrom,
      closesAt: training.postTestForm.liveUntil,
      timerEnabled: !!training.postTestForm.enforceTimer,
      durationMinutes: training.postTestForm.durationMinutes,
      timerStartedAt: attempt?.startedAt || null,
      timerExpiresAt: attempt?.expiresAt || null,
      remainingSeconds,
      canStart: !response && postTestWindowSatisfied,
      canSubmit:
        !response &&
        postTestWindowSatisfied &&
        (!training.postTestForm.enforceTimer || remainingSeconds > 0),
      submitted: !!response,
      response: response ? {
        id: response.id,
        score: response.score,
        passed: response.passed,
        submittedAt: response.submittedAt,
      } : null,
    };
  }

  async startPostTestAttempt(trainingId: string, userId: string) {
    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      include: { postTestForm: true },
    });

    if (!training) {
      throw new NotFoundException('Training not found');
    }

    if (!training.postTestForm) {
      throw new BadRequestException('This training does not have a post-test form');
    }

    this.assertFormActiveAndPublished(training.postTestForm, 'post-test');
    this.assertLiveWindow(training.postTestForm, 'post-test');

    const application = await this.prisma.trainingApplication.findFirst({
      where: {
        userId,
        trainingId,
        status: 'APPROVED',
        isActive: true,
      },
    });

    if (!application) {
      throw new BadRequestException('You must have an approved application to start post-test');
    }

    const existingResponse = await this.prisma.postTestResponse.findUnique({
      where: {
        userId_postTestFormId_trainingId: {
          userId,
          postTestFormId: training.postTestForm.id,
          trainingId,
        },
      },
    });

    if (existingResponse) {
      throw new BadRequestException('You have already submitted the post-test for this training');
    }

    if (!training.postTestForm.isLiveWindowEnabled && training.endDate > new Date()) {
      throw new BadRequestException('Post-test can only be started after the training ends');
    }

    if (!training.postTestForm.enforceTimer || !training.postTestForm.durationMinutes) {
      return {
        timerEnabled: false,
        durationMinutes: training.postTestForm.durationMinutes,
        startedAt: null,
        expiresAt: null,
        remainingSeconds: null,
      };
    }

    const attempt = await this.getOrCreateAttempt(
      'post',
      userId,
      trainingId,
      training.postTestForm.id,
      training.postTestForm.durationMinutes,
    );

    return {
      timerEnabled: true,
      durationMinutes: training.postTestForm.durationMinutes,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingSeconds: this.getRemainingSeconds(attempt.expiresAt),
    };
  }

  /**
   * Get all post-test responses for a training (State)
   */
  async getPostTestResponsesByTraining(trainingId: string) {
    const responses = await this.prisma.postTestResponse.findMany({
      where: { trainingId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        postTestForm: { select: { id: true, title: true, passingScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const stats = {
      total: responses.length,
      passed: responses.filter(r => r.passed === true).length,
      failed: responses.filter(r => r.passed === false).length,
      averageScore: responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length
        : 0,
    };

    return { responses, stats };
  }

  /**
   * Get all pre-test responses for a form (State)
   */
  async getPreTestResponsesByForm(formId: string) {
    const responses = await this.prisma.preTestResponse.findMany({
      where: { preTestFormId: formId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            Institution: { select: { id: true, name: true, shortName: true } },
          },
        },
        training: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const stats = {
      total: responses.length,
      passed: responses.filter(r => r.passed === true).length,
      failed: responses.filter(r => r.passed === false).length,
      averageScore: responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length
        : 0,
    };

    return { responses, stats };
  }

  /**
   * Get all post-test responses for a form (State)
   */
  async getPostTestResponsesByForm(formId: string) {
    const responses = await this.prisma.postTestResponse.findMany({
      where: { postTestFormId: formId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            Institution: { select: { id: true, name: true, shortName: true } },
          },
        },
        training: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const stats = {
      total: responses.length,
      passed: responses.filter(r => r.passed === true).length,
      failed: responses.filter(r => r.passed === false).length,
      averageScore: responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length
        : 0,
    };

    return { responses, stats };
  }

  // ==================== COMBINED STATUS ====================

  /**
   * Get all test statuses for a user on a training
   */
  async getTestStatusForTraining(trainingId: string, userId: string) {
    const [preTestStatus, postTestStatus] = await Promise.all([
      this.getPreTestStatus(trainingId, userId),
      this.getPostTestStatus(trainingId, userId),
    ]);

    return {
      preTest: preTestStatus,
      postTest: postTestStatus,
    };
  }

  /**
   * Get pending tests for user (Faculty dashboard)
   */
  async getPendingTestsForUser(userId: string) {
    // Get all approved training applications for the user
    const applications = await this.prisma.trainingApplication.findMany({
      where: {
        userId,
        status: 'APPROVED',
        isActive: true,
      },
      include: {
        training: {
          include: {
            preTestForm: true,
            postTestForm: true,
          },
        },
      },
    });

    const pendingPreTests = [];
    const pendingPostTests = [];
    const now = new Date();

    for (const app of applications) {
      const training = app.training;

      // Check pre-test
      if (training.preTestForm) {
        const preTestResponse = await this.prisma.preTestResponse.findUnique({
          where: {
            userId_preTestFormId_trainingId: {
              userId,
              preTestFormId: training.preTestForm.id,
              trainingId: training.id,
            },
          },
        });

        // Pre-test is pending only if not submitted and training has not started yet
        if (!preTestResponse && training.startDate > now) {
          pendingPreTests.push({
            trainingId: training.id,
            trainingTitle: training.title,
            formId: training.preTestForm.id,
            formTitle: training.preTestForm.title,
            startDate: training.startDate,
          });
        }
      }

      // Check post-test
      if (training.postTestForm) {
        const postTestResponse = await this.prisma.postTestResponse.findUnique({
          where: {
            userId_postTestFormId_trainingId: {
              userId,
              postTestFormId: training.postTestForm.id,
              trainingId: training.id,
            },
          },
        });

        // Post-test is pending if not submitted and training has ended
        if (!postTestResponse && training.endDate < now) {
          pendingPostTests.push({
            trainingId: training.id,
            trainingTitle: training.title,
            formId: training.postTestForm.id,
            formTitle: training.postTestForm.title,
            endDate: training.endDate,
          });
        }
      }
    }

    return {
      pendingPreTests,
      pendingPostTests,
      totalPending: pendingPreTests.length + pendingPostTests.length,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate score based on correct answers
   */
  private calculateScore(
    questions: any[],
    responses: Record<string, any>,
    passingScore: number | null
  ): { score: number | null; passed: boolean | null } {
    // Check if any questions have correct answers defined
    const scorableQuestions = questions.filter(q => q.correctAnswer !== undefined);

    if (scorableQuestions.length === 0) {
      // No scoring - just submission
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

  /**
   * Check if user answer matches correct answer
   */
  private isAnswerCorrect(userAnswer: any, correctAnswer: any, type: string): boolean {
    if (userAnswer === undefined || userAnswer === null) {
      return false;
    }

    switch (type) {
      case 'multiChoice':
      case 'yesNo':
        return userAnswer === correctAnswer;

      case 'checkbox':
        // For checkbox, both arrays should have same elements
        if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) {
          return false;
        }
        if (userAnswer.length !== correctAnswer.length) {
          return false;
        }
        return correctAnswer.every(c => userAnswer.includes(c));

      case 'number':
        return Number(userAnswer) === Number(correctAnswer);

      case 'text':
        // Case-insensitive string comparison
        return String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();

      default:
        return userAnswer === correctAnswer;
    }
  }

  private assertFormActiveAndPublished(
    form: { isActive: boolean; isPublished: boolean },
    type: 'pre-test' | 'post-test',
  ) {
    if (!form.isActive) {
      throw new BadRequestException(`This ${type} is currently inactive`);
    }
    if (!form.isPublished) {
      throw new BadRequestException(`This ${type} is not published yet`);
    }
  }

  private assertLiveWindow(
    form: {
      isLiveWindowEnabled?: boolean;
      liveFrom?: Date | null;
      liveUntil?: Date | null;
    },
    type: 'pre-test' | 'post-test',
  ) {
    const status = this.getLiveWindowStatus(form);
    if (!status.isLiveNow) {
      throw new BadRequestException(status.lockReason || `This ${type} is not live right now`);
    }
  }

  private getLiveWindowStatus(form: {
    isLiveWindowEnabled?: boolean;
    liveFrom?: Date | null;
    liveUntil?: Date | null;
  }): { isLiveNow: boolean; lockReason: string | null } {
    if (!form.isLiveWindowEnabled) {
      return { isLiveNow: true, lockReason: null };
    }

    if (!form.liveFrom || !form.liveUntil) {
      return {
        isLiveNow: false,
        lockReason: 'Test live window is not configured yet',
      };
    }

    const now = new Date();
    if (now < form.liveFrom) {
      return { isLiveNow: false, lockReason: 'Test has not started yet' };
    }
    if (now > form.liveUntil) {
      return { isLiveNow: false, lockReason: 'Test live window has ended' };
    }

    return { isLiveNow: true, lockReason: null };
  }

  private getAttemptKey(
    type: 'pre' | 'post',
    userId: string,
    trainingId: string,
    formId: string,
  ) {
    return `test:attempt:${type}:${userId}:${trainingId}:${formId}`;
  }

  private async getAttemptFromCache(
    type: 'pre' | 'post',
    userId: string,
    trainingId: string,
    formId: string,
  ): Promise<{ startedAt: string; expiresAt: string } | null> {
    const key = this.getAttemptKey(type, userId, trainingId, formId);
    const data = await this.cache.get<{ startedAt: string; expiresAt: string }>(key);
    if (!data) {
      return null;
    }
    return data;
  }

  private async getOrCreateAttempt(
    type: 'pre' | 'post',
    userId: string,
    trainingId: string,
    formId: string,
    durationMinutes: number,
  ): Promise<{ startedAt: string; expiresAt: string }> {
    const key = this.getAttemptKey(type, userId, trainingId, formId);
    const existingAttempt = await this.cache.get<{ startedAt: string; expiresAt: string }>(key);
    if (existingAttempt) {
      const remaining = this.getRemainingSeconds(existingAttempt.expiresAt);
      if (remaining > 0) {
        return existingAttempt;
      }
      await this.cache.del(key);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const payload = {
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await this.cache.set(
      key,
      payload,
      durationMinutes * 60 + this.ATTEMPT_BUFFER_SECONDS,
    );

    return payload;
  }

  private async assertTimerIfEnabled(
    type: 'pre' | 'post',
    userId: string,
    trainingId: string,
    formId: string,
    form: { enforceTimer?: boolean; durationMinutes?: number | null },
  ) {
    if (!form.enforceTimer || !form.durationMinutes) {
      return;
    }

    const attempt = await this.getAttemptFromCache(type, userId, trainingId, formId);
    if (!attempt) {
      throw new BadRequestException('Test timer is not active. Please start the test again.');
    }

    if (this.getRemainingSeconds(attempt.expiresAt) <= 0) {
      await this.clearAttemptKey(type, userId, trainingId, formId);
      throw new BadRequestException('Test time is over. Submission is not allowed.');
    }
  }

  private getRemainingSeconds(expiresAt?: string | Date | null): number {
    if (!expiresAt) {
      return 0;
    }

    const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    const remaining = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }

  private async clearAttemptKey(
    type: 'pre' | 'post',
    userId: string,
    trainingId: string,
    formId: string,
  ) {
    const key = this.getAttemptKey(type, userId, trainingId, formId);
    await this.cache.del(key).catch(() => {});
  }

  // ==================== INSTITUTION-SCOPED METHODS (Coordinator/Principal) ====================

  /**
   * Get pre-test responses for a training filtered by institution (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getPreTestResponsesByTrainingAndInstitution(trainingId: string, institutionId: string | undefined, branchName?: string, branchId?: string) {
    // Build user filter - if no institutionId, filter by branch across all institutions
    const userFilter: Prisma.UserWhereInput = institutionId
      ? {
          institutionId,
          ...(branchName ? { branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } } : {}),
        }
      : branchName || branchId
        ? {
            OR: [
              ...(branchName ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }] : []),
              ...(branchId ? [{ branchId }] : []),
            ],
          }
        : {};

    const responses = await this.prisma.preTestResponse.findMany({
      where: {
        trainingId,
        user: userFilter,
      },
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
        preTestForm: { select: { id: true, title: true, passingScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const stats = {
      total: responses.length,
      passed: responses.filter(r => r.passed === true).length,
      failed: responses.filter(r => r.passed === false).length,
      averageScore: responses.length > 0
        ? Math.round((responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length) * 100) / 100
        : 0,
    };

    return { responses, stats };
  }

  /**
   * Get post-test responses for a training filtered by institution (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getPostTestResponsesByTrainingAndInstitution(trainingId: string, institutionId: string | undefined, branchName?: string, branchId?: string) {
    // Build user filter - if no institutionId, filter by branch across all institutions
    const userFilter: Prisma.UserWhereInput = institutionId
      ? {
          institutionId,
          ...(branchName ? { branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } } : {}),
        }
      : branchName || branchId
        ? {
            OR: [
              ...(branchName ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }] : []),
              ...(branchId ? [{ branchId }] : []),
            ],
          }
        : {};

    const responses = await this.prisma.postTestResponse.findMany({
      where: {
        trainingId,
        user: userFilter,
      },
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
        postTestForm: { select: { id: true, title: true, passingScore: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const stats = {
      total: responses.length,
      passed: responses.filter(r => r.passed === true).length,
      failed: responses.filter(r => r.passed === false).length,
      averageScore: responses.length > 0
        ? Math.round((responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length) * 100) / 100
        : 0,
    };

    return { responses, stats };
  }

  /**
   * Get institution test completion summary (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getInstitutionTestSummary(institutionId: string | undefined, branchName?: string, branchId?: string) {
    // Build user filter - if no institutionId, filter by branch across all institutions
    const userFilter: Prisma.UserWhereInput = institutionId
      ? {
          institutionId,
          ...(branchName ? { branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } } : {}),
        }
      : branchName || branchId
        ? {
            OR: [
              ...(branchName ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }] : []),
              ...(branchId ? [{ branchId }] : []),
            ],
          }
        : {};

    // Get all trainings that have pre/post test forms and have faculty from this institution enrolled
    const trainingsWithTests = await this.prisma.training.findMany({
      where: {
        isActive: true,
        isPublished: true,
        OR: [
          { preTestFormId: { not: null } },
          { postTestFormId: { not: null } },
        ],
        applications: {
          some: {
            status: 'APPROVED',
            isActive: true,
            user: { is: userFilter },
          },
        },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        preTestFormId: true,
        postTestFormId: true,
        applications: {
          where: {
            status: 'APPROVED',
            isActive: true,
            user: { is: userFilter },
          },
          select: { userId: true },
        },
      },
    });

    const summary = [];

    for (const training of trainingsWithTests) {
      const enrolledCount = training.applications.length;
      const enrolledUserIds = training.applications.map(a => a.userId);

      let preTestStats = null;
      let postTestStats = null;

      if (training.preTestFormId) {
        const preTestResponses = await this.prisma.preTestResponse.count({
          where: {
            trainingId: training.id,
            userId: { in: enrolledUserIds },
          },
        });
        preTestStats = {
          submitted: preTestResponses,
          pending: enrolledCount - preTestResponses,
          completionRate: enrolledCount > 0 ? Math.round((preTestResponses / enrolledCount) * 100) : 0,
        };
      }

      if (training.postTestFormId) {
        const postTestResponses = await this.prisma.postTestResponse.count({
          where: {
            trainingId: training.id,
            userId: { in: enrolledUserIds },
          },
        });
        postTestStats = {
          submitted: postTestResponses,
          pending: enrolledCount - postTestResponses,
          completionRate: enrolledCount > 0 ? Math.round((postTestResponses / enrolledCount) * 100) : 0,
        };
      }

      summary.push({
        trainingId: training.id,
        trainingTitle: training.title,
        startDate: training.startDate,
        endDate: training.endDate,
        enrolledCount,
        preTest: preTestStats,
        postTest: postTestStats,
      });
    }

    return {
      trainings: summary,
      totalTrainings: summary.length,
    };
  }
}
