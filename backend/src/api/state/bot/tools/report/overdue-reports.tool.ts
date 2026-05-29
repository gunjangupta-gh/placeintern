import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';

/**
 * Tool to get list of overdue monthly reports
 * Use this for queries like:
 * - "Which reports are overdue?"
 * - "List overdue reports"
 * - "Students with pending reports?"
 * - "Late report submissions?"
 */
export class OverdueReportsTool extends BaseTool {
  name = 'overdue_reports';

  description = `Get list of overdue monthly reports with student and institution details. Use this tool when user asks:
    - "Overdue reports..."
    - "Which reports are late..."
    - "Students with pending reports..."
    - "Missing report submissions..."
    - "Late reports from..."`;

  schema = z.object({
    institutionName: z
      .string()
      .optional()
      .describe('Institution name to filter (partial match supported)'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe('Maximum number of overdue reports to return (default: 20)'),
  });

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const limit = input.limit ?? 20;
      const now = new Date();

      // Build the where clause for overdue reports
      const where: Prisma.MonthlyReportWhereInput = {
        isDeleted: false,
        OR: [
          // Explicitly marked as overdue
          { isOverdue: true },
          // Due date has passed and not yet approved
          {
            dueDate: { lt: now },
            status: { notIn: ['APPROVED'] },
          },
        ],
      };

      // Filter by institution if provided
      if (input.institutionName) {
        const institutionFilter = this.getInstitutionFilter(input.institutionName);
        where.student = {
          Institution: institutionFilter,
        };
      }

      // Get total count of overdue reports
      const totalOverdue = await this.prisma.monthlyReport.count({ where });

      // Get overdue reports with details
      const overdueReports = await this.prisma.monthlyReport.findMany({
        where,
        take: limit,
        orderBy: [
          { dueDate: 'asc' }, // Most overdue first
          { reportYear: 'desc' },
          { reportMonth: 'desc' },
        ],
        select: {
          id: true,
          reportMonth: true,
          reportYear: true,
          monthName: true,
          status: true,
          dueDate: true,
          isOverdue: true,
          daysLate: true,
          isLateSubmission: true,
          student: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  rollNumber: true,
                  branchName: true,
                },
              },
              Institution: {
                select: {
                  name: true,
                  shortName: true,
                },
              },
            },
          },
          application: {
            select: {
              companyName: true,
            },
          },
        },
      });

      // Format the results
      const reports = overdueReports.map((report) => {
        const daysOverdue = report.dueDate
          ? Math.floor((now.getTime() - new Date(report.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : report.daysLate || 0;

        return {
          reportId: report.id,
          reportPeriod: report.monthName
            ? `${report.monthName} ${report.reportYear}`
            : `${this.getMonthName(report.reportMonth)} ${report.reportYear}`,
          status: report.status,
          dueDate: report.dueDate ? report.dueDate.toISOString().split('T')[0] : null,
          daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
          student: {
            name: report.student?.user?.name || 'Unknown',
            rollNumber: report.student?.user?.rollNumber || null,
            branch: report.student?.user?.branchName || null,
          },
          institution:
            report.student?.Institution?.shortName ||
            report.student?.Institution?.name ||
            'Unknown',
          company: report.application?.companyName || null,
        };
      });

      // Group by institution for summary
      const institutionSummary = this.getInstitutionSummary(reports);

      // Build filter description
      const appliedFilters: Record<string, any> = {};
      if (input.institutionName) appliedFilters['institution'] = input.institutionName;
      appliedFilters['limit'] = limit;

      return this.formatSuccess(
        {
          totalOverdue,
          returnedCount: reports.length,
          reports,
          institutionSummary,
        },
        this.buildFilterDescription(appliedFilters),
      );
    } catch (error) {
      return this.formatError(
        'Failed to get overdue reports',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Generate summary of overdue reports by institution
   */
  private getInstitutionSummary(
    reports: { institution: string }[],
  ): { institution: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const report of reports) {
      const institution = report.institution;
      counts.set(institution, (counts.get(institution) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([institution, count]) => ({ institution, count }))
      .sort((a, b) => b.count - a.count);
  }
}
