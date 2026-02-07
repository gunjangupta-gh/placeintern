import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { getTotalExpectedReports, getTotalExpectedVisits } from '../../../common/utils/monthly-cycle.util';

export interface RecalculateResult {
  success: boolean;
  totalExpected: number;
  reason?: string;
}

@Injectable()
export class ExpectedCycleService {
  private readonly logger = new Logger(ExpectedCycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalculate ONLY expected counts when dates change.
   * NEVER modifies submittedReportsCount or completedVisitsCount.
   *
   * Called when:
   * - Internship is created with dates
   * - Dates are updated by principal/student
   */
  async recalculateExpectedCounts(applicationId: string): Promise<RecalculateResult> {
    try {
      const app = await this.prisma.internshipApplication.findUnique({
        where: { id: applicationId },
        select: {
          startDate: true,
          endDate: true,
          joiningDate: true,
          completionDate: true,
        },
      });

      if (!app) {
        this.logger.warn(`Application not found: ${applicationId}`);
        return { success: false, totalExpected: 0, reason: 'Application not found' };
      }

      // Use startDate/endDate, fallback to joiningDate/completionDate
      const startDate = app.startDate || app.joiningDate;
      const endDate = app.endDate || app.completionDate;

      if (!startDate || !endDate) {
        // Set expected to 0 if no valid dates
        await this.prisma.internshipApplication.update({
          where: { id: applicationId },
          data: {
            totalExpectedReports: 0,
            totalExpectedVisits: 0,
            expectedCountsLastCalculated: new Date(),
          },
        });
        this.logger.log(`No valid dates for ${applicationId}, set expected to 0`);
        return { success: true, totalExpected: 0 };
      }

      // Validate date order
      if (endDate < startDate) {
        this.logger.warn(`Invalid date range for ${applicationId}: end before start`);
        return { success: false, totalExpected: 0, reason: 'End date before start date' };
      }

      // Calculate expected counts using monthly cycle utility
      // Visits: First month = any days (always count), last month >10 days
      // Reports: SKIP January month only (students join in Jan at various dates), last month >10 days
      const totalExpectedReports = getTotalExpectedReports(startDate, endDate);
      const totalExpectedVisits = getTotalExpectedVisits(startDate, endDate);

      // Update only expected counts (never touch submitted/completed)
      await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: {
          totalExpectedReports,
          totalExpectedVisits,
          expectedCountsLastCalculated: new Date(),
        },
      });

      this.logger.log(`Recalculated expected counts for ${applicationId}: reports=${totalExpectedReports}, visits=${totalExpectedVisits}`);
      return { success: true, totalExpected: totalExpectedVisits };
    } catch (error) {
      this.logger.error(`Error recalculating expected counts for ${applicationId}:`, error);
      return { success: false, totalExpected: 0, reason: error.message };
    }
  }

  /**
   * Increment report counter when student submits a report.
   * Called after MonthlyReport is created with APPROVED status.
   */
  async incrementReportCount(applicationId: string): Promise<void> {
    try {
      await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: { submittedReportsCount: { increment: 1 } },
      });
      this.logger.log(`Incremented report count for ${applicationId}`);
    } catch (error) {
      this.logger.error(`Error incrementing report count for ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Decrement report counter when report is deleted.
   * Uses atomic conditional update to prevent race conditions and ensure count >= 0.
   */
  async decrementReportCount(applicationId: string): Promise<void> {
    try {
      // Atomic conditional update: only decrement if count > 0
      // This prevents race conditions where concurrent deletes could make count negative
      const result = await this.prisma.internshipApplication.updateMany({
        where: {
          id: applicationId,
          submittedReportsCount: { gt: 0 },
        },
        data: { submittedReportsCount: { decrement: 1 } },
      });

      if (result.count > 0) {
        this.logger.log(`Decremented report count for ${applicationId}`);
      } else {
        this.logger.warn(`Cannot decrement report count for ${applicationId}: already at 0 or not found`);
      }
    } catch (error) {
      this.logger.error(`Error decrementing report count for ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Increment visit counter when faculty logs a completed visit.
   * Called after FacultyVisitLog is created with COMPLETED status.
   */
  async incrementVisitCount(applicationId: string): Promise<void> {
    try {
      await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: { completedVisitsCount: { increment: 1 } },
      });
      this.logger.log(`Incremented visit count for ${applicationId}`);
    } catch (error) {
      this.logger.error(`Error incrementing visit count for ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Decrement visit counter when visit is cancelled/deleted.
   * Uses atomic conditional update to prevent race conditions and ensure count >= 0.
   */
  async decrementVisitCount(applicationId: string): Promise<void> {
    try {
      // Atomic conditional update: only decrement if count > 0
      // This prevents race conditions where concurrent deletes could make count negative
      const result = await this.prisma.internshipApplication.updateMany({
        where: {
          id: applicationId,
          completedVisitsCount: { gt: 0 },
        },
        data: { completedVisitsCount: { decrement: 1 } },
      });

      if (result.count > 0) {
        this.logger.log(`Decremented visit count for ${applicationId}`);
      } else {
        this.logger.warn(`Cannot decrement visit count for ${applicationId}: already at 0 or not found`);
      }
    } catch (error) {
      this.logger.error(`Error decrementing visit count for ${applicationId}:`, error);
      throw error;
    }
  }

  /**
   * Get progress status for an internship.
   * All data comes from counter fields - no additional queries needed.
   */
  async getProgressStatus(applicationId: string): Promise<{
    totalExpectedReports: number;
    totalExpectedVisits: number;
    submittedReportsCount: number;
    completedVisitsCount: number;
    reportCompletionRate: number;
    visitCompletionRate: number;
  } | null> {
    const app = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: {
        totalExpectedReports: true,
        totalExpectedVisits: true,
        submittedReportsCount: true,
        completedVisitsCount: true,
      },
    });

    if (!app) return null;

    return {
      totalExpectedReports: app.totalExpectedReports,
      totalExpectedVisits: app.totalExpectedVisits,
      submittedReportsCount: app.submittedReportsCount,
      completedVisitsCount: app.completedVisitsCount,
      reportCompletionRate: app.totalExpectedReports > 0
        ? (app.submittedReportsCount / app.totalExpectedReports) * 100
        : 0,
      visitCompletionRate: app.totalExpectedVisits > 0
        ? (app.completedVisitsCount / app.totalExpectedVisits) * 100
        : 0,
    };
  }

  /**
   * Recalculate actual counters from database (after migration or data issues).
   * Counts existing approved reports and completed visits.
   */
  async recalculateActualCounters(applicationId: string): Promise<{
    success: boolean;
    submittedReportsCount: number;
    completedVisitsCount: number;
    reason?: string;
  }> {
    try {
      // Count existing submitted/under_review/approved monthly reports
      // This matches the compliance dashboard criteria
      const submittedReportsCount = await this.prisma.monthlyReport.count({
        where: {
          applicationId,
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
          isDeleted: false,
        },
      });

      // Count existing scheduled/completed/in_progress faculty visits
      // This matches the compliance dashboard criteria
      const completedVisitsCount = await this.prisma.facultyVisitLog.count({
        where: {
          applicationId,
          status: { in: ['SCHEDULED', 'COMPLETED', 'IN_PROGRESS'] },
        },
      });

      // Update the application with actual counts
      await this.prisma.internshipApplication.update({
        where: { id: applicationId },
        data: {
          submittedReportsCount,
          completedVisitsCount,
        },
      });

      this.logger.log(`Recalculated actual counters for ${applicationId}: reports=${submittedReportsCount}, visits=${completedVisitsCount}`);
      return { success: true, submittedReportsCount, completedVisitsCount };
    } catch (error) {
      this.logger.error(`Error recalculating actual counters for ${applicationId}:`, error);
      return { success: false, submittedReportsCount: 0, completedVisitsCount: 0, reason: error.message };
    }
  }

  /**
   * Recalculate both expected counts and actual counters for an application.
   * Useful after migration or when data integrity is in question.
   */
  async recalculateAll(applicationId: string): Promise<{
    success: boolean;
    totalExpectedReports: number;
    totalExpectedVisits: number;
    submittedReportsCount: number;
    completedVisitsCount: number;
    reason?: string;
  }> {
    try {
      const expectedResult = await this.recalculateExpectedCounts(applicationId);
      const actualResult = await this.recalculateActualCounters(applicationId);

      if (!expectedResult.success || !actualResult.success) {
        return {
          success: false,
          totalExpectedReports: 0,
          totalExpectedVisits: 0,
          submittedReportsCount: 0,
          completedVisitsCount: 0,
          reason: expectedResult.reason || actualResult.reason,
        };
      }

      const app = await this.prisma.internshipApplication.findUnique({
        where: { id: applicationId },
        select: {
          totalExpectedReports: true,
          totalExpectedVisits: true,
          submittedReportsCount: true,
          completedVisitsCount: true,
        },
      });

      return {
        success: true,
        totalExpectedReports: app.totalExpectedReports,
        totalExpectedVisits: app.totalExpectedVisits,
        submittedReportsCount: app.submittedReportsCount,
        completedVisitsCount: app.completedVisitsCount,
      };
    } catch (error) {
      this.logger.error(`Error recalculating all for ${applicationId}:`, error);
      return {
        success: false,
        totalExpectedReports: 0,
        totalExpectedVisits: 0,
        submittedReportsCount: 0,
        completedVisitsCount: 0,
        reason: error.message,
      };
    }
  }
}
