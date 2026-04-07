import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { Prisma, ApplicationStatus, InternshipPhase, Role, AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';
import {
  calculateExpectedMonths,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  getMonthCycle,
  MONTHLY_CYCLE,
} from '../../../common/utils/monthly-cycle.util';

@Injectable()
export class StateInstitutionService {
  private readonly logger = new Logger(StateInstitutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get paginated list of institutions with filters
   */
  async getInstitutions(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    isActive?: boolean;
    status?: 'active' | 'inactive' | 'all';
    cursor?: string;
  }) {
    const { page, limit, search, type, isActive, status, cursor } = params;

    const pageNum = Math.max(1, Math.floor(Number(page) || 1));
    const limitNum = Math.max(1, Math.min(100, Math.floor(Number(limit) || 10)));

    const where: Prisma.InstitutionWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type as any;
    }

    // Prefer explicit status filter when provided; preserve legacy isActive behavior otherwise.
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status !== 'all') {
      // Default to active institutions only (consistent with lookupService.getInstitutions)
      // Pass isActive=false explicitly to include inactive institutions in legacy callers.
      where.isActive = isActive ?? true;
    }

    const query: Prisma.InstitutionFindManyArgs = {
      where,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: {
              where: {
                role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
              },
            },
            // Count only active students for consistency with all other calculations
            Student: { where: { user: { active: true } } },
            batches: true,
          },
        },
      },
    };

    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    } else {
      query.skip = Math.max(0, (pageNum - 1) * limitNum);
    }

    const [institutions, total, totalStudents] = await Promise.all([
      this.prisma.institution.findMany(query),
      this.prisma.institution.count({ where }),
      // Get total active students count separately to match dashboard
      this.prisma.student.count({ where: { user: { active: true } } }),
    ]);

    const nextCursor = institutions.length === limitNum
      ? institutions[institutions.length - 1].id
      : null;

    return {
      data: institutions,
      total,
      totalStudents, // Total students across all institutions (matches dashboard)
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      nextCursor,
    };
  }

  /**
   * Get institutions with comprehensive statistics for dashboard
   * Includes: students, internships, assignments, visits, reports
   * Cached for 5 minutes to reduce database load
   */
  async getInstitutionsWithStats(params: {
    page?: number;
    limit?: number;
    search?: string;
    month?: number;
    year?: number;
  }) {
    // Default to 100 to show all institutions (currently 23 in Punjab)
    const { page = 1, limit = 100, search, month, year } = params;
    const skip = (page - 1) * limit;

    // Build cache key including pagination, search, and month/year filter
    const cacheKey = `state:institutions:stats:${page}:${limit}:${search || ''}:${month || ''}:${year || ''}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this._getInstitutionsWithStatsInternal(page, limit, skip, search, month, year);
      },
      { ttl: 5 * 60 * 1000, tags: ['state', 'institutions', 'stats'] }, // 5 minutes cache
    );
  }

  /**
   * Internal implementation of getInstitutionsWithStats
   * Separated for caching purposes
   */
  private async _getInstitutionsWithStatsInternal(
    page: number,
    limit: number,
    skip: number,
    search?: string,
    filterMonth?: number,
    filterYear?: number,
  ) {

    // Get month info - use filter params or default to current month
    const now = new Date();
    const currentMonth = filterMonth || (now.getMonth() + 1);
    const currentYear = filterYear || now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // For queries that check if internship is in training period during the filter month,
    // we use effectiveDate: end of filter month for past months, now for current month
    const currentMonthNow = now.getMonth() + 1;
    const currentYearNow = now.getFullYear();
    const isFilteringPastMonth = filterMonth && filterYear &&
      (filterYear < currentYearNow || (filterYear === currentYearNow && filterMonth < currentMonthNow));
    const effectiveDate = isFilteringPastMonth ? endOfMonth : now;

    const where: Prisma.InstitutionWhereInput = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get institutions with basic info and batch all stats queries
    const [institutions, total] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          isActive: true,
        },
      }),
      this.prisma.institution.count({ where }),
    ]);

    const institutionIds = institutions.map(i => i.id);

    // Batch all stats queries - run once for all institutions instead of N+1
    const [
      studentCounts,
      activeStudentCounts,
      internshipCounts,
      approvedInternshipCounts,
      joiningLetterCounts,
      assignmentCounts,
      visitCounts,
      reportCounts,
      facultyCounts,
      internshipsInTrainingData, // Internships currently in their training period (with dates for monthly cycle calculation)
    ] = await Promise.all([
      // 1. Total students per institution
      this.prisma.student.groupBy({
        by: ['institutionId'],
        where: { institutionId: { in: institutionIds } },
        _count: true,
      }),

      // 1b. Active students per institution (user.active = true) - used for compliance calculation
      this.prisma.student.groupBy({
        by: ['institutionId'],
        where: { institutionId: { in: institutionIds }, user: { active: true } },
        _count: true,
      }),

      // 2. Students with active self-identified internships per institution (APPROVED status, active applications)
      this.prisma.internshipApplication.groupBy({
        by: ['studentId'],
        where: {
          student: { institutionId: { in: institutionIds }, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
        },
        _count: true,
      }).then(async (results) => {
        // Get student institutionIds to group by institution
        const studentIds = results.map(r => r.studentId);
        if (studentIds.length === 0) return new Map<string, number>();

        const students = await this.prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, institutionId: true },
        });

        const instCounts = new Map<string, number>();
        for (const student of students) {
          instCounts.set(student.institutionId, (instCounts.get(student.institutionId) || 0) + 1);
        }
        return instCounts;
      }),

      // 3. Self-identified approved internships per institution (count applications, not unique students - matches getInstitutionOverview, active applications)
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId: { in: institutionIds }, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
        },
        select: {
          student: { select: { institutionId: true } },
        },
      }).then((results) => {
        const instCounts = new Map<string, number>();
        for (const app of results) {
          const instId = app.student.institutionId;
          instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
        }
        return instCounts;
      }),

      // 4. Joining letters submitted per institution (count applications, not unique students - matches getInstitutionOverview, active applications, APPROVED status)
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId: { in: institutionIds }, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          joiningLetterUrl: { not: null },
        },
        select: {
          student: { select: { institutionId: true } },
        },
      }).then((results) => {
        const instCounts = new Map<string, number>();
        for (const app of results) {
          const instId = app.student.institutionId;
          instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
        }
        return instCounts;
      }),

      // 5. Unique ACTIVE students with active mentor assignments per institution
      // Count only ACTIVE students with active mentors (consistent with dashboard calculation)
      this.prisma.mentorAssignment.findMany({
        where: {
          student: {
            institutionId: { in: institutionIds },
            user: { active: true },
          },
          isActive: true,
        },
        select: {
          studentId: true,
          student: { select: { institutionId: true } },
        },
        distinct: ['studentId'], // Only count each student once
      }).then((results) => {
        const instCounts = new Map<string, number>();
        for (const assignment of results) {
          const instId = assignment.student.institutionId;
          instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
        }
        return instCounts;
      }),

      // 6. Faculty visits this month per institution
      // Only count visits for internships that have started (startDate <= effectiveDate)
      // Use effectiveDate to properly filter for past months
      this.prisma.facultyVisitLog.findMany({
        where: {
          isDeleted: false,
          visitDate: { gte: startOfMonth, lte: endOfMonth },
          application: {
            student: { institutionId: { in: institutionIds }, user: { active: true } },
            startDate: { lte: effectiveDate },
          },
        },
        select: {
          application: { select: { student: { select: { institutionId: true } } } },
        },
      }).then((results) => {
        const instCounts = new Map<string, number>();
        for (const visit of results) {
          const instId = visit.application.student.institutionId;
          instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
        }
        return instCounts;
      }),

      // 7. Monthly reports submitted this month per institution (count reports, not unique students - matches getInstitutionOverview)
      // With auto-approval, all submitted reports are APPROVED
      this.prisma.monthlyReport.findMany({
        where: {
          isDeleted: false,
          student: { institutionId: { in: institutionIds }, user: { active: true } },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'APPROVED',
        },
        select: {
          student: { select: { institutionId: true } },
        },
      }).then((results) => {
        const instCounts = new Map<string, number>();
        for (const report of results) {
          const instId = report.student.institutionId;
          instCounts.set(instId, (instCounts.get(instId) || 0) + 1);
        }
        return instCounts;
      }),

      // 8. Total faculty per institution
      this.prisma.user.groupBy({
        by: ['institutionId'],
        where: {
          institutionId: { in: institutionIds },
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
        _count: true,
      }),

      // 9. Internships in their training period during the filter month per institution (with dates for monthly cycle calculation, active applications)
      // For past month filters: startDate <= endOfMonth AND (endDate >= startOfMonth OR endDate is null)
      // For current/future: startDate <= now AND (endDate >= now OR endDate is null)
      // Uses effectiveDate for accurate historical filtering
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId: { in: institutionIds }, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          startDate: { not: null, lte: effectiveDate },
          OR: [
            { endDate: { gte: startOfMonth } },
            { endDate: null },
          ],
        },
        select: {
          student: { select: { institutionId: true } },
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    // Build lookup maps for O(1) access
    const studentCountMap = new Map(studentCounts.map(c => [c.institutionId, c._count]));
    const activeStudentCountMap = new Map(activeStudentCounts.map(c => [c.institutionId, c._count]));
    const facultyCountMap = new Map(facultyCounts.map(c => [c.institutionId, c._count]));

    /**
     * Process internship data for monthly cycle calculations
     * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
     *
     * For each institution, calculate:
     * - internshipsInTraining: count of internships currently in training period
     * - expectedReports: expected reports for the SPECIFIC filtered month
     * - expectedVisits: expected visits for the SPECIFIC filtered month
     *
    * Uses monthly inclusion rules: first >15 days, last any days, middle >10 days.
     * Each qualifying internship expects 1 report and 1 visit for that month.
     * This matches the Principal dashboard calculation logic.
     */
    const internshipsInTrainingCounts = new Map<string, number>();
    const expectedReportsMap = new Map<string, number>();
    const expectedVisitsMap = new Map<string, number>();

    for (const internship of internshipsInTrainingData) {
      const instId = internship.student.institutionId;

      // Count internships per institution
      internshipsInTrainingCounts.set(instId, (internshipsInTrainingCounts.get(instId) || 0) + 1);

      // Calculate expected counts for this internship in the specific filtered month
      // Uses monthly inclusion rules (first >15, last any, middle >10)
      try {
        const startDate = internship.startDate!;
        const endDate = internship.endDate || new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // Default 6 months if no end date

        // Check if this internship has the filtered month as an included month (monthly rules)
        const monthCycle = getMonthCycle(currentYear, currentMonth, startDate, endDate);

        if (monthCycle) {
          // This internship qualifies for the filtered month
          // So it expects 1 report and 1 visit for this month
          expectedReportsMap.set(instId, (expectedReportsMap.get(instId) || 0) + 1);
          expectedVisitsMap.set(instId, (expectedVisitsMap.get(instId) || 0) + 1);
        }
      } catch (error) {
        // Skip internships with invalid dates
        this.logger.warn(`Invalid dates for internship at institution ${instId}: ${error.message}`);
        continue;
      }
    }

    // Build institutions with stats
    const institutionsWithStats = institutions.map((inst) => {
      const totalStudents = studentCountMap.get(inst.id) || 0;
      const activeStudents = activeStudentCountMap.get(inst.id) || 0;
      const studentsWithInternships = internshipCounts.get(inst.id) || 0;
      const selfIdentifiedApproved = approvedInternshipCounts.get(inst.id) || 0;
      const joiningLettersSubmitted = joiningLetterCounts.get(inst.id) || 0;
      const activeAssignments = assignmentCounts.get(inst.id) || 0;
      const facultyVisitsThisMonth = visitCounts.get(inst.id) || 0;
      const reportsSubmittedThisMonth = reportCounts.get(inst.id) || 0;
      const totalFaculty = facultyCountMap.get(inst.id) || 0;
      // Internships currently in training period (for expected reports/visits calculation)
      const internshipsInTraining = internshipsInTrainingCounts.get(inst.id) || 0;

      // Calculate unassigned students (active students - students with mentors)
      const unassignedStudents = Math.max(0, activeStudents - activeAssignments);

      /**
       * Expected reports/visits for the specific filtered month
      * Uses monthly inclusion rules via getMonthCycle
       * Each qualifying internship expects 1 report and 1 visit for the month
       */
      const expectedReportsThisMonth = expectedReportsMap.get(inst.id) || 0;
      const expectedVisitsThisMonth = expectedVisitsMap.get(inst.id) || 0;
      const missingReports = Math.max(0, expectedReportsThisMonth - reportsSubmittedThisMonth);
      const missingVisits = Math.max(0, expectedVisitsThisMonth - facultyVisitsThisMonth);

      // Calculate compliance score using 2-metric formula:
      // Compliance = (MentorRate + JoiningLetterRate) / 2
      // Denominator: activeStudents for both metrics
      // Cap all rates at 100% to prevent impossible percentages
      // Return null when activeStudents = 0 (N/A on frontend)
      const mentorAssignmentRate = activeStudents > 0
        ? Math.min((activeAssignments / activeStudents) * 100, 100)
        : null;
      const joiningLetterRate = activeStudents > 0
        ? Math.min((joiningLettersSubmitted / activeStudents) * 100, 100)
        : null;
      // Monthly report rate calculated separately (NOT included in compliance score)
      // Monthly report rate based on monthly cycle expected reports
      const monthlyReportRate = expectedReportsThisMonth > 0
        ? Math.min((reportsSubmittedThisMonth / expectedReportsThisMonth) * 100, 100)
        : null;
      // Visit completion rate based on monthly cycle expected visits
      const visitCompletionRate = expectedVisitsThisMonth > 0
        ? Math.min((facultyVisitsThisMonth / expectedVisitsThisMonth) * 100, 100)
        : null;
      // Calculate compliance score using only mentor and joining letter rates
      const validRates = [mentorAssignmentRate, joiningLetterRate].filter(r => r !== null) as number[];
      const complianceScore = validRates.length > 0 ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length) : null;

      return {
        ...inst,
        stats: {
          totalStudents,
          activeStudents, // Active students (used for compliance calculations)
          studentsWithInternships,
          internshipsInTraining, // Internships currently in training period
          selfIdentifiedApproved,
          joiningLettersSubmitted,
          assigned: activeAssignments, // Based on activeStudents
          unassigned: unassignedStudents, // Based on activeStudents (activeStudents - assigned)
          facultyVisits: facultyVisitsThisMonth,
          visitsExpected: expectedVisitsThisMonth, // Expected visits based on monthly cycles
          visitsMissing: missingVisits,
          visitCompletionRate,
          reportsSubmitted: reportsSubmittedThisMonth,
          reportsExpected: expectedReportsThisMonth, // Expected reports based on monthly cycles
          reportsMissing: missingReports,
          monthlyReportRate,
          totalFaculty,
          complianceScore,
        },
      };
    });

    return {
      data: institutionsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      month: currentMonth,
      year: currentYear,
    };
  }

  /**
   * Get institution by ID with detailed information
   */
  async getInstitutionById(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: 'PRINCIPAL' },
          take: 10,
        },
        Student: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        batches: {
          where: { isActive: true },
        },
        _count: {
          select: {
            users: true,
            Student: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    return institution;
  }

  /**
   * Get institution overview with detailed statistics including self-identified internships
   */
  async getInstitutionOverview(id: string) {
    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        district: true,
        type: true,
        isActive: true,
        address: true,
        contactEmail: true,
        contactPhone: true,
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }
    const { contactEmail, contactPhone, ...institutionData } = institution;
    const normalizedInstitution = {
      ...institutionData,
      email: contactEmail ?? null,
      phoneNo: contactPhone ?? null,
    };

    // Get current month/year for time-based queries
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);
    const completedThrough = now < endOfMonth ? now : endOfMonth;

    // Use Promise.all for parallel queries
    const [
      totalStudents,
      activeStudents,
      assignedStudents,
      internshipsAdded,
      internshipsActive,
      // Self-identified internship stats
      selfIdentifiedTotal,
      selfIdentifiedApproved,
      selfIdentifiedPending,
      selfIdentifiedRejected,
      // Internships currently in training period
      internshipsInTraining,
      // Joining letter stats
      joiningLettersSubmitted,
      joiningLettersPending,
      joiningLettersApproved,
      joiningLettersRejected,
      // Monthly reports stats
      monthlyReportsSubmitted,
      monthlyReportsPending,
      monthlyReportsApproved,
      monthlyReportsRejected,
      monthlyReportsNotSubmitted,
      // Faculty visits
      facultyVisitsScheduled,
      facultyVisitsCompleted,
      facultyVisitsToBeDone,
      // Branch-wise data
      branchWiseStudents,
      // Company count
      companiesCount,
      // Faculty count
      facultyCount,
      // External mentors
      externalMentorsCount,
      studentsWithExternalMentors,
    ] = await Promise.all([
      // Total students
      this.prisma.student.count({ where: { institutionId: id } }),

      // Active students (user.active = true) - used for compliance calculation
      this.prisma.student.count({ where: { institutionId: id, user: { active: true } } }),

      // Assigned students (unique ACTIVE students with active mentor assignment)
      // Only count active students for consistency with dashboard calculations
      this.prisma.mentorAssignment.findMany({
        where: {
          student: {
            institutionId: id,
            user: { active: true }, // Only count active students
          },
          isActive: true,
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then(results => results.length),

      // Internships added by institution (industry portal removed)
      Promise.resolve(0),

      // Active internships (industry portal removed)
      Promise.resolve(0),

      // Self-identified internship total (active students with active users, active applications only)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
        },
      }),

      // Self-identified approved
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
        },
      }),

      // Self-identified pending
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPLIED,
        },
      }),

      // Self-identified rejected
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.REJECTED,
        },
      }),

      // Internships currently in training period (active applications only)
      // Include: startDate is NULL (assumed active) OR (startDate <= now AND (endDate >= now OR endDate IS NULL))
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          OR: [
            // No startDate set - treat as active (legacy data)
            { startDate: null },
            // Has startDate and is currently in training
            {
              startDate: { lte: now },
              OR: [
                { endDate: { gte: now } },
                { endDate: null },
              ],
            },
          ],
        },
      }),

      // Joining letters submitted (self-identified APPROVED with joining letter, active applications)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          joiningLetterUrl: { not: null },
        },
      }),

      // Joining letters pending (approved self-identified without joining letter, active applications)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          joiningLetterUrl: null,
        },
      }),

      // Joining letters approved (with verified status, active applications)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          joiningLetterUrl: { not: null },
          joiningDate: { not: null },
        },
      }),

      // Joining letters rejected (active applications)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          joiningLetterUrl: { not: null },
          joiningDate: null,
          reviewedAt: { not: null },
        },
      }),

      // Monthly reports submitted for current month
      // Include students with active internships where startDate is NULL or in training period
      this.prisma.monthlyReport.count({
        where: {
          isDeleted: false,
          student: {
            institutionId: id,
            user: { active: true },
            internshipApplications: {
              some: {
                isSelfIdentified: true,
                isActive: true,
                status: ApplicationStatus.APPROVED,
                OR: [
                  { startDate: null },
                  {
                    startDate: { lte: now },
                    OR: [{ endDate: { gte: now } }, { endDate: null }],
                  },
                ],
              },
            },
          },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'APPROVED', // Auto-approval: all submitted reports are APPROVED
        },
      }),

      // Monthly reports pending (draft) for current month
      // Include students with active internships where startDate is NULL or in training period
      this.prisma.monthlyReport.count({
        where: {
          isDeleted: false,
          student: {
            institutionId: id,
            user: { active: true },
            internshipApplications: {
              some: {
                isSelfIdentified: true,
                isActive: true,
                status: ApplicationStatus.APPROVED,
                OR: [
                  { startDate: null },
                  {
                    startDate: { lte: now },
                    OR: [{ endDate: { gte: now } }, { endDate: null }],
                  },
                ],
              },
            },
          },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'DRAFT',
        },
      }),

      // Monthly reports approved
      // Include students with active internships where startDate is NULL or in training period
      this.prisma.monthlyReport.count({
        where: {
          isDeleted: false,
          student: {
            institutionId: id,
            user: { active: true },
            internshipApplications: {
              some: {
                isSelfIdentified: true,
                isActive: true,
                status: ApplicationStatus.APPROVED,
                OR: [
                  { startDate: null },
                  {
                    startDate: { lte: now },
                    OR: [{ endDate: { gte: now } }, { endDate: null }],
                  },
                ],
              },
            },
          },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'APPROVED',
        },
      }),

      // Monthly reports rejected
      // Include students with active internships where startDate is NULL or in training period
      this.prisma.monthlyReport.count({
        where: {
          isDeleted: false,
          student: {
            institutionId: id,
            user: { active: true },
            internshipApplications: {
              some: {
                isSelfIdentified: true,
                isActive: true,
                status: ApplicationStatus.APPROVED,
                OR: [
                  { startDate: null },
                  {
                    startDate: { lte: now },
                    OR: [{ endDate: { gte: now } }, { endDate: null }],
                  },
                ],
              },
            },
          },
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: 'REJECTED',
        },
      }),

      // Students without monthly report this month (need to calculate after total students)
      // Include students with active internships where startDate is NULL or in training period
      this.prisma.student.count({
        where: {
          institutionId: id,
          user: { active: true },
          monthlyReports: {
            none: {
              reportMonth: currentMonth,
              reportYear: currentYear,
            },
          },
          internshipApplications: {
            some: {
              status: ApplicationStatus.APPROVED,
              isSelfIdentified: true,
              isActive: true,
              OR: [
                { startDate: null },
                {
                  startDate: { lte: now },
                  OR: [{ endDate: { gte: now } }, { endDate: null }],
                },
              ],
            },
          },
        },
      }),

      // Faculty visits scheduled this month
      // Include visits for active internships where startDate is NULL or in training period
      this.prisma.facultyVisitLog.count({
        where: {
          isDeleted: false,
          application: {
            isActive: true,
            student: { institutionId: id, user: { active: true } },
            OR: [
              { startDate: null },
              {
                startDate: { lte: now },
                OR: [{ endDate: { gte: now } }, { endDate: null }],
              },
            ],
          },
          visitDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),

      // Faculty visits completed this month
      // Include visits for active internships where startDate is NULL or in training period
      this.prisma.facultyVisitLog.count({
        where: {
          isDeleted: false,
          application: {
            isActive: true,
            student: { institutionId: id, user: { active: true } },
            OR: [
              { startDate: null },
              {
                startDate: { lte: now },
                OR: [{ endDate: { gte: now } }, { endDate: null }],
              },
            ],
          },
          visitDate: {
            gte: startOfMonth,
            lte: completedThrough,
          },
        },
      }),

      // Faculty visits to be done (scheduled but not completed)
      // Include visits for active internships where startDate is NULL or in training period
      this.prisma.facultyVisitLog.count({
        where: {
          isDeleted: false,
          application: {
            isActive: true,
            student: { institutionId: id, user: { active: true } },
            OR: [
              { startDate: null },
              {
                startDate: { lte: now },
                OR: [{ endDate: { gte: now } }, { endDate: null }],
              },
            ],
          },
          visitDate: {
            gt: now,
            lte: endOfMonth,
          },
        },
      }),

      // Branch-wise student distribution (active students with active users)
      // branchName is now on User model, so we need to fetch and group manually
      this.prisma.student.findMany({
        where: { institutionId: id, user: { active: true } },
        select: { user: { select: { branchName: true } } },
      }).then(results => {
        const branchCounts = new Map<string, number>();
        for (const r of results) {
          const branch = r.user?.branchName || 'Unknown';
          branchCounts.set(branch, (branchCounts.get(branch) || 0) + 1);
        }
        return Array.from(branchCounts.entries()).map(([branchName, count]) => ({
          branchName,
          _count: { id: count },
        }));
      }),

      // Companies linked to institution (self-identified only)
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId: id, user: { active: true } },
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          companyName: { not: null },
        },
        select: { companyName: true },
        distinct: ['companyName'],
      }).then(results => results.filter(r => r.companyName).length),

      // Faculty count
      this.prisma.user.count({
        where: {
          institutionId: id,
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
      }),

      // External mentors count (mentors from other institutions assigned to this institution's active students)
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId: id, user: { active: true } },
          isActive: true,
          mentor: {
            institutionId: { not: id },
          },
        },
        select: { mentorId: true },
        distinct: ['mentorId'],
      }).then(results => results.length),

      // Active students with external mentors (students assigned to mentors from other institutions)
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId: id, user: { active: true } },
          isActive: true,
          mentor: {
            institutionId: { not: id },
          },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then(results => results.length),
    ]);

    // Calculate unassigned students (active students - students with mentors)
    const unassignedStudents = Math.max(0, activeStudents - assignedStudents);

    // Calculate compliance score using 2-metric formula:
    // Compliance = (MentorRate + JoiningLetterRate) / 2
    // Denominator: activeStudents for both metrics
    // Cap all rates at 100% to prevent impossible percentages
    // Return null when activeStudents = 0 (N/A on frontend)
    const mentorAssignmentRate = activeStudents > 0
      ? Math.min((assignedStudents / activeStudents) * 100, 100)
      : null;
    const joiningLetterRate = activeStudents > 0
      ? Math.min((joiningLettersSubmitted / activeStudents) * 100, 100)
      : null;
    // Monthly report rate calculated separately (NOT included in compliance score)
    const monthlyReportRate = internshipsInTraining > 0
      ? Math.min(((monthlyReportsSubmitted + monthlyReportsApproved) / internshipsInTraining) * 100, 100)
      : null;
    // Calculate compliance score using only mentor and joining letter rates
    const validRates = [mentorAssignmentRate, joiningLetterRate].filter(r => r !== null) as number[];
    const complianceScore = validRates.length > 0 ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length) : null;

    return {
      institution: normalizedInstitution,
      totalStudents,
      activeStudents,
      assignedStudents,
      unassignedStudents,
      internshipsAdded,
      internshipsActive,
      // Self-identified internship comprehensive data
      selfIdentifiedInternships: {
        total: selfIdentifiedTotal,
        approved: selfIdentifiedApproved,
        pending: selfIdentifiedPending,
        rejected: selfIdentifiedRejected,
        // Show % of students with approved internships, not % of all students
        rate: activeStudents > 0 ? Math.round((selfIdentifiedApproved / activeStudents) * 100) : 0,
      },
      joiningLetterStatus: {
        submitted: joiningLettersSubmitted,
        pending: joiningLettersPending,
        approved: joiningLettersApproved,
        rejected: joiningLettersRejected,
        // Rate uses activeStudents as denominator (per compliance formula)
        rate: activeStudents > 0 ? Math.min(Math.round((joiningLettersSubmitted / activeStudents) * 100), 100) : null,
      },
      monthlyReportStatus: {
        submitted: monthlyReportsSubmitted,
        pending: monthlyReportsPending,
        approved: monthlyReportsApproved,
        rejected: monthlyReportsRejected,
        notSubmitted: monthlyReportsNotSubmitted,
        // Rate is tracked separately (NOT included in compliance score)
        rate: monthlyReportRate !== null ? Math.round(monthlyReportRate) : null,
        currentMonth: currentMonth,
        currentYear: currentYear,
      },
      facultyVisits: {
        scheduled: facultyVisitsScheduled,
        completed: facultyVisitsCompleted,
        toBeDone: facultyVisitsToBeDone,
        completionRate: facultyVisitsScheduled > 0 ? Math.round((facultyVisitsCompleted / facultyVisitsScheduled) * 100) : 0,
      },
      mentorAssignment: {
        assigned: assignedStudents,
        unassigned: unassignedStudents,
        // Rate uses activeStudents as denominator (per compliance formula)
        rate: mentorAssignmentRate,
        // External mentors (from other institutions)
        externalMentors: externalMentorsCount,
        studentsWithExternalMentors: studentsWithExternalMentors,
      },
      branchWiseData: branchWiseStudents.map(b => ({
        branch: b.branchName || 'Unknown',
        count: b._count.id,
      })),
      companiesCount,
      facultyCount,
      complianceScore,
    };
  }

  /**
   * Get institution students with cursor pagination and comprehensive filters
   */
  async getInstitutionStudents(
    id: string,
    params: {
      cursor?: string;
      limit: number;
      search?: string;
      filter: 'assigned' | 'unassigned' | 'all';
      branch?: string;
      companyId?: string;
      reportStatus?: 'submitted' | 'pending' | 'not_submitted' | 'all';
      visitStatus?: 'visited' | 'pending' | 'all';
      selfIdentified?: 'yes' | 'no' | 'all';
      status?: 'active' | 'inactive' | 'all';
    },
  ) {
    const { cursor, limit, search, filter, branch, companyId, reportStatus, visitStatus, selfIdentified, status } = params;

    // Verify institution exists
    const institution = await this.prisma.institution.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    // Get current month/year for report filtering
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Build where clause
    const where: Prisma.StudentWhereInput = { institutionId: id };

    // Build user filter conditions - these will be combined with AND
    const userAndConditions: Prisma.UserWhereInput[] = [];

    // Apply search filter - now search user fields
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { rollNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Apply assignment filter
    if (filter === 'assigned') {
      where.mentorAssignments = {
        some: { isActive: true },
      };
    } else if (filter === 'unassigned') {
      where.mentorAssignments = {
        none: { isActive: true },
      };
    }

    // Apply branch filter - now on User model
    if (branch && branch !== 'all') {
      userAndConditions.push({ branchName: branch });
    }

    // Apply status filter (active/inactive) - now on User model
    if (status === 'active') {
      userAndConditions.push({ active: true });
    } else if (status === 'inactive') {
      userAndConditions.push({ active: false });
    }

    // Combine user conditions if any
    if (userAndConditions.length > 0) {
      where.user = userAndConditions.length === 1
        ? userAndConditions[0]
        : { AND: userAndConditions };
    }

    // Apply company filter
    // Industry/company portal removed: ignore legacy companyId filter

    // Apply self-identified filter
    if (selfIdentified === 'yes') {
      where.internshipApplications = {
        ...where.internshipApplications,
        some: {
          ...(where.internshipApplications as any)?.some,
          isSelfIdentified: true,
        },
      };
    } else if (selfIdentified === 'no') {
      where.internshipApplications = {
        none: {
          isSelfIdentified: true,
        },
      };
    }

    // Apply report status filter
    // With auto-approval, all submitted reports are APPROVED
    if (reportStatus && reportStatus !== 'all') {
      if (reportStatus === 'submitted') {
        where.monthlyReports = {
          some: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: 'APPROVED',
          },
        };
      } else if (reportStatus === 'pending') {
        where.monthlyReports = {
          some: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: 'DRAFT',
          },
        };
      } else if (reportStatus === 'not_submitted') {
        where.monthlyReports = {
          none: {
            reportMonth: currentMonth,
            reportYear: currentYear,
          },
        };
      }
    }

    // Build query with proper typing for cursor pagination
    const query: Prisma.StudentFindManyArgs = {
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            rollNumber: true,
            phoneNo: true,
            branchName: true,
            active: true,
          },
        },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNo: true,
                institutionId: true,
                Institution: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        internshipApplications: {
          where: {
            isActive: true,
            OR: [
              { status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED, ApplicationStatus.JOINED] } },
              { isSelfIdentified: true },
            ],
          },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: {
            id: true,
            status: true,
            isSelfIdentified: true,
            // Self-identified company fields
            companyName: true,
            companyAddress: true,
            companyContact: true,
            companyEmail: true,
            hrName: true,
            jobProfile: true,
            stipend: true,
            internshipDuration: true,
            startDate: true,
            endDate: true,
            joiningLetterUrl: true,
            joiningDate: true,
            reviewedAt: true,
            internshipPhase: true,
            facultyVisitLogs: {
              orderBy: { visitDate: 'desc' as const },
              take: 1,
              select: {
                id: true,
                visitDate: true,
              },
            },
          },
        },
        monthlyReports: {
          where: {
            reportMonth: currentMonth,
            reportYear: currentYear,
          },
          orderBy: { submittedAt: 'desc' as const },
          take: 1,
          select: {
            id: true,
            status: true,
            submittedAt: true,
            reportMonth: true,
            reportYear: true,
          },
        },
      },
    };

    // Apply cursor pagination
    if (cursor) {
      query.cursor = { id: cursor };
      query.skip = 1;
    }

    // Execute queries in parallel
    const [students, total, branches] = await Promise.all([
      this.prisma.student.findMany(query),
      this.prisma.student.count({ where }),
      // Get unique branches for filter dropdown - now on User model
      this.prisma.student.findMany({
        where: { institutionId: id },
        select: { user: { select: { branchName: true } } },
      }).then(results => {
        const uniqueBranches = new Set(results.map(r => r.user?.branchName).filter(Boolean));
        return Array.from(uniqueBranches).map(branchName => ({ branchName }));
      }),
    ]);

    // Transform students to include computed fields
    const resolveJoiningLetterStatus = (app: any) => {
      if (!app?.joiningLetterUrl) {
        return null;
      }
      if (app.joiningDate || [InternshipPhase.ACTIVE, InternshipPhase.COMPLETED].includes(app.internshipPhase)) {
        return 'APPROVED';
      }
      if (app.reviewedAt) {
        return 'REJECTED';
      }
      return 'PENDING';
    };

    const transformedStudents = students.map((student: any) => {
      const latestApp = student.internshipApplications?.[0];
      const selfIdentifiedApp = latestApp?.isSelfIdentified ? latestApp : null;
      const latestReport = student.monthlyReports?.[0];
      const latestVisit = latestApp?.facultyVisitLogs?.[0];
      const activeAssignment = student.mentorAssignments?.find((ma: any) => ma.isActive);
      const activeMentor = activeAssignment?.mentor;
      // Check if mentor is from a different institution than the student
      const isCrossInstitution = activeMentor ? activeMentor.institutionId !== id : false;

      // Get company info - prioritize self-identified, then approved internship
      let company = null;
      if (selfIdentifiedApp) {
        company = {
          companyName: selfIdentifiedApp.companyName,
          companyAddress: selfIdentifiedApp.companyAddress,
          companyContact: selfIdentifiedApp.companyContact,
          companyEmail: selfIdentifiedApp.companyEmail,
          jobProfile: selfIdentifiedApp.jobProfile,
          stipend: selfIdentifiedApp.stipend,
          duration: selfIdentifiedApp.internshipDuration,
          isSelfIdentified: true,
        };
      }

      return {
        ...student,
        // Computed fields for easy access
        hasSelfIdentifiedInternship: !!selfIdentifiedApp,
        selfIdentifiedData: selfIdentifiedApp ? {
          id: selfIdentifiedApp.id,
          companyName: selfIdentifiedApp.companyName,
          companyAddress: selfIdentifiedApp.companyAddress,
          companyContact: selfIdentifiedApp.companyContact,
          companyEmail: selfIdentifiedApp.companyEmail,
          hrName: selfIdentifiedApp.hrName,
          jobProfile: selfIdentifiedApp.jobProfile,
          stipend: selfIdentifiedApp.stipend,
          duration: selfIdentifiedApp.internshipDuration,
          startDate: selfIdentifiedApp.startDate,
          endDate: selfIdentifiedApp.endDate,
          joiningLetterUrl: selfIdentifiedApp.joiningLetterUrl,
          joiningLetterStatus: resolveJoiningLetterStatus(selfIdentifiedApp),
          status: selfIdentifiedApp.status,
        } : null,
        currentMonthReport: latestReport ? {
          id: latestReport.id,
          status: latestReport.status,
          submittedAt: latestReport.submittedAt,
        } : null,
        lastFacultyVisit: latestVisit ? {
          id: latestVisit.id,
          date: latestVisit.visitDate,
          status: latestVisit.visitDate.getTime() <= now.getTime() ? 'COMPLETED' : 'SCHEDULED',
        } : null,
        mentor: activeMentor || null,
        isCrossInstitutionMentor: isCrossInstitution,
        company,
      };
    });

    // Calculate next cursor
    const hasMore = students.length === limit;
    const nextCursor = hasMore ? students[students.length - 1].id : null;

    return {
      students: transformedStudents,
      nextCursor,
      total,
      hasMore,
      filters: {
        branches: branches.map((b: any) => b.branchName).filter(Boolean),
      },
    };
  }

  /**
   * Get institution companies with student counts, branch-wise data, and self-identified info
   * OPTIMIZED: Self-identified companies only (industry portal removed)
   */
  async getInstitutionCompanies(id: string, params: { limit: number; search?: string }) {
    const { limit, search } = params;

    // Helper to resolve joining letter status
    const resolveJoiningLetterStatus = (app: any) => {
      if (!app?.joiningLetterUrl) return null;
      if (app.joiningDate || [InternshipPhase.ACTIVE, InternshipPhase.COMPLETED].includes(app.internshipPhase)) return 'APPROVED';
      if (app.reviewedAt) return 'REJECTED';
      return 'PENDING';
    };

    // Get self-identified applications (active applications only)
    const selfIdWhere: Prisma.InternshipApplicationWhereInput = {
      isSelfIdentified: true,
      isActive: true,
      status: ApplicationStatus.APPROVED,
      student: { institutionId: id, user: { active: true } },
    };
    if (search) {
      selfIdWhere.companyName = { contains: search, mode: 'insensitive' };
    }

    const selfIdentifiedApps = await this.prisma.internshipApplication.findMany({
      where: selfIdWhere,
      take: limit,
      select: {
        id: true,
        isSelfIdentified: true,
        internshipPhase: true,
        companyName: true,
        companyAddress: true,
        companyContact: true,
        companyEmail: true,
        jobProfile: true,
        stipend: true,
        status: true,
        joiningLetterUrl: true,
        joiningDate: true,
        reviewedAt: true,
        student: {
          select: { id: true, institutionId: true, user: { select: { name: true, rollNumber: true, branchName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group self-identified applications by company name
    // Normalize key to ensure consistent grouping (lowercase, trim, replace hyphens/spaces)
    const selfIdCompanyMap = new Map<string, any>();
    selfIdentifiedApps.forEach((app) => {
      const companyName = app.companyName || 'Unknown Company';
      const normalizedKey = companyName.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
      if (!selfIdCompanyMap.has(normalizedKey)) {
        selfIdCompanyMap.set(normalizedKey, {
          id: `self-${normalizedKey.replace(/\s+/g, '-')}`,
          companyName,
          companyAddress: app.companyAddress,
          companyContact: app.companyContact,
          companyEmail: app.companyEmail,
          industryType: 'Self-Identified',
          city: null,
          state: null,
          isApproved: true,
          isVerified: false,
          isSelfIdentifiedCompany: true,
          students: [],
          branchWiseData: [],
          applicationCount: 0, // Track total applications (not deduplicated)
        });
      }
      const company = selfIdCompanyMap.get(normalizedKey);

      // Always count the application to match institution overview count
      company.applicationCount++;

      // Avoid duplicate students for the students list
      if (!company.students.find((s: any) => s.id === app.student.id)) {
        company.students.push({
          id: app.student.id,
          name: app.student.user?.name,
          rollNumber: app.student.user?.rollNumber,
          branch: app.student.user?.branchName,
          email: app.student.user?.email,
          isSelfIdentified: true,
          joiningLetterStatus: resolveJoiningLetterStatus(app),
          jobProfile: app.jobProfile,
          stipend: app.stipend,
        });
      }
    });

    // Calculate branch-wise for self-identified companies
    selfIdCompanyMap.forEach((company) => {
      const branchWise: Record<string, { total: number; selfIdentified: number }> = {};
      company.students.forEach((student: any) => {
        const branch = student.branch || 'Unknown';
        if (!branchWise[branch]) branchWise[branch] = { total: 0, selfIdentified: 0 };
        branchWise[branch].total++;
        branchWise[branch].selfIdentified++;
      });
      company.branchWiseData = Object.entries(branchWise).map(([branch, data]) => ({
        branch,
        total: data.total,
        selfIdentified: data.selfIdentified,
      }));
      company.studentCount = company.students.length;
      // Use applicationCount to match institution overview total
      company.selfIdentifiedCount = company.applicationCount || company.students.length;
    });

    // Self-identified companies only
    const selfIdCompanies = Array.from(selfIdCompanyMap.values());
    const filteredCompanies = selfIdCompanies
      .filter(c => c.studentCount > 0)
      .sort((a, b) => b.studentCount - a.studentCount);

    // Calculate summary
    // For self-identified companies, use applicationCount to match institution overview
    const totalStudents = filteredCompanies.reduce((sum, c) => {
      if (c.isSelfIdentifiedCompany) {
        return sum + (c.applicationCount || c.studentCount);
      }
      return sum + c.studentCount;
    }, 0);
    const totalSelfIdentified = filteredCompanies.reduce((sum, c) => {
      if (c.isSelfIdentifiedCompany) {
        return sum + (c.applicationCount || c.selfIdentifiedCount);
      }
      return sum + (c.selfIdentifiedCount || 0);
    }, 0);

    return {
      companies: filteredCompanies,
      total: filteredCompanies.length,
      summary: {
        totalStudents,
        totalSelfIdentified,
        selfIdentifiedRate: totalStudents > 0 ? Math.round((totalSelfIdentified / totalStudents) * 100) : 0,
      },
    };
  }

  /**
   * Get institution faculty and principal with stats
   * OPTIMIZED: Batch queries to avoid N+1 problem
   */
  async getInstitutionFacultyAndPrincipal(id: string) {
    // Get current month for visit stats - compute once
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0);

    // Fetch all users (principal + faculty) in a single query
    const completedThrough = now < endOfMonth ? now : endOfMonth;
    const [allUsers, mentorStats, visitStats, completedVisitStats, reportStats, principalStatsData] = await Promise.all([
      // Get all users at once
      this.prisma.user.findMany({
        where: {
          institutionId: id,
          role: { in: [Role.PRINCIPAL, Role.TEACHER, Role.TEACHER] },
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          role: true,
          branchName: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),

      // Get all active mentor assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          mentor: { institutionId: id },
          isActive: true,
        },
        select: { mentorId: true, studentId: true },
      }),

      // Get faculty visit stats grouped by faculty
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          isDeleted: false,
          faculty: { institutionId: id },
          visitDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _count: { id: true },
      }),

      // Get completed visit stats grouped by faculty
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          isDeleted: false,
          faculty: { institutionId: id },
          visitDate: { gte: startOfMonth, lte: completedThrough },
        },
        _count: { id: true },
      }),

      // Get monthly report review counts grouped by reviewer (only where reviewedBy is not null)
      this.prisma.monthlyReport.groupBy({
        by: ['reviewedBy'],
        where: {
          reviewedBy: { not: null },
          reviewedAt: { gte: startOfMonth, lte: endOfMonth },
          application: { student: { institutionId: id } },
        },
        _count: { id: true },
      }),

      // Get principal stats in one query
      Promise.all([
        this.prisma.student.count({ where: { institutionId: id, user: { active: true } } }),
        this.prisma.user.count({
          where: { institutionId: id, role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] }, active: true },
        }),
        this.prisma.internshipApplication.count({
          where: { student: { institutionId: id, user: { active: true } }, isActive: true, status: ApplicationStatus.APPLIED },
        }),
      ]),
    ]);

    // Return early if no users found (institution doesn't exist or has no users)
    if (allUsers.length === 0) {
      return {
        principal: null,
        faculty: [],
        summary: {
          totalFaculty: 0,
          totalStudentsAssigned: 0,
          totalVisitsScheduled: 0,
          totalVisitsCompleted: 0,
          overallVisitCompletionRate: 0,
        },
      };
    }

    // Create lookup maps for O(1) access
    // Build unique students per mentor map
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of mentorStats) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }
    const mentorCountMap = new Map(
      Array.from(mentorStudentMap.entries()).map(([id, students]) => [id, students.size])
    );

    // Process visit stats into a nested map: facultyId -> { scheduled, completed }
    const visitCountMap = new Map<string, { scheduled: number; completed: number }>();
    visitStats.forEach(v => {
      visitCountMap.set(v.facultyId, { scheduled: v._count.id, completed: 0 });
    });
    completedVisitStats.forEach(v => {
      const entry = visitCountMap.get(v.facultyId) || { scheduled: 0, completed: 0 };
      entry.completed = v._count.id;
      visitCountMap.set(v.facultyId, entry);
    });

    const reportCountMap = new Map(
      reportStats.filter(r => r.reviewedBy).map(r => [r.reviewedBy!, r._count.id])
    );

    // Separate principal and faculty
    const principal = allUsers.find(u => u.role === 'PRINCIPAL') || null;
    const faculty = allUsers.filter(u => u.role !== 'PRINCIPAL');

    // Attach stats to faculty (no additional queries)
    const facultyWithStats = faculty.map(f => {
      const assignedStudents = mentorCountMap.get(f.id) || 0;
      const visits = visitCountMap.get(f.id) || { scheduled: 0, completed: 0 };
      const reportsReviewed = reportCountMap.get(f.id) || 0;

      return {
        ...f,
        stats: {
          assignedStudents,
          visitsScheduled: visits.scheduled,
          visitsCompleted: visits.completed,
          visitsPending: visits.scheduled - visits.completed,
          reportsReviewed,
          visitCompletionRate: visits.scheduled > 0
            ? Math.round((visits.completed / visits.scheduled) * 100)
            : 0,
        },
      };
    });

    // Principal stats
    const principalStats = principal ? {
      totalStudents: principalStatsData[0],
      totalFaculty: principalStatsData[1],
      pendingApprovals: principalStatsData[2],
    } : null;

    // Summary statistics (computed from already fetched data)
    const totalAssigned = facultyWithStats.reduce((sum, f) => sum + f.stats.assignedStudents, 0);
    const totalVisitsCompleted = facultyWithStats.reduce((sum, f) => sum + f.stats.visitsCompleted, 0);
    const totalVisitsScheduled = facultyWithStats.reduce((sum, f) => sum + f.stats.visitsScheduled, 0);

    return {
      principal: principal ? {
        ...principal,
        stats: principalStats,
      } : null,
      faculty: facultyWithStats,
      summary: {
        totalFaculty: faculty.length,
        totalStudentsAssigned: totalAssigned,
        totalVisitsScheduled,
        totalVisitsCompleted,
        overallVisitCompletionRate: totalVisitsScheduled > 0 ? Math.round((totalVisitsCompleted / totalVisitsScheduled) * 100) : 0,
      },
    };
  }

  /**
   * Create a new institution
   */
  async createInstitution(data: Prisma.InstitutionCreateInput, userId?: string) {
    const institution = await this.prisma.institution.create({
      data,
      include: {
        _count: {
          select: {
            users: true,
            Student: true,
          },
        },
      },
    });

    // Audit institution creation
    this.auditService.log({
      action: AuditAction.INSTITUTION_CREATE,
      entityType: 'Institution',
      entityId: institution.id,
      userId: userId || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Institution created: ${institution.name}`,
      category: AuditCategory.SYSTEM_ADMIN,
      severity: AuditSeverity.HIGH,
      newValues: {
        institutionId: institution.id,
        name: institution.name,
        code: institution.code,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'institutions']);
    return institution;
  }

  /**
   * Update institution details
   */
  async updateInstitution(id: string, data: Prisma.InstitutionUpdateInput, userId?: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    const updated = await this.prisma.institution.update({
      where: { id },
      data,
    });

    // Audit institution update
    this.auditService.log({
      action: AuditAction.INSTITUTION_UPDATE,
      entityType: 'Institution',
      entityId: id,
      userId: userId || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Institution updated: ${institution.name}`,
      category: AuditCategory.SYSTEM_ADMIN,
      severity: AuditSeverity.MEDIUM,
      institutionId: id,
      oldValues: { name: institution.name, code: institution.code },
      newValues: data as any,
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'institutions', `institution:${id}`]);
    return updated;
  }

  /**
   * Delete institution (soft delete)
   */
  async deleteInstitution(id: string, userId?: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    const activeStudentsCount = await this.prisma.student.count({
      where: { institutionId: id, user: { active: true } },
    });

    if (activeStudentsCount > 0) {
      throw new BadRequestException(
        `Cannot delete institution with ${activeStudentsCount} active students`,
      );
    }

    const deleted = await this.prisma.institution.update({
      where: { id },
      data: { isActive: false },
    });

    // Audit institution deletion (soft delete)
    this.auditService.log({
      action: AuditAction.INSTITUTION_DELETE,
      entityType: 'Institution',
      entityId: id,
      userId: userId || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Institution deactivated: ${institution.name}`,
      category: AuditCategory.SYSTEM_ADMIN,
      severity: AuditSeverity.HIGH,
      institutionId: id,
      oldValues: { isActive: true },
      newValues: { isActive: false },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'institutions', `institution:${id}`]);
    return deleted;
  }
}
