import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';

/**
 * Tool to find top or bottom performing institutions based on various metrics.
 * Use this for performance analysis and identifying institutions needing attention.
 */
export class InstitutionPerformanceTool extends BaseTool {
  name = 'institution_performance';

  description = `Find top or bottom performing institutions based on metrics. Use this tool when user asks:
    - "Top 5 performing institutions..."
    - "Best colleges by compliance..."
    - "Worst performing polytechnics..."
    - "Institutions with most students..."
    - "Lowest compliance institutions..."
    - "Which institutions have the best visit completion rate..."
    - "Institutions with highest report submission rate..."
    - "Bottom performers..."`;

  schema = z.object({
    metric: z
      .enum(['compliance', 'students', 'visits'])
      .optional()
      .default('compliance')
      .describe(
        'Metric to rank institutions by: compliance (overall compliance score), students (student count), visits (visit completion rate)',
      ),
    order: z
      .enum(['top', 'bottom'])
      .describe('Whether to get top performers or bottom performers'),
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe('Number of institutions to return (default: 5, max: 20)'),
  });

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const metric = input.metric || 'compliance';
      const limit = input.limit || 5;
      const order = input.order;

      switch (metric) {
        case 'students':
          return await this.rankByStudentCount(order, limit);
        case 'visits':
          return await this.rankByVisitCompletion(order, limit);
        case 'compliance':
        default:
          return await this.rankByCompliance(order, limit);
      }
    } catch (error) {
      return this.errorResponse(
        'Failed to get institution performance',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Rank institutions by student count
   */
  private async rankByStudentCount(
    order: 'top' | 'bottom',
    limit: number,
  ): Promise<string> {
    // Get institutions with student counts
    const institutions = await this.prisma.institution.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        type: true,
        _count: {
          select: {
            Student: true,
          },
        },
      },
    });

    // Sort by student count
    const sorted = institutions.sort((a, b) => {
      const countA = a._count.Student;
      const countB = b._count.Student;
      return order === 'top' ? countB - countA : countA - countB;
    });

    // Take top/bottom N
    const result = sorted.slice(0, limit).map((inst, index) => ({
      rank: index + 1,
      name: inst.name || inst.shortName || inst.code || 'Unknown',
      code: inst.code,
      type: inst.type,
      studentCount: inst._count.Student,
    }));

    return this.successResponse({
      metric: 'students',
      order,
      limit,
      institutions: result,
      description: `${order === 'top' ? 'Top' : 'Bottom'} ${limit} institutions by student count`,
    });
  }

  /**
   * Rank institutions by visit completion rate
   */
  private async rankByVisitCompletion(
    order: 'top' | 'bottom',
    limit: number,
  ): Promise<string> {
    // Get current month/year for context
    const currentPeriod = this.getCurrentPeriod();

    // Get all active institutions with their visit statistics
    const institutions = await this.prisma.institution.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        type: true,
      },
    });

    // For each institution, calculate visit completion rate
    const institutionsWithStats = await Promise.all(
      institutions.map(async (inst) => {
        // Get students with internship applications for this institution
        const applications = await this.prisma.internshipApplication.findMany({
          where: {
            student: {
              institutionId: inst.id,
            },
            isActive: true,
          },
          select: {
            id: true,
            totalExpectedVisits: true,
            completedVisitsCount: true,
          },
        });

        const totalExpected = applications.reduce(
          (sum, app) => sum + (app.totalExpectedVisits || 0),
          0,
        );
        const totalCompleted = applications.reduce(
          (sum, app) => sum + (app.completedVisitsCount || 0),
          0,
        );

        const completionRate =
          totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0;

        return {
          id: inst.id,
          name: inst.name || inst.shortName || inst.code || 'Unknown',
          code: inst.code,
          type: inst.type,
          totalExpectedVisits: totalExpected,
          completedVisits: totalCompleted,
          visitCompletionRate: Math.round(completionRate * 10) / 10,
        };
      }),
    );

    // Sort by completion rate
    const sorted = institutionsWithStats.sort((a, b) => {
      return order === 'top'
        ? b.visitCompletionRate - a.visitCompletionRate
        : a.visitCompletionRate - b.visitCompletionRate;
    });

    // Take top/bottom N
    const result = sorted.slice(0, limit).map((inst, index) => ({
      rank: index + 1,
      name: inst.name,
      code: inst.code,
      type: inst.type,
      visitCompletionRate: inst.visitCompletionRate + '%',
      completedVisits: inst.completedVisits,
      totalExpectedVisits: inst.totalExpectedVisits,
    }));

    return this.successResponse({
      metric: 'visits',
      order,
      limit,
      period: currentPeriod.monthName + ' ' + currentPeriod.year,
      institutions: result,
      description: `${order === 'top' ? 'Top' : 'Bottom'} ${limit} institutions by visit completion rate`,
    });
  }

  /**
   * Rank institutions by overall compliance score
   * Compliance is calculated as a weighted average of:
   * - Report submission rate (50%)
   * - Visit completion rate (50%)
   */
  private async rankByCompliance(
    order: 'top' | 'bottom',
    limit: number,
  ): Promise<string> {
    const currentPeriod = this.getCurrentPeriod();

    // Get all active institutions
    const institutions = await this.prisma.institution.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        type: true,
      },
    });

    // For each institution, calculate compliance score
    const institutionsWithCompliance = await Promise.all(
      institutions.map(async (inst) => {
        // Get internship applications for this institution
        const applications = await this.prisma.internshipApplication.findMany({
          where: {
            student: {
              institutionId: inst.id,
            },
            isActive: true,
          },
          select: {
            id: true,
            totalExpectedVisits: true,
            completedVisitsCount: true,
            totalExpectedReports: true,
            submittedReportsCount: true,
          },
        });

        // Calculate visit completion rate
        const totalExpectedVisits = applications.reduce(
          (sum, app) => sum + (app.totalExpectedVisits || 0),
          0,
        );
        const totalCompletedVisits = applications.reduce(
          (sum, app) => sum + (app.completedVisitsCount || 0),
          0,
        );
        const visitRate =
          totalExpectedVisits > 0
            ? (totalCompletedVisits / totalExpectedVisits) * 100
            : 0;

        // Calculate report submission rate
        const totalExpectedReports = applications.reduce(
          (sum, app) => sum + (app.totalExpectedReports || 0),
          0,
        );
        const totalSubmittedReports = applications.reduce(
          (sum, app) => sum + (app.submittedReportsCount || 0),
          0,
        );
        const reportRate =
          totalExpectedReports > 0
            ? (totalSubmittedReports / totalExpectedReports) * 100
            : 0;

        // Calculate overall compliance (weighted average)
        const complianceScore = (visitRate * 0.5 + reportRate * 0.5);

        return {
          id: inst.id,
          name: inst.name || inst.shortName || inst.code || 'Unknown',
          code: inst.code,
          type: inst.type,
          complianceScore: Math.round(complianceScore * 10) / 10,
          visitCompletionRate: Math.round(visitRate * 10) / 10,
          reportSubmissionRate: Math.round(reportRate * 10) / 10,
          studentCount: applications.length,
        };
      }),
    );

    // Sort by compliance score
    const sorted = institutionsWithCompliance.sort((a, b) => {
      return order === 'top'
        ? b.complianceScore - a.complianceScore
        : a.complianceScore - b.complianceScore;
    });

    // Take top/bottom N
    const result = sorted.slice(0, limit).map((inst, index) => ({
      rank: index + 1,
      name: inst.name,
      code: inst.code,
      type: inst.type,
      complianceScore: inst.complianceScore + '%',
      visitCompletionRate: inst.visitCompletionRate + '%',
      reportSubmissionRate: inst.reportSubmissionRate + '%',
      activeStudents: inst.studentCount,
    }));

    return this.successResponse({
      metric: 'compliance',
      order,
      limit,
      period: currentPeriod.monthName + ' ' + currentPeriod.year,
      institutions: result,
      description: `${order === 'top' ? 'Top' : 'Bottom'} ${limit} institutions by overall compliance score (visit completion 50%, report submission 50%)`,
    });
  }
}
