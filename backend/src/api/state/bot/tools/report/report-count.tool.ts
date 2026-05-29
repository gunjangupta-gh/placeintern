import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { MonthlyReportStatus, Prisma } from '../../../../../generated/prisma/client';

/**
 * Tool to count monthly reports with various filters
 * Use this for queries like:
 * - "How many reports were submitted this month?"
 * - "Total pending reports?"
 * - "Reports from Government Polytechnic?"
 * - "Overdue reports count?"
 */
export class ReportCountTool extends BaseTool {
  name = 'report_count';

  description = `Count monthly reports with optional filters. Use this tool when user asks:
    - "How many reports..."
    - "Total reports..."
    - "Report count..."
    - "Number of submitted/pending/approved reports..."
    - "Overdue reports count..."`;

  schema = z.object({
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
    isOverdue: z
      .boolean()
      .optional()
      .describe('Filter by overdue status (true = only overdue reports)'),
  });

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const { month, year } = this.getCurrentMonthYear();
      const targetMonth = input.month ?? month;
      const targetYear = input.year ?? year;

      // Build the where clause
      const where: Prisma.MonthlyReportWhereInput = {
        isDeleted: false,
      };

      // Filter by report month/year
      if (input.month !== undefined || input.year !== undefined) {
        where.reportMonth = targetMonth;
        where.reportYear = targetYear;
      }

      // Filter by status
      if (input.status) {
        where.status = input.status as MonthlyReportStatus;
      }

      // Filter by overdue status
      if (input.isOverdue !== undefined) {
        if (input.isOverdue) {
          // Reports that are overdue: isOverdue flag is true OR dueDate has passed and not approved
          where.OR = [
            { isOverdue: true },
            {
              dueDate: { lt: new Date() },
              status: { notIn: ['APPROVED'] },
            },
          ];
        } else {
          where.isOverdue = false;
        }
      }

      // Filter by institution
      if (input.institutionName) {
        const institutionFilter = this.getInstitutionFilter(input.institutionName);
        where.student = {
          Institution: institutionFilter,
        };
      }

      // Execute the count query
      const count = await this.prisma.monthlyReport.count({ where });

      // Build filter description
      const appliedFilters: Record<string, any> = {};
      if (input.institutionName) appliedFilters['institution'] = input.institutionName;
      if (input.status) appliedFilters['status'] = input.status;
      if (input.month !== undefined) appliedFilters['month'] = this.getMonthName(targetMonth);
      if (input.year !== undefined) appliedFilters['year'] = targetYear;
      if (input.isOverdue !== undefined) appliedFilters['overdue'] = input.isOverdue ? 'yes' : 'no';

      return this.formatSuccess(
        {
          count,
          reportMonth: input.month !== undefined ? this.getMonthName(targetMonth) : undefined,
          reportYear: input.year !== undefined ? targetYear : undefined,
        },
        this.buildFilterDescription(appliedFilters),
      );
    } catch (error) {
      return this.formatError(
        'Failed to count monthly reports',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
