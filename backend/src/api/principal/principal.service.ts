import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, Role, GrievanceStatus, MonthlyReportStatus, AuditAction, AuditCategory, AuditSeverity, InternshipPhase } from '../../generated/prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';
import { UserService } from '../../domain/user/user.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';
import { ExpectedCycleService } from '../../domain/internship/expected-cycle/expected-cycle.service';
import {
  calculateExpectedMonths,
  getTotalExpectedReports,
  getTotalExpectedVisits,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  getExpectedPrincipalFeedbackVisitsAsOfToday,
  getMonthCycle,
  getPrincipalFeedbackDueDates,
  getTotalExpectedPrincipalFeedbackVisits,
  MONTHLY_CYCLE,
} from '../../common/utils/monthly-cycle.util';
import * as bcrypt from 'bcrypt';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';

// Static month names array - toLocaleString is unreliable in Node.js
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class PrincipalService {
  private readonly logger = new Logger(PrincipalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
    private readonly fileStorageService: FileStorageService,
    private readonly expectedCycleService: ExpectedCycleService,
  ) {}

  /**
   * Get Principal Dashboard - Institution-specific statistics
   */
  async getDashboard(principalId: string, forceRefresh = false) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      include: { Institution: true },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;
    const cacheKey = `principal:dashboard:${institutionId}`;

    // Invalidate cache if force refresh is requested
    if (forceRefresh) {
      await this.cache.delete(cacheKey);
    }

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get current month and year for filtering monthly reports
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Calculate current month boundaries for queries
        const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);
        currentMonthStart.setHours(0, 0, 0, 0);
        const currentMonthEnd = new Date(currentYear, currentMonth, 0); // Last day of current month
        currentMonthEnd.setHours(23, 59, 59, 999);

        // Only count self-identified internships (auto-approved on submission)
        const [
          totalStudents,
          activeStudents,
          totalStaff,
          activeStaff,
          totalTeachers,
          totalAdminStaff,
          totalSelfIdentifiedInternships,
          ongoingInternships,
          completedInternships,
          currentMonthReportsSubmitted,
          currentMonthVisitsCompleted,
          currentMonthPrincipalFeedbackCompleted,
          activeApplicationsForCurrentMonth,
          pendingGrievances,
          totalGrievances,
          applicationCounters,
          studentsByBranch,
          joiningLetterApplications,
          partnerCompanyNames,
          unassignedStudentsCount,
        ] = await Promise.all([
          this.prisma.student.count({ where: { institutionId, user: { active: true } } }),
          this.prisma.student.count({ where: { institutionId, user: { active: true } } }),
          // Count all staff (TEACHER, FACULTY_COORDINATOR, ADMIN_STAFF)
          this.prisma.user.count({ where: { institutionId, role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF] } } }),
          this.prisma.user.count({
            where: { institutionId, role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF] }, active: true }
          }),
          // Count mentors (TEACHER + FACULTY_COORDINATOR)
          this.prisma.user.count({
            where: { institutionId, role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] }, active: true }
          }),
          // Count admin staff (using ADMIN_STAFF role)
          this.prisma.user.count({
            where: {
              institutionId,
              active: true,
              role: Role.ADMIN_STAFF,
            }
          }),
          // Count all active self-identified internships
          this.prisma.internshipApplication.count({
            where: { student: { institutionId, user: { active: true } }, isSelfIdentified: true, isActive: true }
          }),
          // Count ongoing self-identified internships (auto-approved, in progress)
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId, user: { active: true } },
              isSelfIdentified: true,
              isActive: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
            }
          }),
          // Count completed self-identified internships
          this.prisma.internshipApplication.count({
            where: {
              student: { institutionId, user: { active: true } },
              isSelfIdentified: true,
              isActive: true,
              internshipPhase: InternshipPhase.COMPLETED,
            }
          }),
          // Count reports SUBMITTED for current month (status: APPROVED means submitted and auto-approved)
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              student: { institutionId, user: { active: true } },
              reportMonth: currentMonth,
              reportYear: currentYear,
              status: { in: ['APPROVED', 'SUBMITTED'] },
            }
          }),
          // Count faculty visits COMPLETED in current month
          this.prisma.facultyVisitLog.count({
            where: {
              isDeleted: false,
              status: 'COMPLETED',
              application: {
                student: { institutionId, user: { active: true } },
                isSelfIdentified: true,
              },
              visitDate: {
                gte: currentMonthStart,
                lte: currentMonthEnd,
              },
            },
          }),
          // Count principal feedback visits COMPLETED in current month
          this.prisma.principalFeedback.count({
            where: {
              isDeleted: false,
              institutionId,
              status: 'COMPLETED',
              visitDate: {
                gte: currentMonthStart,
                lte: currentMonthEnd,
              },
            },
          }),
          // Get ALL active applications - we'll calculate overlap in code for robustness
          // Only filter by isSelfIdentified and exclude rejected/withdrawn
          this.prisma.internshipApplication.findMany({
            where: {
              student: { institutionId, user: { active: true } },
              isSelfIdentified: true,
              isActive: true,
              status: { notIn: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
            },
            select: {
              id: true,
              startDate: true,
              endDate: true,
            },
          }),
          // Pending grievances (PENDING or UNDER_REVIEW)
          this.prisma.grievance.count({
            where: {
              student: { institutionId, user: { active: true } },
              status: { in: ['PENDING', 'UNDER_REVIEW'] },
            }
          }),
          // Total grievances for the institution
          this.prisma.grievance.count({
            where: {
              student: { institutionId, user: { active: true } },
            }
          }),
          // Aggregate counter fields from active internship applications (for cumulative totals)
          // Exclude rejected/withdrawn only
          this.prisma.internshipApplication.aggregate({
            where: {
              student: { institutionId, user: { active: true } },
              isSelfIdentified: true,
              isActive: true,
              status: { notIn: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
            },
            _sum: {
              submittedReportsCount: true,
              totalExpectedReports: true,
              completedVisitsCount: true,
              totalExpectedVisits: true,
            },
          }),
          // Students grouped by branch with internship counts - query students directly
          this.prisma.student.findMany({
            where: { institutionId, user: { active: true } },
            select: {
              id: true,
              branchId: true,
              branch: {
                select: { id: true, name: true },
              },
              user: {
                select: { active: true },
              },
              internshipApplications: {
                where: {
                  isActive: true, // Count students with active internship applications
                },
                select: { id: true },
                take: 1,
              },
            },
          }),
          // Count joining letters uploaded (active internships only)
          this.prisma.internshipApplication.count({
            where: {
              isSelfIdentified: true,
              isActive: true,
              student: { institutionId, user: { active: true } },
              joiningLetterUrl: { not: null, notIn: [''] },
            },
          }),
          // Get unique partner company names
          this.prisma.internshipApplication.findMany({
            where: {
              student: { institutionId, user: { active: true } },
              isSelfIdentified: true,
              isActive: true,
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
              companyName: { not: null, notIn: [''] },
            },
            select: { companyName: true },
            distinct: ['companyName'],
          }),
          // Count students with self-identified internships (approved or active) but no active mentor assignment
          // Uses MentorAssignment table (source of truth) instead of InternshipApplication.mentorId
          // Includes APPROVED/SELECTED/JOINED status and NOT_STARTED/ACTIVE phase
          this.prisma.student.count({
            where: {
              institutionId,
              user: { active: true },
              internshipApplications: {
                some: {
                  isSelfIdentified: true,
                  status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
                  internshipPhase: { in: [InternshipPhase.NOT_STARTED, InternshipPhase.ACTIVE] },
                },
              },
              mentorAssignments: { none: { isActive: true } },
            },
          }),
        ]);

        // Count unique partner companies
        const totalPartnerCompanies = partnerCompanyNames.length;

        // Joining letter stats - simple: total vs uploaded
        const joiningLetterTotal = totalSelfIdentifiedInternships;
        const joiningLetterUploaded = joiningLetterApplications; // This is now the count of uploaded letters
        const pendingJoiningLetters = joiningLetterTotal - joiningLetterUploaded;

        // Completion rate for self-identified internships (auto-approved on submission)
        const completionRate = totalSelfIdentifiedInternships > 0
          ? Math.round((completedInternships / totalSelfIdentifiedInternships) * 100)
          : 0;

        // Format students by branch data - group students by branchId
        const branchMap = new Map<string, {
          branchId: string;
          branchName: string;
          totalStudents: number;
          activeStudents: number;
          withInternship: number;
        }>();

        // Process each student and group by branch
        for (const student of studentsByBranch) {
          const branchKey = student.branchId || 'unassigned';
          const branchName = student.branch?.name || 'Unassigned';

          if (!branchMap.has(branchKey)) {
            branchMap.set(branchKey, {
              branchId: branchKey,
              branchName,
              totalStudents: 0,
              activeStudents: 0,
              withInternship: 0,
            });
          }

          const branchData = branchMap.get(branchKey)!;
          branchData.totalStudents += 1;

          if (student.user?.active) {
            branchData.activeStudents += 1;
          }

          if (student.internshipApplications && student.internshipApplications.length > 0) {
            branchData.withInternship += 1;
          }
        }

        // Convert map to array and sort by branch name (with Unassigned at the end)
        const formattedStudentsByBranch = Array.from(branchMap.values()).sort((a, b) => {
          if (a.branchId === 'unassigned') return 1;
          if (b.branchId === 'unassigned') return -1;
          return a.branchName.localeCompare(b.branchName);
        });

        // Calculate expected counts for current month using monthly inclusion rules
        // First month >15 days, last month any days, middle months >10 days
        let currentMonthExpectedReports = 0;
        let currentMonthExpectedVisits = 0;
        let currentMonthExpectedPrincipalFeedbackVisits = 0;

        for (const app of activeApplicationsForCurrentMonth) {
          try {
            const { startDate, endDate } = app;
            if (!startDate || !endDate) continue;

            // Use monthly inclusion rules for this month
            const monthCycle = getMonthCycle(currentYear, currentMonth, new Date(startDate), new Date(endDate));
            if (monthCycle) {
              // Month is included per monthly rules
              currentMonthExpectedReports++;
              currentMonthExpectedVisits++;
            }

            // Principal feedback cycle: fixed 15-day due slots from configured start date
            const principalFeedbackDueDates = getPrincipalFeedbackDueDates(
              new Date(startDate),
              new Date(endDate),
            );
            currentMonthExpectedPrincipalFeedbackVisits += principalFeedbackDueDates.filter(
              (dueDate) =>
                dueDate >= currentMonthStart && dueDate <= currentMonthEnd,
            ).length;
          } catch {
            // Skip this application if any error
            continue;
          }
        }

        return {
          institution: {
            id: principal.Institution?.id,
            name: principal.Institution?.name,
            code: principal.Institution?.code,
          },
          students: {
            total: totalStudents,
            active: activeStudents,
          },
          staff: {
            total: totalStaff,
            active: activeStaff,
            teachers: totalTeachers,
            adminStaff: totalAdminStaff,
          },
          // Self-identified internships only (auto-approved, no placement-based)
          internships: {
            totalApplications: totalSelfIdentifiedInternships,
            ongoingInternships,
            completedInternships,
            completionRate,
          },
          pending: {
            // Self-identified internships are auto-approved, so no pending approvals
            monthlyReports: Math.max(0, currentMonthExpectedReports - currentMonthReportsSubmitted),
            principalFeedbackVisits: Math.max(
              0,
              currentMonthExpectedPrincipalFeedbackVisits - currentMonthPrincipalFeedbackCompleted,
            ),
            grievances: pendingGrievances,
            joiningLetters: pendingJoiningLetters,
          },
          // Grievances overview
          grievances: {
            total: totalGrievances,
            pending: pendingGrievances,
          },
          // Monthly reports overview - CURRENT MONTH specific data
          // Cards show "Monthly Reports - Jan 2026" so we show current month data
          monthlyReports: {
            submitted: currentMonthReportsSubmitted,
            expected: currentMonthExpectedReports,
            month: currentMonth,
            year: currentYear,
            // Also include cumulative totals for reference
            cumulative: {
              submitted: applicationCounters._sum.submittedReportsCount || 0,
              expected: applicationCounters._sum.totalExpectedReports || 0,
            },
          },
          // Faculty visits overview - CURRENT MONTH specific data
          // Cards show "Faculty Visits - Jan 2026" so we show current month data
          facultyVisits: {
            completed: currentMonthVisitsCompleted,
            expected: currentMonthExpectedVisits,
            month: currentMonth,
            year: currentYear,
            // Also include cumulative totals for reference
            cumulative: {
              completed: applicationCounters._sum.completedVisitsCount || 0,
              expected: applicationCounters._sum.totalExpectedVisits || 0,
            },
          },
          // Principal feedback visits overview - CURRENT MONTH specific data
          principalFeedbackVisits: {
            completed: currentMonthPrincipalFeedbackCompleted,
            expected: currentMonthExpectedPrincipalFeedbackVisits,
            month: currentMonth,
            year: currentYear,
            cycle: {
              startDate: MONTHLY_CYCLE.PRINCIPAL_FEEDBACK_CYCLE_START_DATE,
              intervalDays: MONTHLY_CYCLE.PRINCIPAL_FEEDBACK_INTERVAL_DAYS,
            },
          },
          // Joining letter stats (simple: total vs uploaded)
          joiningLetterStats: {
            total: joiningLetterTotal,
            uploaded: joiningLetterUploaded,
            pending: pendingJoiningLetters,
            uploadRate: joiningLetterTotal > 0 ? Math.round((joiningLetterUploaded / joiningLetterTotal) * 100) : 0,
          },
          // Partner companies count
          partnerCompanies: totalPartnerCompanies,
          // Students grouped by branch/course
          studentsByBranch: formattedStudentsByBranch,
          // Students with active internships but no mentor assigned
          unassignedStudents: unassignedStudentsCount,
        };
      },
      { ttl: 300, tags: ['principal', `institution:${institutionId}`] },
    );
  }

  /**
   * Get dashboard alerts for principal
   */
  async getDashboardAlerts(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;

    const [pendingSelfIdentified, pendingGrievances] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId },
          isSelfIdentified: true,
          status: ApplicationStatus.APPLIED,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true } },
            },
          },
        },
      }),
      this.prisma.grievance.findMany({
        where: {
          student: { institutionId },
          status: 'PENDING',
        },
        take: 5,
        orderBy: { submittedDate: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true } },
            },
          },
        },
      }),
    ]);

    return {
      pendingSelfIdentified,
      upcomingDeadlines: [], // Internship model removed - no deadlines to track
      pendingGrievances,
    };
  }

  /**
   * Get institution details
   */
  async getInstitution(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      include: {
        Institution: {
          include: {
            _count: {
              select: {
                users: true,
                Student: true,
                batches: true,
              },
            },
          },
        },
      },
    });

    if (!principal || !principal.Institution) {
      throw new NotFoundException('Institution not found');
    }

    return principal.Institution;
  }

  /**
   * Get institution branches/departments
   */
  async getBranches(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      select: { institutionId: true },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const branches = await this.prisma.branch.findMany({
      where: { institutionId: principal.institutionId, isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        duration: true,
      },
      orderBy: { name: 'asc' },
    });

    return branches;
  }

  /**
   * Update institution details
   */
  async updateInstitution(principalId: string, updateData: Prisma.InstitutionUpdateInput) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const updated = await this.prisma.institution.update({
      where: { id: principal.institutionId },
      data: updateData,
    });

    await this.cache.invalidateByTags([`institution:${principal.institutionId}`]);

    return updated;
  }

  /**
   * Get student progress with internship and report data
   */
  async getStudentProgress(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    batchId?: string;
    branchId?: string;
    status?: string; // Internship status filter
    mentorId?: string; // Mentor filter
    joiningLetterStatus?: string; // Joining letter filter: 'uploaded', 'pending', 'all'
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, batchId, branchId, status, mentorId, joiningLetterStatus } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      institutionId: principal.institutionId,
      user: { active: true },
    };

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { rollNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (batchId && batchId !== 'all') {
      where.batchId = batchId;
    }

    if (branchId && branchId !== 'all') {
      where.branchId = branchId;
    }

    // Filter by mentor
    if (mentorId && mentorId !== 'all') {
      if (mentorId === 'unassigned') {
        where.mentorAssignments = { none: { isActive: true } };
      } else {
        where.mentorAssignments = { some: { mentorId, isActive: true } };
      }
    }

    // Get students with their internship applications and reports
    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { name: true, rollNumber: true, branchName: true } },
          batch: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          mentorAssignments: {
            where: { isActive: true },
            select: {
              id: true,
              mentor: { select: { id: true, name: true } },
            },
            take: 1,
          },
          internshipApplications: {
            // Get the most recent application for each student (prioritize self-identified and active)
            orderBy: [
              { isSelfIdentified: 'desc' }, // Self-identified first
              { internshipPhase: 'desc' }, // ACTIVE > NOT_STARTED > COMPLETED
              { createdAt: 'desc' }, // Most recent first
            ],
            take: 1,
            select: {
              id: true,
              status: true,
              internshipPhase: true,
              joiningDate: true,
              completionDate: true,
              // Joining letter fields
              joiningLetterUrl: true,
              joiningLetterUploadedAt: true,
              reviewedAt: true,
              reviewRemarks: true,
              // Self-identified internship fields
              isSelfIdentified: true,
              companyName: true,
              companyAddress: true,
              companyContact: true,
              companyEmail: true,
              jobProfile: true,
              stipend: true,
              internshipDuration: true,
              startDate: true,
              endDate: true,
              // Pre-calculated expected values
              totalExpectedReports: true,
              totalExpectedVisits: true,
              facultyMentorName: true,
              facultyMentorEmail: true,
              facultyMentorContact: true,
              facultyMentorDesignation: true,
              monthlyReports: {
                select: {
                  id: true,
                  reportMonth: true,
                  reportYear: true,
                  status: true,
                  submittedAt: true,
                  reportFileUrl: true,
                },
                orderBy: [{ reportYear: 'asc' }, { reportMonth: 'asc' }],
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    // Get application IDs for faculty visits query
    const applicationIds = students
      .map((s) => s.internshipApplications[0]?.id)
      .filter(Boolean) as string[];

    const studentIds = students.map((s) => s.id);

 // Fetch COMPLETED faculty visits for all applications in a single query
    const facultyVisits = applicationIds.length > 0
      ? await this.prisma.facultyVisitLog.findMany({
          where: { applicationId: { in: applicationIds }, isDeleted: false, status: 'COMPLETED' },
          select: {
            applicationId: true,
            visitDate: true,
          },
          orderBy: { visitDate: 'desc' },
        })
      : [];

    const principalFeedbackVisits = studentIds.length > 0
      ? await this.prisma.principalFeedbackStudent.findMany({
          where: {
            studentId: { in: studentIds },
            principalFeedback: {
              isDeleted: false,
              status: 'COMPLETED',
              visitDate: { not: null },
            },
          },
          select: {
            studentId: true,
            principalFeedbackId: true,
            principalFeedback: {
              select: {
                visitDate: true,
              },
            },
          },
          orderBy: {
            principalFeedback: {
              visitDate: 'desc',
            },
          },
        })
      : [];

    // Create a map of applicationId -> { count, lastVisit }
    const facultyVisitsMap = new Map<string, { count: number; lastVisit: Date | null }>();
    for (const visit of facultyVisits) {
      const existing = facultyVisitsMap.get(visit.applicationId);
      if (!existing) {
        facultyVisitsMap.set(visit.applicationId, {
          count: 1,
          lastVisit: visit.visitDate,
        });
      } else {
        existing.count++;
        // lastVisit is already the most recent due to orderBy
      }
    }

    const principalFeedbackMap = new Map<
      string,
      Array<{ principalFeedbackId: string; visitDate: Date }>
    >();

    for (const entry of principalFeedbackVisits) {
      if (!entry.principalFeedback?.visitDate) {
        continue;
      }

      if (!principalFeedbackMap.has(entry.studentId)) {
        principalFeedbackMap.set(entry.studentId, []);
      }

      principalFeedbackMap.get(entry.studentId)!.push({
        principalFeedbackId: entry.principalFeedbackId,
        visitDate: entry.principalFeedback.visitDate,
      });
    }

    // Transform data for frontend
    const progressData = students.map((student) => {
      const application = student.internshipApplications[0];
      const mentor = student.mentorAssignments[0]?.mentor;
      const reports = application?.monthlyReports || [];

      /**
       * Get expected reports and visits - prefer stored values, fallback to calculation
       * Uses utility functions for accurate "as of now" calculations
       * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
       */
      let totalExpectedReports = 0;
      let totalExpectedVisits = 0;
      let expectedReportsAsOfNow = 0;
      let expectedVisitsAsOfNow = 0;
      let totalExpectedPrincipalFeedbackVisits = 0;
      let expectedPrincipalFeedbackVisitsAsOfNow = 0;
      let completedPrincipalFeedbackVisitsCount = 0;
      let lastPrincipalFeedbackVisit: Date | null = null;

      if (application) {
        const startDate = (application as any).startDate || application.joiningDate;
        const endDate = (application as any).endDate || application.completionDate;

        // Use stored values if available
        const storedExpectedReports = (application as any).totalExpectedReports;
        const storedExpectedVisits = (application as any).totalExpectedVisits;

        if (startDate) {
          const start = new Date(startDate);
          const now = new Date();

          // Default end date: 6 months from start if not specified
          const effectiveEnd = endDate
            ? new Date(endDate)
            : new Date(start.getTime() + 180 * 24 * 60 * 60 * 1000);

          // Use stored values if available, otherwise calculate total
          totalExpectedReports = storedExpectedReports ?? getTotalExpectedReports(start, effectiveEnd);
          totalExpectedVisits = storedExpectedVisits ?? getTotalExpectedVisits(start, effectiveEnd);

          // Calculate how many should be done by now using utility functions
          expectedReportsAsOfNow = getExpectedReportsAsOfToday(start, effectiveEnd);
          expectedVisitsAsOfNow = getExpectedVisitsAsOfToday(start, effectiveEnd);

          totalExpectedPrincipalFeedbackVisits =
            getTotalExpectedPrincipalFeedbackVisits(start, effectiveEnd);
          expectedPrincipalFeedbackVisitsAsOfNow =
            getExpectedPrincipalFeedbackVisitsAsOfToday(start, effectiveEnd);

          // Count completed principal feedback visits in internship/cycle window
          const principalCycleStart = new Date(
            MONTHLY_CYCLE.PRINCIPAL_FEEDBACK_CYCLE_START_DATE,
          );
          principalCycleStart.setHours(0, 0, 0, 0);
          const effectivePrincipalStart = start > principalCycleStart ? start : principalCycleStart;

          const studentPrincipalFeedbacks = principalFeedbackMap.get(student.id) || [];
          const matchedFeedbackIds = new Set<string>();

          for (const feedback of studentPrincipalFeedbacks) {
            if (
              feedback.visitDate >= effectivePrincipalStart &&
              feedback.visitDate <= effectiveEnd
            ) {
              matchedFeedbackIds.add(feedback.principalFeedbackId);
              if (!lastPrincipalFeedbackVisit || feedback.visitDate > lastPrincipalFeedbackVisit) {
                lastPrincipalFeedbackVisit = feedback.visitDate;
              }
            }
          }

          completedPrincipalFeedbackVisitsCount = matchedFeedbackIds.size;
        } else if (storedExpectedReports || storedExpectedVisits) {
          // Use stored values even if no startDate
          totalExpectedReports = storedExpectedReports || 0;
          totalExpectedVisits = storedExpectedVisits || 0;
        }
      }

      const submittedReports = reports.filter(
        (r) => r.status === 'SUBMITTED' || r.status === 'APPROVED',
      ).length;
      const approvedReports = reports.filter((r) => r.status === 'APPROVED').length;

      // Calculate completion percentage
      const completionPercentage = totalExpectedReports > 0
        ? Math.round((approvedReports / totalExpectedReports) * 100)
        : 0;

      // Determine internship status based on internshipPhase
      let internshipStatus = 'Not Started';
      if (application) {
        if (application.internshipPhase === 'COMPLETED') {
          internshipStatus = 'Completed';
        } else if (application.internshipPhase === 'ACTIVE') {
          // Check if delayed based on expected reports
          const expectedSubmitted = reports.filter((r) => {
            const reportDate = new Date(r.reportYear, r.reportMonth - 1);
            return reportDate <= new Date();
          }).length;
          internshipStatus = submittedReports < expectedSubmitted ? 'Delayed' : 'In Progress';
        } else if (application.status === 'JOINED') {
          internshipStatus = 'In Progress';
        } else if (application.status === 'SELECTED') {
          internshipStatus = 'In Progress';
        } else if (['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'].includes(application.status)) {
          internshipStatus = 'Pending';
        } else if (['REJECTED', 'WITHDRAWN'].includes(application.status)) {
          internshipStatus = 'Not Started';
        }
      }

      // Build timeline
      const timeline: { children: string; color: string }[] = [];
      if (application) {
        // Check if joining letter is verified (reviewedAt exists and remarks don't contain 'reject')
        const isJoiningVerified = application.reviewedAt && !application.reviewRemarks?.toLowerCase().includes('reject');
        if (isJoiningVerified && application.joiningDate) {
          timeline.push({
            children: `Internship started - ${new Date(application.joiningDate).toLocaleDateString()}`,
            color: 'green',
          });
        }

        reports.forEach((report) => {
          const monthName = new Date(report.reportYear, report.reportMonth - 1).toLocaleString('default', { month: 'long' });
          if (report.status === 'APPROVED') {
            timeline.push({
              children: `${monthName} ${report.reportYear} report approved`,
              color: 'green',
            });
          } else if (report.status === 'SUBMITTED') {
            timeline.push({
              children: `${monthName} ${report.reportYear} report submitted`,
              color: 'blue',
            });
          } else if (report.status === 'REJECTED') {
            timeline.push({
              children: `${monthName} ${report.reportYear} report rejected`,
              color: 'red',
            });
          }
        });

        if (application.completionDate) {
          timeline.push({
            children: `Internship completed - ${new Date(application.completionDate).toLocaleDateString()}`,
            color: 'green',
          });
        }
      }

      // Get faculty visits data from the map
      const visitsData = application ? facultyVisitsMap.get(application.id) : null;

      return {
        id: student.id,
        name: student.user?.name,
        rollNumber: student.user?.rollNumber,
        batch: student.batch?.name || 'N/A',
        batchId: student.batchId,
        department: student.branch?.name || student.user?.branchName || 'N/A',
        departmentId: student.branchId,
        internshipStatus,
        reportsSubmitted: submittedReports,
        totalReports: totalExpectedReports,
        expectedReportsAsOfNow,
        completionPercentage,
        mentor: mentor?.name || null,
        mentorId: mentor?.id || null,
        // Faculty visits data
        facultyVisitsCount: visitsData?.count || 0,
        totalExpectedVisits,
        expectedVisitsAsOfNow,
        lastFacultyVisit: visitsData?.lastVisit || null,
        principalFeedbackVisitsCount: completedPrincipalFeedbackVisitsCount,
        totalExpectedPrincipalFeedbackVisits,
        expectedPrincipalFeedbackVisitsAsOfNow,
        pendingPrincipalFeedbackVisits: Math.max(
          0,
          expectedPrincipalFeedbackVisitsAsOfNow - completedPrincipalFeedbackVisitsCount,
        ),
        lastPrincipalFeedbackVisit,
        timeline,
        application: application ? {
          id: application.id,
          status: application.status,
          internshipTitle: (application as any).jobProfile || 'N/A',
          joiningDate: application.joiningDate,
          completionDate: application.completionDate,
          // Joining letter details
          joiningLetterUrl: (application as any).joiningLetterUrl,
          joiningLetterUploadedAt: (application as any).joiningLetterUploadedAt,
          hasJoiningLetter: !!(application as any).joiningLetterUrl,
          // Company details (from self-identified fields)
          company: (application as any).companyName ? {
            name: (application as any).companyName,
            address: (application as any).companyAddress,
            contact: (application as any).companyContact,
            email: (application as any).companyEmail,
            isSelfIdentified: true,
          } : null,
          // Internship details (from self-identified fields)
          workLocation: (application as any).companyAddress,
          stipendAmount: (application as any).stipend,
          duration: (application as any).internshipDuration,
          startDate: (application as any).startDate,
          endDate: (application as any).endDate,
          jobProfile: (application as any).jobProfile,
          isSelfIdentified: (application as any).isSelfIdentified,
          internshipPhase: (application as any).internshipPhase,
          // Faculty mentor details (for self-identified internships)
          facultyMentor: (application as any).isSelfIdentified ? {
            name: (application as any).facultyMentorName,
            email: (application as any).facultyMentorEmail,
            contact: (application as any).facultyMentorContact,
            designation: (application as any).facultyMentorDesignation,
          } : null,
        } : null,
        // Monthly reports with details
        monthlyReports: reports.map((report: any) => ({
          id: report.id,
          month: report.reportMonth,
          year: report.reportYear,
          monthName: new Date(report.reportYear, report.reportMonth - 1).toLocaleString('default', { month: 'long' }),
          status: report.status,
          submittedAt: report.submittedAt,
          summary: null,
          reportFileUrl: report.reportFileUrl,
        })),
      };
    });

    // Filter by status if provided
    let filteredData = progressData;
    if (status && status !== 'all') {
      filteredData = progressData.filter((s) => s.internshipStatus === status);
    }

    // Filter by joining letter status
    if (joiningLetterStatus && joiningLetterStatus !== 'all') {
      if (joiningLetterStatus === 'uploaded') {
        filteredData = filteredData.filter((s) => s.application?.hasJoiningLetter);
      } else if (joiningLetterStatus === 'pending') {
        // Show students with APPROVED or JOINED status who haven't uploaded joining letter
        filteredData = filteredData.filter(
          (s) => s.application && !s.application.hasJoiningLetter &&
                 (s.application.status === 'APPROVED' || s.application.status === 'JOINED')
        );
      }
    }

    // Get list of mentors for filter dropdown
    const [mentorsList, mentorAssignmentsList] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          institutionId: principal.institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Get all mentor assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId: principal.institutionId, user: { active: true } },
          isActive: true,
        },
        select: { mentorId: true, studentId: true },
      }),
    ]);

    // Compute unique students per mentor
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of mentorAssignmentsList) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const mentors = mentorsList.map((m) => ({
      ...m,
      assignedCount: mentorStudentMap.get(m.id)?.size || 0,
    }));

    // Calculate status counts for the entire dataset (not just current page)
    const [inProgressCount, completedCount, pendingCount] = await Promise.all([
      // In Progress: JOINED status with ACTIVE internshipPhase
      this.prisma.student.count({
        where: {
          ...where,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
            },
          },
        },
      }),
      // Completed: COMPLETED internshipPhase
      this.prisma.student.count({
        where: {
          ...where,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              internshipPhase: InternshipPhase.COMPLETED,
            },
          },
        },
      }),
      // Pending: APPLIED, UNDER_REVIEW, SHORTLISTED status
      this.prisma.student.count({
        where: {
          ...where,
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              status: { in: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'] },
            },
          },
        },
      }),
    ]);

    // Not started = total - (inProgress + completed + pending)
    const notStartedCount = Math.max(0, total - inProgressCount - completedCount - pendingCount);

    // Count delayed from computed progressData (accurate calculation based on report submissions)
    const delayedCount = progressData.filter((s) => s.internshipStatus === 'Delayed').length;
    // Adjust inProgress count to exclude delayed students (they overlap in DB queries)
    const adjustedInProgressCount = Math.max(0, inProgressCount - delayedCount);

    return {
      students: filteredData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts: {
        total,
        inProgress: adjustedInProgressCount,
        completed: completedCount,
        pending: pendingCount,
        notStarted: notStartedCount,
        delayed: delayedCount,
      },
      mentors: mentors.map((m) => ({
        id: m.id,
        name: m.name,
        assignedCount: m.assignedCount,
      })),
    };
  }

  /**
   * Get students with pagination and filters
   */
  async getStudents(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    batchId?: string;
    branchId?: string;
    mentorId?: string; // Filter by specific mentor ID, or 'none' for unassigned
    isActive?: boolean | string; // Query params come as strings
    hasMentor?: string; // 'true', 'false', or undefined for all
    hasInternship?: string; // 'true' to filter only students with self-identified internships
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Parse page and limit as numbers (query params come as strings)
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, batchId, branchId, mentorId, isActive, hasMentor, hasInternship } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      institutionId: principal.institutionId,
    };

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { rollNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (batchId) {
      where.batchId = batchId;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    // Filter by specific mentor ID
    if (mentorId) {
      if (mentorId === 'none') {
        // Filter for students with no active mentor
        where.mentorAssignments = {
          none: { isActive: true },
        };
      } else {
        // Filter for students assigned to specific mentor
        where.mentorAssignments = {
          some: {
            mentorId: mentorId,
            isActive: true
          },
        };
      }
    }

    // Convert isActive string to boolean (query params come as strings)
    if (isActive !== undefined && isActive !== '') {
      where.user = { active: isActive === 'true' || isActive === true };
    }

    // Filter by mentor assignment status (only if mentorId is not provided)
    // mentorId takes precedence as it's more specific
    if (!mentorId) {
      if (hasMentor === 'true') {
        where.mentorAssignments = {
          some: { isActive: true },
        };
      } else if (hasMentor === 'false') {
        where.mentorAssignments = {
          none: { isActive: true },
        };
        // When filtering for unassigned students, only show active students by default
        // unless isActive is explicitly set to 'false'
        if (isActive !== 'false' && isActive !== false) {
          where.user = { active: true };
        }
      }
    }

    // Filter by self-identified internship
    if (hasInternship === 'true') {
      where.internshipApplications = {
        some: { isSelfIdentified: true },
      };
    }

    // Determine if we need to include full internship data
    const includeInternships = hasInternship === 'true';

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          batch: true,
          branch: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
              rollNumber: true,
              phoneNo: true,
              branchName: true,
            },
          },
          // Include self-identified internship applications when requested
          ...(includeInternships && {
            internshipApplications: {
              where: { isSelfIdentified: true },
              orderBy: { createdAt: 'desc' as const },
              take: 1,
              select: {
                id: true,
                status: true,
                internshipPhase: true,
                isSelfIdentified: true,
                companyName: true,
                companyAddress: true,
                companyContact: true,
                companyEmail: true,
                jobProfile: true,
                stipend: true,
                internshipDuration: true,
                startDate: true,
                endDate: true,
                joiningLetterUrl: true,
                joiningLetterUploadedAt: true,
                facultyMentorName: true,
                facultyMentorEmail: true,
                facultyMentorContact: true,
                facultyMentorDesignation: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            mentorAssignments: {
              where: { isActive: true },
              take: 1,
              include: {
                mentor: {
                  select: { id: true, name: true, email: true, designation: true, phoneNo: true },
                },
              },
            },
          }),
          _count: {
            select: {
              internshipApplications: true,
              monthlyReports: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.student.count({ where }),
    ]);

    // Transform response to include selfIdentifiedInternship for easier frontend access
    const transformedStudents = students.map((student: any) => {
      const mentor = student.mentorAssignments?.[0]?.mentor || null;
      return {
        ...student,
        selfIdentifiedInternship: student.internshipApplications?.[0] || null,
        mentor, // Add mentor at student level for easier access
      };
    });

    return {
      data: transformedStudents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get student by ID
   */
  async getStudentById(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: {
        user: true,
        batch: true,
        branch: true,
        internshipApplications: {
          orderBy: { createdAt: 'desc' },
          include: {
            monthlyReports: {
              where: { isDeleted: false },
              orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }],
              select: {
                id: true,
                reportMonth: true,
                reportYear: true,
                monthName: true,
                reportFileUrl: true,
                status: true,
                submittedAt: true,
                reviewedBy: true,
                reviewedAt: true,
                reviewComments: true,
                isApproved: true,
                approvedBy: true,
                approvedAt: true,
                dueDate: true,
                isOverdue: true,
                isLateSubmission: true,
                isFinalReport: true,
                createdAt: true,
              },
            },
            facultyVisitLogs: {
              where: { isDeleted: false },
              orderBy: { visitDate: 'desc' },
              select: {
                id: true,
                visitNumber: true,
                visitDate: true,
                visitType: true,
                visitDuration: true,
                visitLocation: true,
                status: true,
                latitude: true,
                longitude: true,
                signedDocumentUrl: true,
                filesUrl: true,
                // Observations
                studentPerformance: true,
                workEnvironment: true,
                industrySupport: true,
                skillsDevelopment: true,
                attendanceStatus: true,
                workQuality: true,
                organisationFeedback: true,
                projectTopics: true,
                // New fields from form
                titleOfProjectWork: true,
                assistanceRequiredFromInstitute: true,
                responseFromOrganisation: true,
                remarksOfOrganisationSupervisor: true,
                significantChangeInPlan: true,
                observationsAboutStudent: true,
                feedbackSharedWithStudent: true,
                // Ratings
                studentProgressRating: true,
                industryCooperationRating: true,
                overallSatisfactionRating: true,
                // Issues
                issuesIdentified: true,
                recommendations: true,
                createdAt: true,
                faculty: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
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
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /**
   * Get unmasked contact details for a student (for edit forms)
   * Returns with _unmasked flag to bypass SecurityInterceptor masking
   */
  async getUnmaskedContactDetails(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: {
        user: {
          select: {
            email: true,
            phoneNo: true,
            rollNumber: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return {
      _unmasked: true, // Flag to bypass SecurityInterceptor
      email: student.user?.email,
      phoneNo: student.user?.phoneNo,
      rollNumber: student.user?.rollNumber,
    };
  }

  /**
   * Create a new student - delegates to domain UserService
   */
  async createStudent(principalId: string, createStudentDto: CreateStudentDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Handle branchId/departmentId (departmentId is an alias for branchId)
    const branchId = createStudentDto.branchId || createStudentDto.departmentId;
    let branchName: string | undefined;

    // Look up branch name if branchId is provided
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { name: true },
      });
      branchName = branch?.name;
    }

    // Delegate to domain UserService for student creation
    const result = await this.userService.createStudent(principal.institutionId, {
      name: createStudentDto.name,
      email: createStudentDto.email,
      phoneNo: createStudentDto.phoneNo,
      rollNumber: createStudentDto.rollNumber,
      batchId: createStudentDto.batchId,
      branchId,
      branchName,
      dateOfBirth: createStudentDto.dateOfBirth,
      gender: createStudentDto.gender,
      address: createStudentDto.address,
      parentName: createStudentDto.parentName,
      parentContact: createStudentDto.parentPhone,
    });

    // Log student creation
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Student',
      entityId: result.student.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Student created: ${createStudentDto.name} (${createStudentDto.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        studentId: result.student.id,
        email: createStudentDto.email,
        rollNumber: createStudentDto.rollNumber,
        batchId: createStudentDto.batchId,
      },
    }).catch(() => {}); // Non-blocking

    // TODO: Send email with temporary password to student
    // result.temporaryPassword contains the generated password

    await this.cache.invalidateByTags(['students', `institution:${principal.institutionId}`]);

    return result.student;
  }

  /**
   * Update student details
   */
  async updateStudent(principalId: string, studentId: string, updateStudentDto: UpdateStudentDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Prepare update data, handling branchId/departmentId mapping
    const updateData: any = { ...updateStudentDto };

    // Handle departmentId as alias for branchId
    if (updateData.departmentId !== undefined) {
      updateData.branchId = updateData.departmentId;
      delete updateData.departmentId;
    }

    // Handle parentPhone -> parentContact mapping
    if (updateData.parentPhone !== undefined) {
      updateData.parentContact = updateData.parentPhone;
      delete updateData.parentPhone;
    }

    // Handle phoneNo -> contact mapping
    if (updateData.phoneNo !== undefined) {
      updateData.contact = updateData.phoneNo;
      delete updateData.phoneNo;
    }

    // Handle dateOfBirth -> dob mapping
    if (updateData.dateOfBirth !== undefined) {
      updateData.dob = updateData.dateOfBirth;
      delete updateData.dateOfBirth;
    }

    // Build user update data for synced fields (these belong to User model, not Student)
    const userUpdateData: any = {};
    if (updateData.name) {
      userUpdateData.name = updateData.name;
      delete updateData.name;
    }
    if (updateData.email) {
      userUpdateData.email = updateData.email;
      delete updateData.email;
    }
    if (updateData.contact) {
      userUpdateData.phoneNo = updateData.contact;
      delete updateData.contact;
    }
    if (updateData.rollNumber) {
      userUpdateData.rollNumber = updateData.rollNumber;
      delete updateData.rollNumber;
    }
    if (updateData.dob) {
      userUpdateData.dob = updateData.dob;
      delete updateData.dob;
    }
    if (typeof updateData.isActive === 'boolean') {
      userUpdateData.active = updateData.isActive;
      delete updateData.isActive;
    }

    // Handle relation fields - convert IDs to Prisma relation connect syntax
    const studentUpdateData: any = { ...updateData };

    // Handle batchId -> batch relation
    if (studentUpdateData.batchId !== undefined) {
      if (studentUpdateData.batchId) {
        studentUpdateData.batch = { connect: { id: studentUpdateData.batchId } };
      } else {
        studentUpdateData.batch = { disconnect: true };
      }
      delete studentUpdateData.batchId;
    }

    // Handle branchId -> branch relation
    if (studentUpdateData.branchId !== undefined) {
      if (studentUpdateData.branchId) {
        studentUpdateData.branch = { connect: { id: studentUpdateData.branchId } };
      } else {
        studentUpdateData.branch = { disconnect: true };
      }
      delete studentUpdateData.branchId;
    }

    // Handle institutionId -> Institution relation
    if (studentUpdateData.institutionId !== undefined) {
      if (studentUpdateData.institutionId) {
        studentUpdateData.Institution = { connect: { id: studentUpdateData.institutionId } };
      }
      delete studentUpdateData.institutionId;
    }

    // Remove fields not in Prisma Student schema
    delete studentUpdateData.bloodGroup;
    delete studentUpdateData.semesterId;
    delete studentUpdateData.branchName;
    delete studentUpdateData.batchName;
    delete studentUpdateData.institutionName;
    delete studentUpdateData.departmentName;

    // Always use transaction to keep Student and User in sync
    if (student.userId && Object.keys(userUpdateData).length > 0) {
      const [updatedStudent] = await this.prisma.$transaction([
        this.prisma.student.update({
          where: { id: studentId },
          data: studentUpdateData,
          include: {
            user: true,
            batch: true,
            branch: true,
          },
        }),
        this.prisma.user.update({
          where: { id: student.userId },
          data: userUpdateData,
        }),
      ]);

      await this.cache.invalidateByTags(['students', `student:${studentId}`, `user:${student.userId}`]);

      return updatedStudent;
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: studentUpdateData,
      include: {
        user: true,
        batch: true,
        branch: true,
      },
    });

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return updated;
  }

  /**
   * Delete student (soft delete - deactivates user and student profile)
   */
  async deleteStudent(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Find student and verify they belong to this institution
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student || student.institutionId !== principal.institutionId) {
      throw new NotFoundException('Student not found in your institution');
    }

    // Store info for audit before soft deletion
    const studentInfo = {
      studentId,
      userId: student.userId,
      email: student.user?.email,
      name: student.user?.name,
      rollNumber: student.user?.rollNumber,
      wasActive: student.user?.active,
    };

    // Soft delete - deactivate student and user, deactivate related assignments
    await this.prisma.$transaction([
      // Deactivate mentor assignments (preserve historical data)
      this.prisma.mentorAssignment.updateMany({
        where: { studentId, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      // Deactivate the student record via user relation
      this.prisma.student.update({
        where: { id: studentId },
        data: { user: { update: { active: false } } },
      }),
      // Deactivate the user account
      this.prisma.user.update({
        where: { id: student.userId },
        data: { active: false },
      }),
    ]);

    // Log student soft deletion
    this.auditService.log({
      action: AuditAction.USER_DELETION,
      entityType: 'Student',
      entityId: studentId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Student deactivated (soft delete): ${studentInfo.name} (${studentInfo.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: studentInfo,
      newValues: { isActive: false, active: false },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return { success: true, message: 'Student deactivated successfully' };
  }

  /**
   * Toggle student status (activate/deactivate) - Principal only
   * When deactivating: deactivates mentor assignments and internship applications
   * When activating: reactivates internship applications (mentor assignments need reassignment)
   */
  async toggleStudentStatus(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Find student and verify they belong to this institution
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student || student.institutionId !== principal.institutionId) {
      throw new NotFoundException('Student not found in your institution');
    }

    const currentStatus = student.user?.active ?? true;
    const newStatus = !currentStatus;

    await this.prisma.$transaction(async (tx) => {
      if (!newStatus) {
        // Deactivating: deactivate mentor assignments and internship applications
        await tx.mentorAssignment.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false, deactivatedAt: new Date() },
        });

        await tx.internshipApplication.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false },
        });
      } else {
        // Activating: reactivate mentor assignments and internship applications
        await tx.mentorAssignment.updateMany({
          where: { studentId, isActive: false },
          data: { isActive: true, deactivatedAt: null },
        });

        await tx.internshipApplication.updateMany({
          where: { studentId, isActive: false },
          data: { isActive: true },
        });
      }

      // Toggle the user's active status
      await tx.user.update({
        where: { id: student.userId },
        data: { active: newStatus },
      });
    });

    // Log status change
    this.auditService.log({
      action: newStatus ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Student ${newStatus ? 'activated' : 'deactivated'}: ${student.user?.name} (${student.user?.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: { active: currentStatus },
      newValues: { active: newStatus },
    }).catch(() => {});

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return {
      success: true,
      active: newStatus,
      message: `Student ${newStatus ? 'activated' : 'deactivated'} successfully. Mentor assignments and internship applications also ${newStatus ? 'reactivated' : 'deactivated'}.`,
    };
  }

  /**
   * Parse Excel/CSV file buffer to JSON
   */
  private async parseExcelFile(file: Express.Multer.File): Promise<any[]> {
    const { workbook } = await ExcelUtils.read(file.buffer);
    return ExcelUtils.sheetToJson(workbook, 0);
  }

  /**
   * Bulk upload students from CSV/Excel
   */
  async bulkUploadStudents(principalId: string, files: Express.Multer.File[]) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No file provided');
    }

    const file = files[0];
    const studentsData = await this.parseExcelFile(file);

    if (studentsData.length === 0) {
      throw new BadRequestException('No valid data found in file');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process in batches of 10 for better performance with error isolation
    const BATCH_SIZE = 10;
    for (let i = 0; i < studentsData.length; i += BATCH_SIZE) {
      const batch = studentsData.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((studentData) => this.createStudent(principalId, studentData)),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            data: batch[index],
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    return results;
  }

  /**
   * Bulk upload staff from CSV/Excel
   */
  async bulkUploadStaff(principalId: string, files: Express.Multer.File[]) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('No file provided');
    }

    const file = files[0];
    const staffData = await this.parseExcelFile(file);

    if (staffData.length === 0) {
      throw new BadRequestException('No valid data found in file');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process in batches of 10 for better performance with error isolation
    const BATCH_SIZE = 10;
    for (let i = 0; i < staffData.length; i += BATCH_SIZE) {
      const batch = staffData.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((staffMember) => this.createStaff(principalId, staffMember)),
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({
            data: batch[index],
            error: result.reason?.message || 'Unknown error',
          });
        }
      });
    }

    return results;
  }

  /**
   * Get staff members
   */
  async getStaff(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    role?: string;
    active?: string | boolean;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Parse page and limit as numbers (query params come as strings)
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, role, active } = query;
    const skip = (page - 1) * limit;

    // Allowed staff roles (excludes PRINCIPAL, STUDENT, STATE_DIRECTORATE, SYSTEM_ADMIN)
    const allowedStaffRoles: Role[] = [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF];

    const where: Prisma.UserWhereInput = {
      institutionId: principal.institutionId,
      role: { in: allowedStaffRoles },
    };

    // Allow filtering by specific role if provided (must be one of allowed roles)
    if (role && Object.values(Role).includes(role as Role) && allowedStaffRoles.includes(role as Role)) {
      where.role = role as Role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Handle active filter - support both string and boolean
    if (active !== undefined && active !== '') {
      where.active = active === true || active === 'true';
    }

    const [staff, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          role: true,
          designation: true,
          branchName: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Map branchName to department for frontend compatibility
    const transformedStaff = staff.map((s: any) => ({
      ...s,
      department: s.branchName, // Alias for frontend
    }));

    return {
      data: transformedStaff,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create staff member
   */
  async createStaff(principalId: string, createStaffDto: CreateStaffDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createStaffDto.email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${createStaffDto.email} already exists`);
    }

    // Use the role directly from the DTO (already validated)
    const staffRole: Role = createStaffDto.role as Role;

    // Generate and hash secure temporary password using domain service
    const temporaryPassword = this.userService.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

    const staff = await this.prisma.user.create({
      data: {
        name: createStaffDto.name,
        email: createStaffDto.email,
        password: hashedPassword,
        role: staffRole,
        active: true,
        phoneNo: createStaffDto.phoneNo,
        designation: createStaffDto.designation,
        branchName: createStaffDto.branchName,
        Institution: { connect: { id: principal.institutionId } },
      },
    });

    // Log staff creation
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Staff',
      entityId: staff.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Staff member created: ${createStaffDto.name} (${createStaffDto.email}) as ${staffRole}`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        staffId: staff.id,
        email: createStaffDto.email,
        role: staffRole,
        designation: createStaffDto.designation,
      },
    }).catch(() => {}); // Non-blocking

    // TODO: Send email with temporary password to staff

    await this.cache.invalidateByTags(['staff', `institution:${principal.institutionId}`]);

    return staff;
  }

  /**
   * Update staff member
   */
  async updateStaff(principalId: string, staffId: string, updateData: any) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        institutionId: principal.institutionId,
        role: Role.TEACHER, // Only allow updating TEACHER role
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found or not a valid staff role');
    }

    // Prevent principal from modifying themselves through staff endpoint
    if (staff.id === principalId) {
      throw new BadRequestException('Cannot modify your own account through this endpoint');
    }

    // Prevent changing role to PRINCIPAL
    if (updateData.role && updateData.role === Role.PRINCIPAL) {
      throw new BadRequestException('Cannot change staff role to principal');
    }

    // Prepare update data for Prisma
    const prismaData: Prisma.UserUpdateInput = { ...updateData };

    const updated = await this.prisma.user.update({
      where: { id: staffId },
      data: prismaData,
    });

    // Audit staff update
    this.auditService.log({
      action: AuditAction.USER_PROFILE_UPDATE,
      entityType: 'Staff',
      entityId: staffId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Staff member updated: ${updated.name} (${updated.email})`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      oldValues: {
        name: staff.name,
        email: staff.email,
        phoneNo: staff.phoneNo,
        designation: staff.designation,
        active: staff.active,
      },
      newValues: updateData,
      changedFields: Object.keys(updateData),
    }).catch(() => {});

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return updated;
  }

  /**
   * Deactivate staff member (soft delete)
   */
  async deleteStaff(principalId: string, staffId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        institutionId: principal.institutionId,
        role: Role.TEACHER, // Only allow deactivating TEACHER role
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found or not a valid staff role');
    }

    // Prevent principal from deactivating themselves
    if (staff.id === principalId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    // Check if already deactivated
    if (staff.active === false) {
      throw new BadRequestException('Staff member is already deactivated');
    }

    // Store info for audit
    const staffInfo = {
      staffId,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      previousStatus: staff.active,
    };

    // Soft delete - deactivate user and related mentor assignments
    await this.prisma.$transaction([
      // Deactivate mentor assignments where this staff is the mentor
      this.prisma.mentorAssignment.updateMany({
        where: { mentorId: staffId, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      // Deactivate the user (soft delete)
      this.prisma.user.update({
        where: { id: staffId },
        data: { active: false },
      }),
    ]);

    // Log staff deactivation
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Staff',
      entityId: staffId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Staff member deactivated: ${staffInfo.name} (${staffInfo.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: staffInfo,
      newValues: { active: false },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return { success: true, message: 'Staff member deactivated successfully' };
  }

  /**
   * Toggle staff member active status (activate/deactivate)
   * Also handles mentor assignment reactivation when activating
   */
  async toggleStaffStatus(principalId: string, staffId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        institutionId: principal.institutionId,
        role: Role.TEACHER, // Only allow toggling TEACHER role
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found or not a valid staff role');
    }

    // Prevent principal from toggling themselves
    if (staff.id === principalId) {
      throw new BadRequestException('Cannot modify your own account status');
    }

    const currentStatus = staff.active !== false;
    const newStatus = !currentStatus;
    const action = newStatus ? 'activated' : 'deactivated';

    // Store info for audit
    const staffInfo = {
      staffId,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      previousStatus: currentStatus,
    };

    if (!newStatus) {
      // Deactivating: soft delete mentor assignments (irreversible) and deactivate user
      // Note: Mentor assignments are permanently deactivated - new assignments must be created when user is reactivated
      // Faculty visits by this mentor are preserved for historical records
      await this.prisma.$transaction([
        this.prisma.mentorAssignment.updateMany({
          where: { mentorId: staffId, isActive: true },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Faculty mentor deactivated',
          },
        }),
        this.prisma.user.update({
          where: { id: staffId },
          data: { active: false },
        }),
      ]);
    } else {
      // Activating: only reactivate user - mentor assignments remain deactivated
      // New mentor assignments must be created fresh
      await this.prisma.user.update({
        where: { id: staffId },
        data: { active: true },
      });
    }

    // Log status change
    this.auditService.log({
      action: newStatus ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION,
      entityType: 'Staff',
      entityId: staffId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Staff member ${action}: ${staffInfo.name} (${staffInfo.email})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: staffInfo,
      newValues: { active: newStatus },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags(['staff', `user:${staffId}`]);

    return {
      success: true,
      message: `Staff member ${action} successfully`,
      active: newStatus,
    };
  }

  /**
   * Get faculty mentors with breakdown of internal vs external assignments
   * @param principalId - The ID of the principal
   * @returns List of mentors with assignment counts (internal vs external)
   * @throws NotFoundException if principal or institution not found
   */
  async getMentors(principalId: string) {
    try {
      // Validate input
      if (!principalId || typeof principalId !== 'string') {
        throw new BadRequestException('Invalid principal ID');
      }

      const principal = await this.prisma.user.findUnique({
        where: { id: principalId },
        select: { id: true, institutionId: true },
      });

      if (!principal || !principal.institutionId) {
        throw new NotFoundException('Principal or institution not found');
      }

      const mentors = await this.prisma.user.findMany({
        where: {
          institutionId: principal.institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
        include: {
          mentorAssignments: {
            where: { isActive: true },
            include: {
              student: {
                select: {
                  id: true,
                  institutionId: true,
                },
              },
            },
          },
        },
      });

      // Transform to include internal vs external assignment counts with null safety
      return mentors.map(mentor => {
        const assignments = mentor.mentorAssignments || [];
        const internalAssignments = assignments.filter(a =>
          a.student?.institutionId && a.student.institutionId === principal.institutionId
        );
        const externalAssignments = assignments.filter(a =>
          a.student?.institutionId && a.student.institutionId !== principal.institutionId
        );

        // Omit mentorAssignments from response for cleaner API response
        const { mentorAssignments, ...mentorWithoutAssignments } = mentor;

        return {
          ...mentorWithoutAssignments,
          _count: {
            mentorAssignments: assignments.length,
            internalAssignments: internalAssignments.length,
            externalAssignments: externalAssignments.length,
          },
        };
      });
    } catch (error) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      // Log and wrap unexpected errors
      this.logger.error(`Error fetching mentors for principal ${principalId}:`, error);
      throw new InternalServerErrorException('Failed to fetch mentors');
    }
  }

  /**
   * Get mentor assignments
   */
  async getMentorAssignments(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const assignments = await this.prisma.mentorAssignment.findMany({
      where: {
        student: {
          institutionId: principal.institutionId,
        },
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { name: true, rollNumber: true } },
          },
        },
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
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
      orderBy: { assignmentDate: 'desc' },
    });

    // Add flag for cross-institution assignments
    return assignments.map(a => ({
      ...a,
      isCrossInstitution: a.mentor?.institutionId && a.mentor.institutionId !== principal.institutionId,
    }));
  }

  /**
   * Get external mentor assignments (our faculty mentoring students from other institutions)
   * These assignments should NOT count towards our institution's student totals
   * @param principalId - The ID of the principal
   * @returns List of external mentor assignments with student and mentor details
   * @throws NotFoundException if principal or institution not found
   */
  async getExternalMentorAssignments(principalId: string) {
    try {
      // Validate input
      if (!principalId || typeof principalId !== 'string') {
        throw new BadRequestException('Invalid principal ID');
      }

      const principal = await this.prisma.user.findUnique({
        where: { id: principalId },
        select: { id: true, institutionId: true },
      });

      if (!principal || !principal.institutionId) {
        throw new NotFoundException('Principal or institution not found');
      }

      const assignments = await this.prisma.mentorAssignment.findMany({
        where: {
          mentor: {
            institutionId: principal.institutionId,
            role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
            active: true,
          },
          student: {
            institutionId: { not: principal.institutionId },
            user: { active: true },
          },
          isActive: true,
        },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true, email: true, phoneNo: true, branchName: true } },
              currentSemester: true,
              institutionId: true,
              Institution: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  city: true,
                  state: true,
                },
              },
            },
          },
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNo: true,
              designation: true,
            },
          },
        },
        orderBy: { assignmentDate: 'desc' },
        take: 1000, // Limit to prevent performance issues
      });

      // Add external flag and ensure data integrity
      return assignments.map(a => ({
        ...a,
        isExternalStudent: true, // All students in this query are external
        student: {
          ...a.student,
          Institution: a.student?.Institution || {
            id: '',
            name: 'Unknown Institution',
            code: 'N/A',
            city: '',
            state: '',
          },
        },
      }));
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error fetching external mentor assignments for principal ${principalId}:`, error);
      throw new InternalServerErrorException('Failed to fetch external mentor assignments');
    }
  }

  /**
   * Assign mentor to student
   */
  async assignMentor(principalId: string, assignMentorDto: AssignMentorDto) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!assignMentorDto.studentIds || assignMentorDto.studentIds.length === 0) {
      throw new BadRequestException('studentIds is required');
    }

    // Verify students belong to institution
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: assignMentorDto.studentIds },
        institutionId: principal.institutionId,
      },
      select: { id: true },
    });

    if (students.length !== assignMentorDto.studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    // Verify mentor belongs to institution (TEACHER role)
    const mentor = await this.prisma.user.findFirst({
      where: {
        id: assignMentorDto.mentorId,
        institutionId: principal.institutionId,
        role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
      },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    // Deactivate existing assignment if any
    await this.prisma.mentorAssignment.updateMany({
      where: {
        studentId: { in: assignMentorDto.studentIds },
        isActive: true,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: principalId,
      },
    });

    const assignments = await this.prisma.$transaction(
      assignMentorDto.studentIds.map(studentId =>
        this.prisma.mentorAssignment.create({
          data: {
            studentId,
            mentorId: assignMentorDto.mentorId,
            assignedBy: principalId,
            academicYear: assignMentorDto.academicYear,
            semester: assignMentorDto.semester,
            assignmentReason: assignMentorDto.reason ?? assignMentorDto.notes,
            isActive: true,
          },
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    rollNumber: true,
                    phoneNo: true,
                  },
                },
              },
            },
            mentor: true,
          },
        }),
      ),
    );

    // Log mentor assignment
    this.auditService.log({
      action: AuditAction.MENTOR_ASSIGN,
      entityType: 'MentorAssignment',
      entityId: mentor.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Mentor ${mentor.name} assigned to ${assignMentorDto.studentIds.length} student(s)`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        mentorId: assignMentorDto.mentorId,
        mentorName: mentor.name,
        studentCount: assignMentorDto.studentIds.length,
        studentIds: assignMentorDto.studentIds,
        academicYear: assignMentorDto.academicYear,
        semester: assignMentorDto.semester,
      },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags([
      'mentors',
      'principal', // Invalidate dashboard cache to update unassigned students count
      ...assignMentorDto.studentIds.map(studentId => `student:${studentId}`),
      `institution:${principal.institutionId}`,
    ]);

    return assignments;
  }

  /**
   * Get pending/missing reports grouped by month
   * Shows which students have not submitted their reports for each month
   */
  async getPendingReportsByMonth(principalId: string, query: {
    year?: number | string;
    batchId?: string;
    branchId?: string;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const targetYear = Number(query.year) || new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();

    // Build where clause for students
    const studentWhere: Prisma.StudentWhereInput = {
      institutionId,
      user: { active: true },
    };

    if (query.batchId && query.batchId !== 'all') {
      studentWhere.batchId = query.batchId;
    }
    if (query.branchId && query.branchId !== 'all') {
      studentWhere.branchId = query.branchId;
    }

    // Get all students with active self-identified internships (JOINED status)
    const studentsWithInternships = await this.prisma.student.findMany({
      where: {
        ...studentWhere,
        internshipApplications: {
          some: {
            isSelfIdentified: true,
            status: { in: ['JOINED', 'SELECTED', 'APPROVED'] },
          },
        },
      },
      select: {
        id: true,
        user: { select: { name: true, rollNumber: true } },
        batch: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        internshipApplications: {
          where: {
            isSelfIdentified: true,
            status: { in: ['JOINED', 'SELECTED', 'APPROVED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            joiningDate: true,
            startDate: true,
            endDate: true,
            internshipDuration: true,
            monthlyReports: {
              where: {
                reportYear: targetYear,
              },
              select: {
                reportMonth: true,
                reportYear: true,
                status: true,
                submittedAt: true,
              },
            },
          },
        },
        mentorAssignments: {
          where: { isActive: true },
          take: 1,
          select: {
            mentor: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Get month names
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    // Build pending reports by month
    const pendingByMonth: {
      month: number;
      monthName: string;
      year: number;
      isPast: boolean;
      totalExpected: number;
      submitted: number;
      pending: number;
      students: {
        id: string;
        name: string;
        rollNumber: string;
        batch: string;
        department: string;
        mentor: string | null;
        status: 'missing' | 'pending' | 'submitted' | 'approved';
        submittedAt: Date | null;
      }[];
    }[] = [];

    // Determine which months to show (up to current month if same year, or all 12 if past year)
    const maxMonth = targetYear < currentYear ? 12 : currentMonth;

    for (let month = 1; month <= maxMonth; month++) {
      const monthData = {
        month,
        monthName: monthNames[month - 1],
        year: targetYear,
        isPast: targetYear < currentYear || month < currentMonth,
        totalExpected: 0,
        submitted: 0,
        pending: 0,
        students: [] as any[],
      };

      for (const student of studentsWithInternships) {
        const application = student.internshipApplications[0];
        if (!application) continue;

        // Check if student should have submitted a report for this month
        const joiningDate = application.joiningDate ? new Date(application.joiningDate) : null;
        const joiningMonth = joiningDate ? joiningDate.getMonth() + 1 : null;
        const joiningYear = joiningDate ? joiningDate.getFullYear() : null;

        // Skip months before joining
        if (joiningYear && joiningMonth) {
          if (targetYear < joiningYear) continue;
          if (targetYear === joiningYear && month < joiningMonth) continue;
        }

        // Calculate expected duration from dates or duration string
        let expectedMonths = 6; // Fallback for legacy data
        const appStartDate = application.startDate || application.joiningDate;
        const appEndDate = application.endDate;

        if (appStartDate && appEndDate) {
          // Calculate duration from actual dates
          const start = new Date(appStartDate);
          const end = new Date(appEndDate);
          const yearsDiff = end.getFullYear() - start.getFullYear();
          const monthsDiff = end.getMonth() - start.getMonth();
          expectedMonths = Math.max(1, yearsDiff * 12 + monthsDiff + 1);
        } else if ((application as any).internshipDuration) {
          const match = (application as any).internshipDuration.match(/(\d+)\s*month/i);
          if (match) expectedMonths = parseInt(match[1], 10);
        }

        // Check if month is within internship duration
        if (joiningMonth && joiningYear) {
          const monthsSinceJoining = (targetYear - joiningYear) * 12 + (month - joiningMonth);
          if (monthsSinceJoining >= expectedMonths) continue;
        }

        monthData.totalExpected++;

        // Check report status for this month
        const report = application.monthlyReports.find(
          (r) => r.reportMonth === month && r.reportYear === targetYear,
        );

        const mentor = student.mentorAssignments[0]?.mentor;

        let status: 'missing' | 'pending' | 'submitted' | 'approved' = 'missing';
        if (report) {
          if (report.status === 'APPROVED') {
            status = 'approved';
            monthData.submitted++;
          } else if (report.status === 'SUBMITTED' || report.status === 'UNDER_REVIEW') {
            status = 'submitted';
            monthData.submitted++;
          } else if (report.status === 'DRAFT' || report.status === 'REVISION_REQUIRED') {
            status = 'pending';
            monthData.pending++;
          }
        } else {
          // No report exists - it's missing
          monthData.pending++;
        }

        // Only add to students list if not approved (show missing/pending/submitted for review)
        if (status !== 'approved') {
          monthData.students.push({
            id: student.id,
            name: student.user?.name,
            rollNumber: student.user?.rollNumber,
            batch: student.batch?.name || 'N/A',
            department: student.branch?.name || 'N/A',
            mentor: mentor?.name || null,
            status,
            submittedAt: report?.submittedAt || null,
          });
        }
      }

      // Sort students: missing first, then pending, then submitted
      monthData.students.sort((a, b) => {
        const order = { missing: 0, pending: 1, submitted: 2, approved: 3 };
        return order[a.status] - order[b.status];
      });

      pendingByMonth.push(monthData);
    }

    // Calculate summary stats
    const summary = {
      totalStudentsWithInternships: studentsWithInternships.length,
      totalExpectedReports: pendingByMonth.reduce((sum, m) => sum + m.totalExpected, 0),
      totalSubmitted: pendingByMonth.reduce((sum, m) => sum + m.submitted, 0),
      totalPending: pendingByMonth.reduce((sum, m) => sum + m.pending, 0),
      monthsWithPending: pendingByMonth.filter((m) => m.pending > 0).length,
    };

    return {
      year: targetYear,
      summary,
      months: pendingByMonth.reverse(), // Most recent month first
    };
  }

  /**
   * Get faculty visit reports with stats for principal dashboard
   * Returns data formatted for the frontend FacultyReports component
   */
  async getFacultyReportsForDashboard(principalId: string, query: {
    page?: number | string;
    limit?: number | string;
    facultyId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.FacultyVisitLogWhereInput = {
      isDeleted: false,
      application: {
        student: {
          institutionId,
          user: { active: true },
        },
      },
    };

    if (query.facultyId) {
      where.facultyId = query.facultyId;
    }

    if (query.startDate || query.endDate) {
      where.visitDate = {};
      if (query.startDate) {
        where.visitDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.visitDate.lte = new Date(query.endDate);
      }
    }

    // Get visit logs with related data
    const [logs, total, thisMonthCount, allRatings] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          faculty: {
            select: { id: true, name: true, email: true },
          },
          application: {
            include: {
              student: {
                select: { id: true, user: { select: { name: true, rollNumber: true } } },
              },
            },
          },
        },
      }),
      this.prisma.facultyVisitLog.count({ where }),
      // Count visits this month
      this.prisma.facultyVisitLog.count({
        where: {
          ...where,
          visitDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      // Get all ratings for average calculation
      this.prisma.facultyVisitLog.findMany({
        where,
        select: {
          overallSatisfactionRating: true,
          studentProgressRating: true,
        },
      }),
    ]);

    // Calculate average rating
    const ratings = allRatings
      .map((r) => r.overallSatisfactionRating || r.studentProgressRating)
      .filter((r): r is number => r !== null && r !== undefined);
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    // Map visit type enum to display values
    const visitTypeMap: Record<string, string> = {
      PHYSICAL: 'In-Person',
      VIRTUAL: 'Virtual',
      TELEPHONIC: 'Phone',
      PHONE: 'Phone',
    };

    // Transform logs to frontend format
    const reports = logs.map((log) => {
      // Determine status based on reportSubmittedTo and followUpRequired fields
      let status = 'Pending';
      if (log.reportSubmittedTo) {
        status = log.followUpRequired ? 'Under Review' : 'Approved';
      }

      return {
        id: log.id,
        facultyId: log.faculty.id,
        facultyName: log.faculty.name,
        studentId: log.application.student.id,
        studentName: log.application.student.user?.name,
        studentRollNumber: log.application.student.user?.rollNumber,
        internshipTitle: (log.application as any).jobProfile || 'N/A',
        visitDate: log.visitDate,
        visitType: visitTypeMap[log.visitType] || log.visitType,
        status,
        rating: log.overallSatisfactionRating || log.studentProgressRating || 0,
        duration: log.visitDuration || 'N/A',
        location: log.visitLocation || 'N/A',
        summary: log.observationsAboutStudent || log.studentPerformance || '',
        observations: [
          log.workEnvironment && `Work Environment: ${log.workEnvironment}`,
          log.skillsDevelopment && `Skills Development: ${log.skillsDevelopment}`,
          log.attendanceStatus && `Attendance: ${log.attendanceStatus}`,
          log.workQuality && `Work Quality: ${log.workQuality}`,
        ].filter(Boolean).join('\n') || 'No observations recorded',
        recommendations: log.recommendations || 'No recommendations',
        issuesIdentified: log.issuesIdentified,
        actionRequired: log.actionRequired,
      };
    });

    // Get unique faculty list for filter dropdown
    const facultyList = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
        active: true,
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return {
      reports,
      stats: {
        totalVisits: total,
        avgRating,
        visitsThisMonth: thisMonthCount,
      },
      facultyList,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Reports: Generated report files scoped to institution
   */
  async getStudentReports(principalId: string, query: { reportType?: string; page?: number | string; limit?: number | string }) {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { reportType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.GeneratedReportWhereInput = {
      institutionId: principal.institutionId,
    };
    if (reportType) where.reportType = reportType;

    const [reports, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return { reports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Reports: Faculty visit logs scoped to institution
   */
  async getFacultyVisitReports(principalId: string, query: { page?: number | string; limit?: number | string }) {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FacultyVisitLogWhereInput = {
      isDeleted: false,
      application: {
        student: {
          institutionId: principal.institutionId,
          user: { active: true },
        },
      },
    };

    const [logs, total] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          faculty: { select: { id: true, name: true, email: true } },
          application: { include: { student: { select: { id: true, user: { select: { name: true, rollNumber: true } } } } } },
        },
      }),
      this.prisma.facultyVisitLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Reports: Monthly reports scoped to institution
   */
  async getMonthlyReports(principalId: string, query: { page?: number | string; limit?: number | string; status?: string }) {
    const principal = await this.prisma.user.findUnique({ where: { id: principalId } });
    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const { status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MonthlyReportWhereInput = {
      isDeleted: false,
      student: { institutionId: principal.institutionId },
    };
    if (status) where.status = status as any;

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          student: { select: { id: true, user: { select: { name: true, rollNumber: true } } } },
          application: { select: { id: true } },
        },
      }),
      this.prisma.monthlyReport.count({ where }),
    ]);

    return { reports, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get batches
   */
  async getBatches(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const batches = await this.prisma.batch.findMany({
      where: {
        institutionId: principal.institutionId,
      },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return batches;
  }

  /**
   * Create batch
   */
  async createBatch(principalId: string, batchData: { name: string; isActive?: boolean }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const batch = await this.prisma.batch.create({
      data: {
        name: batchData.name,
        isActive: batchData.isActive ?? true,
        institutionId: principal.institutionId,
      },
    });

    await this.cache.invalidateByTags(['batches', `institution:${principal.institutionId}`]);

    return batch;
  }

  /**
   * Get semesters
   */
  async getSemesters(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Semester feature removed from schema
    return [];
  }

  /**
   * Get subjects
   */
  async getSubjects(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Subject feature removed from schema
    return [];
  }

  /**
   * Get analytics data (optimized with parallel queries)
   */
  async getAnalytics(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Run all queries in parallel for better performance
    const [
      totalStudents,
      batches,
      statusCounts,
      monthlyReportCounts,
    ] = await Promise.all([
      // Total active students count
      this.prisma.student.count({
        where: { institutionId, user: { active: true } },
      }),

      // Batches with active student counts
      this.prisma.batch.findMany({
        where: { institutionId },
        select: {
          name: true,
          _count: { select: { students: { where: { user: { active: true } } } } },
        },
      }),

      // Application status counts using groupBy (self-identified only)
      this.prisma.internshipApplication.groupBy({
        by: ['status'],
        where: {
          student: { institutionId },
          isSelfIdentified: true,
        },
        _count: { status: true },
      }),

      // Monthly report counts grouped by month and status
      this.prisma.monthlyReport.groupBy({
        by: ['reportMonth', 'reportYear', 'status'],
        where: {
          student: { institutionId },
          submittedAt: { gte: sixMonthsAgo },
        },
        _count: { status: true },
      }),
    ]);

    // Process status counts
    const statusMap: Record<string, number> = {};
    let totalApplications = 0;
    let activeInternships = 0;
    let completedInternships = 0;

    statusCounts.forEach((item) => {
      const count = item._count.status;
      statusMap[item.status] = count;
      totalApplications += count;

      if (item.status === 'SELECTED' || item.status === 'JOINED') {
        activeInternships += count;
      }
      if (item.status === 'COMPLETED') {
        completedInternships += count;
      }
    });

    const completionRate = totalApplications > 0
      ? Math.round((completedInternships / totalApplications) * 100)
      : 0;

    // Active rate: percentage of students with ongoing internships
    const activeRate = totalStudents > 0
      ? Math.round((activeInternships / totalStudents) * 100)
      : 0;

    // Format students by batch
    const studentsByBatch = batches.map((batch) => ({
      batch: batch.name,
      students: batch._count.students,
    }));

    // Format internship status for charts
    const internshipStatus = Object.entries(statusMap).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
    }));

    // Process monthly progress (simplified - just show totals by status)
    const monthlyProgress = this.formatMonthlyProgress(monthlyReportCounts);

    return {
      totalStudents,
      activeInternships,
      completionRate,
      activeRate,
      studentsByBatch,
      internshipStatus,
      monthlyProgress,
    };
  }

  private formatMonthlyProgress(reportCounts: { reportMonth: number; reportYear: number; status: string; _count: { status: number } }[]) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    // Generate last 6 months with actual data
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthName = monthNames[date.getMonth()];
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      // Get counts for this specific month
      const approved = reportCounts
        .filter(r => r.reportMonth === month && r.reportYear === year && r.status === 'APPROVED')
        .reduce((sum, r) => sum + r._count.status, 0);

      const pending = reportCounts
        .filter(r => r.reportMonth === month && r.reportYear === year && (r.status === 'PENDING' || r.status === 'SUBMITTED'))
        .reduce((sum, r) => sum + r._count.status, 0);

      result.push({
        month: monthName,
        completed: approved,
        inProgress: pending,
      });
    }

    return result;
  }


  /**
   * Get internship statistics (optimized with single groupBy query)
   */
  async getInternshipStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Run queries in parallel
    const [statusCounts, activeInternships] = await Promise.all([
      // Status counts - only active internship applications
      this.prisma.internshipApplication.groupBy({
        by: ['status'],
        where: {
          student: { institutionId, user: { active: true } },
          isActive: true,
        },
        _count: { status: true },
      }),
      // Active internships with company details - limited to prevent memory issues
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId, user: { active: true } },
          isActive: true,
        },
        select: {
          companyName: true,
          companyAddress: true,
        },
        take: 1000, // Limit to prevent memory issues with large datasets
        orderBy: { createdAt: 'desc' }, // Most recent first
      }),
    ]);

    // Process status counts
    const counts: Record<string, number> = {
      applied: 0,
      underReview: 0,
      selected: 0,
      approved: 0,
      joined: 0,
      completed: 0,
      rejected: 0,
    };

    let total = 0;
    statusCounts.forEach((item) => {
      const count = item._count.status;
      total += count;

      switch (item.status) {
        case 'APPLIED': counts.applied = count; break;
        case 'UNDER_REVIEW': counts.underReview = count; break;
        case 'SELECTED': counts.selected = count; break;
        case 'APPROVED': counts.approved = count; break;
        case 'JOINED': counts.joined = count; break;
        case 'COMPLETED': counts.completed = count; break;
        case 'REJECTED': counts.rejected = count; break;
      }
    });

    // Process company breakdown
    const companyMap = new Map<string, { count: number; location?: string }>();

    activeInternships.forEach((app) => {
      const companyName = app.companyName || 'Unknown';
      const location = app.companyAddress;

      // Company aggregation
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, { count: 0, location });
      }
      const company = companyMap.get(companyName)!;
      company.count++;
    });

    // Convert to sorted arrays
    const totalUniqueCompanies = companyMap.size;
    const byCompany = Array.from(companyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      ...counts,
      activeRate: total > 0 ? Math.round(((counts.approved + counts.selected + counts.joined) / total) * 100) : 0,
      completionRate: total > 0 ? Math.round((counts.completed / total) * 100) : 0,
      totalUniqueCompanies,
      byCompany,
    };
  }

  /**
   * Get placement statistics (optimized with parallel queries)
   */
  async getPlacementStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Run queries in parallel (self-identified internships only, active students)
    const [totalStudents, completedApplications] = await Promise.all([
      this.prisma.student.count({
        where: { institutionId, user: { active: true } },
      }),
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId, user: { active: true } },
          isSelfIdentified: true,
          status: 'COMPLETED',
        },
        select: {
          companyName: true,
        },
      }),
    ]);

    const placedCount = completedApplications.length;

    return {
      totalStudents,
      placedCount,
      placementRate: totalStudents > 0 ? Math.round((placedCount / totalStudents) * 100) : 0,
    };
  }

  /**
   * Get mentor assignment statistics
   */
  async getMentorStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Run all queries in parallel
    const [
      totalMentors,
      allAssignments,
      totalStudents,
    ] = await Promise.all([
      // Count all mentors (TEACHER + FACULTY_COORDINATOR)
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
      }),
      // Get all active assignments to compute mentor with assignments
      // Only count assignments for active students to match totalStudents count
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId, user: { active: true } },
          isActive: true,
        },
        select: {
          mentorId: true,
          studentId: true,
        },
      }),
      // Total students
      this.prisma.student.count({
        where: { institutionId, user: { active: true } },
      }),
    ]);

    // Compute unique mentors with assignments
    // Note: allAssignments includes cross-institution mentors (mentors from other institutions)
    const allMentorsWithAssignments = new Set(allAssignments.map(a => a.mentorId));

    // Get local mentors (from this institution) who have assignments
    const localMentors = await this.prisma.user.findMany({
      where: {
        institutionId,
        role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
        active: true,
      },
      select: { id: true },
    });
    const localMentorIds = new Set(localMentors.map(m => m.id));

    // Count how many of our local mentors have assignments
    const localMentorsWithAssignments = [...allMentorsWithAssignments].filter(id => localMentorIds.has(id)).length;
    // Count external mentors (from other institutions) mentoring our students
    const externalMentors = [...allMentorsWithAssignments].filter(id => !localMentorIds.has(id)).length;

    const assignedMentors = localMentorsWithAssignments;
    const unassignedMentors = totalMentors - assignedMentors;

    // Compute students with/without mentors
    const studentsWithMentors = new Set(allAssignments.map(a => a.studentId)).size;
    // Ensure non-negative (safeguard against edge cases)
    const studentsWithoutMentors = Math.max(0, totalStudents - studentsWithMentors);

    // Get mentor distribution for load balancing display
    // Count unique students per mentor (avoid counting duplicate assignment records)
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of allAssignments) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const avgStudentsPerMentor = assignedMentors > 0
      ? Math.round((studentsWithMentors / assignedMentors) * 10) / 10
      : 0;

    // Get external assignments (our mentors mentoring students from other institutions)
    // Wrap in try-catch to handle edge cases gracefully
    let externalAssignments = [];
    let externalStudentsCount = 0;
    let ourMentorsWithExternalAssignments = 0;
    let externalInstitutions = [];

    try {
      const localMentorIdsArray = Array.from(localMentorIds);

      // Only query if we have mentors to check
      if (localMentorIdsArray.length > 0) {
        externalAssignments = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: { in: localMentorIdsArray },
            student: {
              institutionId: { not: institutionId },
              user: { active: true },
            },
            isActive: true,
          },
          include: {
            student: {
              select: {
                id: true,
                institutionId: true,
                Institution: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
          take: 1000, // Limit for performance
        });

        // Calculate external mentoring stats with null safety
        externalStudentsCount = new Set(
          externalAssignments
            .filter(a => a.studentId)
            .map(a => a.studentId)
        ).size;

        ourMentorsWithExternalAssignments = new Set(
          externalAssignments
            .filter(a => a.mentorId)
            .map(a => a.mentorId)
        ).size;

        // Get unique external institutions (filter out null/undefined)
        const institutionMap = new Map();
        externalAssignments.forEach(a => {
          if (a.student?.Institution?.id) {
            institutionMap.set(a.student.Institution.id, a.student.Institution);
          }
        });
        externalInstitutions = Array.from(institutionMap.values());
      }
    } catch (error) {
      // Log error but don't fail the entire request
      this.logger.warn(`Failed to fetch external assignments for institution ${institutionId}:`, error);
      // externalAssignments remains empty array, counts remain 0
    }

    return {
      mentors: {
        total: totalMentors,
        assigned: assignedMentors,
        unassigned: unassignedMentors,
        external: externalMentors, // Mentors from other institutions mentoring our students
      },
      students: {
        total: totalStudents,
        withMentor: studentsWithMentors,
        withoutMentor: studentsWithoutMentors,
      },
      avgStudentsPerMentor,
      mentorLoadDistribution: Array.from(mentorStudentMap.entries())
        .map(([mentorId, students]) => ({
          mentorId,
          studentCount: students.size,
          isExternal: !localMentorIds.has(mentorId),
        }))
        .sort((a, b) => b.studentCount - a.studentCount),
      // New: External mentoring stats (our faculty mentoring students from other institutions)
      externalMentoring: {
        ourMentorsWithExternalAssignments,
        externalStudentsCount,
        externalInstitutions: externalInstitutions.map(inst => ({
          id: inst?.id || '',
          name: inst?.name || 'Unknown Institution',
          code: inst?.code || '',
        })),
      },
    };
  }

  /**
   * Remove mentor assignment from a student
   */
  async removeMentorAssignment(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Verify student belongs to institution
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Deactivate active assignment
    const result = await this.prisma.mentorAssignment.updateMany({
      where: {
        studentId,
        isActive: true,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: principalId,
        deactivationReason: 'Removed by principal',
      },
    });

    await this.cache.invalidateByTags([
      'mentors',
      'principal', // Invalidate dashboard cache to update unassigned students count
      `student:${studentId}`,
      `institution:${principal.institutionId}`,
    ]);

    return {
      success: true,
      message: result.count > 0 ? 'Mentor assignment removed' : 'No active assignment found',
      count: result.count,
    };
  }

  /**
   * Bulk unassign mentors from students
   */
  async bulkUnassignMentors(principalId: string, studentIds: string[]) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    if (!studentIds || studentIds.length === 0) {
      throw new BadRequestException('studentIds is required');
    }

    // Verify students belong to institution
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        institutionId: principal.institutionId,
      },
      select: { id: true },
    });

    if (students.length !== studentIds.length) {
      throw new NotFoundException('One or more students not found');
    }

    // Deactivate all active assignments for these students
    const result = await this.prisma.mentorAssignment.updateMany({
      where: {
        studentId: { in: studentIds },
        isActive: true,
      },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: principalId,
        deactivationReason: 'Bulk unassigned by principal',
      },
    });

    await this.cache.invalidateByTags([
      'mentors',
      'principal', // Invalidate dashboard cache to update unassigned students count
      ...studentIds.map(id => `student:${id}`),
      `institution:${principal.institutionId}`,
    ]);

    return {
      success: true,
      message: `Removed ${result.count} mentor assignment(s)`,
      count: result.count,
    };
  }

  /**
   * Auto-assign unassigned students to mentors evenly
   */
  async autoAssignMentors(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Get current academic year
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const academicYear = month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    // Get all mentors and active assignments in parallel
    const [mentors, allActiveAssignments] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      // Get all active assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId },
          isActive: true,
        },
        select: { studentId: true, mentorId: true },
      }),
    ]);

    if (mentors.length === 0) {
      throw new BadRequestException('No mentors available for assignment');
    }

    // Build unique students per mentor map and track assigned students
    const mentorStudentMap = new Map<string, Set<string>>();
    const assignedStudentIds = new Set<string>();
    for (const { mentorId, studentId } of allActiveAssignments) {
      assignedStudentIds.add(studentId);
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const unassignedStudents = await this.prisma.student.findMany({
      where: {
        institutionId,
        user: { active: true },
        id: { notIn: Array.from(assignedStudentIds) },
      },
      select: { id: true },
    });

    if (unassignedStudents.length === 0) {
      return {
        success: true,
        message: 'All students already have mentors assigned',
        assignedCount: 0,
      };
    }

    // Sort mentors by current load (ascending) for even distribution
    // Using unique student count, not assignment record count
    const mentorLoads = mentors.map(m => ({
      id: m.id,
      name: m.name,
      count: mentorStudentMap.get(m.id)?.size || 0,
    })).sort((a, b) => a.count - b.count);

    // Distribute students evenly
    const assignments: { studentId: string; mentorId: string }[] = [];
    let mentorIndex = 0;

    for (const student of unassignedStudents) {
      assignments.push({
        studentId: student.id,
        mentorId: mentorLoads[mentorIndex].id,
      });

      // Update the count in our local tracking
      mentorLoads[mentorIndex].count++;

      // Re-sort to always pick the mentor with least students
      mentorLoads.sort((a, b) => a.count - b.count);
    }

    // Create all assignments in a transaction
    const createdAssignments = await this.prisma.$transaction(
      assignments.map(({ studentId, mentorId }) =>
        this.prisma.mentorAssignment.create({
          data: {
            studentId,
            mentorId,
            assignedBy: principalId,
            academicYear,
            assignmentReason: 'Auto-assigned by system',
            isActive: true,
          },
        }),
      ),
    );

    await this.cache.invalidateByTags([
      'mentors',
      'principal', // Invalidate dashboard cache to update unassigned students count
      ...assignments.map(a => `student:${a.studentId}`),
      `institution:${institutionId}`,
    ]);

    return {
      success: true,
      message: `Auto-assigned ${createdAssignments.length} student(s) to mentors`,
      assignedCount: createdAssignments.length,
      distribution: mentorLoads.map(m => ({
        mentorId: m.id,
        mentorName: m.name,
        studentCount: m.count,
      })),
    };
  }

  /**
   * Get faculty progress list with assigned students count
   */
  async getFacultyProgressList(principalId: string, query: any) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Use query params for month/year if provided, otherwise use current date
    const now = new Date();
    const selectedMonth = query.month ? parseInt(query.month, 10) : now.getMonth() + 1; // 1-12
    const selectedYear = query.year ? parseInt(query.year, 10) : now.getFullYear();

    // Calculate month boundaries for the selected month
    const selectedMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
    selectedMonthStart.setHours(0, 0, 0, 0);
    const selectedMonthEnd = new Date(selectedYear, selectedMonth, 0);
    selectedMonthEnd.setHours(23, 59, 59, 999);

    const { search } = query;

    const where: any = {
      institutionId: principal.institutionId,
      role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
      active: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [faculty, mentorAssignmentsList, visitCounts, reportCounts, internshipApps, currentMonthVisits, currentMonthReports] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          designation: true,
          branchName: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Get all mentor assignments with internship data for expected calculations
      // Only filter by isSelfIdentified - date overlap check will determine if counted
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId: principal.institutionId, user: { active: true } },
          isActive: true,
        },
        orderBy: {
          assignmentDate: 'desc',
        },
        select: {
          assignmentDate: true,
          mentorId: true,
          studentId: true,
          student: {
            select: {
              internshipApplications: {
                where: {
                  isActive: true,
                  isSelfIdentified: true,
                  // Exclude rejected/withdrawn - only include active applications
                  status: { notIn: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
                },
                take: 1,
                select: {
                  startDate: true,
                  endDate: true,
                },
              },
            },
          },
        },
      }),
      // Get visit counts per faculty (cumulative)
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          isDeleted: false,
          faculty: { institutionId: principal.institutionId },
          application: {
            student: { institutionId: principal.institutionId, user: { active: true } },
          },
        },
        _count: { id: true },
      }),
      // Get report counts per student (to map to mentor) - cumulative
      this.prisma.monthlyReport.findMany({
        where: {
          isDeleted: false,
          application: {
            isActive: true,
            isSelfIdentified: true,
            student: { institutionId: principal.institutionId, user: { active: true } },
          },
        },
        select: {
          studentId: true,
          status: true,
        },
      }),
      // Get internship applications for cumulative expected counts
      // Exclude rejected/withdrawn - include all active applications
      this.prisma.internshipApplication.findMany({
        where: {
          student: { institutionId: principal.institutionId, user: { active: true } },
          isSelfIdentified: true,
          status: { notIn: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
          isActive: true,
        },
        select: {
          studentId: true,
          totalExpectedReports: true,
          totalExpectedVisits: true,
        },
      }),
      // Selected month visits per faculty
      this.prisma.facultyVisitLog.groupBy({
        by: ['facultyId'],
        where: {
          isDeleted: false,
          faculty: { institutionId: principal.institutionId },
          application: {
            student: { institutionId: principal.institutionId, user: { active: true } },
          },
          visitDate: {
            gte: selectedMonthStart,
            lte: selectedMonthEnd,
          },
        },
        _count: { id: true },
      }),
      // Selected month reports (submitted/approved)
      this.prisma.monthlyReport.findMany({
        where: {
          isDeleted: false,
          application: {
            isActive: true,
            isSelfIdentified: true,
            student: { institutionId: principal.institutionId, user: { active: true } },
          },
          reportMonth: selectedMonth,
          reportYear: selectedYear,
          status: { in: ['APPROVED', 'SUBMITTED'] },
        },
        select: {
          studentId: true,
        },
      }),
    ]);

    // Deduplicate to a single active assignment per student (latest assignment wins)
    const uniqueAssignmentsMap = new Map<string, (typeof mentorAssignmentsList)[number]>();
    for (const assignment of mentorAssignmentsList) {
      if (!uniqueAssignmentsMap.has(assignment.studentId)) {
        uniqueAssignmentsMap.set(assignment.studentId, assignment);
      }
    }
    const effectiveAssignments = Array.from(uniqueAssignmentsMap.values());

    const effectiveAssignmentsWithInternship = effectiveAssignments.filter(
      (assignment) => (assignment.student?.internshipApplications?.length || 0) > 0,
    );

    // Compute unique students per mentor
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of effectiveAssignmentsWithInternship) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    // Build student -> mentor map for report lookup
    const studentToMentorMap = new Map<string, string>();
    for (const { mentorId, studentId } of effectiveAssignmentsWithInternship) {
      studentToMentorMap.set(studentId, mentorId);
    }

    // Build visit count map
    const visitCountMap = new Map(visitCounts.map(v => [v.facultyId, v._count.id]));

    // Build report count map per mentor (based on assigned students' reports)
    const reportCountMap = new Map<string, { pending: number; completed: number }>();
    for (const report of reportCounts) {
      const mentorId = studentToMentorMap.get(report.studentId);
      if (!mentorId) continue; // Skip reports from students without mentors

      if (!reportCountMap.has(mentorId)) {
        reportCountMap.set(mentorId, { pending: 0, completed: 0 });
      }

      const counts = reportCountMap.get(mentorId)!;
      // APPROVED is considered completed (auto-approved on submission)
      // DRAFT is still pending submission
      if (report.status === MonthlyReportStatus.APPROVED || report.status === MonthlyReportStatus.REJECTED) {
        counts.completed++;
      } else {
        counts.pending++;
      }
    }

    // Build expected counts map per mentor (cumulative)
    const expectedCountsMap = new Map<string, { expectedReports: number; expectedVisits: number }>();
    for (const app of internshipApps) {
      const mentorId = studentToMentorMap.get(app.studentId);
      if (!mentorId) continue;

      if (!expectedCountsMap.has(mentorId)) {
        expectedCountsMap.set(mentorId, { expectedReports: 0, expectedVisits: 0 });
      }

      const counts = expectedCountsMap.get(mentorId)!;
      counts.expectedReports += app.totalExpectedReports || 0;
      counts.expectedVisits += app.totalExpectedVisits || 0;
    }

    // Build current month visit count map per faculty
    const currentMonthVisitMap = new Map(currentMonthVisits.map(v => [v.facultyId, v._count.id]));

    // Build current month report count map per mentor
    const currentMonthReportMap = new Map<string, number>();
    for (const report of currentMonthReports) {
      const mentorId = studentToMentorMap.get(report.studentId);
      if (!mentorId) continue;
      currentMonthReportMap.set(mentorId, (currentMonthReportMap.get(mentorId) || 0) + 1);
    }

    // Build selected month EXPECTED counts per mentor
    // Uses monthly inclusion rules (first >15, last any, middle >10)
    const selectedMonthExpectedMap = new Map<string, { expectedReports: number; expectedVisits: number }>();
    for (const assignment of effectiveAssignmentsWithInternship) {
      const { mentorId, student } = assignment;
      const app = student.internshipApplications?.[0];
      if (!app || !app.startDate || !app.endDate) continue;

      // Use monthly inclusion rules for this month
      const monthCycle = getMonthCycle(selectedYear, selectedMonth, new Date(app.startDate), new Date(app.endDate));

      if (monthCycle) {
        // Month is included per monthly rules
        if (!selectedMonthExpectedMap.has(mentorId)) {
          selectedMonthExpectedMap.set(mentorId, { expectedReports: 0, expectedVisits: 0 });
        }
        const counts = selectedMonthExpectedMap.get(mentorId)!;
        counts.expectedReports++;
        counts.expectedVisits++;
      }
    }

    return {
      // Include selected month info at the top level
      currentMonth: selectedMonth,
      currentYear: selectedYear,
      faculty: faculty.map((f) => {
        const reportCounts = reportCountMap.get(f.id) || { pending: 0, completed: 0 };
        const expectedCounts = expectedCountsMap.get(f.id) || { expectedReports: 0, expectedVisits: 0 };
        const totalVisits = visitCountMap.get(f.id) || 0;
        const selectedMonthExpected = selectedMonthExpectedMap.get(f.id) || { expectedReports: 0, expectedVisits: 0 };
        const selectedMonthVisitsCount = currentMonthVisitMap.get(f.id) || 0;
        const selectedMonthReportsCount = currentMonthReportMap.get(f.id) || 0;

        return {
          id: f.id,
          name: f.name,
          email: f.email,
          phoneNo: f.phoneNo,
          employeeId: null,
          designation: f.designation,
          profileImage: null,
          branchId: null,
          branchName: f.branchName ?? null,
          assignedCount: mentorStudentMap.get(f.id)?.size || 0,
          // Cumulative visits
          totalVisits,
          expectedVisits: expectedCounts.expectedVisits,
          // Cumulative reports
          pendingReports: reportCounts.pending,
          completedReports: reportCounts.completed,
          totalReports: reportCounts.pending + reportCounts.completed,
          expectedReports: expectedCounts.expectedReports,
          // Selected month specific data
          currentMonthVisits: selectedMonthVisitsCount,
          currentMonthExpectedVisits: selectedMonthExpected.expectedVisits,
          currentMonthReports: selectedMonthReportsCount,
          currentMonthExpectedReports: selectedMonthExpected.expectedReports,
        };
      }),
    };
  }

  /**
   * Get detailed faculty progress with students and visits
   */
  async getFacultyProgressDetails(principalId: string, facultyId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    // Get faculty details - can be from this institution OR an external mentor
    // who has students from this institution assigned to them
    const faculty = await this.prisma.user.findFirst({
      where: {
        id: facultyId,
        role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        designation: true,
        institutionId: true,
        branchName: true,
        Institution: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    // Check if this is an external faculty - verify they have at least one student from our institution
    const isExternalFaculty = faculty.institutionId !== principal.institutionId;
    if (isExternalFaculty) {
      const hasOurStudents = await this.prisma.mentorAssignment.findFirst({
        where: {
          mentorId: facultyId,
          isActive: true,
          student: { institutionId: principal.institutionId },
        },
      });
      if (!hasOurStudents) {
        throw new NotFoundException('Faculty not found');
      }
    }

    // Get assigned students with their internship details
    // Only show students from this institution (for cross-institution mentors, only show relevant students)
    const mentorAssignments = await this.prisma.mentorAssignment.findMany({
      where: {
        mentorId: facultyId,
        isActive: true,
        student: { institutionId: principal.institutionId },
      },
      include: {
        student: {
          include: {
            user: { select: { name: true, rollNumber: true } },
            batch: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            internshipApplications: {
              where: {
                OR: [
                  { status: { in: ['JOINED', 'COMPLETED', 'SELECTED', 'APPROVED'] } },
                  { isSelfIdentified: true },
                ],
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                internshipPhase: true,
                isSelfIdentified: true,
                companyName: true,
                companyAddress: true,
                companyContact: true,
                companyEmail: true,
                jobProfile: true,
                stipend: true,
                internshipDuration: true,
                startDate: true,
                endDate: true,
                facultyVisitLogs: {
                  where: { facultyId },
                  orderBy: { visitDate: 'desc' },
                  take: 1,
                  select: { visitDate: true },
                },
                _count: {
                  select: { facultyVisitLogs: { where: { facultyId } } },
                },
              },
            },
          },
        },
      },
    });

    // Get all visits by this faculty
    const visits = await this.prisma.facultyVisitLog.findMany({
      where: {
        facultyId,
        isDeleted: false,
        application: {
          student: {
            institutionId: principal.institutionId,
          },
        },
      },
      orderBy: { visitDate: 'desc' },
      include: {
        application: {
          include: {
            student: {
              select: { id: true, user: { select: { name: true, rollNumber: true } } },
            },
          },
        },
      },
    });

    // Calculate current month info for queries
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const currentMonth = thisMonth + 1; // 1-indexed for database
    const currentYear = thisYear;

    // Get student IDs assigned to this faculty
    const assignedStudentIds = mentorAssignments.map((a) => a.student.id);

    // Get monthly reports for current month from assigned students
    const currentMonthReports = assignedStudentIds.length > 0
      ? await this.prisma.monthlyReport.count({
          where: {
            isDeleted: false,
            studentId: { in: assignedStudentIds },
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: { in: ['APPROVED', 'SUBMITTED'] },
          },
        })
      : 0;

    // Calculate expected reports for current month using getMonthCycle
    // Include all active internship statuses (not just JOINED)
    const validStatuses = ['JOINED', 'APPROVED', 'SELECTED', 'COMPLETED'];
    let currentMonthExpectedReports = 0;
    for (const assignment of mentorAssignments) {
      const app = assignment.student.internshipApplications[0];
      // Skip if no app, no dates, or invalid status (unless self-identified)
      if (!app || !app.startDate || !app.endDate) continue;
      if (!app.isSelfIdentified && !validStatuses.includes(app.status)) continue;

      const monthCycle = getMonthCycle(currentYear, currentMonth, app.startDate, app.endDate);
      if (monthCycle) {
        currentMonthExpectedReports++;
      }
    }

    // Calculate expected visits for current month using getMonthCycle
    let currentMonthExpectedVisits = 0;
    for (const assignment of mentorAssignments) {
      const app = assignment.student.internshipApplications[0];
      // Skip if no app, no dates, or invalid status (unless self-identified)
      if (!app || !app.startDate || !app.endDate) continue;
      if (!app.isSelfIdentified && !validStatuses.includes(app.status)) continue;

      const monthCycle = getMonthCycle(currentYear, currentMonth, app.startDate, app.endDate);
      if (monthCycle) {
        currentMonthExpectedVisits++;
      }
    }

    // Calculate stats
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    const visitsThisMonth = visits.filter((v) => {
      const vDate = new Date(v.visitDate);
      return vDate.getMonth() === thisMonth && vDate.getFullYear() === thisYear;
    }).length;

    const visitsLastMonth = visits.filter((v) => {
      const vDate = new Date(v.visitDate);
      return vDate.getMonth() === lastMonth && vDate.getFullYear() === lastMonthYear;
    }).length;

    // For scheduled visits, we count future visits
    const scheduledNextMonth = visits.filter((v) => {
      const vDate = new Date(v.visitDate);
      return vDate > now && vDate.getMonth() === nextMonth && vDate.getFullYear() === nextMonthYear;
    }).length;

    // Calculate missed visits (months with active students but no visits)
    let missedVisits = 0;
    const studentsWithActiveInternships = mentorAssignments.filter((a) => {
      const app = a.student.internshipApplications[0];
      if (!app || !app.startDate || !app.endDate) return false;
      // Include self-identified or valid status internships
      return app.isSelfIdentified || validStatuses.includes(app.status);
    });

    // Simple heuristic: if a student has been on internship for a month and no visit, it's missed
    for (const assignment of studentsWithActiveInternships) {
      const app = assignment.student.internshipApplications[0];
      const lastVisit = app.facultyVisitLogs?.[0]?.visitDate;
      if (!lastVisit) {
        missedVisits++;
      } else {
        const daysSinceVisit = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceVisit > 30) {
          missedVisits++;
        }
      }
    }

    // Build visit summary for past 6 months
    const visitSummary = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const monthVisits = visits.filter((v) => {
        const vDate = new Date(v.visitDate);
        return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
      }).length;
      visitSummary.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        monthName: MONTH_NAMES[d.getMonth()],
        visits: monthVisits,
        isPast: d < now,
      });
    }

    // Transform students data
    const students = mentorAssignments.map((a) => {
      const app = a.student.internshipApplications[0];
      const isSelfIdentified = (app as any)?.isSelfIdentified;
      const startDate = (app as any)?.startDate;
      const endDate = (app as any)?.endDate;

      // Calculate expected visits based on internship duration
      let expectedVisits = 0;
      if (startDate && endDate) {
        expectedVisits = getTotalExpectedVisits(new Date(startDate), new Date(endDate));
      }

      return {
        id: a.student.id,
        applicationId: app?.id || null,
        name: a.student.user?.name,
        rollNumber: a.student.user?.rollNumber,
        batch: a.student.batch?.name || 'N/A',
        department: a.student.branch?.name || 'N/A',
        internshipTitle: (app as any)?.jobProfile || null,
        companyName: (app as any)?.companyName || null,
        jobProfile: (app as any)?.jobProfile || null,
        stipend: (app as any)?.stipend || null,
        internshipDuration: (app as any)?.internshipDuration || null,
        startDate: startDate || null,
        endDate: endDate || null,
        isSelfIdentified: isSelfIdentified || false,
        internshipPhase: (app as any)?.internshipPhase || null,
        totalVisits: app?._count?.facultyVisitLogs || 0,
        expectedVisits,
        lastVisitDate: app?.facultyVisitLogs?.[0]?.visitDate || null,
      };
    });

    // Transform visits data
    const transformedVisits = visits.map((v) => ({
      id: v.id,
      visitDate: v.visitDate,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      visitType: v.visitType,
      visitDuration: v.visitDuration,
      visitLocation: v.visitLocation,
      studentName: v.application.student.user?.name,
      studentRollNumber: v.application.student.user?.rollNumber,
      companyName: (v.application as any).companyName || 'N/A',
      internshipTitle: (v.application as any).jobProfile || 'N/A',
      titleOfProjectWork: v.titleOfProjectWork,
      assistanceRequiredFromInstitute: v.assistanceRequiredFromInstitute,
      responseFromOrganisation: v.responseFromOrganisation,
      remarksOfOrganisationSupervisor: v.remarksOfOrganisationSupervisor,
      significantChangeInPlan: v.significantChangeInPlan,
      observationsAboutStudent: v.observationsAboutStudent,
      feedbackSharedWithStudent: v.feedbackSharedWithStudent,
      studentPerformance: v.studentPerformance,
      workEnvironment: v.workEnvironment,
      industrySupport: v.industrySupport,
      skillsDevelopment: v.skillsDevelopment,
      issuesIdentified: v.issuesIdentified,
      recommendations: v.recommendations,
      actionRequired: v.actionRequired,
      followUpRequired: v.followUpRequired,
      nextVisitDate: v.nextVisitDate,
      reportSubmittedTo: v.reportSubmittedTo,
      overallRating: v.overallSatisfactionRating || v.studentProgressRating,
      status: v.status,
    }));

    return {
      faculty,
      stats: {
        totalStudents: mentorAssignments.length,
        totalVisits: visits.length,
        visitsLastMonth,
        visitsThisMonth,
        scheduledNextMonth,
        missedVisits,
        // Current month stats
        currentMonth,
        currentYear,
        // Monthly reports stats for current month
        reportsSubmittedThisMonth: currentMonthReports,
        reportsExpectedThisMonth: currentMonthExpectedReports,
        reportsPendingThisMonth: Math.max(0, currentMonthExpectedReports - currentMonthReports),
        // Faculty visits stats for current month
        visitsCompletedThisMonth: visitsThisMonth,
        visitsExpectedThisMonth: currentMonthExpectedVisits,
        visitsPendingThisMonth: Math.max(0, currentMonthExpectedVisits - visitsThisMonth),
      },
      students,
      visits: transformedVisits,
      visitSummary,
    };
  }

  /**
   * Get mentor coverage statistics for principal dashboard
   */
  async getMentorCoverage(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;

    // Get mentor coverage stats
    const [
      totalStudents,
      totalStudentsWithInternships,
      studentsWithMentorsData,
      mentors,
      allAssignments,
    ] = await Promise.all([
      // Total active students
      this.prisma.student.count({
        where: { institutionId, user: { active: true } },
      }),
      // Total active students with ongoing internships
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId, user: { active: true } },
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
        },
      }),
      // Unique active students with active mentor assignments
      this.prisma.mentorAssignment.findMany({
        where: {
          student: {
            institutionId,
            user: { active: true },
          },
          isActive: true,
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      // Get all mentors (TEACHER + FACULTY_COORDINATOR)
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] },
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      }),
      // Get all active mentor assignments to compute unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          student: { institutionId, user: { active: true } },
          isActive: true,
        },
        select: {
          mentorId: true,
          studentId: true,
        },
      }),
    ]);

    const studentsWithMentorsCount = studentsWithMentorsData.length;
    const studentsWithoutMentorsCount = Math.max(0, totalStudents - studentsWithMentorsCount);
    const coveragePercentage = totalStudents > 0
      ? Math.round((studentsWithMentorsCount / totalStudents) * 100)
      : 100;

    // Compute unique students per mentor (avoid counting duplicate assignment records)
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of allAssignments) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    const mentorLoadDistribution = mentors
      .map(m => ({
        mentorId: m.id,
        mentorName: m.name,
        mentorEmail: m.email,
        assignedStudents: mentorStudentMap.get(m.id)?.size || 0,
      }))
      .sort((a, b) => b.assignedStudents - a.assignedStudents);

    const avgLoadPerMentor = mentors.length > 0
      ? Math.round((studentsWithMentorsCount / mentors.length) * 10) / 10
      : 0;

    return {
      totalStudents,
      totalStudentsWithInternships,
      studentsWithMentors: studentsWithMentorsCount,
      studentsWithoutMentors: studentsWithoutMentorsCount,
      coveragePercentage,
      totalMentors: mentors.length,
      averageLoadPerMentor: avgLoadPerMentor,
      mentorLoadDistribution,
    };
  }

  /**
   * Get compliance metrics for principal dashboard with 6-month trend
   *
   * NEW FORMULA (aligned with state dashboard):
   * Compliance Score = (MentorRate + JoiningLetterRate) / 2
   * - MentorRate = studentsWithActiveMentors / activeStudents * 100
   * - JoiningLetterRate = joiningLettersUploaded / activeStudents * 100
   *
   * Visit and Report compliance are shown as separate informational metrics (not in overall score)
   */
  async getComplianceMetrics(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get current active students count for compliance calculation
    const activeStudents = await this.prisma.student.count({
      where: {
        institutionId,
        user: { active: true },
      },
    });

    // Get current compliance metrics (MentorRate + JoiningLetterRate)
    const [studentsWithActiveMentors, joiningLettersUploaded] = await Promise.all([
      // Count students with active mentor assignments
      this.prisma.mentorAssignment.count({
        where: {
          student: { institutionId, user: { active: true } },
          isActive: true,
        },
      }),
      // Count joining letters uploaded (non-empty joiningLetterUrl)
      this.prisma.internshipApplication.count({
        where: {
          student: { institutionId, user: { active: true } },
          isSelfIdentified: true,
          joiningLetterUrl: { not: null, notIn: [''] },
        },
      }),
    ]);

    // Calculate compliance rates using activeStudents as denominator
    const mentorRate = activeStudents > 0
      ? Math.min((studentsWithActiveMentors / activeStudents) * 100, 100)
      : null;

    const joiningLetterRate = activeStudents > 0
      ? Math.min((joiningLettersUploaded / activeStudents) * 100, 100)
      : null;

    // Overall compliance score = (MentorRate + JoiningLetterRate) / 2
    // Returns null if activeStudents = 0
    const overallComplianceScore = activeStudents > 0
      ? Math.round(((mentorRate || 0) + (joiningLetterRate || 0)) / 2)
      : null;

    // Calculate 6-month trend data for compliance metrics
    const trendData: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      // Get historical active students count (approximate using current snapshot)
      // For more accurate historical data, a snapshot table would be needed
      const [
        historicalActiveStudents,
        historicalMentorAssignments,
        historicalJoiningLetters,
        studentsWithInternships,
        facultyVisits,
        reportsSubmitted,
      ] = await Promise.all([
        // Active students (current snapshot)
        this.prisma.student.count({
          where: {
            institutionId,
            user: { active: true },
          },
        }),
        // Mentor assignments (current snapshot)
        this.prisma.mentorAssignment.count({
          where: {
            student: { institutionId, user: { active: true } },
            isActive: true,
          },
        }),
        // Joining letters uploaded
        this.prisma.internshipApplication.count({
          where: {
            student: { institutionId, user: { active: true } },
            isSelfIdentified: true,
            joiningLetterUrl: { not: null, notIn: [''] },
          },
        }),
        // Students with ongoing internships (for informational visit/report metrics)
        this.prisma.internshipApplication.count({
          where: {
            student: { institutionId, user: { active: true } },
            isSelfIdentified: true,
            status: ApplicationStatus.JOINED,
            internshipPhase: InternshipPhase.ACTIVE,
            startDate: { lte: endOfMonth },
          },
        }),
        // Faculty visits for informational metrics
        this.prisma.facultyVisitLog.count({
          where: {
            isDeleted: false,
            status: 'COMPLETED',
            application: {
              student: { institutionId, user: { active: true } },
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE,
              startDate: { lte: endOfMonth },
            },
            visitDate: { gte: startOfMonth, lte: endOfMonth },
          },
        }),
        // Reports submitted for informational metrics
        this.prisma.monthlyReport.count({
          where: {
            isDeleted: false,
            student: { institutionId, user: { active: true } },
            reportMonth: month,
            reportYear: year,
            status: { in: ['SUBMITTED', 'APPROVED'] },
          },
        }),
      ]);

      // Calculate compliance rates for trend (MentorRate + JoiningLetterRate)
      const trendMentorRate = historicalActiveStudents > 0
        ? Math.min((historicalMentorAssignments / historicalActiveStudents) * 100, 100)
        : null;

      const trendJoiningLetterRate = historicalActiveStudents > 0
        ? Math.min((historicalJoiningLetters / historicalActiveStudents) * 100, 100)
        : null;

      // Overall compliance score for trend
      const trendOverallScore = historicalActiveStudents > 0
        ? Math.round(((trendMentorRate || 0) + (trendJoiningLetterRate || 0)) / 2)
        : null;

      // Informational metrics (not part of compliance score)
      const visitCompliance = studentsWithInternships > 0
        ? Math.round(Math.min((facultyVisits / studentsWithInternships) * 100, 100))
        : null;

      const reportCompliance = studentsWithInternships > 0
        ? Math.round(Math.min((reportsSubmitted / studentsWithInternships) * 100, 100))
        : null;

      trendData.push({
        month,
        year,
        monthName: MONTH_NAMES[month - 1],
        // New compliance metrics
        overallScore: trendOverallScore,
        mentorRate: trendMentorRate !== null ? Math.round(trendMentorRate) : null,
        joiningLetterRate: trendJoiningLetterRate !== null ? Math.round(trendJoiningLetterRate) : null,
        activeStudents: historicalActiveStudents,
        studentsWithActiveMentors: historicalMentorAssignments,
        joiningLettersUploaded: historicalJoiningLetters,
        // Informational metrics (not in compliance score)
        visitCompliance,
        reportCompliance,
        facultyVisits,
        reportsSubmitted,
        studentsWithInternships,
      });
    }

    // Current month stats
    const currentMonthData = trendData[trendData.length - 1];

    return {
      currentMonth: {
        month: currentMonth,
        year: currentYear,
        // Primary compliance metrics
        overallScore: overallComplianceScore,
        mentorRate: mentorRate !== null ? Math.round(mentorRate) : null,
        joiningLetterRate: joiningLetterRate !== null ? Math.round(joiningLetterRate) : null,
        activeStudents,
        studentsWithActiveMentors,
        joiningLettersUploaded,
        // Informational metrics (separate from compliance score)
        visitComplianceRate: currentMonthData.visitCompliance,
        reportComplianceRate: currentMonthData.reportCompliance,
        facultyVisits: currentMonthData.facultyVisits,
        reportsSubmitted: currentMonthData.reportsSubmitted,
        studentsWithInternships: currentMonthData.studentsWithInternships,
      },
      trend: trendData,
      summary: {
        averageCompliance: trendData.filter(m => m.overallScore !== null).length > 0
          ? Math.round(
              trendData.filter(m => m.overallScore !== null).reduce((sum, m) => sum + m.overallScore, 0) /
              trendData.filter(m => m.overallScore !== null).length
            )
          : null,
        bestMonth: trendData.filter(m => m.overallScore !== null).reduce(
          (best, m) => (m.overallScore || 0) > (best?.overallScore || 0) ? m : best,
          trendData.find(m => m.overallScore !== null) || null
        ),
        worstMonth: trendData.filter(m => m.overallScore !== null).reduce(
          (worst, m) => (m.overallScore || 0) < (worst?.overallScore || Infinity) ? m : worst,
          trendData.find(m => m.overallScore !== null) || null
        ),
      },
    };
  }

  /**
   * Get enhanced dashboard alerts for principal
   * Includes urgent grievances, overdue reports, missing visits, and unassigned students
   */
  async getDashboardAlertsEnhanced(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    const institutionId = principal.institutionId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);

    // Define where clauses for reuse in both count and findMany
    const urgentGrievancesWhere: Prisma.GrievanceWhereInput = {
      student: { institutionId },
      status: { in: [GrievanceStatus.PENDING, GrievanceStatus.UNDER_REVIEW] },
      submittedDate: { lte: sevenDaysAgo },
    };

    const overdueReportsWhere: Prisma.StudentWhereInput = {
      institutionId,
      user: { active: true },
      internshipApplications: {
        some: {
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
          startDate: { lt: startOfCurrentMonth },
        },
      },
      monthlyReports: {
        none: {
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.APPROVED] },
        },
      },
    };

    const missingVisitsWhere: Prisma.StudentWhereInput = {
      institutionId,
      user: { active: true },
      internshipApplications: {
        some: {
          isSelfIdentified: true,
          status: ApplicationStatus.JOINED,
          internshipPhase: InternshipPhase.ACTIVE,
          startDate: { lte: thirtyDaysAgo },
          facultyVisitLogs: {
            none: {
              visitDate: { gte: thirtyDaysAgo },
            },
          },
        },
      },
    };

    // Students with self-identified internships (approved or active) but no active mentor assignment
    // Includes APPROVED/SELECTED/JOINED status and NOT_STARTED/ACTIVE phase
    const unassignedStudentsWhere: Prisma.StudentWhereInput = {
      institutionId,
      user: { active: true },
      internshipApplications: {
        some: {
          isSelfIdentified: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED, ApplicationStatus.JOINED] },
          internshipPhase: { in: [InternshipPhase.NOT_STARTED, InternshipPhase.ACTIVE] },
        },
      },
      mentorAssignments: {
        none: { isActive: true },
      },
    };

    // Run counts and findMany in parallel
    const [
      urgentGrievancesCount,
      overdueReportsCount,
      missingVisitsCount,
      unassignedStudentsCount,
      urgentGrievances,
      overdueReports,
      missingVisits,
      unassignedStudents,
      studentsWithSelfIdentified,
    ] = await Promise.all([
      // Actual counts (not limited)
      this.prisma.grievance.count({ where: urgentGrievancesWhere }),
      this.prisma.student.count({ where: overdueReportsWhere }),
      this.prisma.student.count({ where: missingVisitsWhere }),
      this.prisma.student.count({ where: unassignedStudentsWhere }),

      // Details (limited to 50 for display in modal tables)
      this.prisma.grievance.findMany({
        where: urgentGrievancesWhere,
        include: {
          student: {
            select: { id: true, user: { select: { name: true, rollNumber: true } } },
          },
        },
        orderBy: { submittedDate: 'asc' },
        take: 50,
      }),

      this.prisma.student.findMany({
        where: overdueReportsWhere,
        select: {
          id: true,
          user: { select: { name: true, rollNumber: true } },
          mentorAssignments: {
            where: { isActive: true },
            take: 1,
            select: {
              mentor: { select: { id: true, name: true } },
            },
          },
        },
        take: 50,
      }),

      this.prisma.student.findMany({
        where: missingVisitsWhere,
        select: {
          id: true,
          user: { select: { name: true, rollNumber: true } },
          internshipApplications: {
            where: {
              isSelfIdentified: true,
              status: ApplicationStatus.JOINED,
              internshipPhase: InternshipPhase.ACTIVE
            },
            take: 1,
            select: {
              facultyVisitLogs: {
                orderBy: { visitDate: 'desc' },
                take: 1,
                select: { visitDate: true },
              },
            },
          },
        },
        take: 50,
      }),

      this.prisma.student.findMany({
        where: unassignedStudentsWhere,
        select: {
          id: true,
          user: { select: { name: true, rollNumber: true } },
          batch: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        take: 50,
      }),

      // Fetch students with self-identified internships to filter pending joining letters using JavaScript
      // This avoids MongoDB count query issues with null/undefined/empty string handling
      this.prisma.student.findMany({
        where: {
          institutionId,
          user: { active: true },
          internshipApplications: {
            some: { isSelfIdentified: true },
          },
        },
        select: {
          id: true,
          user: { select: { name: true, rollNumber: true } },
          branch: { select: { id: true, name: true } },
          mentorAssignments: {
            where: { student: { user: { active: true } } },
            take: 1,
            select: {
              mentor: { select: { id: true, name: true } },
            },
          },
          internshipApplications: {
            where: { isSelfIdentified: true },
            take: 1,
            select: {
              joiningLetterUrl: true,
              companyName: true,
              startDate: true,
            },
          },
        },
        orderBy: { user: { name: 'asc' } },
      }),
    ]);

    // Filter pending joining letters using JavaScript for reliable null/undefined handling
    const pendingJoiningLetters = studentsWithSelfIdentified.filter(s => {
      const app = s.internshipApplications[0];
      return app && (!app.joiningLetterUrl || app.joiningLetterUrl === '');
    }).slice(0, 50); // Limit to 50 for modal display

    const pendingJoiningLettersCount = studentsWithSelfIdentified.filter(s => {
      const app = s.internshipApplications[0];
      return app && (!app.joiningLetterUrl || app.joiningLetterUrl === '');
    }).length;

    return {
      summary: {
        urgentGrievancesCount,
        overdueReportsCount,
        missingVisitsCount,
        unassignedStudentsCount,
        pendingJoiningLettersCount,
        totalAlerts: urgentGrievancesCount + overdueReportsCount + missingVisitsCount + unassignedStudentsCount + pendingJoiningLettersCount,
      },
      alerts: {
        urgentGrievances: urgentGrievances.map(g => ({
          grievanceId: g.id,
          title: g.title,
          status: g.status,
          submittedDate: g.submittedDate,
          studentId: g.student.id,
          studentName: g.student.user?.name,
          rollNumber: g.student.user?.rollNumber,
          daysPending: Math.floor((now.getTime() - new Date(g.submittedDate).getTime()) / (1000 * 60 * 60 * 24)),
          priority: 'urgent',
        })),
        overdueReports: overdueReports.map(s => ({
          studentId: s.id,
          studentName: s.user?.name,
          rollNumber: s.user?.rollNumber,
          mentorName: s.mentorAssignments[0]?.mentor?.name || null,
          daysOverdue: now.getDate() - 5,
          priority: 'high',
        })),
        missingVisits: missingVisits.map(s => ({
          studentId: s.id,
          studentName: s.user?.name,
          rollNumber: s.user?.rollNumber,
          lastVisitDate: s.internshipApplications[0]?.facultyVisitLogs[0]?.visitDate || null,
          daysSinceLastVisit: s.internshipApplications[0]?.facultyVisitLogs[0]?.visitDate
            ? Math.floor((now.getTime() - new Date(s.internshipApplications[0].facultyVisitLogs[0].visitDate).getTime()) / (1000 * 60 * 60 * 24))
            : null,
        })),
        unassignedStudents: unassignedStudents.map(s => ({
          studentId: s.id,
          studentName: s.user?.name,
          rollNumber: s.user?.rollNumber,
          batchName: s.batch?.name || null,
          branchName: s.branch?.name || null,
        })),
        pendingJoiningLetters: pendingJoiningLetters.map(s => ({
          studentId: s.id,
          studentName: s.user.name,
          rollNumber: s.user.rollNumber,
          branchName: s.branch?.name || null,
          mentorId: s.mentorAssignments[0]?.mentor?.id || null,
          mentorName: s.mentorAssignments[0]?.mentor?.name || null,
          companyName: s.internshipApplications[0]?.companyName || null,
          startDate: s.internshipApplications[0]?.startDate || null,
        })),
      },
    };
  }

  /**
   * Get joining letter statistics for the institution
   */
  async getJoiningLetterStats(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;
    const cacheKey = `principal:joining-letters:stats:${institutionId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Fetch all active applications and calculate counts using JavaScript
        // This avoids MongoDB count query issues with null/undefined/empty string handling
        const applications = await this.prisma.internshipApplication.findMany({
          where: { isSelfIdentified: true, isActive: true, student: { institutionId, user: { active: true } } },
          select: {
            joiningLetterUrl: true,
            reviewedAt: true,
            reviewRemarks: true,
          },
        });

        // Calculate counts using JavaScript for reliable null/undefined handling
        let noLetter = 0;
        let pendingReview = 0;
        let verified = 0;
        let rejected = 0;

        for (const app of applications) {
          const hasNoLetter = !app.joiningLetterUrl || app.joiningLetterUrl === '';
          if (hasNoLetter) {
            noLetter++;
          } else if (app.reviewedAt && !app.reviewRemarks?.toLowerCase().includes('reject')) {
            verified++;
          } else if (app.reviewedAt && app.reviewRemarks?.toLowerCase().includes('reject')) {
            rejected++;
          } else {
            pendingReview++;
          }
        }

        const total = applications.length;
        const uploaded = pendingReview + verified + rejected;

        return {
          summary: {
            total,
            noLetter,
            pendingReview,
            verified,
            rejected,
            uploaded,
            verificationRate: uploaded > 0 ? Math.round((verified / uploaded) * 100) : 0,
            uploadRate: total > 0 ? Math.round((uploaded / total) * 100) : 0,
          },
        };
      },
      { ttl: 5 * 60 * 1000 }, // 5 minute cache
    );
  }

  /**
   * Get joining letter stats grouped by mentor for dashboard modal
   */
  async getJoiningLettersByMentor(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;

    // Fetch all active internship applications with student's mentor assignment
    const applications = await this.prisma.internshipApplication.findMany({
      where: {
        isActive: true,
        student: { institutionId, user: { active: true } },
      },
      select: {
        id: true,
        joiningLetterUrl: true,
        student: {
          select: {
            id: true,
            mentorAssignments: {
              where: { isActive: true },
              select: {
                mentorId: true,
                mentor: {
                  select: { id: true, name: true },
                },
              },
              take: 1, // Get the active mentor assignment
            },
          },
        },
      },
    });

    // Group by mentor
    const mentorMap = new Map<string, {
      mentorId: string;
      mentorName: string;
      studentsWithInternship: number;
      pendingLetters: number;
      totalLetters: number;
    }>();

    let unassignedStats = {
      mentorId: 'unassigned',
      mentorName: 'Not Assigned',
      studentsWithInternship: 0,
      pendingLetters: 0,
      totalLetters: 0,
      isUnassigned: true,
    };

    for (const app of applications) {
      const hasLetter = app.joiningLetterUrl && app.joiningLetterUrl !== '';
      const activeMentorAssignment = app.student?.mentorAssignments?.[0];
      const mentorId = activeMentorAssignment?.mentorId;
      const mentorName = activeMentorAssignment?.mentor?.name;

      if (!mentorId) {
        // Unassigned student
        unassignedStats.studentsWithInternship++;
        unassignedStats.totalLetters++;
        if (!hasLetter) {
          unassignedStats.pendingLetters++;
        }
      } else {
        if (!mentorMap.has(mentorId)) {
          mentorMap.set(mentorId, {
            mentorId,
            mentorName: mentorName || 'Unknown',
            studentsWithInternship: 0,
            pendingLetters: 0,
            totalLetters: 0,
          });
        }
        const mentor = mentorMap.get(mentorId)!;
        mentor.studentsWithInternship++;
        mentor.totalLetters++;
        if (!hasLetter) {
          mentor.pendingLetters++;
        }
      }
    }

    // Convert to array and add unassigned if exists
    const byMentor = Array.from(mentorMap.values());
    if (unassignedStats.studentsWithInternship > 0) {
      byMentor.unshift(unassignedStats);
    }

    // Sort by pending letters descending, then by students count
    byMentor.sort((a, b) => {
      if (b.pendingLetters !== a.pendingLetters) {
        return b.pendingLetters - a.pendingLetters;
      }
      return b.studentsWithInternship - a.studentsWithInternship;
    });

    // Calculate totals
    const totalStudents = applications.length;
    const totalPending = applications.filter(a => !a.joiningLetterUrl || a.joiningLetterUrl === '').length;

    return {
      totalStudents,
      totalPending,
      byMentor,
    };
  }

  /**
   * Get list of joining letters for the institution
   */
  async getJoiningLetters(principalId: string, query: {
    status?: 'all' | 'pending' | 'verified' | 'rejected' | 'noLetter';
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;
    const { status = 'all', page = 1, limit = 20, search } = query;

    // Build where clause - only active internships with active students
    const where: any = {
      isSelfIdentified: true,
      isActive: true,
      student: { institutionId, user: { active: true } },
    };

    // Apply status filter (handle both null and empty string for joiningLetterUrl)
    if (status === 'pending') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.reviewedAt = null;
    } else if (status === 'verified') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.reviewedAt = { not: null };
      where.reviewRemarks = { not: { contains: 'reject', mode: 'insensitive' } };
    } else if (status === 'rejected') {
      where.joiningLetterUrl = { not: null, notIn: [''] };
      where.reviewedAt = { not: null };
      where.reviewRemarks = { contains: 'reject', mode: 'insensitive' };
    } else if (status === 'noLetter') {
      // Use AND to combine with potential search OR clause
      where.AND = [
        {
          OR: [
            { joiningLetterUrl: { isSet: false } }, // Field doesn't exist
            { joiningLetterUrl: null },
            { joiningLetterUrl: '' },
          ],
        },
      ];
    }

    // Apply search filter
    if (search) {
      const searchCondition = {
        OR: [
          { student: { name: { contains: search, mode: 'insensitive' } } },
          { student: { rollNumber: { contains: search, mode: 'insensitive' } } },
          { companyName: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.AND) {
        where.AND.push(searchCondition);
      } else {
        where.AND = [searchCondition];
      }
    }

    const [total, applications] = await Promise.all([
      this.prisma.internshipApplication.count({ where }),
      this.prisma.internshipApplication.findMany({
        where,
        select: {
          id: true,
          joiningLetterUrl: true,
          joiningLetterUploadedAt: true,
          joiningDate: true,
          reviewedAt: true,
          reviewRemarks: true,
          companyName: true,
          companyEmail: true,
          jobProfile: true,
          startDate: true,
          student: {
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true, email: true } },
              batch: { select: { name: true } },
              branch: { select: { name: true } },
            },
          },
        },
        orderBy: [
          { joiningLetterUploadedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Determine status for each application
    const joiningLetters = applications.map(app => {
      let letterStatus: 'NO_LETTER' | 'PENDING' | 'VERIFIED' | 'REJECTED';

      if (!app.joiningLetterUrl) {
        letterStatus = 'NO_LETTER';
      } else if (app.reviewedAt && !app.reviewRemarks?.toLowerCase().includes('reject')) {
        letterStatus = 'VERIFIED';
      } else if (app.reviewedAt && app.reviewRemarks?.toLowerCase().includes('reject')) {
        letterStatus = 'REJECTED';
      } else {
        letterStatus = 'PENDING';
      }

      return {
        applicationId: app.id,
        status: letterStatus,
        letterUrl: app.joiningLetterUrl,
        uploadedAt: app.joiningLetterUploadedAt,
        joiningDate: app.joiningDate,
        reviewedAt: app.reviewedAt,
        remarks: app.reviewRemarks,
        companyName: app.companyName,
        companyEmail: app.companyEmail,
        jobProfile: app.jobProfile,
        startDate: app.startDate,
        // Flattened student fields for frontend
        studentId: app.student.id,
        studentName: app.student.user?.name,
        studentRollNumber: app.student.user?.rollNumber,
        studentEmail: app.student.user?.email,
        studentBatch: app.student.batch?.name,
        studentBranch: app.student.branch?.name,
      };
    });

    return {
      data: joiningLetters,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Verify a joining letter
   */
  async verifyJoiningLetter(
    principalId: string,
    applicationId: string,
    data: { joiningDate?: Date; remarks?: string }
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    // Verify the application belongs to this institution
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found or not from your institution');
    }

    if (!application.joiningLetterUrl) {
      throw new BadRequestException('No joining letter uploaded for this application');
    }

    // Update the application
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        joiningDate: data.joiningDate || new Date(),
        reviewedAt: new Date(),
        reviewRemarks: data.remarks || 'Verified by Principal',
      },
      include: {
        student: {
          select: { user: { select: { name: true, rollNumber: true } } },
        },
      },
    });

    // Clear cache
    this.cache.delete(`principal:joining-letters:stats:${principal.institutionId}`);

    return {
      success: true,
      message: 'Joining letter verified successfully',
      data: {
        applicationId: updated.id,
        studentName: updated.student.user?.name,
        rollNumber: updated.student.user?.rollNumber,
        verifiedAt: updated.reviewedAt,
      },
    };
  }

  /**
   * Reject a joining letter
   */
  async rejectJoiningLetter(
    principalId: string,
    applicationId: string,
    data: { remarks: string }
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    if (!data.remarks) {
      throw new BadRequestException('Rejection remarks are required');
    }

    // Verify the application belongs to this institution
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found or not from your institution');
    }

    if (!application.joiningLetterUrl) {
      throw new BadRequestException('No joining letter uploaded for this application');
    }

    // Update the application (reject by setting reviewedAt with rejection remarks)
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        reviewedAt: new Date(),
        reviewRemarks: data.remarks,
        // Clear the joining letter so student can re-upload
        joiningLetterUrl: null,
        joiningLetterUploadedAt: null,
      },
      include: {
        student: {
          select: { user: { select: { name: true, rollNumber: true } } },
        },
      },
    });

    // Clear cache
    this.cache.delete(`principal:joining-letters:stats:${principal.institutionId}`);

    return {
      success: true,
      message: 'Joining letter rejected',
      data: {
        applicationId: updated.id,
        studentName: updated.student.user?.name,
        rollNumber: updated.student.user?.rollNumber,
        rejectedAt: updated.reviewedAt,
        remarks: updated.reviewRemarks,
      },
    };
  }

  /**
   * Get recent joining letter activity
   */
  async getJoiningLetterActivity(principalId: string, limit: number = 10) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const institutionId = principal.institutionId;

    const recentActivity = await this.prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        student: { institutionId },
        reviewedAt: { not: null },
      },
      select: {
        id: true,
        reviewedAt: true,
        reviewRemarks: true,
        companyName: true,
        student: {
          select: {
            user: {
              select: {
                name: true,
                rollNumber: true,
              },
            },
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      take: limit,
    });

    return recentActivity.map(a => ({
      applicationId: a.id,
      action: (a.reviewRemarks && a.reviewRemarks.toLowerCase().includes('reject')) ? 'REJECTED' : 'VERIFIED',
      studentName: a.student.user?.name,
      rollNumber: a.student.user?.rollNumber,
      companyName: a.companyName,
      timestamp: a.reviewedAt,
      remarks: a.reviewRemarks,
    }));
  }

  /**
   * Update internship application details
   * STUBBED: Internship editing functionality removed from principal role
   */
  async updateInternship(
    principalId: string,
    applicationId: string,
    data: any
  ) {
    return {
      success: false,
      message: 'Internship editing is not available for principal role',
      data: null,
    };
  }

  /**
   * Bulk update internship statuses
   * STUBBED: Internship editing functionality removed from principal role
   */
  async bulkUpdateInternshipStatus(
    principalId: string,
    data: { applicationIds: string[]; status: string; remarks?: string }
  ) {
    return {
      success: false,
      message: 'Bulk internship status update is not available for principal role',
      count: 0,
    };
  }

  /**
   * Get single internship details for editing
   * STUBBED: Internship editing functionality removed from principal role
   */
  async getInternshipById(principalId: string, applicationId: string) {
    return null;
  }

  /**
   * Delete internship application (soft delete - sets isActive to false)
   */
  async deleteInternship(principalId: string, applicationId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: applicationId,
        isSelfIdentified: true,
        student: { institutionId: principal.institutionId },
      },
      include: {
        student: {
          select: { id: true, user: { select: { name: true, rollNumber: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found');
    }

    // Soft delete - set isActive to false
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: { isActive: false },
    });

    // Log the deletion
    this.auditService.log({
      action: AuditAction.INTERNSHIP_DELETE,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Internship application deleted for student: ${application.student.user?.name} (${application.student.user?.rollNumber})`,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      oldValues: { isActive: true, companyName: application.companyName },
      newValues: { isActive: false },
    }).catch(() => {}); // Non-blocking

    await this.cache.invalidateByTags([
      `institution:${principal.institutionId}`,
      'internships',
      `student:${application.student.id}`,
    ]);

    return {
      success: true,
      message: 'Internship application deleted successfully',
    };
  }

  // ==================== Student Document Management ====================

  /**
   * Get documents for a specific student
   */
  async getStudentDocuments(principalId: string, studentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    // Verify student belongs to principal's institution
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in your institution');
    }

    const documents = await this.prisma.document.findMany({
      where: { studentId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        type: true,
        createdAt: true,
      },
    });

    return documents;
  }

  /**
   * Upload a document for a student
   */
  async uploadStudentDocument(
    principalId: string,
    studentId: string,
    file: Express.Multer.File,
    type: string,
  ) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      include: { Institution: true },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    // Verify student belongs to principal's institution
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: {
        user: { select: { rollNumber: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in your institution');
    }

    const storageType = this.fileStorageService.resolveStudentDocumentType(type);

    // Upload to MinIO
    const uploadResult = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName: principal.Institution?.name || 'default',
      rollNumber: student.user?.rollNumber || student.id,
      documentType: storageType.documentType,
      ...(storageType.customName ? { customName: storageType.customName } : {}),
    });

    // Save document record to database
    const document = await this.prisma.document.create({
      data: {
        studentId: student.id,
        type: type as any,
        fileName: file.originalname,
        fileUrl: uploadResult.url,
      },
    });

    // If this is a profile image, update the student's profileImage field
    if (type === 'profile' || type === 'PROFILE_IMAGE') {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { profileImage: uploadResult.url },
      });
    }

    // Log audit
    this.auditService.log({
      action: AuditAction.STUDENT_DOCUMENT_UPLOAD,
      entityType: 'Document',
      entityId: document.id,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Principal uploaded document for student ${student.user?.rollNumber}: ${file.originalname} (${type})`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      institutionId: principal.institutionId,
      newValues: {
        documentId: document.id,
        fileName: document.fileName,
        type: document.type,
        studentId: student.id,
        studentRollNumber: student.user?.rollNumber,
      },
    }).catch(() => {}); // Non-blocking

    this.logger.log(`Document uploaded by principal for student ${student.user?.rollNumber}: ${document.id}`);
    return {
      id: document.id,
      url: document.fileUrl,
      filename: document.fileName,
      fileUrl: uploadResult.url,
      type: document.type,
      uploadedAt: document.createdAt,
    };
  }

  /**
   * Delete a student document
   */
  async deleteStudentDocument(principalId: string, studentId: string, documentId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
    });

    if (!principal || !principal.institutionId) {
      throw new NotFoundException('Principal or institution not found');
    }

    // Verify student belongs to principal's institution
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        institutionId: principal.institutionId,
      },
      include: { user: { select: { rollNumber: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found in your institution');
    }

    // Find the document
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        studentId: studentId,
        isDeleted: false,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Delete from MinIO
    if (document.fileUrl) {
      try {
        const key = this.extractKeyFromMinioUrl(document.fileUrl);
        if (key) {
          await this.fileStorageService.deleteFile(key);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete file from MinIO: ${error.message}`);
      }
    }

    // Soft delete from database (preserve audit trail)
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Log audit
    this.auditService.log({
      action: AuditAction.STUDENT_DOCUMENT_DELETE,
      entityType: 'Document',
      entityId: documentId,
      userId: principalId,
      userName: principal.name,
      userRole: principal.role,
      description: `Principal deleted document for student ${student.user?.rollNumber}: ${document.fileName}`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: principal.institutionId,
      oldValues: {
        documentId: document.id,
        fileName: document.fileName,
        type: document.type,
        studentId: student.id,
      },
    }).catch(() => {}); // Non-blocking

    this.logger.log(`Document deleted by principal for student ${student.user?.rollNumber}: ${documentId}`);

    return { success: true, message: 'Document deleted successfully' };
  }

  /**
   * Extract MinIO key from URL
   */
  private extractKeyFromMinioUrl(url: string): string | null {
    try {
      if (!url) return null;
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) return null;
      return pathParts.slice(1).join('/');
    } catch (error) {
      this.logger.warn('Failed to extract key from MinIO URL', error);
      return null;
    }
  }
}
