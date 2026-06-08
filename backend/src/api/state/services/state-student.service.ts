import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { Prisma, ApplicationStatus, InternshipPhase, MonthlyReportStatus } from '../../../generated/prisma/client';

export interface GetAllStudentsParams {
  page?: number;
  limit?: number;
  search?: string;
  institutionId?: string;
  branchName?: string;
  status?: 'active' | 'inactive' | 'all';
  internshipStatus?: 'with_internship' | 'without_internship' | 'all';
  mentorStatus?: 'assigned' | 'unassigned' | 'all';
  reportStatus?: 'submitted' | 'pending' | 'not_submitted' | 'all';
}

@Injectable()
export class StateStudentService {
  private readonly logger = new Logger(StateStudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
  ) {}

  /**
   * Get all students across all institutions with filters and pagination
   * Used by State Portal for state-wide student view
   */
  async getAllStudents(params: GetAllStudentsParams) {
    const {
      page = 1,
      limit = 20,
      search,
      institutionId,
      branchName,
      status = 'all',
      internshipStatus = 'all',
      mentorStatus = 'all',
      reportStatus = 'all',
    } = params;

    const skip = (page - 1) * limit;

    // Get current month/year for report filtering
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Build where clause
    const where: Prisma.StudentWhereInput = {};
    const userWhere: Prisma.UserWhereInput = {};

    // Apply search filter
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { rollNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phoneNo: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Apply institution filter
    if (institutionId) {
      where.institutionId = institutionId;
    }

    // Apply branch filter
    if (branchName && branchName !== 'all') {
      userWhere.branchName = branchName;
    }

    // Apply status filter
    if (status === 'active') {
      userWhere.active = true;
    } else if (status === 'inactive') {
      userWhere.active = false;
    }

    // Apply user where conditions
    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }

    // Apply internship status filter
    if (internshipStatus === 'with_internship') {
      where.internshipApplications = {
        some: {
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
        },
      };
    } else if (internshipStatus === 'without_internship') {
      where.internshipApplications = {
        none: {
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
        },
      };
    }

    // Apply mentor status filter
    if (mentorStatus === 'assigned') {
      where.mentorAssignments = {
        some: { isActive: true },
      };
    } else if (mentorStatus === 'unassigned') {
      where.mentorAssignments = {
        none: { isActive: true },
      };
    }

    // Apply report status filter
    if (reportStatus && reportStatus !== 'all') {
      if (reportStatus === 'submitted') {
        where.monthlyReports = {
          some: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: MonthlyReportStatus.APPROVED,
            isDeleted: false,
          },
        };
      } else if (reportStatus === 'pending') {
        where.monthlyReports = {
          some: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            status: MonthlyReportStatus.DRAFT,
            isDeleted: false,
          },
        };
      } else if (reportStatus === 'not_submitted') {
        where.monthlyReports = {
          none: {
            reportMonth: currentMonth,
            reportYear: currentYear,
            isDeleted: false,
          },
        };
      }
    }

    // Execute queries in parallel
    const [students, total, institutions, branches] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { Institution: { name: 'asc' } },
          { user: { name: 'asc' } },
        ],
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
              lastLoginAt: true,
            },
          },
          Institution: {
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
            },
          },
          mentorAssignments: {
            where: { isActive: true },
            take: 1,
            include: {
              mentor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNo: true,
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
              isSelfIdentified: true,
              isActive: true,
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              companyName: true,
              companyAddress: true,
              jobProfile: true,
              stipend: true,
              startDate: true,
              endDate: true,
              joiningLetterUrl: true,
              joiningDate: true,
              internshipPhase: true,
              status: true,
            },
          },
          monthlyReports: {
            where: {
              reportMonth: currentMonth,
              reportYear: currentYear,
              isDeleted: false,
            },
            orderBy: { submittedAt: 'desc' },
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
      }),
      this.prisma.student.count({ where }),
      // Get unique institutions for filter dropdown
      this.prisma.institution.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      // Get unique branches for filter dropdown
      this.prisma.user.findMany({
        where: {
          role: 'STUDENT',
          branchName: { not: null },
        },
        select: { branchName: true },
        distinct: ['branchName'],
      }),
    ]);

    // Helper to resolve joining letter status
    const resolveJoiningLetterStatus = (app: any) => {
      if (!app?.joiningLetterUrl) return null;
      if (app.joiningDate || [InternshipPhase.ACTIVE, InternshipPhase.COMPLETED].includes(app.internshipPhase)) {
        return 'APPROVED';
      }
      return 'PENDING';
    };

    // Transform students
    const transformedStudents = students.map((student) => {
      const latestApp = student.internshipApplications?.[0];
      const latestReport = student.monthlyReports?.[0];
      const activeMentor = student.mentorAssignments?.[0]?.mentor;
      const isCrossInstitution = activeMentor
        ? activeMentor.Institution?.id !== student.institutionId
        : false;

      // Determine internship status
      let internshipStatusValue: 'active' | 'completed' | 'not_started' | 'none' = 'none';
      if (latestApp) {
        if (latestApp.internshipPhase === InternshipPhase.COMPLETED) {
          internshipStatusValue = 'completed';
        } else if (latestApp.internshipPhase === InternshipPhase.ACTIVE) {
          internshipStatusValue = 'active';
        } else {
          internshipStatusValue = 'not_started';
        }
      }

      // Determine report status for current month
      let reportStatusValue: 'submitted' | 'pending' | 'not_submitted' = 'not_submitted';
      if (latestReport) {
        if (latestReport.status === MonthlyReportStatus.APPROVED) {
          reportStatusValue = 'submitted';
        } else if (latestReport.status === MonthlyReportStatus.DRAFT) {
          reportStatusValue = 'pending';
        }
      }

      return {
        id: student.id,
        userId: student.userId,
        name: student.user?.name,
        email: student.user?.email,
        rollNumber: student.user?.rollNumber,
        phoneNo: student.user?.phoneNo,
        branchName: student.user?.branchName,
        active: student.user?.active ?? true,
        lastLoginAt: student.user?.lastLoginAt,
        institution: student.Institution
          ? {
              id: student.Institution.id,
              name: student.Institution.name,
              code: student.Institution.code,
              city: student.Institution.city,
            }
          : null,
        mentor: activeMentor
          ? {
              id: activeMentor.id,
              name: activeMentor.name,
              email: activeMentor.email,
              phoneNo: activeMentor.phoneNo,
              institution: activeMentor.Institution,
              isCrossInstitution,
            }
          : null,
        internship: latestApp
          ? {
              id: latestApp.id,
              companyName: latestApp.companyName,
              companyAddress: latestApp.companyAddress,
              jobProfile: latestApp.jobProfile,
              stipend: latestApp.stipend,
              startDate: latestApp.startDate,
              endDate: latestApp.endDate,
              joiningLetterUrl: latestApp.joiningLetterUrl,
              joiningLetterStatus: resolveJoiningLetterStatus(latestApp),
              phase: latestApp.internshipPhase,
              status: latestApp.status,
            }
          : null,
        currentMonthReport: latestReport
          ? {
              id: latestReport.id,
              status: latestReport.status,
              submittedAt: latestReport.submittedAt,
            }
          : null,
        internshipStatus: internshipStatusValue,
        reportStatus: reportStatusValue,
        hasMentor: !!activeMentor,
        hasInternship: !!latestApp,
        hasJoiningLetter: !!latestApp?.joiningLetterUrl,
      };
    });

    return {
      data: transformedStudents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      currentMonth,
      currentYear,
      filters: {
        institutions,
        branches: branches.map((b) => b.branchName).filter(Boolean),
      },
    };
  }

  /**
   * Get summary statistics for all students
   */
  /**
   * Get all students for export (no pagination)
   * Used for Excel export functionality
   */
  async getAllStudentsForExport(params: Omit<GetAllStudentsParams, 'page' | 'limit'>) {
    const {
      search,
      institutionId,
      branchName,
      status = 'all',
      internshipStatus = 'all',
      mentorStatus = 'all',
    } = params;

    // Build where clause (same as getAllStudents but without pagination)
    const where: Prisma.StudentWhereInput = {};
    const userWhere: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { rollNumber: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { phoneNo: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (branchName && branchName !== 'all') {
      userWhere.branchName = branchName;
    }

    if (status === 'active') {
      userWhere.active = true;
    } else if (status === 'inactive') {
      userWhere.active = false;
    }

    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }

    if (internshipStatus === 'with_internship') {
      where.internshipApplications = {
        some: {
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
        },
      };
    } else if (internshipStatus === 'without_internship') {
      where.internshipApplications = {
        none: {
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
        },
      };
    }

    if (mentorStatus === 'assigned') {
      where.mentorAssignments = {
        some: { isActive: true },
      };
    } else if (mentorStatus === 'unassigned') {
      where.mentorAssignments = {
        none: { isActive: true },
      };
    }

    const students = await this.prisma.student.findMany({
      where,
      orderBy: [
        { Institution: { name: 'asc' } },
        { user: { name: 'asc' } },
      ],
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
        Institution: {
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
          },
        },
        mentorAssignments: {
          where: { isActive: true },
          take: 1,
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                phoneNo: true,
              },
            },
          },
        },
        internshipApplications: {
          where: {
            isSelfIdentified: true,
            isActive: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            companyName: true,
            jobProfile: true,
            stipend: true,
            startDate: true,
            endDate: true,
            joiningLetterUrl: true,
            internshipPhase: true,
          },
        },
      },
    });

    // Transform for export
    return students.map((student) => {
      const latestApp = student.internshipApplications?.[0];
      const activeMentor = student.mentorAssignments?.[0]?.mentor;

      let internshipStatusValue = 'No Internship';
      if (latestApp) {
        if (latestApp.internshipPhase === InternshipPhase.COMPLETED) {
          internshipStatusValue = 'Completed';
        } else if (latestApp.internshipPhase === InternshipPhase.ACTIVE) {
          internshipStatusValue = 'Active';
        } else {
          internshipStatusValue = 'Not Started';
        }
      }

      return {
        name: student.user?.name || '',
        rollNumber: student.user?.rollNumber || '',
        email: student.user?.email || '',
        phoneNo: student.user?.phoneNo || '',
        collegeName: student.Institution?.name || '',
        collegeCode: student.Institution?.code || '',
        branch: student.user?.branchName || '',
        status: student.user?.active ? 'Active' : 'Inactive',
        internshipStatus: internshipStatusValue,
        companyName: latestApp?.companyName || '',
        jobProfile: latestApp?.jobProfile || '',
        stipend: latestApp?.stipend || '',
        startDate: latestApp?.startDate || null,
        endDate: latestApp?.endDate || null,
        mentorName: activeMentor?.name || 'Unassigned',
        mentorEmail: activeMentor?.email || '',
        mentorPhone: activeMentor?.phoneNo || '',
        hasJoiningLetter: !!latestApp?.joiningLetterUrl,
      };
    });
  }

  async getStudentsSummary() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [
      totalStudents,
      activeStudents,
      studentsWithInternship,
      studentsWithMentor,
      studentsWithReport,
      studentsWithJoiningLetter,
    ] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.student.count({ where: { user: { active: true } } }),
      this.prisma.student.count({
        where: {
          user: { active: true },
          internshipApplications: {
            some: {
              isSelfIdentified: true,
              isActive: true,
              status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
            },
          },
        },
      }),
      this.prisma.mentorAssignment.findMany({
        where: {
          isActive: true,
          student: { user: { active: true } },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then((r) => r.length),
      this.prisma.monthlyReport.findMany({
        where: {
          reportMonth: currentMonth,
          reportYear: currentYear,
          status: MonthlyReportStatus.APPROVED,
          isDeleted: false,
          student: { user: { active: true } },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then((r) => r.length),
      this.prisma.internshipApplication.findMany({
        where: {
          isSelfIdentified: true,
          isActive: true,
          status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
          joiningLetterUrl: { not: null },
          student: { user: { active: true } },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then((r) => r.length),
    ]);

    return {
      totalStudents,
      activeStudents,
      inactiveStudents: totalStudents - activeStudents,
      studentsWithInternship,
      studentsWithoutInternship: activeStudents - studentsWithInternship,
      studentsWithMentor,
      studentsWithoutMentor: activeStudents - studentsWithMentor,
      studentsWithReport,
      studentsWithoutReport: activeStudents - studentsWithReport,
      studentsWithJoiningLetter,
      studentsWithoutJoiningLetter: activeStudents - studentsWithJoiningLetter,
      currentMonth,
      currentYear,
    };
  }
}
