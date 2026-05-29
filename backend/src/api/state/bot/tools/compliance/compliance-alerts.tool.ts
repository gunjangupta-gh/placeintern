import { z } from 'zod';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { VisitLogStatus, MonthlyReportStatus } from '../../../../../generated/prisma/client';
import { BaseTool } from '../base.tool';

/**
 * Input schema for compliance alerts tool
 */
const ComplianceAlertsInputSchema = z.object({
  severity: z
    .enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
    .optional()
    .describe('Filter alerts by severity level (CRITICAL, HIGH, MEDIUM, LOW)'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of alerts to return (default: 10)'),
});

type ComplianceAlertsInput = z.infer<typeof ComplianceAlertsInputSchema>;

type AlertType = 'LOW_COMPLIANCE' | 'OVERDUE_REPORTS' | 'MISSING_VISITS' | 'UNASSIGNED_MENTORS';
type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface ComplianceAlert {
  type: AlertType;
  severity: AlertSeverity;
  institutionId: string;
  institutionName: string;
  message: string;
  value: number;
  threshold?: number;
}

/**
 * Tool for compliance alerts and critical issues.
 * Identifies institutions with low compliance, overdue reports, missing visits, etc.
 */
export class ComplianceAlertsTool extends BaseTool {
  name = 'compliance_alerts';

  description = `Get critical compliance issues and alerts. Use this tool when user asks:
- "Compliance alerts..."
- "Critical issues..."
- "Non-compliant institutions..."
- "Overdue items..."
- "Institutions with problems..."
- "Low compliance institutions..."
- "Which institutions need attention..."
- "Compliance issues..."
- "Show me alerts..."
- "Institutions below threshold..."`;

  schema = ComplianceAlertsInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: ComplianceAlertsInput): Promise<string> {
    try {
      const limit = input.limit || 10;
      const alerts: ComplianceAlert[] = [];
      const { month, year } = this.getCurrentPeriod();
      const appliedFilters: Record<string, unknown> = {};

      if (input.severity) {
        appliedFilters.severity = input.severity;
      }
      appliedFilters.limit = limit;
      appliedFilters.period = `${this.getMonthName(month)} ${year}`;

      // Get all active institutions
      const institutions = await this.prisma.institution.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      for (const institution of institutions) {
        // Check for LOW COMPLIANCE - Report Submission Rate < 50%
        const totalActiveInternships = await this.prisma.internshipApplication.count({
          where: {
            internshipPhase: 'ACTIVE',
            isActive: true,
            student: {
              institutionId: institution.id,
            },
          },
        });

        if (totalActiveInternships > 0) {
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
              student: {
                institutionId: institution.id,
              },
            },
          });

          const reportRate = (submittedReports / totalActiveInternships) * 100;

          if (reportRate < 50) {
            alerts.push({
              type: 'LOW_COMPLIANCE',
              severity: reportRate < 25 ? 'CRITICAL' : 'HIGH',
              institutionId: institution.id,
              institutionName: institution.name || 'Unknown Institution',
              message: `Report submission rate is only ${Math.round(reportRate)}%`,
              value: Math.round(reportRate),
              threshold: 50,
            });
          }

          // Check for MISSING VISITS - Visit completion rate < 50%
          const completedVisits = await this.prisma.facultyVisitLog.count({
            where: {
              visitMonth: month,
              visitYear: year,
              status: VisitLogStatus.COMPLETED,
              isDeleted: false,
              application: {
                student: {
                  institutionId: institution.id,
                },
              },
            },
          });

          const visitRate = (completedVisits / totalActiveInternships) * 100;

          if (visitRate < 50) {
            alerts.push({
              type: 'MISSING_VISITS',
              severity: visitRate < 25 ? 'CRITICAL' : 'HIGH',
              institutionId: institution.id,
              institutionName: institution.name || 'Unknown Institution',
              message: `Faculty visit completion rate is only ${Math.round(visitRate)}%`,
              value: Math.round(visitRate),
              threshold: 50,
            });
          }

          // Check for UNASSIGNED MENTORS
          const studentsWithoutMentors = await this.prisma.student.count({
            where: {
              institutionId: institution.id,
              internshipApplications: {
                some: {
                  internshipPhase: 'ACTIVE',
                  isActive: true,
                },
              },
              mentorAssignments: {
                none: {
                  isActive: true,
                },
              },
            },
          });

          if (studentsWithoutMentors > 0) {
            const unassignedRate =
              (studentsWithoutMentors / totalActiveInternships) * 100;
            alerts.push({
              type: 'UNASSIGNED_MENTORS',
              severity: unassignedRate > 50 ? 'CRITICAL' : unassignedRate > 25 ? 'HIGH' : 'MEDIUM',
              institutionId: institution.id,
              institutionName: institution.name || 'Unknown Institution',
              message: `${studentsWithoutMentors} students without mentor assignments (${Math.round(unassignedRate)}%)`,
              value: studentsWithoutMentors,
            });
          }
        }

        // Check for OVERDUE REPORTS
        const overdueReports = await this.prisma.monthlyReport.count({
          where: {
            isOverdue: true,
            isDeleted: false,
            status: {
              notIn: [MonthlyReportStatus.APPROVED, MonthlyReportStatus.SUBMITTED],
            },
            student: {
              institutionId: institution.id,
            },
          },
        });

        if (overdueReports > 5) {
          alerts.push({
            type: 'OVERDUE_REPORTS',
            severity: overdueReports > 20 ? 'CRITICAL' : overdueReports > 10 ? 'HIGH' : 'MEDIUM',
            institutionId: institution.id,
            institutionName: institution.name || 'Unknown Institution',
            message: `${overdueReports} overdue monthly reports`,
            value: overdueReports,
          });
        }
      }

      // Filter by severity if specified
      let filteredAlerts = alerts;
      if (input.severity) {
        filteredAlerts = alerts.filter((a) => a.severity === input.severity);
      }

      // Sort by severity (CRITICAL first, then HIGH, MEDIUM, LOW)
      const severityOrder: Record<AlertSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      filteredAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      // Limit results
      const limitedAlerts = filteredAlerts.slice(0, limit);

      // Summary stats
      const criticalCount = filteredAlerts.filter((a) => a.severity === 'CRITICAL').length;
      const highCount = filteredAlerts.filter((a) => a.severity === 'HIGH').length;
      const mediumCount = filteredAlerts.filter((a) => a.severity === 'MEDIUM').length;
      const lowCount = filteredAlerts.filter((a) => a.severity === 'LOW').length;

      return this.successResponse({
        totalAlerts: filteredAlerts.length,
        summary: {
          critical: criticalCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount,
        },
        alerts: limitedAlerts.map((a) => ({
          type: a.type,
          severity: a.severity,
          institution: a.institutionName,
          message: a.message,
          value: a.value,
          threshold: a.threshold,
        })),
        period: {
          month,
          year,
          monthName: this.getMonthName(month),
        },
        filtersApplied: this.buildFilterDescription(appliedFilters),
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to get compliance alerts',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
