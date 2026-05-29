import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';

/**
 * Input schema for student breakdown tool
 */
const StudentBreakdownInputSchema = z.object({
  groupBy: z
    .enum(['institution', 'branch', 'status', 'internshipPhase'])
    .describe(
      'How to group the breakdown: "institution" for institution-wise, "branch" for branch-wise, "status" for active/inactive, "internshipPhase" for internship phase',
    ),
  institutionName: z
    .string()
    .optional()
    .describe('Filter by institution name (partial match supported)'),
  branchCode: z.string().optional().describe('Filter by branch code (e.g., "CS", "ME")'),
  isActive: z.boolean().optional().describe('Filter by active status'),
  internshipPhase: z
    .enum(['NOT_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED'])
    .optional()
    .describe('Filter by internship phase'),
});

type StudentBreakdownInput = z.infer<typeof StudentBreakdownInputSchema>;

interface BreakdownItem {
  name: string;
  count: number;
  percentage: string;
}

/**
 * Tool to get student breakdown by various dimensions.
 * Use this when user asks for grouped/categorized student data.
 */
export class StudentBreakdownTool extends BaseTool {
  name = 'student_breakdown';

  description = `Get student breakdown grouped by different dimensions. Use this tool when user asks:
- "Branch-wise student breakdown..."
- "Institution-wise student count..."
- "Students by status..."
- "Students by internship phase..."
- "Distribution of students..."
- "Show me students grouped by..."`;

  schema = StudentBreakdownInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: StudentBreakdownInput): Promise<string> {
    try {
      const appliedFilters: Record<string, unknown> = { groupBy: input.groupBy };

      // Build base where clause
      const baseWhere: Prisma.StudentWhereInput = {};

      if (input.institutionName) {
        const institutionId = await this.resolveInstitutionId(input.institutionName);
        if (institutionId) {
          baseWhere.institutionId = institutionId;
          appliedFilters.institution = input.institutionName;
        }
      }

      if (input.branchCode) {
        const branchId = await this.resolveBranchId(input.branchCode);
        if (branchId) {
          baseWhere.branchId = branchId;
          appliedFilters.branch = input.branchCode;
        }
      }

      if (input.isActive !== undefined) {
        baseWhere.user = {
          ...((baseWhere.user as Prisma.UserWhereInput) || {}),
          active: input.isActive,
        };
        appliedFilters.status = input.isActive ? 'active' : 'inactive';
      }

      if (input.internshipPhase) {
        baseWhere.internshipApplications = {
          some: { internshipPhase: input.internshipPhase },
        };
        appliedFilters.internshipPhase = input.internshipPhase;
      }

      let breakdown: BreakdownItem[] = [];
      let totalCount = 0;

      switch (input.groupBy) {
        case 'institution':
          breakdown = await this.getInstitutionBreakdown(baseWhere);
          break;
        case 'branch':
          breakdown = await this.getBranchBreakdown(baseWhere);
          break;
        case 'status':
          breakdown = await this.getStatusBreakdown(baseWhere);
          break;
        case 'internshipPhase':
          breakdown = await this.getInternshipPhaseBreakdown(baseWhere);
          break;
      }

      totalCount = breakdown.reduce((sum, item) => sum + item.count, 0);

      // Calculate percentages
      breakdown = breakdown.map((item) => ({
        ...item,
        percentage: totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) + '%' : '0%',
      }));

      // Sort by count descending
      breakdown.sort((a, b) => b.count - a.count);

      return this.successResponse({
        groupBy: input.groupBy,
        totalCount,
        formattedTotal: this.formatNumber(totalCount),
        breakdown,
        filtersApplied: this.buildFilterDescription(appliedFilters),
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to get student breakdown',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Get breakdown by institution
   */
  private async getInstitutionBreakdown(
    baseWhere: Prisma.StudentWhereInput,
  ): Promise<BreakdownItem[]> {
    const results = await this.prisma.student.groupBy({
      by: ['institutionId'],
      where: baseWhere,
      _count: { id: true },
    });

    // Get institution names
    const institutionIds = results
      .map((r) => r.institutionId)
      .filter((id): id is string => id !== null);
    const institutions = await this.prisma.institution.findMany({
      where: { id: { in: institutionIds } },
      select: { id: true, name: true, shortName: true },
    });

    const institutionMap = new Map(institutions.map((i) => [i.id, i.name || i.shortName || 'Unknown']));

    return results.map((r) => ({
      name: institutionMap.get(r.institutionId || '') || 'Unknown',
      count: r._count.id,
      percentage: '0%', // Will be calculated in _call
    }));
  }

  /**
   * Get breakdown by branch
   */
  private async getBranchBreakdown(baseWhere: Prisma.StudentWhereInput): Promise<BreakdownItem[]> {
    const results = await this.prisma.student.groupBy({
      by: ['branchId'],
      where: baseWhere,
      _count: { id: true },
    });

    // Get branch names
    const branchIds = results.map((r) => r.branchId).filter((id): id is string => id !== null);
    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true, shortName: true, code: true },
    });

    const branchMap = new Map(branches.map((b) => [b.id, b.name || b.shortName || b.code]));

    return results.map((r) => ({
      name: branchMap.get(r.branchId || '') || 'Unknown',
      count: r._count.id,
      percentage: '0%',
    }));
  }

  /**
   * Get breakdown by active status
   */
  private async getStatusBreakdown(baseWhere: Prisma.StudentWhereInput): Promise<BreakdownItem[]> {
    // Count active students
    const activeCount = await this.prisma.student.count({
      where: {
        ...baseWhere,
        user: {
          ...((baseWhere.user as Prisma.UserWhereInput) || {}),
          active: true,
        },
      },
    });

    // Count inactive students
    const inactiveCount = await this.prisma.student.count({
      where: {
        ...baseWhere,
        user: {
          ...((baseWhere.user as Prisma.UserWhereInput) || {}),
          active: false,
        },
      },
    });

    return [
      { name: 'Active', count: activeCount, percentage: '0%' },
      { name: 'Inactive', count: inactiveCount, percentage: '0%' },
    ];
  }

  /**
   * Get breakdown by internship phase
   */
  private async getInternshipPhaseBreakdown(
    baseWhere: Prisma.StudentWhereInput,
  ): Promise<BreakdownItem[]> {
    const phases = ['NOT_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED'] as const;
    const phaseLabels: Record<string, string> = {
      NOT_STARTED: 'Not Started',
      ACTIVE: 'Active',
      COMPLETED: 'Completed',
      TERMINATED: 'Terminated',
    };

    const results: BreakdownItem[] = [];

    for (const phase of phases) {
      const count = await this.prisma.student.count({
        where: {
          ...baseWhere,
          internshipApplications: {
            some: { internshipPhase: phase },
          },
        },
      });

      results.push({
        name: phaseLabels[phase],
        count,
        percentage: '0%',
      });
    }

    // Also count students without any internship application
    const withoutInternship = await this.prisma.student.count({
      where: {
        ...baseWhere,
        internshipApplications: { none: {} },
      },
    });

    results.push({
      name: 'No Internship',
      count: withoutInternship,
      percentage: '0%',
    });

    return results;
  }
}
