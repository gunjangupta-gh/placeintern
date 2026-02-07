import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { MonthlyReportStatus, AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';

export interface SubmitReportDto {
  applicationId: string;
  reportMonth: number;
  reportYear: number;
  reportFileUrl?: string;
}

export interface ReviewReportDto {
  status: MonthlyReportStatus;
  reviewComments?: string;
}

@Injectable()
export class MonthlyReportService {
  private readonly logger = new Logger(MonthlyReportService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  async submitReport(studentId: string, data: SubmitReportDto) {
    try {
      this.logger.log(`Submitting monthly report for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      const application = await this.prisma.internshipApplication.findFirst({
        where: {
          id: data.applicationId,
          studentId,
        },
        select: { id: true },
      });

      if (!application) {
        throw new NotFoundException('Internship application not found');
      }

      // Check for duplicate report
      const existingReport = await this.prisma.monthlyReport.findFirst({
        where: {
          isDeleted: false,
          applicationId: data.applicationId,
          reportMonth: data.reportMonth,
          reportYear: data.reportYear,
        },
      });

      if (existingReport) {
        throw new BadRequestException('Report for this month already exists');
      }

      // Auto-approve reports on submission (no manual review required)
      const submissionTime = new Date();
      const report = await this.prisma.monthlyReport.create({
        data: {
          studentId,
          applicationId: data.applicationId,
          reportMonth: data.reportMonth,
          reportYear: data.reportYear,
          monthName: new Date(data.reportYear, data.reportMonth - 1, 1).toLocaleString(
            'en-US',
            { month: 'long' },
          ),
          reportFileUrl: data.reportFileUrl,
          status: MonthlyReportStatus.APPROVED, // Auto-approved
          isApproved: true, // Mark as approved
          submittedAt: submissionTime,
          approvedAt: submissionTime, // Set approval time to submission time
        },
        include: {
          student: {
            select: { id: true, user: { select: { name: true, rollNumber: true } } },
          },
          application: { select: { id: true } },
        },
      });

      // Invalidate cache
      await this.cache.del(`reports:student:${studentId}`);

      // Audit: Monthly report submitted
      this.auditService.log({
        action: AuditAction.MONTHLY_REPORT_SUBMIT,
        entityType: 'MonthlyReport',
        entityId: report.id,
        userId: student.userId,
        institutionId: student.institutionId,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.LOW,
        description: `Monthly report submitted for ${data.reportMonth}/${data.reportYear}`,
        newValues: {
          reportMonth: data.reportMonth,
          reportYear: data.reportYear,
          applicationId: data.applicationId,
          studentId,
        },
      }).catch(() => {});

      return report;
    } catch (error) {
      this.logger.error(`Failed to submit monthly report: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getReportsByStudent(studentId: string) {
    try {
      const cacheKey = `reports:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.monthlyReport.findMany({
            where: { studentId, isDeleted: false },
            include: {
              application: { select: { id: true } },
            },
            orderBy: [
              { reportYear: 'desc' },
              { reportMonth: 'desc' },
            ],
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get reports for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getReportsByMentor(mentorId: string) {
    try {
      const cacheKey = `reports:mentor:${mentorId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.monthlyReport.findMany({
            where: {
              isDeleted: false,
              application: { mentorId },
            },
            include: {
              student: {
                select: { id: true, user: { select: { name: true, rollNumber: true } } },
              },
              application: { select: { id: true } },
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get reports for mentor ${mentorId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // DEPRECATED: Reports are now auto-approved on submission.
  // This method is kept for backward compatibility but returns early without making changes.
  // All reports are automatically approved when submitted via submitReport().
  async reviewReport(
    id: string,
    mentorId: string,
    status: ReviewReportDto['status'],
    reviewComments?: string,
  ) {
    this.logger.warn(
      `reviewReport() is deprecated. Reports are now auto-approved on submission. ` +
      `Called with id=${id}, mentorId=${mentorId}, status=${status}`
    );

    // Return the existing report without modifications
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, user: { select: { name: true, rollNumber: true } } } },
        application: { select: { id: true } },
      },
    });

    if (!report || report.isDeleted) {
      throw new NotFoundException('Report not found');
    }

    // Log that this deprecated method was called
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_UPDATE,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: mentorId,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      description: `Deprecated reviewReport() called - reports are now auto-approved`,
      oldValues: { status: report.status },
      newValues: { attemptedStatus: status, reviewComments },
    }).catch(() => {});

    return report;
  }

  async getReportStatistics(institutionId: string) {
    try {
      const cacheKey = `report-stats:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // With auto-approval, all submitted reports are APPROVED.
          // We still track the counts for backwards compatibility.
          const statusCounts = await this.prisma.monthlyReport.groupBy({
            by: ['status'],
            where: {
              student: {
                institutionId,
              },
            },
            _count: { status: true },
          });

          const countsByStatus = statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {} as Record<string, number>);

          // With auto-approval, all new reports go directly to APPROVED status.
          // 'pending' (SUBMITTED) should be 0 for new reports, but we keep counting
          // for any legacy reports that may still exist in SUBMITTED state.
          const approved = countsByStatus[MonthlyReportStatus.APPROVED] ?? 0;
          const pending = countsByStatus[MonthlyReportStatus.SUBMITTED] ?? 0; // Legacy reports only
          const rejected = countsByStatus[MonthlyReportStatus.REJECTED] ?? 0; // Legacy reports only
          const needsRevision = countsByStatus[MonthlyReportStatus.REVISION_REQUIRED] ?? 0; // Legacy reports only

          // Total is now primarily the approved count since all submissions are auto-approved
          const total = approved + pending + rejected + needsRevision;

          return {
            total,
            pending, // Should be 0 for new reports (kept for backwards compatibility)
            approved, // This is now the main metric - all submitted reports are approved
            rejected, // Legacy only
            needsRevision, // Legacy only
            // Submission rate is now effectively approval rate since auto-approval is enabled
            submissionRate: total > 0 ? Math.round((approved / total) * 100) : 0,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get report statistics: ${error.message}`, error.stack);
      throw error;
    }
  }
}
