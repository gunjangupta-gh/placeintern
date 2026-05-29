import { z } from 'zod';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { VisitLogStatus, MonthlyReportStatus } from '../../../../../generated/prisma/client';
import { BaseTool } from '../base.tool';

/**
 * Input schema for compliance summary tool
 */
const ComplianceSummaryInputSchema = z.object({
  institutionName: z
    .string()
    .optional()
    .describe('Institution name to filter by (partial match supported, e.g., "Government Polytechnic")'),
  month: z
    .number()
    .min(1)
    .max(12)
    .optional()
    .describe('Month number (1-12). Defaults to current month.'),
  year: z
    .number()
    .min(2020)
    .max(2030)
    .optional()
    .describe('Year (e.g., 2026). Defaults to current year.'),
});

type ComplianceSummaryInput = z.infer<typeof ComplianceSummaryInputSchema>;

/**
 * Tool for compliance overview and rates.
 * Calculates report submission rate, visit completion rate, and mentor assignment rate.
 */
export class ComplianceSummaryTool extends BaseTool {
  name = 'compliance_summary';

  description = `Get overall compliance statistics. Use this tool when user asks:
- "Compliance rate..."
- "Overall compliance..."
- "Report submission rate..."
- "Visit completion rate..."
- "Mentor assignment rate..."
- "How compliant are institutions..."
- "Compliance summary..."
- "Compliance overview..."
- "What is the compliance percentage..."`;

  schema = ComplianceSummaryInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: ComplianceSummaryInput): Promise<string> {
    try {
      const { month: currentMonth, year: currentYear, monthName: currentMonthName } = this.getCurrentPeriod();
      const month = input.month || currentMonth;
      const year = input.year || currentYear;
      const appliedFilters: Record<string, unknown> = {};

      let institutionId: string | null = null;

      // Resolve institution if provided
      if (input.institutionName) {
        institutionId = await this.resolveInstitutionId(input.institutionName);
        if (!institutionId) {
          return this.successResponse({
            reportSubmissionRate: { rate: 0, submitted: 0, expected: 0 },
            visitCompletionRate: { rate: 0, completed: 0, expected: 0 },
            mentorAssignmentRate: { rate: 0, assigned: 0, total: 0 },
            overallComplianceRate: 0,
            filtersApplied: `institution: "${input.institutionName}" (not found)`,
            message: `No institution found matching "${input.institutionName}"`,
          });
        }
        appliedFilters.institution = input.institutionName;
      }
      appliedFilters.period = `${this.getMonthName(month)} ${year}`;

      // Calculate Report Submission Rate
      // Total expected reports for the month (students with active internships)
      const totalActiveInternships = await this.prisma.internshipApplication.count({
        where: {
          internshipPhase: 'ACTIVE',
          isActive: true,
          ...(institutionId && {
            student: {
              institutionId,
            },
          }),
        },
      });

      // Submitted reports for the month
      const submittedReports = await this.prisma.monthlyReport.count({
        where: {
          reportMonth: month,
          reportYear: year,
          status: {
            in: [
              MonthlyReportStatus.SUBMITTED,
              MonthlyReportStatus.UNDER_REVIEW,
              MonthlyReportStatus.APPROVED,
            ],
          },
          isDeleted: false,
          ...(institutionId && {
            student: {
              institutionId,
            },
          }),
        },
      });

      const reportSubmissionRate =
        totalActiveInternships > 0
          ? Math.round((submittedReports / totalActiveInternships) * 100 * 100) / 100
          : 0;

      // Calculate Visit Completion Rate
      // Expected visits (one per active internship per month)
      const expectedVisits = totalActiveInternships;

      // Completed visits for the month
      const completedVisits = await this.prisma.facultyVisitLog.count({
        where: {
          visitMonth: month,
          visitYear: year,
          status: VisitLogStatus.COMPLETED,
          isDeleted: false,
          ...(institutionId && {
            application: {
              student: {
                institutionId,
              },
            },
          }),
        },
      });

      const visitCompletionRate =
        expectedVisits > 0
          ? Math.round((completedVisits / expectedVisits) * 100 * 100) / 100
          : 0;

      // Calculate Mentor Assignment Rate
      // Total students with active internships who need mentors
      const studentsNeedingMentors = await this.prisma.student.count({
        where: {
          internshipApplications: {
            some: {
              internshipPhase: 'ACTIVE',
              isActive: true,
            },
          },
          ...(institutionId && { institutionId }),
        },
      });

      // Students with active mentor assignments
      const studentsWithMentors = await this.prisma.student.count({
        where: {
          internshipApplications: {
            some: {
              internshipPhase: 'ACTIVE',
              isActive: true,
            },
          },
          mentorAssignments: {
            some: {
              isActive: true,
            },
          },
          ...(institutionId && { institutionId }),
        },
      });

      const mentorAssignmentRate =
        studentsNeedingMentors > 0
          ? Math.round((studentsWithMentors / studentsNeedingMentors) * 100 * 100) / 100
          : 0;

      // Calculate Overall Compliance Rate (weighted average)
      const overallComplianceRate =
        Math.round(
          ((reportSubmissionRate + visitCompletionRate + mentorAssignmentRate) / 3) * 100,
        ) / 100;

      return this.successResponse({
        period: {
          month,
          year,
          monthName: this.getMonthName(month),
        },
        reportSubmissionRate: {
          rate: reportSubmissionRate,
          rateFormatted: `${reportSubmissionRate}%`,
          submitted: submittedReports,
          expected: totalActiveInternships,
        },
        visitCompletionRate: {
          rate: visitCompletionRate,
          rateFormatted: `${visitCompletionRate}%`,
          completed: completedVisits,
          expected: expectedVisits,
        },
        mentorAssignmentRate: {
          rate: mentorAssignmentRate,
          rateFormatted: `${mentorAssignmentRate}%`,
          assigned: studentsWithMentors,
          total: studentsNeedingMentors,
        },
        overallComplianceRate,
        overallComplianceRateFormatted: `${overallComplianceRate}%`,
        filtersApplied: this.buildFilterDescription(appliedFilters),
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to get compliance summary',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
