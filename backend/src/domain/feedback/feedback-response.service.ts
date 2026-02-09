import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma } from '../../generated/prisma/client';
import { SubmitFeedbackDto } from './dto';

@Injectable()
export class FeedbackResponseService {
  private readonly logger = new Logger(FeedbackResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Submit feedback (Faculty)
   */
  async submit(dto: SubmitFeedbackDto, userId: string) {
    try {
      this.logger.log(`User ${userId} submitting feedback for form ${dto.feedbackFormId}`);

      // Verify form exists and is published
      const form = await this.prisma.feedbackForm.findUnique({
        where: { id: dto.feedbackFormId },
      });

      if (!form) {
        throw new NotFoundException('Feedback form not found');
      }

      if (!form.isPublished) {
        throw new BadRequestException('Feedback form is not available');
      }

      // If training-specific, verify user attended
      if (dto.trainingId) {
        const application = await this.prisma.trainingApplication.findUnique({
          where: { userId_trainingId: { userId, trainingId: dto.trainingId } },
        });

        if (!application || application.status !== 'APPROVED') {
          throw new BadRequestException('You must have an approved application to submit feedback');
        }

        // Check if already submitted
        const existing = await this.prisma.feedbackResponse.findFirst({
          where: {
            userId,
            feedbackFormId: dto.feedbackFormId,
            trainingId: dto.trainingId,
          },
        });

        if (existing) {
          throw new BadRequestException('You have already submitted feedback for this training');
        }
      }

      // Validate responses against form questions
      const questions = form.questions as any[];
      const requiredQuestions = questions.filter((q: any) => q.required);

      for (const q of requiredQuestions) {
        if (dto.responses[q.id] === undefined || dto.responses[q.id] === null || dto.responses[q.id] === '') {
          throw new BadRequestException(`Required question "${q.question}" is not answered`);
        }
      }

      const response = await this.prisma.feedbackResponse.create({
        data: {
          userId,
          feedbackFormId: dto.feedbackFormId,
          trainingId: dto.trainingId,
          responses: dto.responses,
        },
        include: {
          user: { select: { id: true, name: true } },
          feedbackForm: { select: { id: true, title: true } },
          training: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.TRAINING_FEEDBACK_SUBMIT,
        entityType: 'FeedbackResponse',
        entityId: response.id,
        userId,
        category: AuditCategory.FEEDBACK_SYSTEM,
        severity: AuditSeverity.LOW,
        description: `Submitted feedback for "${form.title}"`,
      }).catch(() => {});

      return response;
    } catch (error) {
      this.logger.error(`Failed to submit feedback: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get responses by training (State)
   */
  async getByTraining(trainingId: string) {
    try {
      const responses = await this.prisma.feedbackResponse.findMany({
        where: { trainingId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              branchName: true,
              Institution: { select: { id: true, name: true, shortName: true } },
            },
          },
          feedbackForm: { select: { id: true, title: true, questions: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return responses;
    } catch (error) {
      this.logger.error(`Failed to get feedback responses: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's feedback responses (Faculty)
   */
  async getByUser(userId: string) {
    try {
      const responses = await this.prisma.feedbackResponse.findMany({
        where: { userId },
        include: {
          feedbackForm: { select: { id: true, title: true } },
          training: { select: { id: true, title: true, startDate: true, endDate: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return responses;
    } catch (error) {
      this.logger.error(`Failed to get user feedback: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get aggregated feedback results (State)
   */
  async getAggregatedResults(feedbackFormId: string, trainingId?: string) {
    try {
      const form = await this.prisma.feedbackForm.findUnique({
        where: { id: feedbackFormId },
      });

      if (!form) {
        throw new NotFoundException('Feedback form not found');
      }

      const responses = await this.prisma.feedbackResponse.findMany({
        where: {
          feedbackFormId,
          ...(trainingId ? { trainingId } : {}),
        },
      });

      const questions = form.questions as any[];
      const aggregated: Record<string, any> = {};

      for (const question of questions) {
        const questionResponses = responses
          .map((r) => (r.responses as Record<string, any>)[question.id])
          .filter((r) => r !== undefined && r !== null);

        if (question.type === 'rating') {
          const numericResponses = questionResponses.map((r) => Number(r)).filter((r) => !isNaN(r));
          const sum = numericResponses.reduce((a, b) => a + b, 0);
          const avg = numericResponses.length > 0 ? sum / numericResponses.length : 0;

          // Distribution
          const distribution: Record<number, number> = {};
          for (let i = 1; i <= 5; i++) {
            distribution[i] = numericResponses.filter((r) => r === i).length;
          }

          aggregated[question.id] = {
            question: question.question,
            type: 'rating',
            totalResponses: numericResponses.length,
            average: Math.round(avg * 100) / 100,
            distribution,
          };
        } else if (question.type === 'yesNo') {
          const yesCount = questionResponses.filter((r) => r === true || r === 'yes' || r === 'Yes').length;
          const noCount = questionResponses.filter((r) => r === false || r === 'no' || r === 'No').length;

          aggregated[question.id] = {
            question: question.question,
            type: 'yesNo',
            totalResponses: questionResponses.length,
            yes: yesCount,
            no: noCount,
            yesPercentage: questionResponses.length > 0 ? (yesCount / questionResponses.length) * 100 : 0,
          };
        } else if (question.type === 'multiChoice' || question.type === 'checkbox') {
          const optionCounts: Record<string, number> = {};
          for (const resp of questionResponses) {
            const options = Array.isArray(resp) ? resp : [resp];
            for (const opt of options) {
              optionCounts[opt] = (optionCounts[opt] || 0) + 1;
            }
          }

          aggregated[question.id] = {
            question: question.question,
            type: question.type,
            totalResponses: questionResponses.length,
            optionCounts,
          };
        } else {
          // Text responses - just count and list
          aggregated[question.id] = {
            question: question.question,
            type: 'text',
            totalResponses: questionResponses.length,
            responses: questionResponses.slice(0, 50), // Limit to 50 for display
          };
        }
      }

      return {
        form: { id: form.id, title: form.title },
        trainingId,
        totalResponses: responses.length,
        aggregated,
      };
    } catch (error) {
      this.logger.error(`Failed to get aggregated results: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if user has submitted feedback
   */
  async hasSubmitted(userId: string, feedbackFormId: string, trainingId?: string) {
    const response = await this.prisma.feedbackResponse.findFirst({
      where: {
        userId,
        feedbackFormId,
        ...(trainingId ? { trainingId } : {}),
      },
    });

    return { hasSubmitted: !!response };
  }

  /**
   * Get response stats (State)
   */
  async getResponseStats(trainingId?: string) {
    try {
      const where: Prisma.FeedbackResponseWhereInput = trainingId ? { trainingId } : {};

      const [totalResponses, byForm] = await Promise.all([
        this.prisma.feedbackResponse.count({ where }),
        this.prisma.feedbackResponse.groupBy({
          by: ['feedbackFormId'],
          where,
          _count: true,
        }),
      ]);

      // Get form titles
      const formIds = byForm.map((b) => b.feedbackFormId);
      const forms = await this.prisma.feedbackForm.findMany({
        where: { id: { in: formIds } },
        select: { id: true, title: true },
      });

      const formMap = new Map(forms.map((f) => [f.id, f.title]));

      return {
        totalResponses,
        byForm: byForm.map((b) => ({
          formId: b.feedbackFormId,
          formTitle: formMap.get(b.feedbackFormId) || 'Unknown',
          count: b._count,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get response stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get pending feedback trainings for user (Faculty)
   */
  async getPendingForUser(userId: string) {
    // Get trainings user attended but hasn't submitted feedback for
    const attendedTrainings = await this.prisma.trainingApplication.findMany({
      where: { userId, status: 'APPROVED' },
      include: {
        training: {
          include: { feedbackForm: true },
        },
      },
    });

    const submittedFeedback = await this.prisma.feedbackResponse.findMany({
      where: { userId },
      select: { trainingId: true },
    });

    const submittedTrainingIds = new Set(submittedFeedback.map((f) => f.trainingId).filter(Boolean));

    const pending = attendedTrainings
      .filter((app) => app.training.feedbackForm && !submittedTrainingIds.has(app.trainingId))
      .map((app) => ({
        training: app.training,
        feedbackForm: app.training.feedbackForm,
      }));

    return pending;
  }

  /**
   * Get institution feedback summary (Principal)
   */
  async getInstitutionFeedbackSummary(institutionId: string, trainingId?: string) {
    const where: Prisma.FeedbackResponseWhereInput = {
      user: { institutionId },
      ...(trainingId ? { trainingId } : {}),
    };

    const [totalResponses, byTraining] = await Promise.all([
      this.prisma.feedbackResponse.count({ where }),
      this.prisma.feedbackResponse.groupBy({
        by: ['trainingId'],
        where,
        _count: true,
      }),
    ]);

    // Get training titles
    const trainingIds = byTraining.map((b) => b.trainingId).filter((id): id is string => id !== null);
    const trainings = await this.prisma.training.findMany({
      where: { id: { in: trainingIds } },
      select: { id: true, title: true },
    });

    const trainingMap = new Map(trainings.map((t) => [t.id, t.title]));

    return {
      totalResponses,
      byTraining: byTraining.map((b) => ({
        trainingId: b.trainingId,
        trainingTitle: b.trainingId ? trainingMap.get(b.trainingId) || 'Unknown' : 'General',
        count: b._count,
      })),
    };
  }
}
