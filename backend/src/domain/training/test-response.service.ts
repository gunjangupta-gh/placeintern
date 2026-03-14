import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { Prisma } from '../../generated/prisma/client';
import { AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { SubmitTestResponseDto } from './dto';

@Injectable()
export class TestResponseService {
  private readonly logger = new Logger(TestResponseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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

    return {
      required: true,
      hasForm: true,
      submitted: !!response,
      response: response ? {
        id: response.id,
        score: response.score,
        passed: response.passed,
        submittedAt: response.submittedAt,
      } : null,
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

      // Check if training has ended (post-test should only be allowed after training)
      const now = new Date();
      if (training.endDate > now) {
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

    // Check if training has ended
    const trainingEnded = training.endDate < new Date();

    return {
      required: true,
      hasForm: true,
      trainingEnded,
      submitted: !!response,
      response: response ? {
        id: response.id,
        score: response.score,
        passed: response.passed,
        submittedAt: response.submittedAt,
      } : null,
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
