import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { MonthlyReportStatus, Prisma } from '../../../../../generated/prisma/client';

/**
 * Tool to get breakdowns of monthly reports grouped by various dimensions
 * Use this for queries like:
 * - "Reports by status breakdown?"
 * - "Institution-wise report submission?"
 * - "Month-wise report count?"
 */
export class ReportBreakdownTool extends BaseTool {
  name = 'report_breakdown';

  description = `Get monthly report breakdowns grouped by status, institution, or month. Use this tool when user asks:
    - "Reports by status..."
    - "Institution-wise reports..."
    - "Month-wise report breakdown..."
    - "Approved vs rejected reports..."
    - "Report distribution by..."`;

  schema = z.object({
    groupBy: z
      .enum(['status', 'institution', 'month'])
      .describe('Dimension to group reports by'),
    institutionName: z
      .string()
      .optional()
      .describe('Institution name to filter (partial match supported)'),
    status: z
      .enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'])
      .optional()
      .describe('Filter by report status'),
    month: z
      .number()
      .min(1)
      .max(12)
      .optional()
      .describe('Month number (1-12) to filter reports'),
    year: z
      .number()
      .min(2020)
      .max(2100)
      .optional()
      .describe('Year to filter reports'),
  });

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { month, year } = this.getCurrentMonthYear();
      const targetMonth = input.month ?? month;
      const targetYear = input.year ?? year;

      // Build base where clause
      const baseWhere: Prisma.MonthlyReportWhereInput = {
        isDeleted: false,
      };

      // Apply filters
      if (input.month !== undefined || input.year !== undefined) {
        baseWhere.reportMonth = targetMonth;
        baseWhere.reportYear = targetYear;
      }

      if (input.status) {
        baseWhere.status = input.status as MonthlyReportStatus;
      }

      if (input.institutionName) {
        const institutionFilter = this.getInstitutionFilter(input.institutionName);
        baseWhere.student = {
          Institution: institutionFilter,
        };
      }

      let breakdown: { label: string; count: number }[] = [];

      switch (input.groupBy) {
        case 'status':
          breakdown = await this.getStatusBreakdown(baseWhere);
          break;
        case 'institution':
          breakdown = await this.getInstitutionBreakdown(baseWhere);
          break;
        case 'month':
          breakdown = await this.getMonthBreakdown(baseWhere, targetYear);
          break;
      }

      // Calculate total
      const total = breakdown.reduce((sum, item) => sum + item.count, 0);

      // Build filter description
      const appliedFilters: Record<string, any> = {
        groupBy: input.groupBy,
      };
      if (input.institutionName) appliedFilters['institution'] = input.institutionName;
      if (input.status) appliedFilters['status'] = input.status;
      if (input.month !== undefined) appliedFilters['month'] = this.getMonthName(targetMonth);
      if (input.year !== undefined) appliedFilters['year'] = targetYear;

      return this.formatSuccess(
        {
          groupBy: input.groupBy,
          breakdown,
          total,
        },
        this.buildFilterDescription(appliedFilters),
      );
    } catch (error) {
      return this.formatError(
        'Failed to get report breakdown',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Get breakdown by report status
   */
  private async getStatusBreakdown(
    baseWhere: Prisma.MonthlyReportWhereInput,
  ): Promise<{ label: string; count: number }[]> {
    const statuses: MonthlyReportStatus[] = [
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'REVISION_REQUIRED',
    ];

    const breakdown: { label: string; count: number }[] = [];

    for (const status of statuses) {
      const count = await this.prisma.monthlyReport.count({
        where: {
          ...baseWhere,
          status,
        },
      });
      if (count > 0) {
        breakdown.push({
          label: this.formatStatusLabel(status),
          count,
        });
      }
    }

    // Sort by count descending
    return breakdown.sort((a, b) => b.count - a.count);
  }

  /**
   * Get breakdown by institution
   */
  private async getInstitutionBreakdown(
    baseWhere: Prisma.MonthlyReportWhereInput,
  ): Promise<{ label: string; count: number }[]> {
    // Get all reports with institution info
    const reports = await this.prisma.monthlyReport.findMany({
      where: baseWhere,
      select: {
        student: {
          select: {
            Institution: {
              select: {
                id: true,
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
    });

    // Group by institution
    const institutionCounts = new Map<string, { name: string; count: number }>();

    for (const report of reports) {
      const institution = report.student?.Institution;
      if (institution) {
        const key = institution.id;
        const existing = institutionCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          institutionCounts.set(key, {
            name: institution.shortName || institution.name || 'Unknown',
            count: 1,
          });
        }
      }
    }

    // Convert to array and sort
    const breakdown = Array.from(institutionCounts.values())
      .map((item) => ({
        label: item.name,
        count: item.count,
      }))
      .sort((a, b) => b.count - a.count);

    return breakdown;
  }

  /**
   * Get breakdown by month (for a specific year)
   */
  private async getMonthBreakdown(
    baseWhere: Prisma.MonthlyReportWhereInput,
    year: number,
  ): Promise<{ label: string; count: number }[]> {
    const breakdown: { label: string; count: number }[] = [];

    // Remove any existing month/year filters for month breakdown
    const { reportMonth: _m, reportYear: _y, ...whereWithoutMonthYear } = baseWhere;

    for (let month = 1; month <= 12; month++) {
      const count = await this.prisma.monthlyReport.count({
        where: {
          ...whereWithoutMonthYear,
          reportMonth: month,
          reportYear: year,
        },
      });
      if (count > 0) {
        breakdown.push({
          label: `${this.getMonthName(month)} ${year}`,
          count,
        });
      }
    }

    return breakdown;
  }

  /**
   * Format status label for display
   */
  private formatStatusLabel(status: MonthlyReportStatus): string {
    const labels: Record<MonthlyReportStatus, string> = {
      DRAFT: 'Draft',
      SUBMITTED: 'Submitted',
      UNDER_REVIEW: 'Under Review',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      REVISION_REQUIRED: 'Revision Required',
    };
    return labels[status] || status;
  }
}
