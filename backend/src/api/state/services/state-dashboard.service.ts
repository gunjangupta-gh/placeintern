import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../core/database/prisma.service";
import { LruCacheService } from "../../../core/cache/lru-cache.service";
import {
  ApplicationStatus,
  Role,
  VisitType,
} from "../../../generated/prisma/client";
import { AuditService } from "../../../infrastructure/audit/audit.service";
import { LookupService } from "../../shared/lookup.service";
import {
  calculateExpectedMonths,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  getMonthCycle,
  MONTHLY_CYCLE,
} from "../../../common/utils/monthly-cycle.util";

@Injectable()
export class StateDashboardService {
  private readonly logger = new Logger(StateDashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
    private readonly lookupService: LookupService,
  ) {}

  /**
   * Get State Directorate Dashboard Statistics
   * Uses domain services where available, with state-level aggregation
   * @param params - Optional month/year for filtering time-sensitive data
   */
  async getDashboardStats(params?: { month?: number; year?: number }) {
    const now = new Date();

    // Use provided month/year or default to current
    const targetMonth = params?.month ?? now.getMonth() + 1;
    const targetYear = params?.year ?? now.getFullYear();

    // This prevents stale cache when no filter is passed vs explicit same-month filter
    const cacheKey = `state:dashboard:stats:${targetMonth}-${targetYear}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastMonthDate = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );

        // Target and previous month dates for detailed stats
        const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
        const prevMonthYear = targetMonth === 1 ? targetYear - 1 : targetYear;

        // Start/end of target month and previous month
        const startOfTargetMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfTargetMonth = new Date(
          targetYear,
          targetMonth,
          0,
          23,
          59,
          59,
          999,
        );
        const startOfPrevMonth = new Date(prevMonthYear, prevMonth - 1, 1);
        const endOfPrevMonth = new Date(targetYear, targetMonth - 1, 0);

        // Use parallel queries for efficiency
        // Only count self-identified internships (not placement-based)
        const [
          totalInstitutions,
          activeInstitutions,
          totalStudents,
          activeStudents,
          totalFaculty,
          activeFaculty,
          totalSelfIdentifiedInternships,
          activeSelfIdentifiedInternships,
          totalApplications,
          acceptedApplications,
          // Mentor assignments
          totalAssignments,
          activeAssignments,
          studentsWithActiveMentorsData, // Unique students with active mentors (array)
          internshipsWithMentorsData, // Students with internships who have mentors (array)
          // Faculty visits
          visitsThisMonth,
          visitsLastMonth,
          totalFacultyVisits,
          // Monthly reports
          reportsSubmittedThisMonth,
          reportsSubmittedLastMonth,
          reportsPendingReview,
          reportsApprovedThisMonth,
          totalReportsSubmitted,
          // Recent activity
          recentApplications,
        ] = await Promise.all([
          this.prisma.institution.count(),
          this.prisma.institution.count({ where: { isActive: true } }),
          // Total students (only from ACTIVE institutions for consistency with institution table)
          this.prisma.student.count({
            where: { Institution: { isActive: true } },
          }),
          // Active students (only from ACTIVE institutions for consistency with institution table)
          this.prisma.student.count({
            where: { user: { active: true }, Institution: { isActive: true } },
          }),
          this.prisma.user.count({
            where: { role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] }, active: true },
          }),
          this.prisma.user.count({
            where: {
              role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
              active: true,
            },
          }),
          // Count self-identified internships only (from ACTIVE institutions, active students with active users, active applications)
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              status: ApplicationStatus.APPROVED,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // All application counts are for self-identified only (from ACTIVE institutions, active students with active users, active applications)
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              status: ApplicationStatus.APPROVED,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Mentor assignments - count records (for reference)
          this.prisma.mentorAssignment.count(),
          this.prisma.mentorAssignment.count({ where: { isActive: true } }),
          // Unique ACTIVE students with active mentor assignments (from ACTIVE institutions, active users)
          this.prisma.mentorAssignment.findMany({
            where: {
              isActive: true,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
            select: { studentId: true },
            distinct: ["studentId"],
          }),
          // Internships with mentors (students with approved internships who have active mentors, from ACTIVE institutions, active users, active applications)
          this.prisma.mentorAssignment.findMany({
            where: {
              isActive: true,
              student: {
                user: { active: true },
                Institution: { isActive: true },
                internshipApplications: {
                  some: {
                    isSelfIdentified: true,
                    isActive: true,
                    status: ApplicationStatus.APPROVED,
                  },
                },
              },
            },
            select: { studentId: true },
            distinct: ["studentId"],
          }),
          // Faculty visits - target month (only COMPLETED visits, ACTIVE institutions, active users)
          this.prisma.facultyVisitLog.count({
            where: {
              isDeleted: false,
              status: "COMPLETED",
              visitDate: { gte: startOfTargetMonth, lte: endOfTargetMonth },
              application: {
                startDate: { lte: endOfTargetMonth },
                student: {
                  user: { active: true },
                  Institution: { isActive: true },
                },
              },
            },
          }),
          // Faculty visits - previous month (only COMPLETED visits, ACTIVE institutions, active users)
          this.prisma.facultyVisitLog.count({
            where: {
              isDeleted: false,
              status: "COMPLETED",
              visitDate: { gte: startOfPrevMonth, lte: endOfPrevMonth },
              application: {
                startDate: { lte: endOfPrevMonth },
                student: {
                  user: { active: true },
                  Institution: { isActive: true },
                },
              },
            },
          }),
          // Total faculty visits (only COMPLETED visits, ACTIVE institutions, active users)
          this.prisma.facultyVisitLog.count({
            where: {
              isDeleted: false,
              status: "COMPLETED",
              application: {
                startDate: { lte: endOfTargetMonth },
                student: {
                  user: { active: true },
                  Institution: { isActive: true },
                },
              },
            },
          }),
          // Monthly reports - submitted for target month (ACTIVE institutions, active users)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              reportMonth: targetMonth,
              reportYear: targetYear,
              status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Monthly reports - submitted previous month (ACTIVE institutions, active users)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              reportMonth: prevMonth,
              reportYear: prevMonthYear,
              status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Monthly reports - pending review (should be 0 with auto-approval, kept for legacy)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Monthly reports - approved for target month (ACTIVE institutions, active users)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              reportMonth: targetMonth,
              reportYear: targetYear,
              status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Total reports submitted (ACTIVE institutions, active users)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Recent activity (ACTIVE institutions, active users, active applications)
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              createdAt: { gte: lastWeek },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
        ]);

        // Get count from the distinct studentIds arrays
        const activeStudentsWithMentors = studentsWithActiveMentorsData.length;
        const internshipsWithMentors = internshipsWithMentorsData.length;

        // Calculate active students without mentor assignments
        // Based on ACTIVE students only (not total students)
        const activeStudentsWithoutMentors = Math.max(
          0,
          activeStudents - activeStudentsWithMentors,
        );

        // Calculate active students without internships
        const activeStudentsWithInternships = activeSelfIdentifiedInternships;
        const activeStudentsWithoutInternships = Math.max(
          0,
          activeStudents - activeStudentsWithInternships,
        );

        // Fetch internships in their training period during the target month (ACTIVE institutions, active applications only)
        // Requires startDate to be set and before end of target month, with endDate after start of target month or not set
        const internshipsInTraining =
          await this.prisma.internshipApplication.findMany({
            where: {
              isSelfIdentified: true,
              isActive: true,
              status: ApplicationStatus.APPROVED,
              startDate: { not: null, lte: endOfTargetMonth },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
              OR: [{ endDate: { gte: startOfTargetMonth } }, { endDate: null }],
            },
            select: {
              id: true,
              startDate: true,
              endDate: true,
            },
          });

        const internshipsCurrentlyInTraining = internshipsInTraining.length;

        /**
         * Calculate expected reports/visits for the SPECIFIC filtered month
         * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
         *
         * Uses monthly inclusion rules: first >15 days, last any days, middle >10 days.
         * Each qualifying internship expects 1 report and 1 visit for that month.
         * This matches the Principal dashboard calculation logic.
         */
        let expectedReportsThisMonth = 0;
        let expectedVisitsThisMonth = 0;

        for (const internship of internshipsInTraining) {
          // startDate is guaranteed to be set by the query filter
          try {
            const startDate = internship.startDate!;
            const endDate =
              internship.endDate ||
              new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // Default 6 months if no end date

            // Check if this internship has the filtered month as an included month (monthly rules)
            const monthCycle = getMonthCycle(
              targetYear,
              targetMonth,
              startDate,
              endDate,
            );

            if (monthCycle) {
              // This internship qualifies for the filtered month
              // So it expects 1 report and 1 visit for this month
              if (targetMonth !== 1) {
                expectedReportsThisMonth++;
              }
              expectedVisitsThisMonth++;
            }
          } catch (error) {
            // Skip internships with invalid dates
            this.logger.warn(
              `Invalid dates for internship ${internship.id}: ${error.message}`,
            );
            continue;
          }
        }

        // Final expected counts (no future month check needed - getMonthCycle handles this)
        const finalExpectedReports = expectedReportsThisMonth;
        const finalExpectedVisits = expectedVisitsThisMonth;

        const missingReportsThisMonth = Math.max(
          0,
          finalExpectedReports - reportsSubmittedThisMonth,
        );
        // Note: missingReportsLastMonth should use last month's expected count, but we don't have historical data
        // For now, use this month's expected as an approximation (most internships are long-term)
        const missingReportsLastMonth = Math.max(
          0,
          finalExpectedReports - reportsSubmittedLastMonth,
        );
        const pendingVisitsThisMonth = Math.max(
          0,
          finalExpectedVisits - visitsThisMonth,
        );

        return {
          institutions: {
            total: totalInstitutions,
            active: activeInstitutions,
          },
          students: {
            total: totalStudents,
            active: activeStudents,
          },
          faculty: {
            total: totalFaculty,
            active: activeFaculty,
          },
          totalFaculty,
          activeFaculty,
          internships: {
            total: totalSelfIdentifiedInternships,
            active: activeSelfIdentifiedInternships,
          },
          applications: {
            total: totalApplications,
            accepted: acceptedApplications,
            approvalRate:
              totalApplications > 0
                ? Math.round((acceptedApplications / totalApplications) * 100)
                : 0,
          },
          // Student & Mentor Assignment breakdown - all based on ACTIVE students
          assignments: {
            // Raw assignment record counts (for reference only)
            totalAssignmentRecords: totalAssignments,
            activeAssignmentRecords: activeAssignments,

            // Active students breakdown
            activeStudents, // Total active students (base for all calculations)
            activeStudentsWithMentors, // Active students who have a mentor assigned
            activeStudentsWithoutMentors, // Active students without a mentor

            // Internship breakdown (for active students)
            activeStudentsWithInternships, // Active students with approved internships
            activeStudentsWithoutInternships, // Active students without internships

            // Internship-mentor breakdown
            internshipsWithMentors, // Internships that have mentors assigned
            internshipsWithoutMentors:
              activeStudentsWithInternships - internshipsWithMentors,
          },
          // Faculty Visits Card with details
          facultyVisits: {
            total: totalFacultyVisits,
            thisMonth: visitsThisMonth,
            lastMonth: visitsLastMonth,
            expectedThisMonth: finalExpectedVisits,
            pendingThisMonth: pendingVisitsThisMonth,
            // Return null when no data to show N/A on frontend
            completionRate:
              finalExpectedVisits > 0
                ? Math.round((visitsThisMonth / finalExpectedVisits) * 100)
                : null,
          },
          // Monthly Reports Card with details
          monthlyReports: {
            total: totalReportsSubmitted,
            thisMonth: reportsSubmittedThisMonth,
            lastMonth: reportsSubmittedLastMonth,
            pendingReview: reportsPendingReview,
            approvedThisMonth: reportsApprovedThisMonth,
            expectedThisMonth: finalExpectedReports,
            missingThisMonth: missingReportsThisMonth,
            missingLastMonth: missingReportsLastMonth,
            // Return null when no data to show N/A on frontend
            submissionRate:
              finalExpectedReports > 0
                ? Math.round(
                    (reportsSubmittedThisMonth / finalExpectedReports) * 100,
                  )
                : null,
          },
          compliance: {
            totalVisits: totalFacultyVisits,
            pendingReports: reportsPendingReview,
          },
          recentActivity: {
            applicationsLastWeek: recentApplications,
          },
        };
      },
      { ttl: 900, tags: ["state", "dashboard"] }, // OPTIMIZED: Increased from 5 to 15 minutes - data rarely changes
    );
  }

  // Backwards-compatible alias - passes month/year params to getDashboardStats
  async getDashboard(params?: { month?: number; year?: number }) {
    return this.getDashboardStats(params);
  }

  /**
   * Get critical alerts for state dashboard
   * Returns institutions with compliance < 50%, students without mentors for > 7 days,
   * missing monthly reports (overdue by > 5 days), and faculty visit gaps (> 30 days)
   */
  async getCriticalAlerts(
    getInstitutionsWithStats: (params: any) => Promise<any>,
  ) {
    const cacheKey = "state:dashboard:critical-alerts";

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );

        // Run all independent queries in parallel
        const [
          institutionsWithStats,
          studentsWithoutMentors,
          missingReports,
          institutions,
          allLastVisits,
        ] = await Promise.all([
          // 1. Get institutions with stats
          getInstitutionsWithStats({ page: 1, limit: 100 }),

          // 2. All students without mentors (no day limit) - from active institutions only
          this.prisma.student.findMany({
            where: {
              user: { active: true },
              Institution: { isActive: true },
              mentorAssignments: {
                none: { isActive: true },
              },
            },
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true } },
              Institution: { select: { id: true, name: true, code: true } },
              internshipApplications: {
                where: {
                  isSelfIdentified: true,
                  isActive: true,
                  status: ApplicationStatus.APPROVED,
                },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true, startDate: true },
              },
            },
            take: 50,
          }),

          // 3. Missing monthly reports (overdue by > 5 days since internship start)
          // Only check students whose internships started more than 5 days ago
          // With auto-approval, all submitted reports are APPROVED
          // Only from active institutions, active applications
          this.prisma.student.findMany({
            where: {
              user: { active: true },
              Institution: { isActive: true },
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  isActive: true,
                  status: ApplicationStatus.APPROVED,
                  startDate: { lte: fiveDaysAgo },
                },
              },
              monthlyReports: {
                none: {
                  reportMonth: currentMonth,
                  reportYear: currentYear,
                  status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
                },
              },
            },
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true } },
              Institution: { select: { id: true, name: true, code: true } },
            },
            take: 20,
          }),

          // 4. Get all institutions (cached via LookupService)
          this.lookupService
            .getInstitutions()
            .then((data) => data.institutions),

          // 5. Get last visit per institution using raw aggregation - avoiding N+1
          this.prisma.facultyVisitLog.groupBy({
            by: ["applicationId"],
            where: { isDeleted: false },
            _max: { visitDate: true },
          }),
        ]);

        // Calculate low compliance institutions (using pre-calculated complianceScore)
        const lowCompliance = institutionsWithStats.data
          .filter((inst: any) => {
            // Only include institutions with students and compliance score < 50%
            return (
              inst.stats.totalStudents > 0 && inst.stats.complianceScore < 50
            );
          })
          .map((inst: any) => ({
            institutionId: inst.id,
            institutionName: inst.name,
            institutionCode: inst.code,
            city: inst.city,
            complianceScore: inst.stats.complianceScore,
          }));

        // Calculate visit gaps efficiently - get last visit per institution in batch
        const applicationIds = allLastVisits.map((v) => v.applicationId);
        const applicationsWithInstitution =
          applicationIds.length > 0
            ? await this.prisma.internshipApplication.findMany({
                where: { id: { in: applicationIds } },
                select: {
                  id: true,
                  student: { select: { institutionId: true } },
                },
              })
            : [];

        // Build map of institution -> last visit date
        const institutionLastVisit = new Map<string, Date>();
        for (const app of applicationsWithInstitution) {
          const visitInfo = allLastVisits.find(
            (v) => v.applicationId === app.id,
          );
          if (visitInfo?._max.visitDate) {
            const instId = app.student.institutionId;
            const existingDate = institutionLastVisit.get(instId);
            const visitDate = new Date(visitInfo._max.visitDate);
            if (!existingDate || visitDate > existingDate) {
              institutionLastVisit.set(instId, visitDate);
            }
          }
        }

        // Find institutions with visit gaps
        const visitGaps: any[] = [];
        for (const inst of institutions) {
          const lastVisitDate = institutionLastVisit.get(inst.id);
          if (lastVisitDate && lastVisitDate < thirtyDaysAgo) {
            const daysSince = Math.floor(
              (now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24),
            );
            visitGaps.push({
              institutionId: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              lastVisitDate: lastVisitDate,
              daysSinceLastVisit: daysSince,
            });
          }
        }

        return {
          timestamp: now.toISOString(),
          summary: {
            totalAlerts:
              lowCompliance.length +
              studentsWithoutMentors.length +
              missingReports.length +
              visitGaps.length,
            lowComplianceCount: lowCompliance.length,
            studentsWithoutMentorsCount: studentsWithoutMentors.length,
            missingReportsCount: missingReports.length,
            visitGapsCount: visitGaps.length,
          },
          alerts: {
            lowComplianceInstitutions: lowCompliance,
            studentsWithoutMentors: studentsWithoutMentors.map((s) => {
              const internship = s.internshipApplications[0];
              const startDate = internship?.startDate
                ? new Date(internship.startDate)
                : null;
              return {
                studentId: s.id,
                studentName: s.user?.name,
                rollNumber: s.user?.rollNumber,
                institutionId: s.Institution?.id,
                institutionName: s.Institution?.name,
                institutionCode: s.Institution?.code,
                hasInternship: !!internship,
                internshipStartDate: startDate?.toISOString() || null,
                daysSinceInternshipStarted: startDate
                  ? Math.floor(
                      (now.getTime() - startDate.getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null,
              };
            }),
            missingReports: missingReports.map((s) => ({
              studentId: s.id,
              studentName: s.user?.name,
              rollNumber: s.user?.rollNumber,
              institutionId: s.Institution?.id,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysOverdue: now.getDate() - 5,
            })),
            facultyVisitGaps: visitGaps,
          },
        };
      },
      { ttl: 900, tags: ["state", "dashboard", "alerts"] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }

  /**
   * Get action items for state dashboard
   * Returns pending approvals, institutions requiring intervention, and overdue compliance items
   */
  async getActionItems(
    getInstitutionsWithStats: (params: any) => Promise<any>,
  ) {
    const cacheKey = "state:dashboard:action-items";

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const fifteenDaysAgo = new Date(
          now.getTime() - 15 * 24 * 60 * 60 * 1000,
        );

        // Run all independent queries in parallel
        const [institutionsWithStats, overdueItems] = await Promise.all([
          // 1. Get institutions with stats
          getInstitutionsWithStats({ page: 1, limit: 100 }),

          // 2. Overdue compliance items (from active institutions, active applications only)
          // With auto-approval, all submitted reports are APPROVED
          this.prisma.student.findMany({
            where: {
              user: { active: true },
              Institution: { isActive: true },
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  isActive: true,
                  status: ApplicationStatus.APPROVED,
                  createdAt: { lte: fifteenDaysAgo },
                },
              },
              monthlyReports: {
                none: {
                  reportMonth: currentMonth,
                  reportYear: currentYear,
                  status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
                },
              },
            },
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true } },
              Institution: { select: { id: true, name: true, code: true } },
            },
            take: 15,
          }),
        ]);

        // Institutions requiring intervention (compliance < 30%)
        // Use activeStudents as denominator per approved specification
        // Compliance = (MentorRate + JoiningLetterRate) / 2
        const requiresIntervention = institutionsWithStats.data
          .filter((inst: any) => {
            const { stats } = inst;
            // Use activeStudents as denominator
            if (stats.activeStudents === 0) return false;

            // 2-metric formula: MentorRate + JoiningLetterRate
            const assignmentRate = Math.min(
              (stats.assigned / stats.activeStudents) * 100,
              100,
            );
            const joiningLetterRate = Math.min(
              (stats.joiningLettersSubmitted / stats.activeStudents) * 100,
              100,
            );
            const overallCompliance = (assignmentRate + joiningLetterRate) / 2;
            return overallCompliance < 30;
          })
          .map((inst: any) => {
            const { stats } = inst;
            const assignmentRate = Math.min(
              (stats.assigned / stats.activeStudents) * 100,
              100,
            );
            const joiningLetterRate = Math.min(
              (stats.joiningLettersSubmitted / stats.activeStudents) * 100,
              100,
            );
            return {
              institutionId: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              city: inst.city,
              complianceScore: Math.round(
                (assignmentRate + joiningLetterRate) / 2,
              ),
              issues: [
                stats.unassigned > 0 &&
                  `${stats.unassigned} students without mentors`,
                stats.facultyVisits === 0 && "No faculty visits this month",
                stats.reportsMissing > 0 &&
                  `${stats.reportsMissing} missing reports`,
              ].filter(Boolean),
            };
          });

        return {
          timestamp: now.toISOString(),
          summary: {
            totalActionItems: requiresIntervention.length + overdueItems.length,
            interventionRequiredCount: requiresIntervention.length,
            overdueComplianceCount: overdueItems.length,
          },
          actions: {
            institutionsRequiringIntervention: requiresIntervention,
            overdueComplianceItems: overdueItems.map((s) => ({
              studentId: s.id,
              studentName: s.user?.name,
              rollNumber: s.user?.rollNumber,
              institutionName: s.Institution?.name,
              institutionCode: s.Institution?.code,
              daysOverdue: 15,
              priority: "high",
            })),
          },
        };
      },
      { ttl: 900, tags: ["state", "dashboard", "actions"] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }

  /**
   * Get compliance summary for state dashboard
   * Returns overall compliance metrics and breakdown by institution
   */
  async getComplianceSummary(
    getInstitutionsWithStats: (params: any) => Promise<any>,
  ) {
    const cacheKey = "state:compliance:summary";

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const startOfMonth = new Date(currentYear, currentMonth - 1, 1);

        // Run state-wide counts AND institution stats in parallel
        const [
          totalInstitutions,
          activeStudents,
          totalStudentsWithInternships,
          totalAssignments,
          totalJoiningLetters,
          totalVisitsThisMonth,
          totalReportsThisMonth,
          institutionsWithStats,
        ] = await Promise.all([
          this.prisma.institution.count({ where: { isActive: true } }),
          // Count active students from active institutions with active users (denominator for compliance)
          this.prisma.student.count({
            where: { user: { active: true }, Institution: { isActive: true } },
          }),
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              status: ApplicationStatus.APPROVED,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Count unique students with active mentor assignments (from active institutions, active users)
          this.prisma.mentorAssignment
            .findMany({
              where: {
                isActive: true,
                student: {
                  user: { active: true },
                  Institution: { isActive: true },
                },
              },
              select: { studentId: true },
              distinct: ["studentId"],
            })
            .then((results) => results.length),
          // Count joining letters submitted (students with approved internships who have joining letter, active users, active applications)
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              status: ApplicationStatus.APPROVED,
              joiningLetterUrl: { not: null },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          this.prisma.facultyVisitLog.count({
            where: {
              isDeleted: false,
              visitDate: { gte: startOfMonth },
              application: {
                student: {
                  user: { active: true },
                  Institution: { isActive: true },
                },
              },
            },
          }),
          // With auto-approval, all submitted reports are APPROVED (active users)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          }),
          // Run institution stats in parallel with state-wide counts
          getInstitutionsWithStats({ page: 1, limit: 100 }),
        ]);

        // Calculate state-wide compliance rates (cap at 100%, null when no data)
        // NEW FORMULA: Compliance = (MentorCoverage + JoiningLetterRate) / 2
        // Denominator: activeStudents (per approved specification)
        const mentorCoverageRate =
          activeStudents > 0
            ? Math.round(
                Math.min((totalAssignments / activeStudents) * 100, 100),
              )
            : null;
        const joiningLetterRate =
          activeStudents > 0
            ? Math.round(
                Math.min((totalJoiningLetters / activeStudents) * 100, 100),
              )
            : null;
        // Visit and report rates are tracked separately (NOT in compliance score)
        const visitComplianceRate =
          totalStudentsWithInternships > 0
            ? Math.round(
                Math.min(
                  (totalVisitsThisMonth / totalStudentsWithInternships) * 100,
                  100,
                ),
              )
            : null;
        const reportComplianceRate =
          totalStudentsWithInternships > 0
            ? Math.round(
                Math.min(
                  (totalReportsThisMonth / totalStudentsWithInternships) * 100,
                  100,
                ),
              )
            : null;
        // Calculate overall compliance from 2 metrics only (MentorCoverage + JoiningLetterRate)
        const stateValidRates = [mentorCoverageRate, joiningLetterRate].filter(
          (r) => r !== null,
        ) as number[];
        const overallCompliance =
          stateValidRates.length > 0
            ? Math.round(
                stateValidRates.reduce((a, b) => a + b, 0) /
                  stateValidRates.length,
              )
            : null;

        // Process institution-wise compliance breakdown (cap at 100%, null when no data)
        // NEW FORMULA: Compliance = (MentorCoverage + JoiningLetterRate) / 2
        // Denominator: activeStudents (per approved specification)
        const institutionCompliance = institutionsWithStats.data
          .map((inst: any) => {
            const { stats } = inst;
            // Use activeStudents as denominator for compliance metrics
            const mentorCov =
              stats.activeStudents > 0
                ? Math.round(
                    Math.min(
                      (stats.assigned / stats.activeStudents) * 100,
                      100,
                    ),
                  )
                : null;
            const joiningLetterCov =
              stats.activeStudents > 0
                ? Math.round(
                    Math.min(
                      (stats.joiningLettersSubmitted / stats.activeStudents) *
                        100,
                      100,
                    ),
                  )
                : null;
            // Visit and report rates tracked separately (NOT in compliance score)
            const visitComp =
              stats.studentsWithInternships > 0
                ? Math.round(
                    Math.min(
                      (stats.facultyVisits / stats.studentsWithInternships) *
                        100,
                      100,
                    ),
                  )
                : null;
            const reportComp =
              stats.studentsWithInternships > 0
                ? Math.round(
                    Math.min(
                      (stats.reportsSubmitted / stats.studentsWithInternships) *
                        100,
                      100,
                    ),
                  )
                : null;
            // Calculate overall from 2 metrics only (MentorCoverage + JoiningLetterRate)
            const instValidRates = [mentorCov, joiningLetterCov].filter(
              (r) => r !== null,
            ) as number[];
            const overall =
              instValidRates.length > 0
                ? Math.round(
                    instValidRates.reduce((a, b) => a + b, 0) /
                      instValidRates.length,
                  )
                : null;

            return {
              institutionId: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              city: inst.city,
              overallScore: overall,
              mentorCoverage: mentorCov,
              joiningLetterRate: joiningLetterCov,
              // Keep visit and report as separate tracked metrics (not in compliance)
              visitCompliance: visitComp,
              reportCompliance: reportComp,
              activeStudents: stats.activeStudents,
              studentsWithInternships: stats.studentsWithInternships,
              studentsWithMentors: stats.assigned,
              joiningLettersSubmitted: stats.joiningLettersSubmitted,
              visitsThisMonth: stats.facultyVisits,
              reportsThisMonth: stats.reportsSubmitted,
            };
          })
          .sort((a: any, b: any) => a.overallScore - b.overallScore);

        return {
          timestamp: now.toISOString(),
          month: currentMonth,
          year: currentYear,
          stateWide: {
            totalInstitutions,
            activeStudents,
            totalStudentsWithInternships,
            totalMentorAssignments: totalAssignments,
            totalJoiningLetters,
            totalVisitsThisMonth,
            totalReportsThisMonth,
            // Overall compliance based on 2 metrics: MentorCoverage + JoiningLetterRate
            overallComplianceScore: overallCompliance,
            mentorCoverageRate,
            joiningLetterRate,
            // Visit and report rates tracked separately (NOT in compliance score)
            visitComplianceRate,
            reportComplianceRate,
          },
          distribution: {
            excellent: institutionCompliance.filter(
              (i: any) => i.overallScore >= 90,
            ).length,
            good: institutionCompliance.filter(
              (i: any) => i.overallScore >= 70 && i.overallScore < 90,
            ).length,
            warning: institutionCompliance.filter(
              (i: any) => i.overallScore >= 50 && i.overallScore < 70,
            ).length,
            critical: institutionCompliance.filter(
              (i: any) => i.overallScore >= 30 && i.overallScore < 50,
            ).length,
            interventionRequired: institutionCompliance.filter(
              (i: any) => i.overallScore !== null && i.overallScore < 30,
            ).length,
          },
          institutions: institutionCompliance,
        };
      },
      { ttl: 900, tags: ["state", "compliance"] }, // OPTIMIZED: Increased from 5 to 15 minutes
    );
  }

  /**
   * Get college-wise breakdown for dashboard statistics
   * Returns institution-wise data for students, reports, mentors, or visits
   * @param type - Type of breakdown (students, reports, mentors, visits)
   * @param params - Optional month/year filter params
   */
  /**
   * Get visits grouped by visit type (PHYSICAL, VIRTUAL, TELEPHONIC)
   * Returns counts for pie chart visualization
   * @param params - Optional month/year for filtering
   */
  async getVisitsByType(params?: { month?: number; year?: number }) {
    const now = new Date();
    const targetMonth = params?.month ?? now.getMonth() + 1;
    const targetYear = params?.year ?? now.getFullYear();

   // Always use month-specific cache key to stay consistent with dashboard stats
    const cacheKey = `state:dashboard:visits-by-type:${targetMonth}-${targetYear}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(
          targetYear,
          targetMonth,
          0,
          23,
          59,
          59,
          999,
        );

        // Get visits grouped by type for the target month
        const visitsByType = await this.prisma.facultyVisitLog.groupBy({
          by: ["visitType"],
          where: {
            isDeleted: false,
            status: "COMPLETED",
            visitDate: { gte: startOfMonth, lte: endOfMonth },
            application: {
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
          },
          _count: { id: true },
        });

        // Map to a more readable format with colors for the chart
        const typeColors = {
          PHYSICAL: "#22c55e", // green
          VIRTUAL: "#3b82f6", // blue
          TELEPHONIC: "#f59e0b", // amber
        };

        const typeLabels = {
          PHYSICAL: "Physical Visit",
          VIRTUAL: "Virtual Visit",
          TELEPHONIC: "Telephonic Visit",
        };

        const data = visitsByType.map((item) => ({
          type: item.visitType,
          label: typeLabels[item.visitType] || item.visitType,
          count: item._count.id,
          color: typeColors[item.visitType] || "#6b7280",
        }));

        // Ensure all types are represented (even if count is 0)
        const allTypes: VisitType[] = [
          VisitType.PHYSICAL,
          VisitType.VIRTUAL,
          VisitType.TELEPHONIC,
        ];
        for (const visitType of allTypes) {
          if (!data.find((d) => d.type === visitType)) {
            data.push({
              type: visitType,
              label: typeLabels[visitType],
              count: 0,
              color: typeColors[visitType],
            });
          }
        }

        // Sort by count descending
        data.sort((a, b) => b.count - a.count);

        const total = data.reduce((sum, item) => sum + item.count, 0);

        return {
          month: targetMonth,
          year: targetYear,
          total,
          data,
        };
      },
      { ttl: 900, tags: ["state", "dashboard", "visits"] },
    );
  }

  async getCollegeWiseBreakdown(
    type: "students" | "reports" | "mentors" | "visits",
    params?: { month?: number; year?: number },
  ) {
    // Use provided month/year or default to current
    const now = new Date();
    const targetMonth = params?.month ?? now.getMonth() + 1;
    const targetYear = params?.year ?? now.getFullYear();

    // Always use month-specific cache key to stay consistent with dashboard stats
    const cacheKey = `state:dashboard:college-breakdown:${type}:${targetMonth}-${targetYear}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(
          targetYear,
          targetMonth,
          0,
          23,
          59,
          59,
          999,
        );

        // Get all active institutions
        const institutions = await this.prisma.institution.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
          },
          orderBy: { name: "asc" },
        });

        switch (type) {
          case "students": {
            // Get student counts per institution (active students with active users from active institutions)
            const studentCounts = await this.prisma.student.groupBy({
              by: ["institutionId"],
              where: {
                user: { active: true },
                Institution: { isActive: true },
              },
              _count: { id: true },
            });

            // Get active internship counts per institution (active students with active users from active institutions, active applications)
            const internshipCounts =
              await this.prisma.internshipApplication.groupBy({
                by: ["studentId"],
                where: {
                  isSelfIdentified: true,
                  isActive: true,
                  status: ApplicationStatus.APPROVED,
                  student: {
                    user: { active: true },
                    Institution: { isActive: true },
                  },
                },
              });

            // Get student institutionIds for internships (already filtered above, but add Institution check)
            const studentsWithInternships = await this.prisma.student.findMany({
              where: {
                id: { in: internshipCounts.map((i) => i.studentId) },
                user: { active: true },
                Institution: { isActive: true },
              },
              select: { institutionId: true },
            });

            // Count internships per institution
            const internshipsByInstitution = new Map<string, number>();
            for (const s of studentsWithInternships) {
              const count = internshipsByInstitution.get(s.institutionId) || 0;
              internshipsByInstitution.set(s.institutionId, count + 1);
            }

            return institutions.map((inst) => ({
              id: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              totalStudents:
                studentCounts.find((c) => c.institutionId === inst.id)?._count
                  .id || 0,
              activeInternships: internshipsByInstitution.get(inst.id) || 0,
            }));
          }

          case "reports": {
            // Get reports submitted for the target month per institution (active students with active users from active institutions)
            const reportsThisMonth = await this.prisma.monthlyReport.findMany({
              where: {
                isDeleted: false,
                reportMonth: targetMonth,
                reportYear: targetYear,
                status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
                student: {
                  user: { active: true },
                  Institution: { isActive: true },
                },
              },
              select: {
                student: { select: { institutionId: true } },
              },
            });

            // Count reports per institution
            const reportsByInstitution = new Map<string, number>();
            for (const r of reportsThisMonth) {
              const instId = r.student.institutionId;
              const count = reportsByInstitution.get(instId) || 0;
              reportsByInstitution.set(instId, count + 1);
            }

            // Get expected reports per institution using monthly cycle rules (matching main stats logic)
            const internshipsInTraining =
              await this.prisma.internshipApplication.findMany({
                where: {
                  isSelfIdentified: true,
                  isActive: true,
                  status: ApplicationStatus.APPROVED,
                  startDate: { not: null, lte: endOfMonth },
                  student: {
                    user: { active: true },
                    Institution: { isActive: true },
                  },
                  OR: [{ endDate: { gte: startOfMonth } }, { endDate: null }],
                },
                select: {
                  id: true,
                  startDate: true,
                  endDate: true,
                  student: { select: { institutionId: true } },
                },
              });

            const expectedByInstitution = new Map<string, number>();
            for (const i of internshipsInTraining) {
              try {
                const internshipStart = i.startDate!;
                const internshipEnd =
                  i.endDate ||
                  new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
                const monthCycle = getMonthCycle(
                  targetYear,
                  targetMonth,
                  internshipStart,
                  internshipEnd,
                );
                // Apply same rules as main stats: skip January for reports, require monthly cycle inclusion
                if (monthCycle && targetMonth !== 1) {
                  const instId = i.student.institutionId;
                  const count = expectedByInstitution.get(instId) || 0;
                  expectedByInstitution.set(instId, count + 1);
                }
              } catch {
                continue;
              }
            }

            return institutions.map((inst) => ({
              id: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              submitted: reportsByInstitution.get(inst.id) || 0,
              expected: expectedByInstitution.get(inst.id) || 0,
            }));
          }

          case "mentors": {
            // Get mentor/faculty counts per institution (from active institutions)
            const mentorCounts = await this.prisma.user.groupBy({
              by: ["institutionId"],
              where: {
                role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
                active: true,
                institutionId: { not: null },
                Institution: { isActive: true },
              },
              _count: { id: true },
            });

            // Get students with active mentor assignments per institution (active students with active users from active institutions)
            const assignmentCounts =
              await this.prisma.mentorAssignment.findMany({
                where: {
                  isActive: true,
                  student: {
                    user: { active: true },
                    Institution: { isActive: true },
                  },
                },
                select: {
                  student: { select: { institutionId: true } },
                },
              });

            const assignedByInstitution = new Map<string, number>();
            for (const a of assignmentCounts) {
              const instId = a.student.institutionId;
              const count = assignedByInstitution.get(instId) || 0;
              assignedByInstitution.set(instId, count + 1);
            }

            return institutions.map((inst) => ({
              id: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              totalMentors:
                mentorCounts.find((c) => c.institutionId === inst.id)?._count
                  .id || 0,
              assignedStudents: assignedByInstitution.get(inst.id) || 0,
            }));
          }

          case "visits": {
            // Get COMPLETED visits this month per institution (matching main stats logic)
            const visitsThisMonth = await this.prisma.facultyVisitLog.findMany({
              where: {
                isDeleted: false,
                status: "COMPLETED",
                visitDate: { gte: startOfMonth, lte: endOfMonth },
                application: {
                  startDate: { lte: endOfMonth },
                  student: {
                    user: { active: true },
                    Institution: { isActive: true },
                  },
                },
              },
              select: {
                application: {
                  select: {
                    student: { select: { institutionId: true } },
                  },
                },
              },
            });

            const visitsByInstitution = new Map<string, number>();
            for (const v of visitsThisMonth) {
              const instId = v.application.student.institutionId;
              const count = visitsByInstitution.get(instId) || 0;
              visitsByInstitution.set(instId, count + 1);
            }

            // Get expected visits per institution using monthly cycle rules (matching main stats logic)
            const internshipsInTraining =
              await this.prisma.internshipApplication.findMany({
                where: {
                  isSelfIdentified: true,
                  isActive: true,
                  status: ApplicationStatus.APPROVED,
                  startDate: { not: null, lte: endOfMonth },
                  student: {
                    user: { active: true },
                    Institution: { isActive: true },
                  },
                  OR: [{ endDate: { gte: startOfMonth } }, { endDate: null }],
                },
                select: {
                  id: true,
                  startDate: true,
                  endDate: true,
                  student: { select: { institutionId: true } },
                },
              });

            const expectedByInstitution = new Map<string, number>();
            for (const i of internshipsInTraining) {
              try {
                const internshipStart = i.startDate!;
                const internshipEnd =
                  i.endDate ||
                  new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
                const monthCycle = getMonthCycle(
                  targetYear,
                  targetMonth,
                  internshipStart,
                  internshipEnd,
                );
                if (monthCycle) {
                  const instId = i.student.institutionId;
                  const count = expectedByInstitution.get(instId) || 0;
                  expectedByInstitution.set(instId, count + 1);
                }
              } catch {
                continue;
              }
            }

            return institutions.map((inst) => ({
              id: inst.id,
              institutionName: inst.name,
              institutionCode: inst.code,
              completed: visitsByInstitution.get(inst.id) || 0,
              expected: expectedByInstitution.get(inst.id) || 0,
            }));
          }

          default:
            return [];
        }
      },
      { ttl: 900, tags: ["state", "dashboard", "breakdown"] },
    );
  }
}
