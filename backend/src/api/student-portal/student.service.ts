import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service";
import { LruCacheService } from "../../core/cache/lru-cache.service";
import { CacheService } from "../../core/cache/cache.service";
import { FacultyVisitService } from "../../domain/report/faculty-visit/faculty-visit.service";
import { ExpectedCycleService } from "../../domain/internship/expected-cycle/expected-cycle.service";
import {
  Prisma,
  ApplicationStatus,
  InternshipPhase,
  MonthlyReportStatus,
  DocumentType,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  Role,
  PlanAfterDiploma,
  JobLocationPreference,
  ExpectedSalaryRange,
} from "../../generated/prisma/client";
import { AuditService } from "../../infrastructure/audit/audit.service";
import {
  calculateExpectedMonths,
  MonthlyCycle,
  getReportSubmissionStatus as getMonthlyReportStatus,
  MONTHLY_CYCLE,
  getMonthName,
} from "../../common/utils/monthly-cycle.util";

// Month names for display
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Report submission status types
type ReportSubmissionStatus =
  | "NOT_YET_DUE"
  | "CAN_SUBMIT"
  | "OVERDUE"
  | "SUBMITTED"
  | "APPROVED";

// REMOVED: ReportPeriod interface - was used by removed generateExpectedReports function
// Expected counts are now calculated via ExpectedCycleService using getTotalExpectedCount()

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly redisCache: CacheService,
    private readonly facultyVisitService: FacultyVisitService,
    private readonly auditService: AuditService,
    private readonly expectedCycleService: ExpectedCycleService
  ) {}

  private isMonthlyReportUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== "P2002") {
      return false;
    }

    const target = (error.meta as { target?: string[] } | undefined)?.target;
    if (!Array.isArray(target)) {
      return false;
    }

    return (
      target.includes("applicationId") &&
      target.includes("reportMonth") &&
      target.includes("reportYear")
    );
  }

  private async deleteSoftDeletedMonthlyReportConflicts(params: {
    applicationId: string;
    reportMonth: number;
    reportYear: number;
  }) {
    const { applicationId, reportMonth, reportYear } = params;

    await this.prisma.monthlyReport.deleteMany({
      where: {
        applicationId,
        reportMonth,
        reportYear,
        isDeleted: true,
      },
    });
  }

  private isCountedReportStatus(status?: MonthlyReportStatus | string | null): boolean {
    if (!status) return false;
    const countedStatuses: MonthlyReportStatus[] = [
      MonthlyReportStatus.SUBMITTED,
      MonthlyReportStatus.UNDER_REVIEW,
      MonthlyReportStatus.APPROVED,
    ];
    return countedStatuses.includes(status as MonthlyReportStatus);
  }

  private async getReportFileVersions(
    reportId: string,
    currentFileUrl?: string | null,
    currentStatus?: MonthlyReportStatus | string | null,
  ) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'MonthlyReport',
        entityId: reportId,
        action: {
          in: [
            AuditAction.MONTHLY_REPORT_SUBMIT,
            AuditAction.MONTHLY_REPORT_UPDATE,
            AuditAction.MONTHLY_REPORT_APPROVE,
            AuditAction.MONTHLY_REPORT_REJECT,
          ],
        },
      },
      select: {
        action: true,
        timestamp: true,
        userName: true,
        userRole: true,
        newValues: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    const versions: Array<{
      version: number;
      fileUrl: string;
      uploadedAt: Date;
      uploadedBy?: string | null;
      uploaderRole?: Role;
      reviewStatus?: MonthlyReportStatus | string | null;
      reviewedAt?: Date;
      reviewedBy?: string | null;
      reviewerRole?: Role;
    }> = [];
    const mergeWindowMs = 2 * 60 * 1000;

    for (const log of logs) {
      const isUploadAction =
        log.action === AuditAction.MONTHLY_REPORT_SUBMIT ||
        log.action === AuditAction.MONTHLY_REPORT_UPDATE;
      const isReviewAction =
        log.action === AuditAction.MONTHLY_REPORT_APPROVE ||
        log.action === AuditAction.MONTHLY_REPORT_REJECT;

      if (isReviewAction) {
        const activeVersion = versions[versions.length - 1];
        if (!activeVersion) continue;

        activeVersion.reviewStatus = log.action === AuditAction.MONTHLY_REPORT_APPROVE
          ? MonthlyReportStatus.APPROVED
          : MonthlyReportStatus.REJECTED;
        activeVersion.reviewedAt = log.timestamp;
        activeVersion.reviewedBy = log.userName;
        activeVersion.reviewerRole = log.userRole;
        continue;
      }

      if (!isUploadAction) continue;

      const values = log.newValues as Record<string, unknown> | null;
      const fileUrl = typeof values?.reportFileUrl === 'string' ? values.reportFileUrl : null;
      if (!fileUrl) continue;

      const lastVersion = versions[versions.length - 1];
      const shouldMergeWithPrevious =
        !!lastVersion &&
        !lastVersion.reviewStatus &&
        lastVersion.fileUrl === fileUrl &&
        (lastVersion.uploadedBy || null) === (log.userName || null) &&
        (lastVersion.uploaderRole || null) === (log.userRole || null) &&
        Math.abs(log.timestamp.getTime() - lastVersion.uploadedAt.getTime()) <= mergeWindowMs;

      if (shouldMergeWithPrevious) {
        continue;
      }

      versions.push({
        version: versions.length + 1,
        fileUrl,
        uploadedAt: log.timestamp,
        uploadedBy: log.userName,
        uploaderRole: log.userRole,
      });
    }

    if (
      currentFileUrl &&
      (versions.length === 0 || versions[versions.length - 1].fileUrl !== currentFileUrl)
    ) {
      versions.push({
        version: versions.length + 1,
        fileUrl: currentFileUrl,
        uploadedAt: new Date(),
        reviewStatus: currentStatus || null,
      });
    }

    if (versions.length > 0) {
      const latestVersion = versions[versions.length - 1];
      if (!latestVersion.reviewStatus && currentStatus) {
        latestVersion.reviewStatus = currentStatus;
      }
    }

    return versions;
  }

  // REMOVED: calculateExpectedReportPeriods function - was used by removed generateExpectedReports
  // Expected counts are now calculated via ExpectedCycleService using getTotalExpectedCount()

  /**
   * Helper: Get submission status for a report
   * HIGH PRIORITY FIX 10.6: Case-insensitive status comparisons
   */
  private getReportSubmissionStatus(report: any): {
    status: ReportSubmissionStatus;
    label: string;
    color: string;
    canSubmit: boolean;
    sublabel?: string;
  } {
    const now = new Date();

    // Normalize status for comparison (case-insensitive)
    const normalizedStatus = report.status
      ? typeof report.status === "string"
        ? report.status.toUpperCase()
        : report.status
      : null;

    // If report is already submitted/approved
    if (
      normalizedStatus === MonthlyReportStatus.APPROVED ||
      normalizedStatus === "APPROVED" ||
      report.isApproved
    ) {
      return {
        status: "APPROVED",
        label: "Approved",
        color: "green",
        canSubmit: false,
      };
    }

    if (
      normalizedStatus === MonthlyReportStatus.SUBMITTED ||
      normalizedStatus === "SUBMITTED"
    ) {
      return {
        status: "SUBMITTED",
        label: "Submitted",
        color: "blue",
        canSubmit: false,
      };
    }

    // Calculate submission window if not stored
    const windowStart = report.submissionWindowStart
      ? new Date(report.submissionWindowStart)
      : null;
    const windowEnd = report.submissionWindowEnd
      ? new Date(report.submissionWindowEnd)
      : null;

    if (!windowStart || !windowEnd) {
      // Fallback: use monthly cycle calculation based on period dates
      // Reports are due on the 5th of the following month
      const periodEndDate = report.periodEndDate
        ? new Date(report.periodEndDate)
        : null;

      if (periodEndDate) {
        // Calculate submission window: first day of next month to 5th of next month
        const reportMonth = periodEndDate.getMonth() + 1; // 1-12
        const reportYear = periodEndDate.getFullYear();
        const nextMonth = reportMonth === 12 ? 1 : reportMonth + 1;
        const nextYear = reportMonth === 12 ? reportYear + 1 : reportYear;

        const calcWindowStart = new Date(nextYear, nextMonth - 1, 1);
        calcWindowStart.setHours(0, 0, 0, 0);

        const calcWindowEnd = new Date(
          nextYear,
          nextMonth - 1,
          MONTHLY_CYCLE.REPORT_DUE_DAY
        );
        calcWindowEnd.setHours(23, 59, 59, 999);

        if (now < calcWindowStart) {
          const daysUntil = Math.ceil(
            (calcWindowStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            status: "NOT_YET_DUE",
            label: "In Progress",
            color: "default",
            canSubmit: false,
            sublabel: `Month ends in ${daysUntil} days`,
          };
        }

        if (now >= calcWindowStart && now <= calcWindowEnd) {
          const daysLeft = Math.ceil(
            (calcWindowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return {
            status: "CAN_SUBMIT",
            label: "Submit Now",
            color: "blue",
            canSubmit: true,
            sublabel: `${daysLeft} days left`,
          };
        }

        const daysOverdue = Math.ceil(
          (now.getTime() - calcWindowEnd.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          status: "OVERDUE",
          label: "Overdue",
          color: "red",
          canSubmit: true,
          sublabel: `${daysOverdue} days overdue`,
        };
      }

      // No valid period end date available - cannot determine status
      return {
        status: "NOT_YET_DUE",
        label: "Pending",
        color: "default",
        canSubmit: false,
        sublabel: "Unable to calculate due date",
      };
    }

    // Use stored submission window
    if (now < windowStart) {
      const daysUntil = Math.ceil(
        (windowStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        status: "NOT_YET_DUE",
        label: "Not Yet Due",
        color: "default",
        canSubmit: false,
        sublabel: `Opens in ${daysUntil} days`,
      };
    }

    if (now >= windowStart && now <= windowEnd) {
      const daysLeft = Math.ceil(
        (windowEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        status: "CAN_SUBMIT",
        label: "Submit Now",
        color: "blue",
        canSubmit: true,
        sublabel: `${daysLeft} days left`,
      };
    }

    const daysOverdue = Math.ceil(
      (now.getTime() - windowEnd.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      status: "OVERDUE",
      label: "Overdue",
      color: "red",
      canSubmit: true,
      sublabel: `${daysOverdue} days overdue`,
    };
  }

  /**
   * Get student dashboard - internship status, report status
   */
  async getDashboard(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, rollNumber: true, email: true } },
      },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;
    const cacheKey = `student:dashboard:${studentId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // OPTIMIZED: Get current self-identified internship with only necessary fields
        const currentInternship =
          await this.prisma.internshipApplication.findFirst({
            where: {
              studentId,
              isActive: true,
              isSelfIdentified: true,
              status: {
                in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED],
              },
              internshipPhase: InternshipPhase.ACTIVE,
            },
            select: {
              id: true,
              status: true,
              isSelfIdentified: true,
              companyName: true,
              jobProfile: true,
              startDate: true,
              endDate: true,
              hrContact: true,
              hrEmail: true,
              hrName: true,
              hrDesignation: true,
              joiningDate: true,
              internshipDuration: true,
              joiningLetterUrl: true,
              joiningLetterUploadedAt: true,
              facultyMentorName: true,
              totalExpectedReports: true,
              totalExpectedVisits: true,
              submittedReportsCount: true,
              completedVisitsCount: true,
              // Internship model removed - self-identified only
              mentor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNo: true,
                },
              },
            },
          });

        // Get pending reports count
        const pendingReports = await this.prisma.monthlyReport.count({
          where: {
            studentId,
            isDeleted: false,
            status: MonthlyReportStatus.DRAFT,
          },
        });

        // Get available internships count - Internship model removed
        const availableInternships = 0;

        // FIXED: Get total self-identified applications count - filter by appropriate status
        const totalApplications = await this.prisma.internshipApplication.count(
          {
            where: {
              studentId,
              isSelfIdentified: true,
              status: {
                in: [
                  ApplicationStatus.APPROVED,
                  ApplicationStatus.JOINED,
                  ApplicationStatus.COMPLETED,
                ],
              },
            },
          }
        );

        // Get upcoming deadlines
        const upcomingDeadlines = await this.prisma.monthlyReport.findMany({
          where: {
            studentId,
            isDeleted: false,
            status: {
              in: [
                MonthlyReportStatus.DRAFT,
                MonthlyReportStatus.REVISION_REQUIRED,
              ],
            },
          },
          take: 3,
          orderBy: { reportMonth: "asc" },
        });

        // Get recent notifications (placeholder - would integrate with notification system)
        const notifications = [];

        // OPTIMIZED: Get recent activities with only necessary fields
        const recentActivities =
          await this.prisma.internshipApplication.findMany({
            where: { studentId, isActive: true, isSelfIdentified: true },
            take: 5,
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              status: true,
              companyName: true,
              jobProfile: true,
              isSelfIdentified: true,
              updatedAt: true,
              createdAt: true,
              // Internship model removed - self-identified only
            },
          });

        return {
          profile: {
            id: student.id,
            name: student.user?.name,
            rollNumber: student.user?.rollNumber,
            email: student.user?.email,
          },
          currentInternship,
          upcomingDeadlines,
          pendingReports,
          availableInternships,
          totalApplications,
          notifications,
          recentActivities,
        };
      },
      { ttl: 300, tags: ["student", `student:${studentId}`] }
    );
  }

  /**
   * Get student profile
   */
  async getProfile(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            active: true,
            rollNumber: true,
            branch: {
              select: {
                id: true,
                name: true,
                shortName: true,
              },
            },
            Institution: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        Institution: {
          select: {
            name: true,
          },
        },
        batch: true,
        branch: true,
        mentorAssignments: {
          where: { isActive: true },
          include: {
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
        },
        // OPTIMIZED: Include only necessary fields for Career Track section
        // Filter out deactivated applications
        internshipApplications: {
          where: { isActive: true },
          select: {
            id: true,
            status: true,
            isSelfIdentified: true,
            isActive: true,
            companyName: true,
            jobProfile: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            hrName: true,
            hrContact: true,
            hrEmail: true,
            hrDesignation: true,
            internshipDuration: true,
            joiningLetterUrl: true,
            joiningLetterUploadedAt: true,
            facultyMentorName: true,
            facultyMentorEmail: true,
            totalExpectedReports: true,
            totalExpectedVisits: true,
            submittedReportsCount: true,
            completedVisitsCount: true,
            createdAt: true,
            updatedAt: true,
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            // Include monthly reports for pending tags calculation
            monthlyReports: {
              where: { isDeleted: false },
              select: {
                id: true,
                reportMonth: true,
                reportYear: true,
                status: true,
                submittedAt: true,
                applicationId: true,
              },
              orderBy: { submittedAt: "desc" },
            },
          },
          orderBy: { appliedDate: "desc" },
        },
        _count: {
          select: {
            internshipApplications: true,
            monthlyReports: true,
            grievances: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    return student;
  }

  /**
   * Update student profile
   * Syncs common fields (name, email, contact) to User record
   */
  async updateProfile(
    userId: string,
    updateProfileDto: Prisma.StudentUpdateInput
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // IMPORTANT: Do not allow Student Portal to toggle activation/deactivation or perform nested updates.
    // This endpoint is intended only for basic profile fields.
    const dto: any = updateProfileDto as any;
    const allowedKeys = new Set([
      "name",
      "email",
      "contact",
      "address",
      "pinCode",
      "tehsil",
      "district",
      "city",
      "state",
      "dob",
      "parentName",
      "parentContact",
      "motherName",
      "gender",
    ]);

    const safeUpdateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(dto ?? {})) {
      if (!allowedKeys.has(key)) continue;
      if (value === undefined) continue;
      safeUpdateData[key] = value;
    }

    // Build user update data for synced fields
    const userUpdateData: any = {};
    if (safeUpdateData.name) userUpdateData.name = safeUpdateData.name;
    if (safeUpdateData.email) userUpdateData.email = safeUpdateData.email;
    if (safeUpdateData.contact) userUpdateData.phoneNo = safeUpdateData.contact; // Student.contact -> User.phoneNo
    if (safeUpdateData.dob) userUpdateData.dob = safeUpdateData.dob;

    // Remove User-only fields from Student update data
    // These fields dont exist on Student model - theyre on User model
    delete safeUpdateData.name;
    delete safeUpdateData.email;
    delete safeUpdateData.contact;
    delete safeUpdateData.dob;

    if (
      Object.keys(safeUpdateData).length === 0 &&
      Object.keys(userUpdateData).length === 0
    ) {
      return student;
    }

    // Use transaction to sync Student and User records
    const [updated] = await this.prisma.$transaction([
      this.prisma.student.update({
        where: { userId },
        data: safeUpdateData,
        include: {
          user: true,
          batch: true,
          branch: true,
        },
      }),
      // Only update user if there are fields to sync
      ...(Object.keys(userUpdateData).length > 0
        ? [
            this.prisma.user.update({
              where: { id: userId },
              data: userUpdateData,
            }),
          ]
        : []),
    ]);

    // Audit profile update
    this.auditService
      .log({
        action: AuditAction.STUDENT_PROFILE_UPDATE,
        entityType: "Student",
        entityId: student.id,
        userId,
        userName: student.user?.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Student profile updated: ${student.user.name}`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: safeUpdateData as any,
      })
      .catch(() => {});

    await this.cache.invalidateByTags([
      "student",
      `student:${updated.id}`,
      `user:${userId}`,
    ]);

    return updated;
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(userId: string, imageUrl: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const updated = await this.prisma.student.update({
      where: { userId },
      data: {
        profileImage: imageUrl,
      },
    });

    // Audit profile image upload
    this.auditService
      .log({
        action: AuditAction.STUDENT_PROFILE_UPDATE,
        entityType: "Student",
        entityId: student.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Profile image uploaded for student: ${student.user.name}`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: { profileImage: imageUrl },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["student", `student:${student.id}`]);

    return {
      success: true,
      imageUrl,
      message: "Profile image uploaded successfully",
    };
  }

  /**
   * Get available internships for student
   * DEPRECATED: Internship model has been removed - only self-identified internships are supported
   */
  async getAvailableInternships(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      industryType?: string;
      location?: string;
    }
  ) {
    throw new NotFoundException(
      "Internship browsing is no longer available - the Internship model has been removed. Only self-identified internships are supported."
    );
  }

  /**
   * Apply for internship
   * DEPRECATED: Internship model has been removed - only self-identified internships are supported
   */
  async applyToInternship(
    userId: string,
    internshipId: string,
    applicationDto: {
      coverLetter?: string;
      resume?: string;
      additionalInfo?: string;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Internship model removed - throw error
    throw new NotFoundException(
      "Internship model has been removed - only self-identified internships are supported"
    );
  }

  /**
   * Get student applications
   */
  async getApplications(
    userId: string,
    params: { page?: number; limit?: number; status?: string }
  ) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const where: Prisma.InternshipApplicationWhereInput = {
      studentId: student.id,
      isActive: true,
    };

    if (status) {
      where.status = status as ApplicationStatus;
    }

    const [applications, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          // Internship and Industry models removed - self-identified only
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          // Include monthly reports for pending tags calculation
          monthlyReports: {
            where: { isDeleted: false },
            select: {
              id: true,
              reportMonth: true,
              reportYear: true,
              status: true,
              submittedAt: true,
              applicationId: true,
              reportFileUrl: true,
              monthName: true,
            },
            orderBy: { submittedAt: "desc" },
          },
          _count: {
            select: {
              monthlyReports: true,
              facultyVisitLogs: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get internship details + student's application (if any)
   */
  async getInternshipDetails(userId: string, internshipId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Internship model removed - return empty object for backward compatibility
    const internship = null;

    if (!internship) {
      throw new NotFoundException(
        "Internship model has been removed - only self-identified internships are supported"
      );
    }

    const application = null; // Internship model removed

    return { internship, application };
  }

  /**
   * Get application details by ID (with ownership verification)
   */
  async getApplicationDetails(userId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const application = await this.prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        // Internship model removed - self-identified only
        mentor: true,
        monthlyReports: true,
        facultyVisitLogs: true,
      },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    // Verify ownership
    if (application.studentId !== student.id) {
      throw new NotFoundException("Application not found");
    }

    return application;
  }

  /**
   * Withdraw an application
   */
  async withdrawApplication(userId: string, applicationId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    // Verify ownership
    if (application.studentId !== student.id) {
      throw new NotFoundException("Application not found");
    }

    // Check if application can be withdrawn
    const nonWithdrawableStatuses: ApplicationStatus[] = [
      ApplicationStatus.SELECTED,
      ApplicationStatus.JOINED,
      ApplicationStatus.COMPLETED,
      ApplicationStatus.WITHDRAWN,
    ];

    if (nonWithdrawableStatuses.includes(application.status)) {
      throw new BadRequestException(
        `Cannot withdraw application with status: ${application.status}`
      );
    }

    const oldStatus = application.status;

    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatus.WITHDRAWN,
      },
    });

    // Audit application withdrawal
    this.auditService
      .log({
        action: AuditAction.APPLICATION_WITHDRAW,
        entityType: "InternshipApplication",
        entityId: applicationId,
        userId,
        userName: student.user?.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Application withdrawn: ${application.companyName || "Unknown Company"}`,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.institutionId || undefined,
        oldValues: { status: oldStatus },
        newValues: { status: ApplicationStatus.WITHDRAWN },
      })
      .catch(() => {});

    await this.cache.invalidateByTags([
      "applications",
      `student:${student.id}`,
    ]);

    return {
      success: true,
      message: "Application withdrawn successfully",
      application: updated,
    };
  }

  /**
   * Update self-identified application (company info, joining letter)
   * Note: Time period (startDate, endDate) cannot be modified by student
   */
  async updateSelfIdentifiedApplication(
    userId: string,
    applicationId: string,
    updateDto: {
      companyName?: string;
      companyAddress?: string;
      companyContact?: string;
      companyEmail?: string;
      hrName?: string;
      hrContact?: string;
      hrEmail?: string;
      jobProfile?: string;
      joiningLetterUrl?: string;
      deleteJoiningLetter?: boolean;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const application = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    // Verify ownership
    if (application.studentId !== student.id) {
      throw new NotFoundException("Application not found");
    }

    // Only allow updates for self-identified applications
    if (!application.isSelfIdentified) {
      throw new BadRequestException(
        "Only self-identified applications can be updated"
      );
    }

    const oldValues = {
      companyName: application.companyName,
      companyAddress: application.companyAddress,
      companyContact: application.companyContact,
      companyEmail: application.companyEmail,
      hrName: application.hrName,
      hrContact: application.hrContact,
      hrEmail: application.hrEmail,
      jobProfile: application.jobProfile,
      joiningLetterUrl: application.joiningLetterUrl,
    };

    // Build update data - explicitly exclude time period fields
    const updateData: any = {};

    if (updateDto.companyName !== undefined)
      updateData.companyName = updateDto.companyName;
    if (updateDto.companyAddress !== undefined)
      updateData.companyAddress = updateDto.companyAddress;
    if (updateDto.companyContact !== undefined)
      updateData.companyContact = updateDto.companyContact;
    if (updateDto.companyEmail !== undefined)
      updateData.companyEmail = updateDto.companyEmail;
    if (updateDto.hrName !== undefined) updateData.hrName = updateDto.hrName;
    if (updateDto.hrContact !== undefined)
      updateData.hrContact = updateDto.hrContact;
    if (updateDto.hrEmail !== undefined) updateData.hrEmail = updateDto.hrEmail;
    if (updateDto.jobProfile !== undefined)
      updateData.jobProfile = updateDto.jobProfile;

    // Handle joining letter
    if (updateDto.deleteJoiningLetter) {
      updateData.joiningLetterUrl = null;
      updateData.joiningLetterUploadedAt = null;
    } else if (updateDto.joiningLetterUrl !== undefined) {
      updateData.joiningLetterUrl = updateDto.joiningLetterUrl;
      updateData.joiningLetterUploadedAt = new Date();
    }

    const updated = await this.prisma.internshipApplication.update({
      where: { id: applicationId },
      data: updateData,
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit application update
    this.auditService
      .log({
        action: AuditAction.APPLICATION_UPDATE,
        entityType: "InternshipApplication",
        entityId: applicationId,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Self-identified application updated: ${updated.companyName}`,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        oldValues,
        newValues: updateData,
      })
      .catch(() => {});

    await this.cache.invalidateByTags([
      "applications",
      `student:${student.id}`,
    ]);

    return {
      success: true,
      message: "Application updated successfully",
      application: updated,
    };
  }

  /**
   * Submit self-identified internship
   */
  async submitSelfIdentified(
    userId: string,
    selfIdentifiedDto: {
      companyName: string;
      companyAddress: string;
      companyContact?: string;
      companyEmail?: string;
      hrName?: string;
      hrDesignation?: string;
      hrContact?: string;
      hrEmail?: string;
      internshipDuration?: string;
      stipend?: string;
      startDate?: Date;
      endDate?: Date;
      jobProfile?: string;
      joiningLetterUrl?: string;
      coverLetter?: string;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;

    // Check if student already has an active internship application
    const activeApplication = await this.prisma.internshipApplication.findFirst(
      {
        where: {
          studentId,
          isActive: true,

          status: {
            in: [
              ApplicationStatus.SELECTED,
              ApplicationStatus.JOINED,
              ApplicationStatus.APPLIED,
            ],
          },
        },
      }
    );

    if (activeApplication && !activeApplication.isSelfIdentified) {
      throw new BadRequestException(
        "You already have an active internship application"
      );
    }

    // Check if student already has an approved self-identified internship
    const existingSelfIdentified =
      await this.prisma.internshipApplication.findFirst({
        where: {
          studentId,
          isActive: true,
          isSelfIdentified: true,
          status: ApplicationStatus.APPROVED,
          internshipPhase: {
            in: [InternshipPhase.NOT_STARTED, InternshipPhase.ACTIVE],
          },
        },
      });

    if (existingSelfIdentified) {
      throw new BadRequestException(
        "You already have an approved self-identified internship. Please edit the existing one instead of creating a new application."
      );
    }

    // Self-identified internships are auto-approved
    // If joiningLetterUrl is provided, auto-approve joining as well
    const hasJoiningLetter = !!selfIdentifiedDto.joiningLetterUrl;
    const now = new Date();
    const application = await this.prisma.internshipApplication.create({
      data: {
        studentId,
        isSelfIdentified: true,
        isActive: true,
        status: ApplicationStatus.APPROVED,
        internshipPhase: InternshipPhase.ACTIVE,
        reviewedAt: now,
        joiningLetterUploadedAt: hasJoiningLetter ? now : null,
        joiningDate: hasJoiningLetter ? now : null,
        ...selfIdentifiedDto,
      },
    });

    // Audit self-identified internship submission
    this.auditService
      .log({
        action: AuditAction.APPLICATION_SUBMIT,
        entityType: "InternshipApplication",
        entityId: application.id,
        userId,
        userName: student.user?.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Self-identified internship submitted: ${selfIdentifiedDto.companyName}`,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.institutionId || undefined,
        newValues: {
          applicationId: application.id,
          companyName: selfIdentifiedDto.companyName,
          isSelfIdentified: true,
          status: ApplicationStatus.APPROVED,
          startDate: selfIdentifiedDto.startDate,
          endDate: selfIdentifiedDto.endDate,
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["applications", `student:${studentId}`]);

    return application;
  }

  /**
   * Get self-identified internship applications
   */
  async getSelfIdentified(
    userId: string,
    params: { page?: number; limit?: number }
  ) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const where: Prisma.InternshipApplicationWhereInput = {
      studentId: student.id,
      isActive: true,
      isSelfIdentified: true,
    };

    const [applications, total] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          mentor: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNo: true,
              designation: true,
            },
          },
          // Internship and Industry models removed - self-identified only
          _count: {
            select: {
              monthlyReports: true,
              facultyVisitLogs: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.internshipApplication.count({ where }),
    ]);

    return {
      applications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Submit monthly report for faculty review
   * - If a non-approved report exists, update it with latest file and mark SUBMITTED
   * - If no report exists, create with SUBMITTED status
   * - Check submission window and mark overdue if applicable
   */
  async submitMonthlyReport(
    userId: string,
    reportDto: {
      applicationId: string;
      reportMonth: number;
      reportYear: number;
      reportFileUrl: string; // Required for submission
      monthName?: string;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;

    // Require file URL for submission
    if (!reportDto.reportFileUrl) {
      throw new BadRequestException("Report file is required for submission");
    }

    // Verify application belongs to student
    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: reportDto.applicationId,
        studentId,
      },
      select: {
        id: true,
        startDate: true,
        joiningDate: true,
        endDate: true,
        completionDate: true,
      },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    // CRITICAL FIX 10.1: Monthly Report Timing Validation
    // Validate report month is not before internship started
    const internshipStartDate =
      application.startDate || application.joiningDate;
    if (internshipStartDate) {
      const reportDate = new Date(
        reportDto.reportYear,
        reportDto.reportMonth - 1,
        1
      );
      const startDate = new Date(
        internshipStartDate.getFullYear(),
        internshipStartDate.getMonth(),
        1
      );

      if (reportDate < startDate) {
        throw new BadRequestException(
          `Cannot submit report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
            `Internship started in ${MONTH_NAMES[internshipStartDate.getMonth()]} ${internshipStartDate.getFullYear()}.`
        );
      }
    }

    // Validate report month is not after internship ended
    const internshipEndDate = application.endDate || application.completionDate;
    if (internshipEndDate) {
      const reportDate = new Date(
        reportDto.reportYear,
        reportDto.reportMonth - 1,
        1
      );
      const endDate = new Date(
        internshipEndDate.getFullYear(),
        internshipEndDate.getMonth(),
        1
      );

      if (reportDate > endDate) {
        throw new BadRequestException(
          `Cannot submit report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
            `Internship ended in ${MONTH_NAMES[internshipEndDate.getMonth()]} ${internshipEndDate.getFullYear()}.`
        );
      }
    }

    // Check if report for this month already exists
    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        isDeleted: false,
      },
    });

    // Calculate submission window
    const nextMonth =
      reportDto.reportMonth === 12 ? 1 : reportDto.reportMonth + 1;
    const nextYear =
      reportDto.reportMonth === 12
        ? reportDto.reportYear + 1
        : reportDto.reportYear;
    const submissionWindowStart = new Date(nextYear, nextMonth - 1, 1);
    const submissionWindowEnd = new Date(
      nextYear,
      nextMonth - 1,
      10,
      23,
      59,
      59
    );
    const now = new Date();
    const isOverdue = now > submissionWindowEnd;

    // If report already exists
    if (existingReport) {
      // Don't allow re-submission if already approved
      if (existingReport.status === MonthlyReportStatus.APPROVED) {
        throw new BadRequestException("Report has already been approved");
      }

      // Calculate period dates if not already set
      const periodStartDate =
        existingReport.periodStartDate ||
        new Date(reportDto.reportYear, reportDto.reportMonth - 1, 1);
      const periodEndDate =
        existingReport.periodEndDate ||
        new Date(reportDto.reportYear, reportDto.reportMonth, 0, 23, 59, 59);

      const shouldIncrementReportCount = !this.isCountedReportStatus(existingReport.status);

      // Update existing report and submit for manual faculty approval
      const updated = await this.prisma.monthlyReport.update({
        where: { id: existingReport.id },
        data: {
          reportFileUrl: reportDto.reportFileUrl,
          monthName:
            reportDto.monthName || MONTH_NAMES[reportDto.reportMonth - 1],
          status: MonthlyReportStatus.SUBMITTED,
          isApproved: false,
          approvedAt: null,
          approvedBy: null,
          reviewedAt: null,
          reviewedBy: null,
          reviewComments: null,
          submittedAt: now,
          submissionWindowStart:
            existingReport.submissionWindowStart || submissionWindowStart,
          submissionWindowEnd:
            existingReport.submissionWindowEnd || submissionWindowEnd,
          dueDate: existingReport.dueDate || submissionWindowEnd,
          periodStartDate,
          periodEndDate,
          isOverdue,
        },
      });

      // Audit monthly report submission (update)
      this.auditService
        .log({
          action: AuditAction.MONTHLY_REPORT_SUBMIT,
          entityType: "MonthlyReport",
          entityId: updated.id,
          userId,
          userName: student.user.name,
          userRole: student.user.role || Role.STUDENT,
          description: `Monthly report submitted for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}${isOverdue ? " (overdue)" : ""}`,
          category: AuditCategory.INTERNSHIP_WORKFLOW,
          severity: isOverdue ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
          institutionId: student.institutionId || undefined,
          newValues: {
            reportId: updated.id,
            reportMonth: reportDto.reportMonth,
            reportYear: reportDto.reportYear,
            status: MonthlyReportStatus.SUBMITTED,
            isOverdue,
            previousReportFileUrl: existingReport.reportFileUrl,
            reportFileUrl: reportDto.reportFileUrl,
            manualApprovalRequired: true,
          },
        })
        .catch(() => {});

      await this.cache.invalidateByTags(["reports", `student:${studentId}`, `student:dashboard:${studentId}`]);

      if (shouldIncrementReportCount) {
        await this.expectedCycleService.incrementReportCount(
          reportDto.applicationId
        );
      }

      const fileVersions = await this.getReportFileVersions(updated.id, updated.reportFileUrl, updated.status);

      return {
        ...updated,
        message: "Report submitted successfully and sent for faculty approval",
        autoApproved: false,
        fileVersions,
      };
    }

    // Calculate period dates for the report
    const periodStartDate = new Date(
      reportDto.reportYear,
      reportDto.reportMonth - 1,
      1
    );
    const periodEndDate = new Date(
      reportDto.reportYear,
      reportDto.reportMonth,
      0,
      23,
      59,
      59
    );

    // Create new report with SUBMITTED status for manual faculty approval
    let report;
    let shouldIncrementReportCount = true;

    await this.deleteSoftDeletedMonthlyReportConflicts({
      applicationId: reportDto.applicationId,
      reportMonth: reportDto.reportMonth,
      reportYear: reportDto.reportYear,
    });

    try {
      report = await this.prisma.monthlyReport.create({
        data: {
          applicationId: reportDto.applicationId,
          studentId,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          reportFileUrl: reportDto.reportFileUrl,
          monthName:
            reportDto.monthName || MONTH_NAMES[reportDto.reportMonth - 1],
          status: MonthlyReportStatus.SUBMITTED,
          isApproved: false,
          submittedAt: now,
          submissionWindowStart,
          submissionWindowEnd,
          dueDate: submissionWindowEnd,
          periodStartDate,
          periodEndDate,
          isOverdue,
        },
      });
    } catch (error) {
      if (!this.isMonthlyReportUniqueConstraintError(error)) {
        throw error;
      }

      await this.deleteSoftDeletedMonthlyReportConflicts({
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
      });

      const conflictingReport = await this.prisma.monthlyReport.findFirst({
        where: {
          applicationId: reportDto.applicationId,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          isDeleted: false,
        },
      });

      if (!conflictingReport) {
        report = await this.prisma.monthlyReport.create({
          data: {
            applicationId: reportDto.applicationId,
            studentId,
            reportMonth: reportDto.reportMonth,
            reportYear: reportDto.reportYear,
            reportFileUrl: reportDto.reportFileUrl,
            monthName:
              reportDto.monthName || MONTH_NAMES[reportDto.reportMonth - 1],
            status: MonthlyReportStatus.SUBMITTED,
            isApproved: false,
            submittedAt: now,
            submissionWindowStart,
            submissionWindowEnd,
            dueDate: submissionWindowEnd,
            periodStartDate,
            periodEndDate,
            isOverdue,
          },
        });
        shouldIncrementReportCount = true;
      } else if (conflictingReport.status === MonthlyReportStatus.APPROVED) {
        throw new BadRequestException("Report has already been approved");
      } else {
        shouldIncrementReportCount = !this.isCountedReportStatus(conflictingReport.status);
        report = await this.prisma.monthlyReport.update({
          where: { id: conflictingReport.id },
          data: {
            reportFileUrl: reportDto.reportFileUrl,
            monthName:
              reportDto.monthName || MONTH_NAMES[reportDto.reportMonth - 1],
            status: MonthlyReportStatus.SUBMITTED,
            isApproved: false,
            approvedAt: null,
            approvedBy: null,
            reviewedAt: null,
            reviewedBy: null,
            reviewComments: null,
            submittedAt: now,
            submissionWindowStart:
              conflictingReport.submissionWindowStart || submissionWindowStart,
            submissionWindowEnd:
              conflictingReport.submissionWindowEnd || submissionWindowEnd,
            dueDate: conflictingReport.dueDate || submissionWindowEnd,
            periodStartDate: conflictingReport.periodStartDate || periodStartDate,
            periodEndDate: conflictingReport.periodEndDate || periodEndDate,
            isOverdue,
          },
        });

        shouldIncrementReportCount = true;
      }
    }

    // Audit monthly report submission (create)
    this.auditService
      .log({
        action: AuditAction.MONTHLY_REPORT_SUBMIT,
        entityType: "MonthlyReport",
        entityId: report.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Monthly report submitted for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}${isOverdue ? " (overdue)" : ""}`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: isOverdue ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: {
          reportId: report.id,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          status: MonthlyReportStatus.SUBMITTED,
          isOverdue,
          reportFileUrl: reportDto.reportFileUrl,
          manualApprovalRequired: true,
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["reports", `student:${studentId}`, `student:dashboard:${studentId}`]);

    // Increment submitted reports counter for new report
    if (shouldIncrementReportCount) {
      await this.expectedCycleService.incrementReportCount(
        reportDto.applicationId
      );
    }

    const fileVersions = await this.getReportFileVersions(report.id, report.reportFileUrl, report.status);

    return {
      ...report,
      message: "Report submitted successfully and sent for faculty approval",
      autoApproved: false,
      fileVersions,
    };
  }

  /**
   * Update a monthly report (student-owned)
   */
  async updateMonthlyReport(
    userId: string,
    id: string,
    reportDto: {
      reportFileUrl?: string;
      monthName?: string;
      status?: MonthlyReportStatus;
      reviewComments?: string;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;

    const existing = await this.prisma.monthlyReport.findFirst({
      where: { id, studentId, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException("Monthly report not found");
    }

    const oldValues = {
      reportFileUrl: existing.reportFileUrl,
      monthName: existing.monthName,
      status: existing.status,
    };

    if (
      reportDto.status === MonthlyReportStatus.APPROVED ||
      reportDto.status === MonthlyReportStatus.REJECTED ||
      reportDto.status === MonthlyReportStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        "Students cannot set review status directly. Submit report for faculty review."
      );
    }

    const updated = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        reportFileUrl: reportDto.reportFileUrl,
        monthName: reportDto.monthName,
        status: reportDto.status,
        reviewComments: undefined,
        submittedAt:
          reportDto.status === MonthlyReportStatus.SUBMITTED
            ? new Date()
            : undefined,
      },
    });

    // Audit monthly report update
    this.auditService
      .log({
        action: AuditAction.MONTHLY_REPORT_SUBMIT,
        entityType: "MonthlyReport",
        entityId: id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Monthly report updated for ${existing.monthName || MONTH_NAMES[(existing.reportMonth || 1) - 1]} ${existing.reportYear}`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        oldValues,
        newValues: reportDto,
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["reports", `student:${studentId}`]);
    return updated;
  }

  /**
   * Delete a monthly report (student-owned, non-approved only)
   */
  async deleteMonthlyReport(userId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;

    const existing = await this.prisma.monthlyReport.findFirst({
      where: { id, studentId, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException("Monthly report not found");
    }

    // Soft delete instead of hard delete
    await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Decrement counter for statuses that contribute to submittedReportsCount.
    if (
      existing.applicationId &&
      this.isCountedReportStatus(existing.status)
    ) {
      await this.expectedCycleService.decrementReportCount(
        existing.applicationId
      );
    }

    // Audit monthly report deletion
    this.auditService
      .log({
        action: AuditAction.MONTHLY_REPORT_DELETE,
        entityType: "MonthlyReport",
        entityId: id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Monthly report deleted for ${existing.monthName || MONTH_NAMES[(existing.reportMonth || 1) - 1]} ${existing.reportYear}`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.institutionId || undefined,
        oldValues: {
          reportId: id,
          reportMonth: existing.reportMonth,
          reportYear: existing.reportYear,
          status: existing.status,
          isDeleted: false,
        },
        newValues: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["reports", `student:${studentId}`, `student:dashboard:${studentId}`]);

    return {
      success: true,
      message: "Monthly report deleted successfully",
    };
  }

  /**
   * Get student documents (only non-deleted)
   */
  async getDocuments(
    userId: string,
    params: { page?: number; limit?: number; type?: string }
  ) {
    const { page = 1, limit = 10, type } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const where: Prisma.DocumentWhereInput = {
      studentId: student.id,
      isDeleted: false, // Only return non-deleted documents
      ...(type ? { type: type as DocumentType } : {}),
    };

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Upload a document
   */
  async uploadDocument(
    userId: string,
    file: any,
    documentDto: { type: string }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const fileUrl =
      (file as any)?.path ||
      (file as any)?.location ||
      (file as any)?.url ||
      "";
    const fileName =
      (file as any)?.originalname || (file as any)?.filename || "document";

    const created = await this.prisma.document.create({
      data: {
        studentId: student.id,
        type: documentDto.type as DocumentType,
        fileName,
        fileUrl,
      },
    });

    // Audit document upload
    this.auditService
      .log({
        action: AuditAction.STUDENT_DOCUMENT_UPLOAD,
        entityType: "Document",
        entityId: created.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Document uploaded: ${fileName} (${documentDto.type})`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: {
          documentId: created.id,
          fileName,
          fileUrl,
          type: documentDto.type,
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["documents", `student:${student.id}`]);
    return created;
  }

  /**
   * Soft delete a document
   */
  async deleteDocument(userId: string, id: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const document = await this.prisma.document.findFirst({
      where: { id, isDeleted: false },
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    // Soft delete instead of hard delete
    await this.prisma.document.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    // Audit document deletion
    this.auditService
      .log({
        action: AuditAction.STUDENT_DOCUMENT_DELETE,
        entityType: "Document",
        entityId: id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Document deleted: ${document.fileName}`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.institutionId || undefined,
        oldValues: {
          documentId: id,
          fileName: document.fileName,
          type: document.type,
          isDeleted: false,
        },
        newValues: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["documents", `student:${student.id}`]);
    return { success: true, message: "Document deleted successfully" };
  }

  /**
   * Get monthly reports
   * CRITICAL FIX 10.3: Filter reports by valid internship period
   */
  async getMonthlyReports(
    userId: string,
    params: { page?: number; limit?: number; applicationId?: string }
  ) {
    const { page = 1, limit = 10, applicationId } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;

    // Build where clause with optional applicationId filter
    const where: any = { studentId, isDeleted: false };
    if (applicationId) {
      where.applicationId = applicationId;
    }

    const [reports, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          // OPTIMIZED: Only select necessary fields from application
          application: {
            select: {
              id: true,
              companyName: true,
              isSelfIdentified: true,
              startDate: true,
              endDate: true,
              joiningDate: true,
              completionDate: true,
              // Internship and Industry models removed
            },
          },
        },
        orderBy: [{ reportYear: "desc" }, { reportMonth: "desc" }],
      }),
      this.prisma.monthlyReport.count({ where }),
    ]);

    // CRITICAL FIX 10.3: Filter reports for valid internship period only
    const validReports = reports.filter((report) => {
      const application = report.application;
      if (!application) return true; // Keep if no application data

      const internshipStartDate =
        application.startDate || application.joiningDate;
      const internshipEndDate =
        application.endDate || application.completionDate;

      // If no start date, keep all reports
      if (!internshipStartDate) return true;

      const reportDate = new Date(report.reportYear, report.reportMonth - 1, 1);
      const startDate = new Date(
        internshipStartDate.getFullYear(),
        internshipStartDate.getMonth(),
        1
      );

      // Filter out reports before internship started
      if (reportDate < startDate) return false;

      // Filter out reports after internship ended
      if (internshipEndDate) {
        const endDate = new Date(
          internshipEndDate.getFullYear(),
          internshipEndDate.getMonth(),
          1
        );
        if (reportDate > endDate) return false;
      }

      return true;
    });

    const reportsWithVersions = await Promise.all(
      validReports.map(async (report) => ({
        ...report,
        fileVersions: await this.getReportFileVersions(report.id, report.reportFileUrl, report.status),
      }))
    );

    return {
      reports: reportsWithVersions,
      total: reportsWithVersions.length,
      page,
      limit,
      totalPages: Math.ceil(reportsWithVersions.length / limit),
    };
  }

  /**
   * Submit grievance
   */
  async submitGrievance(
    userId: string,
    grievanceDto: {
      title: string;
      category: string;
      description: string;
      severity?: string;
      // industryId removed - Industry model no longer exists
      actionRequested?: string;
      preferredContactMethod?: string;
      attachments?: string[];
      assignedToId?: string;
    }
  ) {
    console.log(
      "[StudentService.submitGrievance] Received grievanceDto:",
      JSON.stringify(grievanceDto, null, 2)
    );
    console.log(
      "[StudentService.submitGrievance] assignedToId:",
      grievanceDto.assignedToId
    );

    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const studentId = student.id;

    const grievance = await this.prisma.grievance.create({
      data: {
        studentId,
        title: grievanceDto.title,
        category: grievanceDto.category as any,
        description: grievanceDto.description,
        severity: (grievanceDto.severity as any) || "MEDIUM",
        actionRequested: grievanceDto.actionRequested,
        preferredContactMethod: grievanceDto.preferredContactMethod,
        attachments: grievanceDto.attachments || [],
        assignedToId: grievanceDto.assignedToId,
        escalationLevel: "MENTOR",
        status: "SUBMITTED",
      },
    });

    // Audit grievance submission
    this.auditService
      .log({
        action: AuditAction.GRIEVANCE_SUBMIT,
        entityType: "Grievance",
        entityId: grievance.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Grievance submitted: ${grievanceDto.title} (${grievanceDto.category})`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity:
          grievanceDto.severity === "HIGH" ||
          grievanceDto.severity === "CRITICAL"
            ? AuditSeverity.HIGH
            : AuditSeverity.MEDIUM,
        institutionId: student.institutionId || undefined,
        newValues: {
          grievanceId: grievance.id,
          title: grievanceDto.title,
          category: grievanceDto.category,
          severity: grievanceDto.severity || "MEDIUM",
          status: "PENDING",
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["grievances", `student:${studentId}`]);

    // Invalidate Redis cache for assigned faculty so they see the new grievance
    if (grievanceDto.assignedToId) {
      await this.redisCache.del(
        `grievances:faculty:${grievanceDto.assignedToId}`
      );
    }

    return grievance;
  }

  /**
   * Get grievances
   */
  async getGrievances(
    userId: string,
    params: { page?: number; limit?: number; status?: string }
  ) {
    const { page = 1, limit = 10, status } = params;
    const skip = (page - 1) * limit;

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const where: Prisma.GrievanceWhereInput = {
      studentId: student.id,
    };

    if (status) {
      where.status = status as any;
    }

    const [grievances, total] = await Promise.all([
      // OPTIMIZED: Only select necessary fields for list view
      this.prisma.grievance.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          category: true,
          description: true,
          severity: true,
          status: true,
          submittedDate: true,
          resolvedDate: true,
          resolution: true,
          createdAt: true,
          updatedAt: true,
          // Internship and Industry models removed
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { submittedDate: "desc" },
      }),
      this.prisma.grievance.count({ where }),
    ]);

    return {
      grievances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Support Tickets: Students should use SupportTicketService via /support/tickets endpoints
  // POST /support/tickets - Create ticket (all authenticated users)
  // GET /support/tickets/my-tickets - Get user's own tickets

  // REMOVED: generateExpectedReports function
  // Legacy system that created DRAFT records has been replaced by counter-based tracking
  // Expected counts are now calculated via ExpectedCycleService.recalculateExpectedCounts()
  // when internship is created (self-identified submission) or dates are updated

  /**
   * Get monthly reports with submission status for an application
   * Returns only reports that have been uploaded by students (with files)
   */
  async getMonthlyReportsWithStatus(userId: string, applicationId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Verify ownership
    const application = await this.prisma.internshipApplication.findFirst({
      where: { id: applicationId, studentId: student.id },
      // Internship and Industry models removed
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    // Get all reports for this application
    const reports = await this.prisma.monthlyReport.findMany({
      where: { applicationId, isDeleted: false },
      orderBy: [{ reportYear: "asc" }, { reportMonth: "asc" }],
    });

    const reportsWithVersions = await Promise.all(
      reports.map(async (report) => ({
        ...report,
        fileVersions: await this.getReportFileVersions(report.id, report.reportFileUrl, report.status),
      }))
    );

    return this.formatReportsWithStatus(reportsWithVersions, application);
  }

  /**
   * Helper: Format reports with submission status
   * HIGH PRIORITY FIX 10.5: Progress calculated based on valid reports only
   */
  private formatReportsWithStatus(reports: any[], application: any) {
    const internshipStartDate =
      application.startDate || application.joiningDate;
    const internshipEndDate = application.endDate || application.completionDate;

    // Filter for valid reports (within internship period)
    const validReports = reports.filter((report) => {
      if (!internshipStartDate) return true;

      const reportDate = new Date(report.reportYear, report.reportMonth - 1, 1);
      const startDate = new Date(
        internshipStartDate.getFullYear(),
        internshipStartDate.getMonth(),
        1
      );

      // Filter out reports before internship started
      if (reportDate < startDate) return false;

      // Filter out reports after internship ended
      if (internshipEndDate) {
        const endDate = new Date(
          internshipEndDate.getFullYear(),
          internshipEndDate.getMonth(),
          1
        );
        if (reportDate > endDate) return false;
      }

      return true;
    });

    const reportsWithStatus = validReports.map((report) => {
      const submissionStatus = this.getReportSubmissionStatus(report);
      return {
        ...report,
        submissionStatus,
        autoApproved:
          report.isApproved && report.status === MonthlyReportStatus.APPROVED, // HIGH PRIORITY FIX 10.4
      };
    });

    // Calculate progress - only for valid reports
    const total = validReports.length;
    const approved = validReports.filter(
      (r) => r.status === MonthlyReportStatus.APPROVED
    ).length;
    const submitted = validReports.filter(
      (r) => r.status === MonthlyReportStatus.SUBMITTED
    ).length;
    const draft = validReports.filter(
      (r) => r.status === MonthlyReportStatus.DRAFT
    ).length;
    const overdue = validReports.filter((r) => {
      if (r.status === MonthlyReportStatus.APPROVED) return false;
      const status = this.getReportSubmissionStatus(r);
      return status.status === "OVERDUE";
    }).length;

    return {
      reports: reportsWithStatus,
      progress: {
        total,
        approved,
        submitted,
        draft,
        overdue,
        percentage: total > 0 ? Math.round((approved / total) * 100) : 0,
      },
      internship: {
        startDate: application.startDate,
        endDate: application.endDate,
        companyName: application.companyName,
      },
    };
  }

  /**
   * View a specific monthly report
   * HIGH PRIORITY FIX 10.4: Include autoApproved flag in response
   */
  async viewMonthlyReport(userId: string, reportId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const report = await this.prisma.monthlyReport.findFirst({
      where: { id: reportId, studentId: student.id, isDeleted: false },
      include: {
        application: {
          select: {
            companyName: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            completionDate: true,
            // Internship and Industry models removed
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const submissionStatus = this.getReportSubmissionStatus(report);
    const fileVersions = await this.getReportFileVersions(report.id, report.reportFileUrl, report.status);

    return {
      ...report,
      submissionStatus,
      autoApproved:
        report.isApproved && report.status === MonthlyReportStatus.APPROVED,
      fileVersions,
    };
  }

  /**
   * Upload report file and save as DRAFT (for cases where user wants to upload before submitting)
   */
  private async validateMonthlyReportUploadPreconditions(
    userId: string,
    reportDto: {
      applicationId: string;
      reportMonth: number;
      reportYear: number;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: reportDto.applicationId,
        studentId: student.id,
      },
      select: {
        id: true,
        startDate: true,
        joiningDate: true,
        endDate: true,
        completionDate: true,
      },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    const internshipStartDate =
      application.startDate || application.joiningDate;
    if (internshipStartDate) {
      const reportDate = new Date(
        reportDto.reportYear,
        reportDto.reportMonth - 1,
        1
      );
      const startDate = new Date(
        internshipStartDate.getFullYear(),
        internshipStartDate.getMonth(),
        1
      );

      if (reportDate < startDate) {
        throw new BadRequestException(
          `Cannot upload report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
            `Internship started in ${MONTH_NAMES[internshipStartDate.getMonth()]} ${internshipStartDate.getFullYear()}.`
        );
      }
    }

    const internshipEndDate = application.endDate || application.completionDate;
    if (internshipEndDate) {
      const reportDate = new Date(
        reportDto.reportYear,
        reportDto.reportMonth - 1,
        1
      );
      const endDate = new Date(
        internshipEndDate.getFullYear(),
        internshipEndDate.getMonth(),
        1
      );

      if (reportDate > endDate) {
        throw new BadRequestException(
          `Cannot upload report for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}. ` +
            `Internship ended in ${MONTH_NAMES[internshipEndDate.getMonth()]} ${internshipEndDate.getFullYear()}.`
        );
      }
    }

    const existingReport = await this.prisma.monthlyReport.findFirst({
      where: {
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
        isDeleted: false,
      },
    });

    if (existingReport?.status === MonthlyReportStatus.APPROVED) {
      throw new BadRequestException("Approved reports cannot be modified");
    }

    return { student, existingReport };
  }

  async validateReportUploadEligibility(
    userId: string,
    reportDto: {
      applicationId: string;
      reportMonth: number;
      reportYear: number;
    }
  ) {
    await this.validateMonthlyReportUploadPreconditions(userId, reportDto);
    return { valid: true };
  }

  async uploadReportFile(
    userId: string,
    reportDto: {
      applicationId: string;
      reportMonth: number;
      reportYear: number;
      reportFileUrl: string;
    }
  ) {
    const { student, existingReport } =
      await this.validateMonthlyReportUploadPreconditions(userId, reportDto);

    if (existingReport) {
      // Update existing report with file
      const updated = await this.prisma.monthlyReport.update({
        where: { id: existingReport.id },
        data: { reportFileUrl: reportDto.reportFileUrl },
      });

      // Audit report file upload (update)
      this.auditService
        .log({
          action: AuditAction.MONTHLY_REPORT_UPDATE,
          entityType: "MonthlyReport",
          entityId: updated.id,
          userId,
          userName: student.user.name,
          userRole: student.user.role || Role.STUDENT,
          description: `Report file uploaded for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}`,
          category: AuditCategory.INTERNSHIP_WORKFLOW,
          severity: AuditSeverity.LOW,
          institutionId: student.institutionId || undefined,
          newValues: {
            reportId: updated.id,
            reportMonth: reportDto.reportMonth,
            reportYear: reportDto.reportYear,
            previousReportFileUrl: existingReport.reportFileUrl,
            reportFileUrl: reportDto.reportFileUrl,
          },
        })
        .catch(() => {});

      await this.cache.invalidateByTags(["reports", `student:${student.id}`]);
      return updated;
    }

    // Calculate submission window and period dates
    const nextMonth =
      reportDto.reportMonth === 12 ? 1 : reportDto.reportMonth + 1;
    const nextYear =
      reportDto.reportMonth === 12
        ? reportDto.reportYear + 1
        : reportDto.reportYear;
    const submissionWindowStart = new Date(nextYear, nextMonth - 1, 1);
    const submissionWindowEnd = new Date(
      nextYear,
      nextMonth - 1,
      10,
      23,
      59,
      59
    );
    const periodStartDate = new Date(
      reportDto.reportYear,
      reportDto.reportMonth - 1,
      1
    );
    const periodEndDate = new Date(
      reportDto.reportYear,
      reportDto.reportMonth,
      0,
      23,
      59,
      59
    );

    // Create new DRAFT report with file
    let report;

    await this.deleteSoftDeletedMonthlyReportConflicts({
      applicationId: reportDto.applicationId,
      reportMonth: reportDto.reportMonth,
      reportYear: reportDto.reportYear,
    });

    try {
      report = await this.prisma.monthlyReport.create({
        data: {
          applicationId: reportDto.applicationId,
          studentId: student.id,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          reportFileUrl: reportDto.reportFileUrl,
          monthName: MONTH_NAMES[reportDto.reportMonth - 1],
          status: MonthlyReportStatus.DRAFT,
          submissionWindowStart,
          submissionWindowEnd,
          dueDate: submissionWindowEnd,
          periodStartDate,
          periodEndDate,
        },
      });
    } catch (error) {
      if (!this.isMonthlyReportUniqueConstraintError(error)) {
        throw error;
      }

      await this.deleteSoftDeletedMonthlyReportConflicts({
        applicationId: reportDto.applicationId,
        reportMonth: reportDto.reportMonth,
        reportYear: reportDto.reportYear,
      });

      const conflictingReport = await this.prisma.monthlyReport.findFirst({
        where: {
          applicationId: reportDto.applicationId,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          isDeleted: false,
        },
      });

      if (!conflictingReport) {
        report = await this.prisma.monthlyReport.create({
          data: {
            applicationId: reportDto.applicationId,
            studentId: student.id,
            reportMonth: reportDto.reportMonth,
            reportYear: reportDto.reportYear,
            reportFileUrl: reportDto.reportFileUrl,
            monthName: MONTH_NAMES[reportDto.reportMonth - 1],
            status: MonthlyReportStatus.DRAFT,
            submissionWindowStart,
            submissionWindowEnd,
            dueDate: submissionWindowEnd,
            periodStartDate,
            periodEndDate,
          },
        });
      } else if (conflictingReport.status === MonthlyReportStatus.APPROVED) {
        throw new BadRequestException("Approved reports cannot be modified");
      } else {
        report = await this.prisma.monthlyReport.update({
          where: { id: conflictingReport.id },
          data: { reportFileUrl: reportDto.reportFileUrl },
        });
      }
    }

    // Audit report file upload (create draft)
    this.auditService
      .log({
        action: AuditAction.MONTHLY_REPORT_UPDATE,
        entityType: "MonthlyReport",
        entityId: report.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role || Role.STUDENT,
        description: `Report file uploaded (draft) for ${MONTH_NAMES[reportDto.reportMonth - 1]} ${reportDto.reportYear}`,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: {
          reportId: report.id,
          reportMonth: reportDto.reportMonth,
          reportYear: reportDto.reportYear,
          reportFileUrl: reportDto.reportFileUrl,
          status: MonthlyReportStatus.DRAFT,
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags(["reports", `student:${student.id}`]);
    return report;
  }

  /**
   * Get faculty visits with status for an application
   */
  async getFacultyVisitsWithStatus(applicationId: string) {
    return this.facultyVisitService.getMonthlyVisitStatus(applicationId);
  }

  // REMOVED: generateExpectedVisits function - was a wrapper for legacy FacultyVisitService.generateExpectedVisits
  // Expected counts are now calculated via ExpectedCycleService using getTotalExpectedCount()
  // and stored in InternshipApplication.totalExpectedVisits and completedVisitsCount

  /**
   * Get all companies for dropdown selection
   * Returns company name and address for auto-fill
   */
  async getCompanies(params: { search?: string; limit?: number }) {
    const { search, limit = 100 } = params;

    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { alias: { has: search } },
      ];
    }

    const companies = await this.prisma.company.findMany({
      where,
      select: {
        name: true,
        address: true,
        contact: true,
        email: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return {
      companies,
      total: companies.length,
    };
  }

  /**
   * Get the assigned mentor for the student
   */
  async getMyMentor(userId: string) {
    console.log("[StudentService.getMyMentor] userId:", userId);

    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    console.log("[StudentService.getMyMentor] studentId:", student.id);

    // Find active mentor assignment
    const assignment = await this.prisma.mentorAssignment.findFirst({
      where: {
        studentId: student.id,
        isActive: true,
      },
      include: {
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
      orderBy: { assignmentDate: "desc" },
    });

    console.log("[StudentService.getMyMentor] assignment found:", !!assignment);
    console.log(
      "[StudentService.getMyMentor] mentor:",
      assignment?.mentor
        ? { id: assignment.mentor.id, name: assignment.mentor.name }
        : null
    );

    return {
      data: {
        mentor: assignment?.mentor || null,
        assignmentId: assignment?.id || null,
        assignmentDate: assignment?.assignmentDate || null,
      },
    };
  }

  // =============================================
  // STUDENT PLACEMENT INTEREST METHODS
  // =============================================

  /**
   * Get student's placement interest (returns null if not filled)
   */
  async getPlacementInterest(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const placementInterest = await this.prisma.studentPlacementInterest.findUnique({
      where: { studentId: student.id },
    });

    return {
      data: placementInterest,
      isFilled: !!placementInterest,
    };
  }

  /**
   * Check if student has filled placement interest form
   */
  async hasFilledPlacementInterest(userId: string): Promise<boolean> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const placementInterest = await this.prisma.studentPlacementInterest.findUnique({
      where: { studentId: student.id },
      select: { id: true },
    });

    return !!placementInterest;
  }

  /**
   * Submit placement interest form
   */
  async submitPlacementInterest(
    userId: string,
    data: {
      planAfterDiploma: PlanAfterDiploma;
      interestedForPrivateJob?: JobLocationPreference;
      expectedSalary?: ExpectedSalaryRange;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Check if already submitted
    const existing = await this.prisma.studentPlacementInterest.findUnique({
      where: { studentId: student.id },
    });

    if (existing) {
      throw new BadRequestException(
        "Placement interest form has already been submitted. Use update instead."
      );
    }

    // Validate: If plan is PRIVATE_JOB, job location and salary should be provided
    if (data.planAfterDiploma === PlanAfterDiploma.PRIVATE_JOB) {
      if (!data.interestedForPrivateJob) {
        throw new BadRequestException(
          "Job location preference is required for private job option"
        );
      }
      if (!data.expectedSalary) {
        throw new BadRequestException(
          "Expected salary range is required for private job option"
        );
      }
    } else {
      // Clear job-specific fields if plan is not PRIVATE_JOB
      data.interestedForPrivateJob = undefined;
      data.expectedSalary = undefined;
    }

    const placementInterest = await this.prisma.studentPlacementInterest.create({
      data: {
        studentId: student.id,
        planAfterDiploma: data.planAfterDiploma,
        interestedForPrivateJob: data.interestedForPrivateJob,
        expectedSalary: data.expectedSalary,
      },
    });

    // Audit placement interest submission
    this.auditService
      .log({
        action: AuditAction.STUDENT_PROFILE_UPDATE,
        entityType: "StudentPlacementInterest",
        entityId: placementInterest.id,
        userId,
        userName: student.user?.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Placement interest form submitted: ${data.planAfterDiploma}`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        newValues: {
          planAfterDiploma: data.planAfterDiploma,
          interestedForPrivateJob: data.interestedForPrivateJob,
          expectedSalary: data.expectedSalary,
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags([
      "student",
      `student:${student.id}`,
      `student:dashboard:${student.id}`,
    ]);

    return {
      success: true,
      message: "Placement interest form submitted successfully",
      data: placementInterest,
    };
  }

  /**
   * Update placement interest form
   */
  async updatePlacementInterest(
    userId: string,
    data: {
      planAfterDiploma?: PlanAfterDiploma;
      interestedForPrivateJob?: JobLocationPreference;
      expectedSalary?: ExpectedSalaryRange;
    }
  ) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    // Check if exists
    const existing = await this.prisma.studentPlacementInterest.findUnique({
      where: { studentId: student.id },
    });

    if (!existing) {
      throw new NotFoundException(
        "Placement interest form not found. Please submit first."
      );
    }

    const oldValues = {
      planAfterDiploma: existing.planAfterDiploma,
      interestedForPrivateJob: existing.interestedForPrivateJob,
      expectedSalary: existing.expectedSalary,
    };

    // Determine final plan
    const finalPlan = data.planAfterDiploma || existing.planAfterDiploma;

    // Build update data
    const updateData: any = {};

    if (data.planAfterDiploma !== undefined) {
      updateData.planAfterDiploma = data.planAfterDiploma;
    }

    // Handle job-specific fields based on plan
    if (finalPlan === PlanAfterDiploma.PRIVATE_JOB) {
      if (data.interestedForPrivateJob !== undefined) {
        updateData.interestedForPrivateJob = data.interestedForPrivateJob;
      }
      if (data.expectedSalary !== undefined) {
        updateData.expectedSalary = data.expectedSalary;
      }
    } else {
      // Clear job-specific fields if plan is not PRIVATE_JOB
      updateData.interestedForPrivateJob = null;
      updateData.expectedSalary = null;
    }

    const updated = await this.prisma.studentPlacementInterest.update({
      where: { studentId: student.id },
      data: updateData,
    });

    // Audit placement interest update
    this.auditService
      .log({
        action: AuditAction.STUDENT_PROFILE_UPDATE,
        entityType: "StudentPlacementInterest",
        entityId: updated.id,
        userId,
        userName: student.user?.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Placement interest form updated`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        institutionId: student.institutionId || undefined,
        oldValues,
        newValues: updateData,
      })
      .catch(() => {});

    await this.cache.invalidateByTags([
      "student",
      `student:${student.id}`,
      `student:dashboard:${student.id}`,
    ]);

    return {
      success: true,
      message: "Placement interest form updated successfully",
      data: updated,
    };
  }

  // =============================================
  // PRE-PLACEMENT OFFER (PPO) METHODS
  // =============================================

  /**
   * Get PPO status for a student
   */
  async getPPOStatus(userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId },
      select: {
        id: true,
        prePlacementOfferReceived: true,
        prePlacementOfferMarkedAt: true,
        prePlacementOfferCompany: true,
      },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    return {
      hasMarked: student.prePlacementOfferReceived !== null,
      received: student.prePlacementOfferReceived,
      companyName: student.prePlacementOfferCompany,
      markedAt: student.prePlacementOfferMarkedAt,
    };
  }

  /**
   * Submit or update PPO status
   */
  async submitPPOStatus(userId: string, dto: { received: boolean; companyName?: string }) {
    const student = await this.prisma.student.findFirst({
      where: { userId },
      include: { user: { select: { name: true, role: true } } },
    });

    if (!student) {
      throw new NotFoundException("Student not found");
    }

    const oldValues = {
      prePlacementOfferReceived: student.prePlacementOfferReceived,
      prePlacementOfferCompany: student.prePlacementOfferCompany,
    };

    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: {
        prePlacementOfferReceived: dto.received,
        prePlacementOfferCompany: dto.received ? dto.companyName || null : null,
        prePlacementOfferMarkedAt: new Date(),
      },
      select: {
        id: true,
        prePlacementOfferReceived: true,
        prePlacementOfferMarkedAt: true,
        prePlacementOfferCompany: true,
      },
    });

    // Audit PPO submission
    this.auditService
      .log({
        action: AuditAction.STUDENT_PROFILE_UPDATE,
        entityType: "Student",
        entityId: student.id,
        userId,
        userName: student.user?.name,
        userRole: student.user?.role || Role.STUDENT,
        description: `Pre-placement offer status updated: ${dto.received ? 'Received' : 'Not received'}${dto.received && dto.companyName ? ` from ${dto.companyName}` : ''}`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.institutionId || undefined,
        oldValues,
        newValues: {
          prePlacementOfferReceived: dto.received,
          prePlacementOfferCompany: dto.received ? dto.companyName : null,
        },
      })
      .catch(() => {});

    await this.cache.invalidateByTags([
      "student",
      `student:${student.id}`,
      `student:dashboard:${student.id}`,
    ]);

    return {
      success: true,
      message: dto.received
        ? "Congratulations! PPO status recorded successfully"
        : "PPO status recorded successfully",
      data: {
        hasMarked: true,
        received: updated.prePlacementOfferReceived,
        companyName: updated.prePlacementOfferCompany,
        markedAt: updated.prePlacementOfferMarkedAt,
      },
    };
  }
}
