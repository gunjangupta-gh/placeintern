import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, MonthlyReportStatus } from '../../../generated/prisma/client';
import { StateReportService } from '../../../domain/report/state/state-report.service';
import { getMonthCycle } from '../../../common/utils/monthly-cycle.util';

@Injectable()
export class StateReportsService {
  private readonly logger = new Logger(StateReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly stateReportService: StateReportService,
  ) {}

  /**
   * Get institution performance metrics
   * Internship/industry portal removed; placements removed.
   */
  async getInstitutionPerformance(institutionId: string, params: { fromDate?: Date; toDate?: Date }) {
    const { fromDate, toDate } = params;

    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found`);
    }

    // Placement feature removed from schema; keep response shape stable.
    const placementStats = {
      overview: {
        totalStudents: 0,
        placedStudents: 0,
        totalPlacements: 0,
        placementRate: 0,
        averageSalary: 0,
        highestSalary: 0,
      },
      statusBreakdown: {},
      topCompanies: [],
      branchWiseStats: [],
    };

    const dateFilter: Prisma.InternshipApplicationWhereInput = {
      student: { institutionId, user: { active: true } },
      isSelfIdentified: true,
    };

    if (fromDate || toDate) {
      dateFilter.createdAt = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }

    const [totalStudents, totalApplications, approvedApplications, completedApplications, facultyVisits, monthlyReports] = await Promise.all([
      this.prisma.student.count({ where: { institutionId, user: { active: true } } }),
      this.prisma.internshipApplication.count({ where: dateFilter }),
      this.prisma.internshipApplication.count({ where: { ...dateFilter, status: ApplicationStatus.APPROVED } }),
      this.prisma.internshipApplication.count({ where: { ...dateFilter, status: ApplicationStatus.COMPLETED } }),
      this.prisma.facultyVisitLog.count({
        where: { isDeleted: false, application: { student: { institutionId, user: { active: true } } } },
      }),
      this.prisma.monthlyReport.count({
        where: { isDeleted: false, student: { institutionId, user: { active: true } } },
      }),
    ]);

    const approvalRate = totalApplications > 0
      ? ((approvedApplications / totalApplications) * 100).toFixed(2)
      : '0';
    const completionRate = approvedApplications > 0
      ? ((completedApplications / approvedApplications) * 100).toFixed(2)
      : '0';

    return {
      institution: {
        id: institution.id,
        name: institution.name,
        code: institution.code,
      },
      metrics: {
        totalStudents,
        totalApplications,
        approvedApplications,
        completedApplications,
        // Internship model removed; approximate with approved self-identified applications
        totalInternships: approvedApplications,
        approvalRate: Number(approvalRate),
        completionRate: Number(completionRate),
      },
      compliance: {
        facultyVisits,
        monthlyReports,
        averageVisitsPerApplication: approvedApplications > 0
          ? (facultyVisits / approvedApplications).toFixed(2)
          : 0,
      },
      placements: placementStats,
    };
  }

  /**
   * Get monthly report statistics
   * Uses domain service for detailed stats
   */
  async getMonthlyReportStats(params: { institutionId?: string; month?: number; year?: number }) {
    const { institutionId, month, year } = params;
    const targetMonth = month ?? new Date().getMonth() + 1;
    const targetYear = year ?? new Date().getFullYear();

    const domainStats = await this.stateReportService.getMonthlyReportStats(targetMonth, targetYear);

    if (institutionId) {
      const where: Prisma.MonthlyReportWhereInput = {
        isDeleted: false,
        student: { institutionId, user: { active: true } },
        reportMonth: targetMonth,
        reportYear: targetYear,
      };

      const [total, draft, submitted, approved, rejected] = await Promise.all([
        this.prisma.monthlyReport.count({ where }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'DRAFT' as any } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'SUBMITTED' as any } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'APPROVED' as any } }),
        this.prisma.monthlyReport.count({ where: { ...where, status: 'REJECTED' as any } }),
      ]);

      return {
        institutionId,
        ...domainStats,
        institutionStats: {
          total,
          byStatus: { draft, submitted, approved, rejected },
          submissionRate: total > 0 ? (((submitted + approved) / total) * 100).toFixed(2) : 0,
        },
      };
    }

    return domainStats;
  }

  /**
   * Get institution reports
   * OPTIMIZED: Added pagination with default limit of 100
   */
  async getInstitutionReports(params: {
    fromDate?: string;
    toDate?: string;
    reportType?: string;
    page?: number;
    limit?: number;
  }) {
    const { fromDate, toDate, page = 1, limit = 100 } = params;
    const skip = (page - 1) * limit;
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    const createdAtFilter = (from || to)
      ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : undefined;

    const [institutions, total] = await Promise.all([
      this.prisma.institution.findMany({
        where: createdAtFilter,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              Student: true,
            },
          },
        },
      }),
      this.prisma.institution.count({ where: createdAtFilter }),
    ]);

    const data = institutions.map((inst) => ({
      ...(inst as any),
      _count: {
        ...(inst as any)._count,
        internships: 0,
        industries: 0,
        placements: 0,
      },
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get system-wide audit logs
   */
  async getAuditLogs(params: {
    institutionId?: string;
    userId?: string;
    action?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { institutionId, userId, action, fromDate, toDate, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {};

    if (institutionId) where.institutionId = institutionId;
    if (userId) where.userId = userId;
    if (action) where.action = action as any;

    if (fromDate || toDate) {
      where.timestamp = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
          Institution: { select: { id: true, name: true, code: true } },
        },
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get faculty visit statistics
   */
  async getFacultyVisitStats(params: {
    institutionId?: string;
    facultyId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { institutionId, facultyId, fromDate, toDate } = params;
    const now = new Date();
    const month = fromDate?.getMonth() ?? now.getMonth() + 1;
    const year = fromDate?.getFullYear() ?? now.getFullYear();

    const baseStats = await this.stateReportService.getFacultyVisitStats(month, year);

    const where: Prisma.FacultyVisitLogWhereInput = {
      isDeleted: false,
      ...(institutionId ? { application: { student: { institutionId, user: { active: true } } } } : {}),
      ...(facultyId ? { facultyId } : {}),
      ...((fromDate || toDate)
        ? { visitDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
        : {}),
    };

    const [totalVisits, physicalVisits, virtualVisits, visitsByFaculty] = await Promise.all([
      this.prisma.facultyVisitLog.count({ where }),
      this.prisma.facultyVisitLog.count({ where: { ...where, visitType: 'PHYSICAL' as any } }),
      this.prisma.facultyVisitLog.count({ where: { ...where, visitType: 'VIRTUAL' as any } }),
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where,
        _count: true,
      }),
    ]);

    return {
      ...baseStats,
      filtered: {
        total: totalVisits,
        byType: { physical: physicalVisits, virtual: virtualVisits },
        byFaculty: visitsByFaculty.map((v) => ({ facultyId: v.facultyId, count: v._count })),
      },
    };
  }

  /**
   * Top performers - institutions ranked by compliance metrics
   * Uses monthly cycle rules to calculate expected reports/visits (same as InstitutionPerformance)
   */
  async getTopPerformers(params: { limit?: number; month?: number; year?: number }) {
    const { limit = 5, month, year } = params;
    const now = new Date();
    const targetMonth = month ?? (now.getMonth() + 1);
    const targetYear = year ?? now.getFullYear();
    const cacheKey = `state:top-performers:${limit}:${targetMonth}:${targetYear}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        // For queries that check if internship is in training period during the filter month,
        // use effectiveDate: end of filter month for past months, now for current month
        const currentMonthNow = now.getMonth() + 1;
        const currentYearNow = now.getFullYear();
        const isFilteringPastMonth = month && year &&
          (year < currentYearNow || (year === currentYearNow && month < currentMonthNow));
        const effectiveDate = isFilteringPastMonth ? endOfMonth : now;

        // Get all active institutions
        const institutions = await this.prisma.institution.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            code: true,
          },
        });

        const institutionIds = institutions.map(i => i.id);

        // Batch queries for efficiency
        const [
          reportCounts,
          visitCounts,
          internshipsInTrainingData,
        ] = await Promise.all([
          // Reports submitted this month per institution
          this.prisma.monthlyReport.findMany({
            where: {
              isDeleted: false,
              reportMonth: targetMonth,
              reportYear: targetYear,
              status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
              student: { institutionId: { in: institutionIds }, user: { active: true } },
            },
            select: {
              student: { select: { institutionId: true } },
            },
          }),

          // Visits completed this month per institution (only COMPLETED visits)
          this.prisma.facultyVisitLog.findMany({
            where: {
              isDeleted: false,
              visitDate: { gte: startOfMonth, lte: endOfMonth },
              status: 'COMPLETED',
              application: {
                student: { institutionId: { in: institutionIds }, user: { active: true } },
                startDate: { lte: effectiveDate },
              },
            },
            select: {
              application: { select: { student: { select: { institutionId: true } } } },
            },
          }),

          // Internships in their training period during the filter month (with dates for monthly cycle calculation)
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

        // Build lookup maps
        const reportsByInstitution = new Map<string, number>();
        for (const report of reportCounts) {
          const instId = report.student.institutionId;
          reportsByInstitution.set(instId, (reportsByInstitution.get(instId) || 0) + 1);
        }

        const visitsByInstitution = new Map<string, number>();
        for (const visit of visitCounts) {
          const instId = visit.application.student.institutionId;
          visitsByInstitution.set(instId, (visitsByInstitution.get(instId) || 0) + 1);
        }

        // Calculate expected reports/visits using monthly cycle rules
        // Uses monthly inclusion rules: first >15 days, last any days, middle >10 days
        const expectedReportsMap = new Map<string, number>();
        const expectedVisitsMap = new Map<string, number>();
        const internshipsCountMap = new Map<string, number>();

        for (const internship of internshipsInTrainingData) {
          const instId = internship.student.institutionId;
          internshipsCountMap.set(instId, (internshipsCountMap.get(instId) || 0) + 1);

          try {
            const startDate = internship.startDate!;
            const endDate = internship.endDate || new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

            // Check if this internship qualifies for the filtered month using monthly cycle rules
            const monthCycle = getMonthCycle(targetYear, targetMonth, startDate, endDate);

            if (monthCycle) {
              // This internship qualifies - expects 1 visit for this month
              expectedVisitsMap.set(instId, (expectedVisitsMap.get(instId) || 0) + 1);
              // Reports are not expected in January
              if (targetMonth !== 1) {
                expectedReportsMap.set(instId, (expectedReportsMap.get(instId) || 0) + 1);
              }
            }
          } catch (error) {
            // Skip internships with invalid dates
            continue;
          }
        }

        // Calculate performance for each institution
        const performanceData = institutions.map(inst => {
          const reportsSubmitted = reportsByInstitution.get(inst.id) || 0;
          const facultyVisits = visitsByInstitution.get(inst.id) || 0;
          const reportsExpected = expectedReportsMap.get(inst.id) || 0;
          const visitsExpected = expectedVisitsMap.get(inst.id) || 0;
          const internshipsInTraining = internshipsCountMap.get(inst.id) || 0;

          // Calculate rates capped at 100%
          const monthlyReportRate = reportsExpected > 0
            ? Math.min(Math.round((reportsSubmitted / reportsExpected) * 100), 100)
            : null;
          const visitCompletionRate = visitsExpected > 0
            ? Math.min(Math.round((facultyVisits / visitsExpected) * 100), 100)
            : null;

          // Overall score (average of reports and visits rates) - only include valid rates
          const validRates = [monthlyReportRate, visitCompletionRate].filter(r => r !== null) as number[];
          const score = validRates.length > 0
            ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length)
            : 0;

          return {
            id: inst.id,
            institutionId: inst.id,
            name: inst.name,
            institutionName: inst.name,
            code: inst.code,
            score,
            stats: {
              internshipsInTraining,
              reportsSubmitted,
              reportsExpected,
              facultyVisits,
              visitsExpected,
              monthlyReportRate,
              visitCompletionRate,
            },
          };
        });

        // Filter out institutions with no expected compliance (no qualifying internships)
        const activeInstitutions = performanceData.filter(
          p => p.stats.reportsExpected > 0 || p.stats.visitsExpected > 0
        );

        // Sort by compliance score descending for top performers
        const sortedByScore = [...activeInstitutions].sort((a, b) => b.score - a.score);

        // Get top performers (highest scores)
        const topPerformers = sortedByScore.slice(0, limit);

        // Get bottom performers (lowest scores)
        const bottomPerformers = [...sortedByScore].reverse().slice(0, limit);

        return {
          topPerformers,
          bottomPerformers,
        };
      },
      { ttl: 300, tags: ['state', 'top-performers'] },
    );
  }

  async getJoiningLetterStats(params?: { month?: number; year?: number }) {
    // Note: Joining letter stats are cumulative, not month-specific
    // The params are accepted for API consistency but not used
    return this.stateReportService.getJoiningLetterStats();
  }

  async getStateWidePlacementTrends(years: number = 5) {
    const cacheKey = `state:placement:trends:${years}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => [],
      { ttl: 600, tags: ['state', 'placements'] },
    );
  }

  async getStateWidePlacementStats() {
    const cacheKey = 'state:placement:stats';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const totalStudents = await this.prisma.student.count({
          where: { user: { active: true }, Institution: { isActive: true } },
        });

        return {
          overview: {
            totalStudents,
            placedStudents: 0,
            totalPlacements: 0,
            totalSalary: 0,
            averageSalary: 0,
            highestSalary: 0,
            placementRate: '0.00',
          },
          breakdown: {
            status: {},
            topCompanies: [],
            branches: [],
            institutions: [],
          },
        };
      },
      { ttl: 600, tags: ['state', 'placements'] },
    );
  }

  /**
   * Monthly analytics for state dashboard
   * Focused on self-identified internship applications only
   */
  async getMonthlyAnalytics(params: { month?: number; year?: number; institutionId?: string }) {
    const { month, year, institutionId } = params;
    const currentDate = new Date();
    const targetMonth = month ?? currentDate.getMonth() + 1;
    const targetYear = year ?? currentDate.getFullYear();
    const cacheKey = `state:monthly-analytics:${targetYear}:${targetMonth}:${institutionId ?? 'all'}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0);

        const studentFilter: Prisma.StudentWhereInput = {
          user: { active: true },
          Institution: { isActive: true },
          ...(institutionId ? { institutionId } : {}),
        };

        const applicationBaseWhere: Prisma.InternshipApplicationWhereInput = {
          createdAt: { gte: startDate, lte: endDate },
          isSelfIdentified: true,
          student: studentFilter,
        };

        const [newStudents, newApplications, approvedApplications, facultyVisits, monthlyReports] = await Promise.all([
          this.prisma.student.count({
            where: { ...studentFilter, createdAt: { gte: startDate, lte: endDate } },
          }),
          this.prisma.internshipApplication.count({ where: applicationBaseWhere }),
          this.prisma.internshipApplication.count({
            where: { ...applicationBaseWhere, status: ApplicationStatus.APPROVED },
          }),
          this.prisma.facultyVisitLog.count({
            where: {
              isDeleted: false,
              visitDate: { gte: startDate, lte: endDate },
              application: { student: studentFilter },
            },
          }),
          this.prisma.monthlyReport.count({
            where: {
              student: studentFilter,
              reportMonth: targetMonth,
              reportYear: targetYear,
            },
          }),
        ]);

        const trend: Array<{ month: string; applications: number; approved: number; placements: number }> = [];
        for (let i = 5; i >= 0; i--) {
          const trendMonthStart = new Date(targetYear, targetMonth - 1 - i, 1);
          const trendMonthEnd = new Date(trendMonthStart.getFullYear(), trendMonthStart.getMonth() + 1, 0);

          const trendWhere: Prisma.InternshipApplicationWhereInput = {
            createdAt: { gte: trendMonthStart, lte: trendMonthEnd },
            isSelfIdentified: true,
            student: studentFilter,
          };

          const [applications, approved] = await Promise.all([
            this.prisma.internshipApplication.count({ where: trendWhere }),
            this.prisma.internshipApplication.count({
              where: { ...trendWhere, status: ApplicationStatus.APPROVED },
            }),
          ]);

          trend.push({
            month: trendMonthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            applications,
            approved,
            placements: approved,
          });
        }

        return {
          month: targetMonth,
          year: targetYear,
          metrics: {
            newStudents,
            newApplications,
            approvedApplications,
            selectedApplications: approvedApplications,
            newInternships: approvedApplications,
            newIndustries: 0,
            facultyVisits,
            monthlyReports,
            approvalRate: newApplications > 0
              ? ((approvedApplications / newApplications) * 100).toFixed(2)
              : 0,
            placementRate: newApplications > 0
              ? ((approvedApplications / newApplications) * 100).toFixed(2)
              : 0,
          },
          trend,
        };
      },
      { ttl: 300, tags: ['state', 'monthly-analytics'] },
    );
  }
}
