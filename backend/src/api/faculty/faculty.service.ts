import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LruCacheService } from '../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, MonthlyReportStatus, AuditAction, AuditCategory, AuditSeverity, Role, InternshipPhase } from '../../generated/prisma/client';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ExpectedCycleService } from '../../domain/internship/expected-cycle/expected-cycle.service';
import {
  calculateExpectedMonths,
  getTotalExpectedCount,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,
  isReportMonthIncluded,
  isVisitMonthIncluded,
  MONTHLY_CYCLE,
  MonthlyCycle,
} from '../../common/utils/monthly-cycle.util';

@Injectable()
export class FacultyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
    private readonly expectedCycleService: ExpectedCycleService,
  ) {}

  /**
   * Build optional fields object using only valid Prisma FacultyVisitLog schema fields
   * This ensures type safety and prevents unknown field errors
   */
  private buildVisitLogFields(dto: any): Partial<Prisma.FacultyVisitLogUncheckedUpdateInput> {
    const fields: Partial<Prisma.FacultyVisitLogUncheckedUpdateInput> = {};

    // Core visit fields
    if (dto.visitLocation !== undefined) fields.visitLocation = dto.visitLocation;
    if (dto.visitType !== undefined) fields.visitType = dto.visitType;
    if (dto.status !== undefined) fields.status = dto.status;
    if (dto.visitDate !== undefined) fields.visitDate = dto.visitDate ? new Date(dto.visitDate) : null;
    if (dto.signedDocumentUrl !== undefined) fields.signedDocumentUrl = dto.signedDocumentUrl;

    // GPS fields
    if (dto.latitude !== undefined) fields.latitude = dto.latitude !== null ? parseFloat(String(dto.latitude)) : null;
    if (dto.longitude !== undefined) fields.longitude = dto.longitude !== null ? parseFloat(String(dto.longitude)) : null;
    if (dto.gpsAccuracy !== undefined) fields.gpsAccuracy = dto.gpsAccuracy !== null ? parseFloat(String(dto.gpsAccuracy)) : null;

    // String observation fields
    if (dto.visitDuration !== undefined) fields.visitDuration = dto.visitDuration;
    if (dto.studentPerformance !== undefined) fields.studentPerformance = dto.studentPerformance;
    if (dto.workEnvironment !== undefined) fields.workEnvironment = dto.workEnvironment;
    if (dto.industrySupport !== undefined) fields.industrySupport = dto.industrySupport;
    if (dto.skillsDevelopment !== undefined) fields.skillsDevelopment = dto.skillsDevelopment;
    if (dto.attendanceStatus !== undefined) fields.attendanceStatus = dto.attendanceStatus;
    if (dto.workQuality !== undefined) fields.workQuality = dto.workQuality;
    if (dto.organisationFeedback !== undefined) fields.organisationFeedback = dto.organisationFeedback;
    if (dto.projectTopics !== undefined) fields.projectTopics = dto.projectTopics;
    if (dto.titleOfProjectWork !== undefined) fields.titleOfProjectWork = dto.titleOfProjectWork;
    if (dto.assistanceRequiredFromInstitute !== undefined) fields.assistanceRequiredFromInstitute = dto.assistanceRequiredFromInstitute;
    if (dto.responseFromOrganisation !== undefined) fields.responseFromOrganisation = dto.responseFromOrganisation;
    if (dto.remarksOfOrganisationSupervisor !== undefined) fields.remarksOfOrganisationSupervisor = dto.remarksOfOrganisationSupervisor;
    if (dto.significantChangeInPlan !== undefined) fields.significantChangeInPlan = dto.significantChangeInPlan;
    if (dto.observationsAboutStudent !== undefined) fields.observationsAboutStudent = dto.observationsAboutStudent;
    if (dto.feedbackSharedWithStudent !== undefined) fields.feedbackSharedWithStudent = dto.feedbackSharedWithStudent;
    if (dto.issuesIdentified !== undefined) fields.issuesIdentified = dto.issuesIdentified;
    if (dto.recommendations !== undefined) fields.recommendations = dto.recommendations;
    if (dto.actionRequired !== undefined) fields.actionRequired = dto.actionRequired;
    if (dto.filesUrl !== undefined) fields.filesUrl = dto.filesUrl;
    if (dto.meetingMinutes !== undefined) fields.meetingMinutes = dto.meetingMinutes;
    if (dto.reportSubmittedTo !== undefined) fields.reportSubmittedTo = dto.reportSubmittedTo;

    // Integer rating fields (1-5 scale)
    if (dto.studentProgressRating !== undefined) fields.studentProgressRating = dto.studentProgressRating !== null ? Number(dto.studentProgressRating) : null;
    if (dto.industryCooperationRating !== undefined) fields.industryCooperationRating = dto.industryCooperationRating !== null ? Number(dto.industryCooperationRating) : null;
    if (dto.workEnvironmentRating !== undefined) fields.workEnvironmentRating = dto.workEnvironmentRating !== null ? Number(dto.workEnvironmentRating) : null;
    if (dto.mentoringSupportRating !== undefined) fields.mentoringSupportRating = dto.mentoringSupportRating !== null ? Number(dto.mentoringSupportRating) : null;
    if (dto.overallSatisfactionRating !== undefined) fields.overallSatisfactionRating = dto.overallSatisfactionRating !== null ? Number(dto.overallSatisfactionRating) : null;

    // Boolean fields
    if (dto.followUpRequired !== undefined) fields.followUpRequired = Boolean(dto.followUpRequired);
    if (dto.isMonthlyVisit !== undefined) fields.isMonthlyVisit = Boolean(dto.isMonthlyVisit);

    // Date fields
    if (dto.nextVisitDate !== undefined) fields.nextVisitDate = dto.nextVisitDate ? new Date(dto.nextVisitDate) : null;
    if (dto.requiredByDate !== undefined) fields.requiredByDate = dto.requiredByDate ? new Date(dto.requiredByDate) : null;

    // Integer fields
    if (dto.visitNumber !== undefined) fields.visitNumber = dto.visitNumber !== null ? Number(dto.visitNumber) : null;
    if (dto.visitMonth !== undefined) fields.visitMonth = dto.visitMonth !== null ? Number(dto.visitMonth) : null;
    if (dto.visitYear !== undefined) fields.visitYear = dto.visitYear !== null ? Number(dto.visitYear) : null;

    // Array fields
    if (dto.visitPhotos !== undefined) fields.visitPhotos = dto.visitPhotos;
    if (dto.attendeesList !== undefined) fields.attendeesList = dto.attendeesList;

    return fields;
  }

  /**
   * Calculate expected months (reports/visits) using monthly cycles
   * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V (Q47-49)
   *
   * @param startDate - Internship start date
   * @param endDate - Internship end date (or current date if ongoing)
   * @param countOnlyDue - If true, only count months where report due date has passed
   */
  private calculateExpectedCycles(startDate: Date, endDate: Date, countOnlyDue = false): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    const months: MonthlyCycle[] = calculateExpectedMonths(start, end);

    if (countOnlyDue) {
      // Only count months where the report due date has passed (5th of next month)
      return months.filter(m => now >= m.reportDueDate).length;
    }

    // Count total expected months for the internship duration
    return months.length;
  }


  /**
   * Get faculty profile
   */
  async getProfile(facultyId: string) {
    const faculty = await this.prisma.user.findUnique({
      where: { id: facultyId },
      include: {
        Institution: true,
      },
    });

    if (!faculty) {
      throw new NotFoundException('Faculty not found');
    }

    return faculty;
  }

  /**
   * Get student detail
   * SECURITY: Requires facultyId to verify authorization via MentorAssignment
   */
  async getStudentDetail(studentId: string, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        batch: true,
        branch: true,
        Institution: true,
        internshipApplications: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /**
   * Get unmasked contact details for a student.
   * This bypasses the security interceptor's masking for authorized faculty/principal.
   * The response is marked with _unmasked: true to signal the interceptor to skip masking.
   */
  async getUnmaskedContactDetails(studentId: string, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            dob: true,
          },
        },
        internshipApplications: {
          where: { isActive: true },
          select: {
            id: true,
            companyEmail: true,
            companyContact: true,
            hrEmail: true,
            hrContact: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const internship = student.internshipApplications[0];

    // Return unmasked data - marked so interceptor can identify it
    return {
      _unmasked: true, // Signal to skip masking in response
      studentId: student.id,
      userId: student.user.id,
      name: student.user.name,
      email: student.user.email,
      phoneNo: student.user.phoneNo,
      dob: student.user.dob,
      internship: internship ? {
        companyEmail: internship.companyEmail,
        companyContact: internship.companyContact,
        hrEmail: internship.hrEmail,
        hrContact: internship.hrContact,
      } : null,
    };
  }

  /**
   * Get faculty dashboard data with assigned students count and pending reviews
   */
  async getDashboard(facultyId: string) {
    const cacheKey = `faculty:dashboard:${facultyId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get faculty's institution for external student detection
        const faculty = await this.prisma.user.findUnique({
          where: { id: facultyId },
          select: { institutionId: true },
        });

        // First, get all student IDs assigned to this faculty
        const assignedStudentAssignments = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: facultyId,
            isActive: true,
          },
          select: {
            studentId: true,
            student: {
              select: {
                institutionId: true,
              },
            },
          },
        });
        const studentIds = assignedStudentAssignments.map((a) => a.studentId);

        // Calculate internal vs external students (with null safety)
        const internalStudents = assignedStudentAssignments.filter(
          a => a.student?.institutionId && faculty?.institutionId &&
               a.student.institutionId === faculty.institutionId
        ).length;
        const externalStudents = assignedStudentAssignments.filter(
          a => a.student?.institutionId && faculty?.institutionId &&
               a.student.institutionId !== faculty.institutionId
        ).length;

        // Only count self-identified internships (not placement-based)
        const [
          assignedStudents,
          activeSelfIdentifiedInternships,
          pendingReports,
          pendingVisits,
          totalVisits,
          completedVisits,
          // Grievance counts
          pendingGrievances,
          totalGrievances,
          // Joining letters counts
          pendingJoiningLetters,
          totalJoiningLetters,
        ] = await Promise.all([
          // Count assigned students
          Promise.resolve(studentIds.length),
          // Count active self-identified internships for assigned students (active applications only)
          this.prisma.internshipApplication.count({
            where: {
              studentId: { in: studentIds },
              student: { user: { active: true } },
              isActive: true,
              isSelfIdentified: true,
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
            },
          }),
          // Count pending monthly reports for assigned students
          // Only count reports for active internships that have started
          this.prisma.monthlyReport.count({
            where: {
              isDeleted: false,
              application: {
                studentId: { in: studentIds },
                student: { user: { active: true } },
                isActive: true,
                isSelfIdentified: true,
                startDate: { lte: new Date() }, // Only count if internship has started
              },
              status: MonthlyReportStatus.SUBMITTED,
            },
          }),
          // Count pending applications (if any) for assigned students (active applications only)
          this.prisma.internshipApplication.count({
            where: {
              studentId: { in: studentIds },
              student: { user: { active: true } },
              isActive: true,
              isSelfIdentified: true,
              status: ApplicationStatus.APPLIED,
            },
          }),
          // Count total visit logs - only for active internships that have started
          this.prisma.facultyVisitLog.count({
            where: {
              facultyId,
              isDeleted: false,
              application: {
                student: { user: { active: true } },
                isActive: true,
                startDate: { lte: new Date() }, // Only count visits for started internships
              },
            },
          }),
          // Count completed visits (status: COMPLETED) - only for active internships that have started
          this.prisma.facultyVisitLog.count({
            where: {
              facultyId,
              isDeleted: false,
              status: 'COMPLETED',
              application: {
                student: { user: { active: true } },
                isActive: true,
                startDate: { lte: new Date() }, // Only count visits for started internships
              },
            },
          }),
          // Count pending grievances assigned to this faculty
          this.prisma.grievance.count({
            where: {
              assignedToId: facultyId,
              status: { in: ['PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'SUBMITTED'] },
            },
          }),
          // Count total grievances assigned to this faculty
          this.prisma.grievance.count({
            where: {
              assignedToId: facultyId,
            },
          }),
          // Count pending joining letters = active internships WITHOUT joiningLetterUrl (not yet uploaded)
          this.prisma.internshipApplication.count({
            where: {
              studentId: { in: studentIds },
              student: { user: { active: true } },
              isActive: true,
              isSelfIdentified: true,
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
              joiningLetterUrl: null,
            },
          }),
          // Count total joining letters expected = active internships count (same as activeInternships)
          this.prisma.internshipApplication.count({
            where: {
              studentId: { in: studentIds },
              student: { user: { active: true } },
              isActive: true,
              isSelfIdentified: true,
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
            },
          }),
        ]);

        // Only show upcoming visits for active internships that have started
        const upcomingVisits = await this.prisma.facultyVisitLog.findMany({
          where: {
            facultyId,
            isDeleted: false,
            visitDate: {
              gte: new Date(),
            },
            application: {
              student: { user: { active: true } },
              isActive: true,
              startDate: { lte: new Date() }, // Only show visits for started internships
            },
          },
          take: 5,
          orderBy: { visitDate: 'asc' },
          include: {
            application: {
              include: {
                student: {
                  select: {
                    id: true,
                    user: { select: { name: true, rollNumber: true } },
                  },
                },
              },
            },
          },
        });

        return {
          totalStudents: assignedStudents,
          internalStudents, // Students from same institution
          externalStudents, // Students from other institutions (cross-institutional mentoring)
          // Self-identified internships only (no placement-based)
          activeInternships: activeSelfIdentifiedInternships,
          pendingReports,
          pendingApprovals: pendingVisits,
          totalVisits,
          completedVisits, // Visits with status: COMPLETED
          upcomingVisits,
          // Grievance stats
          pendingGrievances,
          totalGrievances,
          // Joining letters stats
          pendingJoiningLetters,
          totalJoiningLetters,
        };
      },
      { ttl: 300, tags: ['faculty', `faculty:${facultyId}`] },
    );
  }

  /**
  * Get current month compliance stats for faculty dashboard.
  * Uses monthly inclusion rules to determine which students should submit reports/visits this month.
   */
  async getCurrentMonthStats(facultyId: string) {
    const cacheKey = `faculty:monthlyStats:${facultyId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Calculate month date range for visitDate-based filtering (handles visits without visitMonth/visitYear)
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(currentYear, currentMonth, 0); // Last day of current month
        monthEnd.setHours(23, 59, 59, 999);

        // Get all active internships for assigned students
        const assignments = await this.prisma.mentorAssignment.findMany({
          where: {
            mentorId: facultyId,
            isActive: true,
            student: { user: { active: true } },
          },
          select: {
            studentId: true,
            student: {
              select: {
                internshipApplications: {
                  where: {
                    isActive: true,
                    isSelfIdentified: true,
                    status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
                  },
                  select: {
                    id: true,
                    startDate: true,
                    endDate: true,
                    joiningDate: true,
                    completionDate: true,
                    monthlyReports: {
                      where: {
                        isDeleted: false,
                        reportMonth: currentMonth,
                        reportYear: currentYear,
                      },
                      select: { id: true, status: true },
                    },
                    facultyVisitLogs: {
                      where: {
                        isDeleted: false,
                        facultyId,
                        status: 'COMPLETED',
                        // Use visitDate range instead of visitMonth/visitYear for backwards compatibility
                        visitDate: {
                          gte: monthStart,
                          lte: monthEnd,
                        },
                      },
                      select: { id: true, visitDate: true },
                    },
                  },
                },
              },
            },
          },
        });

        let expectedReportsThisMonth = 0;
        let expectedVisitsThisMonth = 0;
        let submittedReportsThisMonth = 0;
        let completedVisitsThisMonth = 0;

        for (const assignment of assignments) {
          for (const app of assignment.student.internshipApplications) {
            const startDate = app.startDate || app.joiningDate;
            const endDate = app.endDate || app.completionDate;

            if (!startDate || !endDate) continue;

            const isReportIncluded = isReportMonthIncluded(
              startDate,
              endDate,
              currentYear,
              currentMonth,
            );
            const isVisitIncluded = isVisitMonthIncluded(
              startDate,
              endDate,
              currentYear,
              currentMonth,
            );

            if (isReportIncluded) {
              expectedReportsThisMonth++;

              // Count submitted reports for this month
              const hasReport = app.monthlyReports.some(
                (r) => r.status === 'APPROVED' || r.status === 'SUBMITTED',
              );
              if (hasReport) submittedReportsThisMonth++;
            }

            if (isVisitIncluded) {
              expectedVisitsThisMonth++;

              // Count completed visits for this month (check if at least one visit exists)
              if (app.facultyVisitLogs && app.facultyVisitLogs.length > 0) {
                completedVisitsThisMonth++;
              }
            }
          }
        }

        // Get month name for display
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ];

        return {
          currentMonth,
          currentYear,
          monthName: monthNames[currentMonth - 1],
          expectedReportsThisMonth,
          submittedReportsThisMonth,
          expectedVisitsThisMonth,
          completedVisitsThisMonth,
          // Include monthly inclusion rule info for transparency
          minDaysForInclusion: MONTHLY_CYCLE.MIN_DAYS_FOR_INCLUSION,
          firstMonthMinDays: MONTHLY_CYCLE.FIRST_MONTH_MIN_DAYS,
          lastMonthIncludedWithAnyDays: false,
        };
      },
      { ttl: 300, tags: ['faculty', `faculty:${facultyId}`] },
    );
  }

  /**
   * Get assigned students list with pagination
   */
  async getAssignedStudents(
    facultyId: string,
    params: { page?: number; limit?: number; search?: string },
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const search = params.search;
    const skip = (page - 1) * limit;

    // Get faculty's institution for external student detection
    const faculty = await this.prisma.user.findUnique({
      where: { id: facultyId },
      select: { institutionId: true },
    });

    const where: Prisma.MentorAssignmentWhereInput = {
      mentorId: facultyId,
      isActive: true,
      student: {
        user: { active: true },
      },
    };

    if (search) {
      where.student = {
        user: { active: true },
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { rollNumber: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    const [assignments, total] = await Promise.all([
      this.prisma.mentorAssignment.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            include: {
              user: true,
              batch: true,
              branch: true,
              Institution: {
                select: { id: true, name: true, code: true, city: true, state: true },
              },
              internshipApplications: {
                where: {
                  isActive: true,
                  isSelfIdentified: true,
                  // Only show active/approved internships for assigned students
                  status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED] },
                },
                include: {
                  monthlyReports: {
                    orderBy: { createdAt: 'desc' as const },
                    where: { isDeleted: false },
                    take: 5,
                  },
                  facultyVisitLogs: {
                    orderBy: { visitDate: 'desc' as const },
                    where: { isDeleted: false },
                    take: 5,
                  },
                },
                orderBy: { createdAt: 'desc' as const },
              },
              _count: {
                select: {
                  monthlyReports: { where: { isDeleted: false }  },
                },
              },
            },
          },
        },
        orderBy: { assignmentDate: 'desc' },
      }),
      this.prisma.mentorAssignment.count({ where }),
    ]);

    // Add isExternalStudent flag to each assignment (with null safety)
    const studentsWithFlag = assignments.map(assignment => ({
      ...assignment,
      isExternalStudent: !!(
        faculty?.institutionId &&
        assignment.student?.institutionId &&
        faculty.institutionId !== assignment.student.institutionId
      ),
    }));

    return {
      students: studentsWithFlag,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get student progress details (self-identified internships only)
   * SECURITY: Requires facultyId to verify authorization via MentorAssignment
   */
  async getStudentProgress(studentId: string, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true, rollNumber: true } },
        internshipApplications: {
          where: {
            isActive: true,
            isSelfIdentified: true,
          },
          include: {
            monthlyReports: {
              orderBy: { reportMonth: 'asc' },
            },
            facultyVisitLogs: {
              orderBy: { visitDate: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Calculate overall progress (self-identified internships only)
    const currentApplication = student.internshipApplications.find(
      app => app.isSelfIdentified && (app.status === ApplicationStatus.JOINED || app.status === ApplicationStatus.APPROVED)
    );

    let overallProgress = 0;
    let completionStatus = 'NOT_STARTED';

    if (currentApplication) {
      // Calculate expected reports dynamically based on months since internship started
      const now = new Date();
      const startDate = currentApplication.startDate;
      const endDate = currentApplication.endDate;

      let totalReportsExpected = 0;

      if (startDate) {
        // Calculate using monthly cycles from start date to now (or end date if completed)
        const effectiveEndDate = endDate && new Date(endDate) < now ? new Date(endDate) : now;

        // Only calculate if internship has started
        if (new Date(startDate) <= now) {
          totalReportsExpected = this.calculateExpectedCycles(new Date(startDate), effectiveEndDate, true);
          totalReportsExpected = Math.max(1, totalReportsExpected);
        }
      }
      // If no startDate, expected reports remains 0 (cannot calculate without dates)

      const submittedReports = currentApplication.monthlyReports.filter(
        r => r.status === MonthlyReportStatus.APPROVED || r.status === MonthlyReportStatus.SUBMITTED
      ).length;

      overallProgress = totalReportsExpected > 0 ? (submittedReports / totalReportsExpected) * 100 : 0;

      if (currentApplication.status === ApplicationStatus.COMPLETED) {
        completionStatus = 'COMPLETED';
      } else if (submittedReports > 0) {
        completionStatus = 'IN_PROGRESS';
      } else {
        completionStatus = 'STARTED';
      }
    }

    return {
      studentId,
      studentName: student.user?.name,
      rollNumber: student.user?.rollNumber,
      overallProgress: Math.round(overallProgress),
      currentInternship: currentApplication,
      monthlyReports: currentApplication?.monthlyReports || [],
      visitLogs: currentApplication?.facultyVisitLogs || [],
      completionStatus,
    };
  }

  /**
   * Get visit log by ID
   * SECURITY: Requires facultyId to verify authorization
   */
  async getVisitLogById(id: string, facultyId: string) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            student: {
              select: {
                id: true,
                profileImage: true,
                user: { select: { name: true, rollNumber: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!visitLog || visitLog.isDeleted) {
      throw new NotFoundException('Visit log not found');
    }

    // SECURITY: Verify faculty owns this visit log
    if (visitLog.facultyId !== facultyId) {
      throw new NotFoundException('Visit log not found or you are not authorized to view it');
    }

    return visitLog;
  }

  /**
   * Get visit logs with pagination
   */
  async getVisitLogs(
    facultyId: string,
    params: { page?: number; limit?: number; studentId?: string },
  ) {
    const { studentId } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.FacultyVisitLogWhereInput = {
      facultyId,
      isDeleted: false,
    };

    if (studentId) {
      where.application = {
        studentId,
      };
    }

    const [visitLogs, total] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          application: {
            include: {
              student: {
                select: {
                  id: true,
                  user: { select: { name: true, rollNumber: true } },
                },
              },
            },
          },
        },
        orderBy: { visitDate: 'desc' },
      }),
      this.prisma.facultyVisitLog.count({ where }),
    ]);

    return {
      visitLogs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create visit log (supports quick visit logging)
   * Required fields: applicationId OR studentId, visitType, visitLocation
   * All other fields are optional
   */
  async createVisitLog(facultyId: string, createVisitLogDto: any) {
    const {
      applicationId,
      studentId,
      visitDate,
      visitType,
      visitLocation,
      latitude,
      longitude,
      gpsAccuracy,
      visitPhotos,
      signedDocumentUrl,
      status,
    } = createVisitLogDto;

    // Filter to only valid Prisma schema fields (excludes unknown fields like 'notes')
    const filteredVisitData = this.buildVisitLogFields(createVisitLogDto);

    // Validate required fields
    if (!visitType) {
      throw new BadRequestException('visitType is required');
    }

    // Location is required only for PHYSICAL visits (unless saving as draft)
    if (visitType === 'PHYSICAL' && !visitLocation && status !== 'DRAFT') {
      throw new BadRequestException('visitLocation is required for physical visits');
    }

    // Find application - support both applicationId and studentId
    let application;
    let targetStudentId: string | null = null;

    if (applicationId) {
      // Direct application ID provided - find the application first (active applications only)
      application = await this.prisma.internshipApplication.findFirst({
        where: {
          id: applicationId,
          isActive: true,
          status: { in: ['JOINED', 'APPROVED'] },
        },
      });

      if (application) {
        targetStudentId = application.studentId;
      }
    } else if (studentId) {
      // Find active application by student ID (active applications only)
      targetStudentId = studentId;
      application = await this.prisma.internshipApplication.findFirst({
        where: {
          studentId,
          isActive: true,
          status: { in: ['JOINED', 'APPROVED'] },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      throw new BadRequestException('Either applicationId or studentId is required');
    }

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Verify authorization: Check if faculty is assigned to this student via MentorAssignment
    // OR is the mentor on the application directly
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId: targetStudentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    const isMentorOnApplication = application.mentorId === facultyId;

    if (!isAuthorized && !isMentorOnApplication) {
      throw new NotFoundException('Application not found or you are not the assigned mentor');
    }

    // Validate that visit date is not before internship start date
    const visitDateToUse = visitDate ? new Date(visitDate) : new Date();

    if (application.startDate) {
      const internshipStartDate = new Date(application.startDate);

      if (visitDateToUse < internshipStartDate) {
        throw new BadRequestException(
          `Visit date cannot be before internship start date (${internshipStartDate.toISOString().split('T')[0]})`
        );
      }
    }

    // Validate that visit date is not after internship end date
    if (application.endDate) {
      const internshipEndDate = new Date(application.endDate);

      if (visitDateToUse > internshipEndDate) {
        throw new BadRequestException(
          `Visit date cannot be after internship end date (${internshipEndDate.toISOString().split('T')[0]})`
        );
      }
    }

    // Check if faculty has already logged a visit for this application on the same day
    const visitDateStart = new Date(visitDateToUse);
    visitDateStart.setHours(0, 0, 0, 0);
    const visitDateEnd = new Date(visitDateToUse);
    visitDateEnd.setHours(23, 59, 59, 999);

    const existingVisitOnSameDay = await this.prisma.facultyVisitLog.findFirst({
      where: {
        applicationId: application.id,
        facultyId,
        isDeleted: false,
        visitDate: {
          gte: visitDateStart,
          lte: visitDateEnd,
        },
      },
    });

    if (existingVisitOnSameDay) {
      throw new BadRequestException(
        `You have already logged a visit for this student on ${visitDateToUse.toISOString().split('T')[0]}. Only one visit per student per day is allowed.`
      );
    }

    // Count existing visits for this application
    const visitCount = await this.prisma.facultyVisitLog.count({
      where: { applicationId: application.id, isDeleted: false },
    });

    // Prepare visit data with defaults for quick logging
    // Auto-set visitMonth and visitYear from visitDate for monthly stats queries
    const visitMonth = visitDateToUse.getMonth() + 1; // 1-12
    const visitYear = visitDateToUse.getFullYear();

    const visitLogData: any = {
      applicationId: application.id,
      facultyId,
      internshipId: application.internshipId,
      visitNumber: visitCount + 1,
      visitType,
      // Use the already validated visit date
      visitDate: visitDateToUse,
      // Auto-set visitMonth and visitYear for monthly compliance tracking
      visitMonth,
      visitYear,
      // Auto-set status to COMPLETED for quick logs if not provided (unless DRAFT)
      status: status || 'COMPLETED',
      // Include location if provided
      ...(visitLocation && { visitLocation }),
      // Include GPS coordinates if provided
      ...(latitude !== undefined && { latitude: parseFloat(String(latitude)) }),
      ...(longitude !== undefined && { longitude: parseFloat(String(longitude)) }),
      ...(gpsAccuracy !== undefined && { gpsAccuracy: parseFloat(String(gpsAccuracy)) }),
      // Include signed document URL if provided
      ...(signedDocumentUrl && { signedDocumentUrl }),
      // Include photo URLs if provided
      ...(visitPhotos && visitPhotos.length > 0 && { visitPhotos }),
      // Include any additional optional fields provided (filtered to valid schema fields)
      ...filteredVisitData,
    };

    const visitLog = await this.prisma.facultyVisitLog.create({
      data: visitLogData,
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true, rollNumber: true } } },
            },
          },
        },
      },
    });

    // Increment visit count for the application if status is COMPLETED
    if (visitLog.status === 'COMPLETED') {
      await this.expectedCycleService.incrementVisitCount(application.id);
    }

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit visit log creation
    this.auditService.log({
      action: AuditAction.VISIT_LOG_CREATE,
      entityType: 'FacultyVisitLog',
      entityId: visitLog.id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Faculty visit log created: ${visitType} at ${visitLocation}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        visitLogId: visitLog.id,
        applicationId: application.id,
        studentId: visitLog.application.student.id,
        studentName: visitLog.application.student.user?.name,
        visitType,
        visitLocation,
        visitDate: visitLog.visitDate,
      },
    }).catch(() => {});

    // Invalidate all relevant caches: visits, application, faculty dashboard, and monthly stats
    await this.cache.invalidateByTags(['visits', `application:${application.id}`, 'faculty', `faculty:${facultyId}`]);

    return visitLog;
  }

  /**
   * Update visit log
   *
   * IMPORTANT: When visit is in DRAFT status, only document/photo uploads are allowed.
   * Core visit details (GPS, location, student, dates) are locked after initial creation.
   * SECURITY: Requires facultyId to verify authorization
   */
  async updateVisitLog(id: string, updateVisitLogDto: any, facultyId: string) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!visitLog || visitLog.isDeleted) {
      throw new NotFoundException('Visit log not found');
    }

    // SECURITY: Verify faculty owns this visit log
    if (visitLog.facultyId !== facultyId) {
      throw new NotFoundException('Visit log not found or you are not authorized to update it');
    }

    const oldValues = {
      visitType: visitLog.visitType,
      visitLocation: visitLog.visitLocation,
      visitDate: visitLog.visitDate,
      status: visitLog.status,
    };

    // Filter to only valid Prisma schema fields (excludes unknown fields like 'notes')
    let filteredUpdateData = this.buildVisitLogFields(updateVisitLogDto);

    // SECURITY: Fields that are ALWAYS LOCKED after creation (regardless of status)
    // These core visit details cannot be modified via API - prevents DevTools bypass
    const lockedFields = [
      'latitude',
      'longitude',
      'gpsAccuracy',
      'visitLocation',
      'visitDate',
      'visitType',
      'applicationId',
      'studentId',
      'internshipId',
      'facultyId',
      'visitNumber',
    ];

    // Check if user is trying to modify locked fields
    const attemptedLockedFields = lockedFields.filter(
      field => updateVisitLogDto[field] !== undefined
    );

    if (attemptedLockedFields.length > 0) {
      throw new BadRequestException(
        `Cannot modify locked fields: ${attemptedLockedFields.join(', ')}. ` +
        `Visit date, type, location, GPS coordinates, and student cannot be changed after creation.`
      );
    }

    // Remove locked fields from update data as additional security layer
    lockedFields.forEach(field => {
      delete filteredUpdateData[field];
    });

    // When visit is in DRAFT status, restrict updates to only documents and photos
    if (visitLog.status === 'DRAFT') {
      // Fields that CAN be updated when in DRAFT (completing the visit report)
      const allowedDraftUpdateFields = [
        'signedDocumentUrl',
        'visitPhotos',
        'filesUrl',
        'status', // Allow status change (DRAFT -> COMPLETED)
        // Observation/report fields that are filled during visit completion
        'visitDuration',
        'studentPerformance',
        'workEnvironment',
        'industrySupport',
        'skillsDevelopment',
        'attendanceStatus',
        'workQuality',
        'organisationFeedback',
        'projectTopics',
        'titleOfProjectWork',
        'assistanceRequiredFromInstitute',
        'responseFromOrganisation',
        'remarksOfOrganisationSupervisor',
        'significantChangeInPlan',
        'observationsAboutStudent',
        'feedbackSharedWithStudent',
        'studentProgressRating',
        'industryCooperationRating',
        'workEnvironmentRating',
        'mentoringSupportRating',
        'overallSatisfactionRating',
        'issuesIdentified',
        'recommendations',
        'actionRequired',
        'meetingMinutes',
        'attendeesList',
        'reportSubmittedTo',
        'followUpRequired',
        'nextVisitDate',
      ];

      // Filter to only allowed fields for draft updates
      filteredUpdateData = Object.fromEntries(
        Object.entries(filteredUpdateData).filter(([key]) =>
          allowedDraftUpdateFields.includes(key)
        )
      ) as Partial<Prisma.FacultyVisitLogUncheckedUpdateInput>;
    }

    const updated = await this.prisma.facultyVisitLog.update({
      where: { id },
      data: filteredUpdateData,
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    // Get faculty for audit
    const userId = facultyId || visitLog.facultyId;
    const faculty = await this.prisma.user.findUnique({ where: { id: userId } });

    // Audit visit log update
    this.auditService.log({
      action: AuditAction.VISIT_LOG_UPDATE,
      entityType: 'FacultyVisitLog',
      entityId: id,
      userId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Faculty visit log updated`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      oldValues,
      newValues: filteredUpdateData,
    }).catch(() => {});

    // Invalidate all relevant caches: visits, faculty dashboard, and monthly stats
    await this.cache.invalidateByTags(['visits', `visit:${id}`, 'faculty', `faculty:${facultyId}`]);

    return updated;
  }

  /**
   * Delete visit log
   * SECURITY: Requires facultyId to verify authorization
   */
  async deleteVisitLog(id: string, facultyId: string) {
    const visitLog = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!visitLog || visitLog.isDeleted) {
      throw new NotFoundException('Visit log not found');
    }

    // SECURITY: Verify faculty owns this visit log
    if (visitLog.facultyId !== facultyId) {
      throw new NotFoundException('Visit log not found or you are not authorized to delete it');
    }

    const deletedInfo = {
      visitLogId: id,
      applicationId: visitLog.applicationId,
      studentId: visitLog.application.studentId,
      studentName: visitLog.application.student.user?.name,
      visitType: visitLog.visitType,
      visitLocation: visitLog.visitLocation,
      visitDate: visitLog.visitDate,
    };

    // Soft delete instead of hard delete
    await this.prisma.facultyVisitLog.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Decrement visit count for the application if visit was COMPLETED
    if (visitLog.status === 'COMPLETED' && visitLog.applicationId) {
      await this.expectedCycleService.decrementVisitCount(visitLog.applicationId);
    }

    // Get faculty for audit
    const userId = facultyId || visitLog.facultyId;
    const faculty = await this.prisma.user.findUnique({ where: { id: userId } });

    // Audit visit log deletion
    this.auditService.log({
      action: AuditAction.VISIT_LOG_DELETE,
      entityType: 'FacultyVisitLog',
      entityId: id,
      userId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Faculty visit log soft deleted`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    // Invalidate all relevant caches: visits, faculty dashboard, and monthly stats
    await this.cache.invalidateByTags([
      'visits',
      `visit:${id}`,
      'faculty',
      `faculty:${facultyId}`,
    ]);

    return {
      success: true,
      message: 'Visit log deleted successfully',
    };
  }

  /**
   * Get monthly reports for review
   * Fetches reports from students assigned via MentorAssignment OR via application.mentorId
   */
  async getMonthlyReports(
    facultyId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { status } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    // First, get all student IDs assigned to this faculty via MentorAssignment
    const assignedStudentIds = await this.prisma.mentorAssignment.findMany({
      where: {
        mentorId: facultyId,
        isActive: true,
      },
      select: { studentId: true },
    });
    const studentIds = assignedStudentIds.map((a) => a.studentId);

    // Build where clause to include reports from:
    // 1. Students assigned via MentorAssignment
    // 2. Applications where faculty is directly set as mentorId
    const where: Prisma.MonthlyReportWhereInput = {
      isDeleted: false,
      OR: [
        // Reports from students assigned via MentorAssignment
        ...(studentIds.length > 0 ? [{
          studentId: { in: studentIds },
        }] : []),
        // Reports where faculty is directly the mentor on the application
        {
          application: {
            mentorId: facultyId,
          },
        },
      ],
    };

    if (status) {
      where.status = status as MonthlyReportStatus;
    }

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          application: {
            include: {
              student: {
                select: {
                  id: true,
                  user: { select: { name: true, rollNumber: true } },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.monthlyReport.count({ where }),
    ]);

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Review monthly report
   */
  async reviewMonthlyReport(id: string, reviewDto: {
    facultyId: string;
    reviewComments?: string;
    isApproved: boolean;
  }) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!report || report.isDeleted) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application.mentorId !== reviewDto.facultyId) {
      throw new BadRequestException('You are not authorized to review this report');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        reviewedBy: reviewDto.facultyId,
        reviewedAt: new Date(),
        reviewComments: reviewDto.reviewComments,
        isApproved: reviewDto.isApproved,
        status: reviewDto.isApproved
          ? MonthlyReportStatus.APPROVED
          : MonthlyReportStatus.REJECTED,
      },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: reviewDto.facultyId } });

    // Audit report review
    this.auditService.log({
      action: reviewDto.isApproved ? AuditAction.MONTHLY_REPORT_APPROVE : AuditAction.MONTHLY_REPORT_REJECT,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: reviewDto.facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report ${reviewDto.isApproved ? 'approved' : 'rejected'}: ${report.monthName} ${report.reportYear}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: updated.status,
        isApproved: reviewDto.isApproved,
        reviewComments: reviewDto.reviewComments,
        studentId: updated.application?.studentId,
        studentName: updated.application?.student?.user?.name,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return updated;
  }

  /**
   * Get self-identified internship approvals pending review
   */
  async getSelfIdentifiedApprovals(
    facultyId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { status } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.InternshipApplicationWhereInput = {
      mentorId: facultyId,
      isSelfIdentified: true,
      isActive: true,
    };

    if (status) {
      where.status = status as ApplicationStatus;
    } else {
      // Self-identified internships are auto-approved, so default to APPROVED
      where.status = ApplicationStatus.APPROVED;
    }

    const [approvals, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true, email: true, phoneNo: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      approvals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update self-identified internship approval status
   */
  async updateSelfIdentifiedApproval(id: string, approvalDto: {
    facultyId: string;
    status: 'APPROVED' | 'REJECTED';
    reviewRemarks?: string;
  }) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (!application.isSelfIdentified) {
      throw new BadRequestException('This is not a self-identified internship');
    }

    // Verify faculty is the mentor
    if (application.mentorId !== approvalDto.facultyId) {
      throw new BadRequestException('You are not authorized to approve this application');
    }

    const oldStatus = application.status;
    const newStatus = approvalDto.status === 'APPROVED'
      ? ApplicationStatus.APPROVED
      : ApplicationStatus.REJECTED;

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedAt: new Date(),
        reviewRemarks: approvalDto.reviewRemarks,
        ...(approvalDto.status === 'REJECTED' && {
          rejectionReason: approvalDto.reviewRemarks,
        }),
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: approvalDto.facultyId } });

    // Audit self-identified internship approval/rejection
    this.auditService.log({
      action: approvalDto.status === 'APPROVED' ? AuditAction.APPLICATION_APPROVE : AuditAction.APPLICATION_REJECT,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: approvalDto.facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Self-identified internship ${approvalDto.status.toLowerCase()}: ${application.student?.user?.name} at ${application.companyName}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: newStatus,
        studentId: application.studentId,
        studentName: application.student?.user?.name,
        companyName: application.companyName,
        reviewRemarks: approvalDto.reviewRemarks,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return updated;
  }

  /**
   * Submit monthly feedback for student (from faculty perspective)
   * Note: MonthlyFeedback model has been removed from the schema
   */
  async submitMonthlyFeedback(facultyId: string, feedbackDto: any) {
    throw new BadRequestException('Monthly feedback feature is not available. This model has been removed from the system.');
  }

  /**
   * Get feedback history
   * Note: MonthlyFeedback model has been removed from the schema
   */
  async getFeedbackHistory(
    facultyId: string,
    params: { page?: number; limit?: number; studentId?: string },
  ) {
    throw new BadRequestException('Feedback history feature is not available. MonthlyFeedback model has been removed from the system.');
  }

  // ==================== Internship Management ====================

  /**
   * Get student internships
   * SECURITY: Requires facultyId to verify authorization via MentorAssignment
   */
  async getStudentInternships(studentId: string, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    // OPTIMIZED: Added pagination limit to prevent memory issues with students who have many applications (active applications only)
    const internships = await this.prisma.internshipApplication.findMany({
      where: { studentId, isActive: true },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            designation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 most recent internships
    });

    return { internships };
  }

  /**
   * Update internship application
   */
  async updateInternship(id: string, updateDto: any, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to update this application');
    }

    const oldValues = {
      status: application.status,
      hasJoined: !!(application.joiningDate || application.joiningLetterUrl),
      isSelected: application.isSelected,
      companyName: application.companyName,
      startDate: application.startDate,
      endDate: application.endDate,
      stipend: application.stipend,
    };

    // Build update data - only include fields that are provided
    const updateData: any = {
      reviewedAt: new Date(),
    };

    // Status fields
    if (updateDto.status !== undefined) updateData.status = updateDto.status;
    if (updateDto.hasJoined !== undefined) {
      updateData.joiningDate = updateDto.hasJoined ? (application.joiningDate ?? new Date()) : null;
    }
    if (updateDto.isSelected !== undefined) updateData.isSelected = updateDto.isSelected;
    if (updateDto.remarks !== undefined) updateData.reviewRemarks = updateDto.remarks;
    if (updateDto.joiningDate) updateData.joiningDate = new Date(updateDto.joiningDate);

    // Company/Industry info
    if (updateDto.companyName !== undefined) updateData.companyName = updateDto.companyName;
    if (updateDto.companyAddress !== undefined) updateData.companyAddress = updateDto.companyAddress;
    if (updateDto.companyContact !== undefined) updateData.companyContact = updateDto.companyContact;
    if (updateDto.companyEmail !== undefined) updateData.companyEmail = updateDto.companyEmail;
    if (updateDto.location !== undefined) updateData.companyAddress = updateDto.location; // Alias

    // HR info
    if (updateDto.hrName !== undefined) updateData.hrName = updateDto.hrName;
    if (updateDto.hrDesignation !== undefined) updateData.hrDesignation = updateDto.hrDesignation;
    if (updateDto.hrContact !== undefined) updateData.hrContact = updateDto.hrContact;
    if (updateDto.hrEmail !== undefined) updateData.hrEmail = updateDto.hrEmail;

    // Internship details
    if (updateDto.startDate) updateData.startDate = new Date(updateDto.startDate);
    if (updateDto.endDate) updateData.endDate = new Date(updateDto.endDate);
    if (updateDto.stipend !== undefined) updateData.stipend = String(updateDto.stipend);
    if (updateDto.jobProfile !== undefined) updateData.jobProfile = updateDto.jobProfile;
    if (updateDto.internshipDuration !== undefined) updateData.internshipDuration = updateDto.internshipDuration;

    // Notes
    if (updateDto.notes !== undefined) updateData.notes = updateDto.notes;

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Recalculate expected counts if dates were updated
    // This ONLY updates expected counts, never touches submitted/completed counts
    if (updateDto.startDate || updateDto.endDate) {
      await this.expectedCycleService.recalculateExpectedCounts(id);
    }

    // Audit internship update
    this.auditService.log({
      action: AuditAction.APPLICATION_UPDATE,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Internship application updated for student: ${application.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues,
      newValues: updateDto,
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Internship updated successfully',
      data: updated,
    };
  }

  /**
   * Delete internship application (soft delete - sets isActive to false)
   */
  async deleteInternship(id: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Internship application not found');
    }

    // Check if already deleted
    if (!application.isActive) {
      throw new BadRequestException('This internship application has already been deleted');
    }

    // Verify faculty is the mentor
    if (application.mentorId && application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to delete this application');
    }

    const deletedInfo = {
      applicationId: id,
      studentId: application.studentId,
      studentName: application.student?.user?.name,
      companyName: application.companyName,
      status: application.status,
      wasActive: application.isActive,
    };

    // Soft delete - set isActive to false instead of hard delete
    await this.prisma.internshipApplication.update({
      where: { id },
      data: { isActive: false },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit internship soft deletion
    this.auditService.log({
      action: AuditAction.APPLICATION_WITHDRAW,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Internship application deactivated for student: ${application.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
      newValues: { isActive: false },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Internship application deleted successfully',
    };
  }

  // ==================== Monthly Report Actions ====================

  /**
   * Approve monthly report
   */
  async approveMonthlyReport(id: string, remarks: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!report || report.isDeleted) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application?.mentorId && report.application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to approve this report');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        status: 'APPROVED',
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: facultyId,
        reviewedAt: new Date(),
        reviewedBy: facultyId,
        reviewComments: remarks,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit report approval
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_APPROVE,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report approved: ${report.monthName} ${report.reportYear} for ${report.application?.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: 'APPROVED',
        remarks,
        studentId: report.studentId,
        studentName: report.application?.student?.user?.name,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return {
      success: true,
      message: 'Monthly report approved successfully',
      data: updated,
    };
  }

  /**
   * Reject monthly report
   */
  async rejectMonthlyReport(id: string, reason: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!report || report.isDeleted) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application?.mentorId && report.application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to reject this report');
    }

    const oldStatus = report.status;

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isApproved: false,
        reviewedAt: new Date(),
        reviewedBy: facultyId,
        reviewComments: reason,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit report rejection
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_REJECT,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report rejected: ${report.monthName} ${report.reportYear} for ${report.application?.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { status: oldStatus },
      newValues: {
        status: 'REJECTED',
        reason,
        studentId: report.studentId,
        studentName: report.application?.student?.user?.name,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return {
      success: true,
      message: 'Monthly report rejected',
      data: updated,
    };
  }

  /**
   * Delete monthly report
   */
  async deleteMonthlyReport(id: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!report || report.isDeleted) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor
    if (report.application?.mentorId && report.application.mentorId !== facultyId) {
      throw new BadRequestException('You are not authorized to delete this report');
    }

    const deletedInfo = {
      reportId: id,
      reportMonth: report.reportMonth,
      reportYear: report.reportYear,
      monthName: report.monthName,
      studentId: report.studentId,
      studentName: report.application?.student?.user?.name,
      status: report.status,
    };

    // Soft delete instead of hard delete
    await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Decrement report count for the application
    if (report.applicationId) {
      await this.expectedCycleService.decrementReportCount(report.applicationId);
    }

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit report deletion
    this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_DELETE,
      entityType: 'MonthlyReport',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Monthly report soft deleted: ${report.monthName} ${report.reportYear} for ${report.application?.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    await this.cache.invalidateByTags(['reports', `report:${id}`]);

    return {
      success: true,
      message: 'Monthly report deleted successfully',
    };
  }

  // ==================== Joining Letter Management ====================

  /**
   * Get joining letters for review
   */
  async getJoiningLetters(
    facultyId: string,
    params: { page?: number; limit?: number; status?: string },
  ) {
    const { status } = params;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    // Get student IDs assigned to this faculty via MentorAssignment
    const mentorAssignments = await this.prisma.mentorAssignment.findMany({
      where: {
        mentorId: facultyId,
        isActive: true,
      },
      select: { studentId: true },
    });
    const assignedStudentIds = mentorAssignments.map((a) => a.studentId);

    // Build OR conditions - only include studentId condition if there are assigned students
    const orConditions: Prisma.InternshipApplicationWhereInput[] = [
      { mentorId: facultyId },
    ];

    if (assignedStudentIds.length > 0) {
      orConditions.push({ studentId: { in: assignedStudentIds } });
    }

    // Query applications where:
    // 1. Faculty is directly set as mentorId on the application, OR
    // 2. Student is assigned to this faculty via MentorAssignment
    // (active applications only)
    const where: Prisma.InternshipApplicationWhereInput = {
      joiningLetterUrl: { not: null },
      isActive: true,
      OR: orConditions,
    };

    if (status) {
      where.status = status as any;
    }

    const [letters, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          joiningLetterUrl: true,
          joiningLetterUploadedAt: true,
          companyName: true,
          isSelfIdentified: true,
          status: true,
          reviewedAt: true,
          reviewRemarks: true,
          studentId: true,
          mentorId: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              user: { select: { name: true, rollNumber: true, email: true } },
            },
          },
        },
        orderBy: { joiningLetterUploadedAt: 'desc' },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      letters,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Verify joining letter
   */
  async verifyJoiningLetter(id: string, remarks: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if faculty is authorized via direct mentorId OR MentorAssignment
    const isDirectMentor = application.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: application.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to verify this joining letter');
    }

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewRemarks: remarks,
        joiningDate: new Date(),
        internshipPhase: InternshipPhase.ACTIVE,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter verification
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_VERIFY,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter verified for student: ${application.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        applicationId: id,
        studentId: application.studentId,
        studentName: application.student?.user?.name,
        remarks,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Joining letter verified successfully',
      data: updated,
    };
  }

  /**
   * Reject joining letter
   */
  async rejectJoiningLetter(id: string, reason: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if faculty is authorized via direct mentorId OR MentorAssignment
    const isDirectMentor = application.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: application.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to reject this joining letter');
    }

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewRemarks: reason,
        joiningDate: null,
        internshipPhase: InternshipPhase.NOT_STARTED,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter rejection
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_REJECT,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter rejected for student: ${application.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        applicationId: id,
        studentId: application.studentId,
        studentName: application.student?.user?.name,
        reason,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Joining letter rejected',
      data: updated,
    };
  }

  /**
   * Delete joining letter
   */
  async deleteJoiningLetter(id: string, facultyId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if faculty is authorized via direct mentorId OR MentorAssignment
    const isDirectMentor = application.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: application.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to delete this joining letter');
    }

    const deletedInfo = {
      applicationId: id,
      studentId: application.studentId,
      studentName: application.student?.user?.name,
      joiningLetterUrl: application.joiningLetterUrl,
    };

    const updated = await this.prisma.internshipApplication.update({
      where: { id },
      data: {
        joiningLetterUrl: null,
        joiningLetterUploadedAt: null,
        reviewedAt: null,
        reviewRemarks: null,
        joiningDate: null,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter deletion
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_DELETE,
      entityType: 'InternshipApplication',
      entityId: id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter deleted for student: ${application.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: deletedInfo,
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${id}`]);

    return {
      success: true,
      message: 'Joining letter deleted successfully',
      data: updated,
    };
  }

  /**
   * Download monthly report file
   */
  async downloadMonthlyReport(reportId: string, facultyId: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id: reportId },
      include: {
        application: {
          include: {
            student: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!report || report.isDeleted) {
      throw new NotFoundException('Monthly report not found');
    }

    // Verify faculty is the mentor or assigned via MentorAssignment
    const isDirectMentor = report.application?.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: report.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to download this report');
    }

    if (!report.reportFileUrl) {
      throw new NotFoundException('No report file available for download');
    }

    return {
      url: report.reportFileUrl,
      fileName: `monthly_report_${report.application?.student?.user?.name || 'report'}_${report.reportMonth}_${report.reportYear}.pdf`,
    };
  }

  /**
   * Upload monthly report for a student (faculty uploading on behalf of student)
   */
  async uploadMonthlyReport(
    file: Express.Multer.File,
    body: { applicationId?: string; month: string; year: string; studentId?: string },
    facultyId: string,
    fileStorageService?: any,
  ) {
    const { applicationId, month, year, studentId } = body;

    // Validate that at least one identifier is provided
    if (!applicationId && !studentId) {
      throw new BadRequestException('Either applicationId or studentId must be provided');
    }

    // Find the application - either by ID or by finding student's active application
    let application;

    if (applicationId) {
      // Direct lookup by applicationId
      application = await this.prisma.internshipApplication.findUnique({
        where: { id: applicationId },
        include: {
          student: {
            include: {
              Institution: true,
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
        },
      });
    } else if (studentId) {
      // Find the student's active internship application
      application = await this.prisma.internshipApplication.findFirst({
        where: {
          studentId: studentId,
          internshipPhase: 'ACTIVE',
        },
        include: {
          student: {
            include: {
              Institution: true,
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
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // If no active application, try to find any approved/joined application
      if (!application) {
        application = await this.prisma.internshipApplication.findFirst({
          where: {
            studentId: studentId,
            status: { in: ['APPROVED', 'JOINED'] },
          },
          include: {
            student: {
              include: {
                Institution: true,
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
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }
    }

    if (!application) {
      throw new NotFoundException(
        studentId
          ? 'No active internship application found for this student'
          : 'Application not found'
      );
    }

    // Verify faculty is authorized
    const isDirectMentor = application.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: application.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to upload reports for this student');
    }

    const reportMonth = parseInt(month, 10);
    const reportYear = parseInt(year, 10);

    // Validate month and year
    if (isNaN(reportMonth) || isNaN(reportYear)) {
      throw new BadRequestException('Invalid month or year provided');
    }

    // Use application.id for consistency (handles both applicationId and studentId cases)
    const appId = application.id;

    // Check if report already exists for this month
    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        applicationId: appId,
        reportMonth,
        reportYear,
        isDeleted: false,
      },
    });

    if (existingReport) {
      throw new BadRequestException(`Report for ${month}/${year} already exists`);
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // Upload file to MinIO if fileStorageService is provided
    let reportFileUrl = null;
    let reportFileKey = null;

    if (fileStorageService && file) {
      try {
        // Create folder structure: monthly-reports/{institutionId}/{studentId}/{year}/{month}/
        const institutionId = application.student?.Institution?.id || 'unknown';
        const studentIdForPath = application.studentId;
        const folder = `monthly-reports/${institutionId}/${studentIdForPath}/${reportYear}`;
        const filename = `report_${reportMonth}_${Date.now()}.pdf`;

        const uploadResult = await fileStorageService.uploadFile(file.buffer, {
          folder,
          filename,
          contentType: file.mimetype || 'application/pdf',
          metadata: {
            studentId: application.studentId,
            applicationId: appId,
            reportMonth: reportMonth.toString(),
            reportYear: reportYear.toString(),
            uploadedBy: facultyId,
          },
        });

        reportFileKey = uploadResult.key;
        reportFileUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('Failed to upload report file to storage:', uploadError);
        // Continue without file URL - report will still be created
      }
    }

    const report = await this.prisma.monthlyReport.create({
      data: {
        applicationId: appId,
        studentId: application.studentId,
        reportMonth,
        reportYear,
        monthName: monthNames[reportMonth - 1] || `Month ${reportMonth}`,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        reportFileUrl: reportFileKey, // Store the key, not the full URL
      },
    });

    // Increment report count for the application
    await this.expectedCycleService.incrementReportCount(appId);

    await this.cache.invalidateByTags(['reports', `application:${appId}`]);

    return {
      success: true,
      message: 'Monthly report uploaded successfully',
      data: report,
    };
  }

  /**
   * Get presigned URL to view monthly report
   */
  async getMonthlyReportViewUrl(
    reportId: string,
    facultyId: string,
    fileStorageService: any,
  ) {
    // Find the report
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id: reportId },
      include: {
        application: true,
        student: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Verify faculty is authorized to view this report
    const isDirectMentor = report.application?.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: report.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to view this report');
    }

    // Check if report has a file
    if (!report.reportFileUrl) {
      throw new BadRequestException('No file attached to this report');
    }

    // Generate presigned URL (valid for 1 hour)
    try {
      const presignedUrl = await fileStorageService.getSignedUrl(report.reportFileUrl, 3600);
      return {
        success: true,
        url: presignedUrl,
        filename: `report_${report.monthName}_${report.reportYear}.pdf`,
        expiresIn: 3600,
      };
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new BadRequestException('Failed to generate view URL for the report');
    }
  }

  /**
   * Create assignment for student
   * Note: MonthlyFeedback model has been removed from the schema
   */
  async createAssignment(facultyId: string, assignmentData: any) {
    throw new BadRequestException('Assignment creation is not available. MonthlyFeedback model has been removed from the system.');
  }

  /**
   * Get application details for file upload (used by controller to determine file path)
   */
  async getApplicationForUpload(applicationId: string) {
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      include: {
        student: {
          select: {
            id: true,
            Institution: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                name: true,
                rollNumber: true,
                institutionId: true,
              },
            },
          },
        },
      },
    });

    return application;
  }

  // ==================== Student Management ====================

  /**
   * Update student profile
   * SECURITY: Requires facultyId to verify authorization via MentorAssignment
   */
  async updateStudent(studentId: string, updateDto: any, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const oldValues = {
      name: student.user?.name,
      email: student.user?.email,
      phoneNo: student.user?.phoneNo,
      active: student.user?.active,
    };

    // Build update data for Student model
    const updateData: any = {};
    // Build update data for User model (fields that moved to User)
    const userUpdateData: any = {};

    // Personal info - most fields are now on User model
    if (updateDto.name !== undefined) userUpdateData.name = updateDto.name;
    if (updateDto.email !== undefined) userUpdateData.email = updateDto.email;
    if (updateDto.profileImage !== undefined) updateData.profileImage = updateDto.profileImage;
    if (updateDto.contact !== undefined) userUpdateData.phoneNo = updateDto.contact;
    if (updateDto.rollNumber !== undefined) userUpdateData.rollNumber = updateDto.rollNumber;
    if (updateDto.dob !== undefined) userUpdateData.dob = updateDto.dob || null;
    if (updateDto.gender !== undefined) updateData.gender = updateDto.gender;
    if (updateDto.category !== undefined) updateData.category = updateDto.category;
    if (updateDto.admissionType !== undefined) updateData.admissionType = updateDto.admissionType;
    if (updateDto.branchName !== undefined) userUpdateData.branchName = updateDto.branchName;

    // Academic info - these remain on Student
    if (updateDto.currentYear !== undefined) updateData.currentYear = updateDto.currentYear;
    if (updateDto.currentSemester !== undefined) updateData.currentSemester = updateDto.currentSemester;
    // Use Prisma relation connect syntax for batch and branch
    if (updateDto.batchId !== undefined) {
      if (updateDto.batchId) {
        updateData.batch = { connect: { id: updateDto.batchId } };
      } else {
        updateData.batch = { disconnect: true };
      }
    }
    if (updateDto.branchId !== undefined) {
      if (updateDto.branchId) {
        updateData.branch = { connect: { id: updateDto.branchId } };
      } else {
        updateData.branch = { disconnect: true };
      }
    }
    if (updateDto.clearanceStatus !== undefined) updateData.clearanceStatus = updateDto.clearanceStatus;

    // Parent info
    if (updateDto.parentName !== undefined) updateData.parentName = updateDto.parentName;
    if (updateDto.parentContact !== undefined) updateData.parentContact = updateDto.parentContact;
    if (updateDto.motherName !== undefined) updateData.motherName = updateDto.motherName;

    // Address info
    if (updateDto.address !== undefined) updateData.address = updateDto.address;
    if (updateDto.city !== undefined) updateData.city = updateDto.city;
    if (updateDto.state !== undefined) updateData.state = updateDto.state;
    if (updateDto.district !== undefined) updateData.district = updateDto.district;
    if (updateDto.tehsil !== undefined) updateData.tehsil = updateDto.tehsil;
    if (updateDto.pinCode !== undefined) updateData.pinCode = updateDto.pinCode;

    // Status - active is now on User model
    if (updateDto.isActive !== undefined) userUpdateData.active = updateDto.isActive;

    // Update User model first if there are user fields to update
    if (Object.keys(userUpdateData).length > 0 && student.userId) {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: userUpdateData,
      });
    }

    // Update Student model
    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: updateData,
      include: {
        batch: true,
        branch: true,
        Institution: true,
        user: true,
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit student update
    this.auditService.log({
      action: AuditAction.STUDENT_PROFILE_UPDATE,
      entityType: 'Student',
      entityId: studentId,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Student profile updated by faculty: ${student.user?.name}`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      institutionId: faculty?.institutionId || undefined,
      oldValues,
      newValues: updateDto,
    }).catch(() => {});

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return {
      success: true,
      message: 'Student updated successfully',
      data: updated,
    };
  }

  /**
   * Save student document after upload
   * SECURITY: Requires facultyId to verify authorization via MentorAssignment
   */
  async saveStudentDocument(studentId: string, documentUrl: string, documentType: string, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { name: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Create document record
    const document = await this.prisma.document.create({
      data: {
        studentId,
        type: documentType as any,
        fileName: documentType,
        fileUrl: documentUrl,
      },
    });

    // If this is a profile image, update the student's profileImage field
    if (documentType === 'profile' || documentType === 'PROFILE_IMAGE') {
      await this.prisma.student.update({
        where: { id: studentId },
        data: { profileImage: documentUrl },
      });
    }

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit document upload
    this.auditService.log({
      action: AuditAction.STUDENT_DOCUMENT_UPLOAD,
      entityType: 'Document',
      entityId: document.id,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Document uploaded for student: ${student.user?.name} (${documentType})`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        studentId,
        studentName: student.user?.name,
        documentType,
        documentUrl,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['students', `student:${studentId}`]);

    return {
      success: true,
      message: 'Document uploaded successfully',
      fileUrl: documentUrl, // Include fileUrl directly for frontend
      data: document,
    };
  }

  /**
   * Toggle student active status
   * SECURITY: Requires facultyId to verify authorization via MentorAssignment
   * Also toggles mentor assignments and internship applications
   */
  async toggleStudentStatus(studentId: string, facultyId: string) {
    // Verify faculty is assigned to this student
    const isAuthorized = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId,
        mentorId: facultyId,
        isActive: true,
      },
    });

    if (!isAuthorized) {
      throw new NotFoundException('Student not found or you are not the assigned mentor');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true, name: true, active: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (!student.user) {
      throw new NotFoundException('Student user account not found');
    }

    const currentStatus = student.user.active ?? true;
    const newStatus = !currentStatus;

    // Use transaction to ensure all related data is updated atomically
    await this.prisma.$transaction(async (tx) => {
      if (!newStatus) {
        // Deactivating: Also deactivate mentor assignments and internship applications
        await tx.mentorAssignment.updateMany({
          where: { studentId },
          data: { isActive: false },
        });
        await tx.internshipApplication.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false },
        });
      } else {
        // Activating: Reactivate mentor assignments and internship applications
        await tx.mentorAssignment.updateMany({
          where: { studentId, isActive: false },
          data: { isActive: true },
        });

        await tx.internshipApplication.updateMany({
          where: { studentId, isActive: false },
          data: { isActive: true },
        });
      }

      // Toggle user active status
      await tx.user.update({
        where: { id: student.user!.id },
        data: { active: newStatus },
      });
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit status toggle
    this.auditService.log({
      action: newStatus ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Student ${newStatus ? 'activated' : 'deactivated'} by faculty: ${student.user?.name} (mentor assignments and internship applications also ${newStatus ? 'reactivated' : 'deactivated'})`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: faculty?.institutionId || undefined,
      oldValues: { active: currentStatus },
      newValues: { active: newStatus },
    }).catch(() => {});

    await this.cache.invalidateByTags(['students', `student:${studentId}`, 'users', `user:${student.userId}`, 'faculty', `faculty:${facultyId}`]);

    return {
      success: true,
      active: newStatus,
      message: `Student ${newStatus ? 'activated' : 'deactivated'} successfully. Mentor assignments and internship applications also ${newStatus ? 'reactivated' : 'deactivated'}.`,
    };
  }

  /**
   * Upload joining letter for a student
   */
  async uploadJoiningLetter(applicationId: string, joiningLetterUrl: string, facultyId: string) {
    // Verify application exists and faculty is the mentor
    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { name: true, rollNumber: true } },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Check if faculty is authorized via direct mentorId OR MentorAssignment
    const isDirectMentor = application.mentorId === facultyId;
    const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        mentorId: facultyId,
        studentId: application.studentId,
        isActive: true,
      },
    });
    const isAssignedMentor = !!mentorAssignment;

    if (!isDirectMentor && !isAssignedMentor) {
      throw new BadRequestException('You are not authorized to upload a joining letter for this application');
    }

    // Update the application with joining letter URL and auto-approve joining
    // When joiningLetterUrl is uploaded, automatically set hasJoined = true
    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        joiningLetterUrl,
        joiningLetterUploadedAt: new Date(),
        reviewedAt: new Date(),
        reviewRemarks: null,
        joiningDate: new Date(),
        internshipPhase: InternshipPhase.ACTIVE,
      },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { name: true, rollNumber: true } },
          },
        },
      },
    });

    // Get faculty for audit
    const faculty = await this.prisma.user.findUnique({ where: { id: facultyId } });

    // Audit joining letter upload
    this.auditService.log({
      action: AuditAction.JOINING_LETTER_UPLOAD,
      entityType: 'InternshipApplication',
      entityId: applicationId,
      userId: facultyId,
      userName: faculty?.name,
      userRole: faculty?.role || Role.TEACHER,
      description: `Joining letter uploaded for student: ${application.student?.user?.name}`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.LOW,
      institutionId: faculty?.institutionId || undefined,
      newValues: {
        applicationId,
        studentId: application.student?.id,
        studentName: application.student?.user?.name,
        joiningLetterUrl,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['applications', `application:${applicationId}`]);

    return {
      success: true,
      message: 'Joining letter uploaded successfully',
      data: updated,
    };
  }
}
