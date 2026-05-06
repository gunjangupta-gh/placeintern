import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import {
  InternshipStatus,
  MonthlyReportStatus,
  Role,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../../core/database/prisma.service";
import { ReportType } from "./interfaces/report.interface";
import { getMonthCycle } from "../../../common/utils/monthly-cycle.util";

/**
 * Pagination options for report generation
 * Prevents memory overflow on large datasets
 */
export interface ReportPaginationOptions {
  take?: number; // Number of records to fetch (default: 10000)
  skip?: number; // Number of records to skip (default: 0)
}

/** Default maximum records to prevent memory overflow */
const DEFAULT_MAX_RECORDS = 10000;
/** Warning threshold for large result sets */
const WARNING_THRESHOLD = 5000;

/**
 * Reports that require institution isolation for non-admin users
 * Admin users (STATE_DIRECTORATE, SYSTEM_ADMIN) can view all institutions
 * Non-admin users MUST have institutionId to prevent cross-tenant data leakage
 */
const INSTITUTION_REQUIRED_REPORTS = [
  "internship",
  "faculty",
  "mentor",
  "monthly",
  "placement",
  "compliance",
  "pending",
  "training",
];

/**
 * Reports that allow viewing all institutions for admin users
 * When institutionId is not provided, returns data from all institutions
 */
const INSTITUTION_OPTIONAL_REPORTS = ["student", "industry"];

/**
 * Reports that can be run without institution filter (admin-only)
 */
const ADMIN_ONLY_REPORTS = ["institution_performance", "system"];

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);
  private readonly monthMatrix = [
    { month: 1, key: "jan" },
    { month: 2, key: "feb" },
    { month: 3, key: "mar" },
    { month: 4, key: "apr" },
    { month: 5, key: "may" },
    { month: 6, key: "jun" },
    { month: 7, key: "jul" },
    { month: 8, key: "aug" },
    { month: 9, key: "sep" },
    { month: 10, key: "oct" },
    { month: 11, key: "nov" },
    { month: 12, key: "dec" },
  ] as const;

  constructor(private prisma: PrismaService) {}

  /**
   * Format a date to Indian Standard Time (IST, UTC+5:30)
   * Returns formatted string in 'DD/MM/YYYY HH:mm:ss IST' format
   * Returns empty string for null/undefined/invalid input
   */
  private formatToIST(date: any): string {
    try {
      if (date === null || date === undefined || date === "") return "";

      // Convert to Date object
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === "string" || typeof date === "number") {
        dateObj = new Date(date);
      } else {
        return "";
      }

      // Check if date is valid
      const timestamp = dateObj.getTime();
      if (isNaN(timestamp) || !isFinite(timestamp)) return "";

      // IST is UTC+5:30
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const istDate = new Date(timestamp + istOffset);

      const day = String(istDate.getUTCDate()).padStart(2, "0");
      const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
      const year = istDate.getUTCFullYear();
      const hours = String(istDate.getUTCHours()).padStart(2, "0");
      const minutes = String(istDate.getUTCMinutes()).padStart(2, "0");
      const seconds = String(istDate.getUTCSeconds()).padStart(2, "0");

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} IST`;
    } catch (error) {
      return "";
    }
  }

  /**
   * Format a date to Indian Standard Time (IST) - date only format
   * Returns formatted string in 'DD/MM/YYYY' format
   * Returns empty string for null/undefined/invalid input
   */
  private formatToISTDateOnly(date: any): string {
    try {
      if (date === null || date === undefined || date === "") return "";

      // Convert to Date object
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === "string" || typeof date === "number") {
        dateObj = new Date(date);
      } else {
        return "";
      }

      // Check if date is valid
      const timestamp = dateObj.getTime();
      if (isNaN(timestamp) || !isFinite(timestamp)) return "";

      // IST is UTC+5:30
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(timestamp + istOffset);

      const day = String(istDate.getUTCDate()).padStart(2, "0");
      const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
      const year = istDate.getUTCFullYear();

      return `${day}/${month}/${year}`;
    } catch (error) {
      return "";
    }
  }

  /**
   * Format month/year pair as readable report month label (e.g. "March 2026")
   */
  private formatReportMonth(month: number, year: number): string {
    const monthNames = [
      "",
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
    const safeMonth = Number(month);
    const safeYear = Number(year);
    if (!safeMonth || safeMonth < 1 || safeMonth > 12 || !safeYear) {
      return "";
    }
    return `${monthNames[safeMonth]} ${safeYear}`;
  }

  /**
   * Build report month label from a date value in local calendar month/year.
   */
  private formatReportMonthFromDate(
    date: Date | string | null | undefined,
  ): string {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return this.formatReportMonth(d.getMonth() + 1, d.getFullYear());
  }

  /**
   * Build Jan-Dec submission columns where eligible months are 0/1 and
   * non-eligible months are null (blank in exports).
   */
  private buildMonthSubmissionColumns(
    submittedMonths: Set<number>,
    eligibleMonths: Set<number>,
  ): Record<string, number | null> {
    return this.monthMatrix.reduce(
      (acc, { month, key }) => {
        acc[key] = eligibleMonths.has(month)
          ? submittedMonths.has(month)
            ? 1
            : 0
          : null;
        return acc;
      },
      {} as Record<string, number | null>,
    );
  }

  /**
   * Determine which months in the provided year are expected based on internship period.
   */
  private getExpectedMonthsForYear(
    startDate: Date | string | null | undefined,
    endDate: Date | string | null | undefined,
    year: number,
  ): Set<number> {
    const expectedMonths = new Set<number>();
    if (!startDate) return expectedMonths;

    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) return expectedMonths;

    const parsedEnd = endDate ? new Date(endDate) : null;
    const effectiveEnd =
      parsedEnd && !isNaN(parsedEnd.getTime())
        ? parsedEnd
        : new Date(year, 11, 31, 23, 59, 59, 999);

    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const rangeStart = parsedStart > yearStart ? parsedStart : yearStart;
    const rangeEnd = effectiveEnd < yearEnd ? effectiveEnd : yearEnd;

    if (rangeEnd < rangeStart) return expectedMonths;

    const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

    while (cursor <= lastMonth) {
      expectedMonths.add(cursor.getMonth() + 1);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return expectedMonths;
  }

  /**
   * Determine eligible months using the same monthly-cycle rule used by dashboard cards.
   * For reports, January is excluded.
   */
  private getEligibleMonthsForYearByCycle(
    startDate: Date | string | null | undefined,
    endDate: Date | string | null | undefined,
    year: number,
    mode: "report" | "visit",
  ): Set<number> {
    const eligibleMonths = new Set<number>();
    if (!startDate) return eligibleMonths;

    const parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) return eligibleMonths;

    // Dashboard logic uses a 6-month forward fallback for open-ended internships.
    const fallbackEnd = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const parsedEnd = endDate ? new Date(endDate) : fallbackEnd;
    const effectiveEnd = isNaN(parsedEnd.getTime()) ? fallbackEnd : parsedEnd;

    for (let month = 1; month <= 12; month++) {
      const cycle = getMonthCycle(year, month, parsedStart, effectiveEnd);
      if (!cycle) continue;
      if (mode === "report" && month === 1) continue;
      eligibleMonths.add(month);
    }

    return eligibleMonths;
  }

  /**
   * Parse common boolean-ish inputs coming from JSON bodies, query params, or forms.
   * Returns undefined when the value is "not provided".
   */
  private parseBooleanLike(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
      return Boolean(value);
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === "true" ||
        normalized === "1" ||
        normalized === "yes" ||
        normalized === "y"
      )
        return true;
      if (
        normalized === "false" ||
        normalized === "0" ||
        normalized === "no" ||
        normalized === "n"
      )
        return false;
    }
    return undefined;
  }

  /**
   * Normalize response values for export columns
   */
  private formatResponseValue(value: unknown): string | number | boolean {
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(", ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value as string | number | boolean;
  }

  /**
   * Build a stable question key for export columns
   */
  private buildQuestionKey(question: any, index: number): string {
    const questionId = question?.id ? String(question.id) : `q${index + 1}`;
    const questionText = question?.question ? String(question.question) : "";
    return questionText ? `${questionId}: ${questionText}` : questionId;
  }

  /**
   * Build user filter for training response reports
   */
  private buildTrainingUserWhere(filters: any): Record<string, unknown> {
    const userWhere: Record<string, unknown> = {};
    if (filters?.institutionId) {
      userWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      userWhere.branchId = filters.branchId;
    }
    return userWhere;
  }

  /**
   * Build training date range filter (applies to training start/end dates)
   */
  private buildTrainingDateWhere(filters: any): Record<string, unknown> {
    const trainingWhere: Record<string, unknown> = {};
    if (filters?.startDate) {
      const startDate = new Date(filters.startDate);
      trainingWhere.startDate = {
        gte: new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        ),
      };
    }
    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      trainingWhere.endDate = {
        lte: new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        ),
      };
    }
    return trainingWhere;
  }

  /**
   * Get pagination parameters with defaults
   * Enforces maximum record limit to prevent memory overflow
   */
  private getPaginationParams(pagination?: ReportPaginationOptions): {
    take: number;
    skip: number;
  } {
    const take = Math.min(
      pagination?.take ?? DEFAULT_MAX_RECORDS,
      DEFAULT_MAX_RECORDS,
    );
    const skip = pagination?.skip ?? 0;
    return { take, skip };
  }

  /**
   * Log warning if result set exceeds threshold
   */
  private warnOnLargeResultSet(resultCount: number, reportType: string): void {
    if (resultCount >= WARNING_THRESHOLD) {
      this.logger.warn(
        `Large result set: ${reportType} returned ${resultCount} records. ` +
          `Consider using pagination (skip/take) for better performance.`,
      );
    }
  }

  /**
   * Validate institution isolation for reports
   * Throws ForbiddenException if institutionId is required but not provided
   * Admin users can bypass institution requirement for optional reports
   */
  private validateInstitutionIsolation(
    reportType: string,
    filters: any,
    isAdmin: boolean = false,
  ): void {
    const typeStr = reportType.toLowerCase();

    // Check if this report type strictly requires institution isolation
    const requiresInstitution = INSTITUTION_REQUIRED_REPORTS.some((r) =>
      typeStr.includes(r),
    );

    // Check if this report type allows optional institution for admins
    const isOptionalReport = INSTITUTION_OPTIONAL_REPORTS.some((r) =>
      typeStr.includes(r),
    );

    // For optional reports, admins can view all institutions
    if (isOptionalReport && isAdmin) {
      if (!filters?.institutionId) {
        this.logger.log(`Admin generating ${reportType} for all institutions`);
      }
      return; // Allow admin to proceed without institutionId
    }

    // For required reports or non-admin users on optional reports
    if (
      (requiresInstitution || isOptionalReport) &&
      !filters?.institutionId &&
      !isAdmin
    ) {
      this.logger.warn(
        `Report generation blocked: ${reportType} requires institutionId for non-admin users`,
      );
      throw new ForbiddenException(
        "Institution ID is required for this report type",
      );
    }
  }

  /**
   * Generate Student Progress Report (Student Directory)
   * Returns complete student information including institution, mentor, and internship status
   * @param filters - Filter criteria for the report (validated by StudentDirectoryFilterDto)
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentProgressReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Institution filter - REQUIRED for non-admin users (enforced by validateInstitutionIsolation)
    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Branch filter - uses Branch model (not Department)
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    } else if (filters?.departmentId) {
      // Backward compatibility: departmentId maps to branchId
      where.branchId = filters.departmentId;
    }

    // Year filter - support multiple filter names for flexibility
    if (filters?.year !== undefined && filters?.year !== null) {
      where.currentYear = Number(filters.year);
    } else if (
      filters?.currentYear !== undefined &&
      filters?.currentYear !== null
    ) {
      where.currentYear = Number(filters.currentYear);
    } else if (filters?.academicYear) {
      // For academicYear like "2024-2025", extract first year
      const yearStr = String(filters.academicYear);
      const yearMatch = yearStr.match(/^(\d{4})/);
      if (yearMatch) {
        where.currentYear = Number(yearMatch[1]);
      }
    }

    // Semester filter
    if (filters?.semester !== undefined && filters?.semester !== null) {
      where.currentSemester = Number(filters.semester);
    } else if (
      filters?.currentSemester !== undefined &&
      filters?.currentSemester !== null
    ) {
      where.currentSemester = Number(filters.currentSemester);
    }

    // IMPORTANT: isActive filter - properly handle boolean-ish values
    // Default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
      this.logger.debug(
        `Student directory filter: isActive=${isActiveValue} (raw: ${String(filters?.isActive)})`,
      );
    } else {
      // By default, only show active students with active user accounts
      where.user = { active: true };
    }

    // Mentor filter - filter students assigned to specific mentor
    let mentorFilter: string | undefined;
    if (filters?.mentorId) {
      mentorFilter = filters.mentorId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            active: true,
            rollNumber: true,
            branchName: true,
          },
        },
        branch: { select: { id: true, name: true } },
        Institution: { select: { id: true, name: true, shortName: true } },
        // Get internship applications with mentor and status info
        internshipApplications: {
          select: {
            id: true,
            status: true,
            internshipPhase: true,
            companyName: true,
            jobProfile: true,
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1, // Get most recent application
        },
        // Get mentor assignments
        mentorAssignments: {
          where: { isActive: true },
          select: {
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { assignmentDate: "desc" },
          take: 1, // Get current mentor
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(students.length, "StudentProgressReport");

    // Apply mentor filter if specified (post-query filter for complex relation)
    let filteredStudents = students;
    if (mentorFilter) {
      filteredStudents = students.filter((student) => {
        const applicationMentor = student.internshipApplications[0]?.mentor?.id;
        const assignedMentor = student.mentorAssignments[0]?.mentor?.id;
        return (
          applicationMentor === mentorFilter || assignedMentor === mentorFilter
        );
      });
    }

    return filteredStudents.map((student) => {
      // Determine mentor name from assignment or application
      const mentorName =
        student.mentorAssignments[0]?.mentor?.name ??
        student.internshipApplications[0]?.mentor?.name ??
        "Not Assigned";

      // Determine internship status
      const latestApplication = student.internshipApplications[0];
      let internshipStatus = "Not Started";
      if (latestApplication) {
        switch (latestApplication.status) {
          case "COMPLETED":
            internshipStatus = "Completed";
            break;
          case "JOINED":
          case "APPROVED":
          case "SELECTED":
            internshipStatus = "In Progress";
            break;
          case "APPLIED":
          case "UNDER_REVIEW":
          case "SHORTLISTED":
            internshipStatus = "Applied";
            break;
          case "REJECTED":
          case "WITHDRAWN":
            internshipStatus = "Not Active";
            break;
          default:
            internshipStatus = latestApplication.status ?? "Unknown";
        }
      }

      return {
        // Core student info
        rollNumber: student.user.rollNumber,
        name: student.user.name,
        gender: student.gender ?? "N/A",
        email: student.user.email ?? "",
        phoneNumber: student.user.phoneNo ?? "",

        // Academic info
        branchName: student.branch?.name ?? student.user.branchName ?? "",
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,

        // Institution info
        institutionName: student.Institution?.name ?? "",
        institutionShortName: student.Institution?.shortName ?? "",

        // Mentor info
        mentorName,

        // Internship info
        internshipStatus,
        internshipsCount: student.internshipApplications.length,

        // Placement info
        placementsCount: 0,
        isPlaced: false,

        // Status info
        clearanceStatus: student.clearanceStatus,
        isActive: student.user?.active ?? false,
        studentActive: student.user?.active ?? false,
        userActive: student.user?.active ?? false,

        // Timestamps (formatted in IST)
        createdAt: this.formatToIST(student.createdAt),
      };
    });
  }

  /**
   * Generate Student Placement Interest + PPO Report
   * Includes all placement interest fields plus student/user/institution and PPO details
   */
  async generateStudentPlacementInterestPpoReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: any = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.planAfterDiploma) {
      where.planAfterDiploma = filters.planAfterDiploma;
    }

    if (filters?.expectedSalary) {
      where.expectedSalary = filters.expectedSalary;
    }

    if (filters?.interestedForPrivateJob) {
      where.interestedForPrivateJob = filters.interestedForPrivateJob;
    }

    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
      }
      where.submittedAt = dateFilter;
    }

    const studentWhere: any = {};
    if (filters?.institutionId) {
      studentWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }

    const prePlacementOfferReceived = this.parseBooleanLike(
      filters?.prePlacementOfferReceived,
    );
    if (prePlacementOfferReceived !== undefined) {
      studentWhere.prePlacementOfferReceived = prePlacementOfferReceived;
    }

    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentWhere.user = { active: isActiveValue };
    } else {
      studentWhere.user = { active: true };
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    const interests = await this.prisma.studentPlacementInterest.findMany({
      where,
      include: {
        student: {
          select: {
            prePlacementOfferReceived: true,
            prePlacementOfferMarkedAt: true,
            prePlacementOfferCompany: true,
            branch: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                name: true,
                rollNumber: true,
                active: true,
              },
            },
            Institution: {
              select: {
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { submittedAt: "desc" },
    });

    this.warnOnLargeResultSet(
      interests.length,
      "StudentPlacementInterestPpoReport",
    );

    return interests.map((interest) => ({
      studentName: interest.student?.user?.name ?? "N/A",
      rollNumber: interest.student?.user?.rollNumber ?? "N/A",
      institutionName: interest.student?.Institution?.name ?? "N/A",
      institutionShortName: interest.student?.Institution?.shortName ?? "N/A",
      branchName: interest.student?.branch?.name ?? "N/A",

      planAfterDiploma: interest.planAfterDiploma ?? "N/A",
      interestedForPrivateJob: interest.interestedForPrivateJob ?? "N/A",
      expectedSalary: interest.expectedSalary ?? "N/A",

      prePlacementOfferReceived:
        interest.student?.prePlacementOfferReceived ?? false,
      prePlacementOfferCompany:
        interest.student?.prePlacementOfferCompany ?? "N/A",
      prePlacementOfferMarkedAt: interest.student?.prePlacementOfferMarkedAt
        ? this.formatToIST(interest.student.prePlacementOfferMarkedAt)
        : "N/A",

      interestSubmittedAt: interest.submittedAt
        ? this.formatToIST(interest.submittedAt)
        : "N/A",
      interestUpdatedAt: interest.updatedAt
        ? this.formatToIST(interest.updatedAt)
        : "N/A",

      isActive: interest.student?.user?.active ?? false,
      userActive: interest.student?.user?.active ?? false,
    }));
  }

  /**
   * Generate Internship Report
   * Supports filtering by isSelfIdentified, mentorId, status, date range, and verificationStatus
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateInternshipReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active applications only
    where.isActive = true;

    // Handle isSelfIdentified filter - default to showing all if not specified
    const isSelfIdentified = this.parseBooleanLike(filters?.isSelfIdentified);
    if (isSelfIdentified !== undefined) {
      where.isSelfIdentified = isSelfIdentified;
    }

    // Handle institution filter with proper nesting for student relation
    const studentWhere: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }
    // Handle institution name filter (text search)
    if (filters?.institutionName) {
      studentWhere.institution = {
        name: { contains: filters.institutionName, mode: "insensitive" },
      };
    }

    // Default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentWhere.user = { active: isActiveValue };
    } else {
      studentWhere.user = { active: true };
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    // Handle status filter
    if (filters?.status) {
      where.status = filters.status;
    }

    // Handle mentor filter
    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    // Handle verification status filter
    if (filters?.verificationStatus) {
      where.verificationStatus = filters.verificationStatus;
    }

    // Handle date range filter (startDate and endDate from transformed dateRange)
    // Use createdAt for filtering since appliedDate/applicationDate default to migration timestamp
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        // Parse date and create UTC start of day
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
      }
      if (filters.endDate) {
        // Parse date and create UTC end of day
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
      }
      // Apply to createdAt (which has actual application date from migrated data)
      where.createdAt = dateFilter;
    }

    // Handle internship start date range filter (for self-identified internships)
    // This filters by the actual internship start date, not the application date
    // Note: Frontend sends startDateRange: [start, end], processor transforms to startDateStart/startDateEnd
    this.logger.log(
      `[InternshipReport] Checking startDate filters - startDateStart: ${filters?.startDateStart}, startDateEnd: ${filters?.startDateEnd}, startDateRange: ${JSON.stringify(filters?.startDateRange)}`,
    );

    // Also check for startDateRange array format (in case transformation didn't happen)
    let startDateStartValue = filters?.startDateStart;
    let startDateEndValue = filters?.startDateEnd;

    // Handle case where startDateRange array is passed directly
    if (
      !startDateStartValue &&
      !startDateEndValue &&
      Array.isArray(filters?.startDateRange) &&
      filters.startDateRange.length === 2
    ) {
      this.logger.log(
        `[InternshipReport] Found startDateRange array, transforming inline`,
      );
      startDateStartValue = filters.startDateRange[0];
      startDateEndValue = filters.startDateRange[1];
    }

    if (startDateStartValue || startDateEndValue) {
      const startDateFilter: Record<string, unknown> = {};
      if (startDateStartValue) {
        // Parse ISO date string and use it directly (dates are stored in UTC)
        startDateFilter.gte = new Date(startDateStartValue);
        this.logger.log(
          `[InternshipReport] Applied startDate >= ${startDateFilter.gte}`,
        );
      }
      if (startDateEndValue) {
        // Parse ISO date string and set to end of day in UTC
        const endDate = new Date(startDateEndValue);
        // Set to end of the day (23:59:59.999)
        endDate.setUTCHours(23, 59, 59, 999);
        startDateFilter.lte = endDate;
        this.logger.log(
          `[InternshipReport] Applied startDate <= ${startDateFilter.lte}`,
        );
      }
      // Apply to startDate field (internship start date)
      where.startDate = startDateFilter;
      this.logger.log(
        `[InternshipReport] Final startDate filter applied to where clause`,
      );
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            gender: true,
            Institution: { select: { id: true, name: true, code: true } },
            branch: { select: { id: true, name: true } },
            user: {
              select: {
                name: true,
                rollNumber: true,
                branchName: true,
                active: true,
                phoneNo: true,
                email: true,
              },
            },
            mentorAssignments: {
              where: { isActive: true },
              include: {
                mentor: { select: { name: true, email: true, phoneNo: true } },
              },
              take: 1,
            },
          },
        },
        mentor: {
          select: { id: true, name: true, email: true, phoneNo: true },
        },
        _count: { select: { monthlyReports: true } },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(applications.length, "InternshipReport");

    return applications.map((application) => {
      // Parse city from companyAddress (e.g., "123 Street, City, State" -> "City")
      let companyCity = "";
      if (application.companyAddress) {
        const addressParts = application.companyAddress
          .split(",")
          .map((part) => part.trim());
        // Assume city is the second-to-last part or second part
        if (addressParts.length >= 2) {
          companyCity = addressParts[1] || "";
        }
      }

      // Get mentor name from application's direct mentor or from student's mentor assignment
      const mentorName =
        application.mentor?.name ??
        application.student.mentorAssignments?.[0]?.mentor?.name ??
        "N/A";

      // Determine internship status (same logic as student directory report)
      let internshipStatus = "Not Started";
      switch (application.status) {
        case "COMPLETED":
          internshipStatus = "Completed";
          break;
        case "JOINED":
        case "APPROVED":
        case "SELECTED":
          internshipStatus = "In Progress";
          break;
        case "APPLIED":
        case "UNDER_REVIEW":
        case "SHORTLISTED":
          internshipStatus = "Applied";
          break;
        case "REJECTED":
        case "WITHDRAWN":
          internshipStatus = "Not Active";
          break;
        default:
          internshipStatus = application.status ?? "Unknown";
      }

      // Calculate application fill rate for self-identified internships
      // Required fields: companyName, companyAddress, companyContact, hrName, hrContact, jobProfile, startDate, endDate, stipend
      const requiredFields = [
        application.companyName,
        application.companyAddress,
        application.companyContact,
        application.hrName,
        application.hrContact,
        application.jobProfile,
        application.startDate,
        application.endDate,
        application.stipend,
      ];
      const filledFieldsCount = requiredFields.filter(
        (field) => field !== null && field !== undefined && field !== "",
      ).length;
      const applicationFillRate = Math.round(
        (filledFieldsCount / requiredFields.length) * 100,
      );

      // Parse stipend (stored as String in DB) to number
      const stipendValue = application.stipend
        ? parseFloat(application.stipend)
        : 0;

      // Parse duration (stored as String in DB) - extract numeric value
      let durationValue = "N/A";
      if (application.internshipDuration) {
        // Try to extract number from string like "8 weeks" or "2 months" or just "8"
        const durationMatch = application.internshipDuration.match(/\d+/);
        durationValue = durationMatch
          ? durationMatch[0]
          : application.internshipDuration;
      }

      // Map internship phase to readable verification status
      let verificationStatus = "N/A";
      switch (application.internshipPhase) {
        case "NOT_STARTED":
          verificationStatus = "Pending";
          break;
        case "ACTIVE":
          verificationStatus = "Verified";
          break;
        case "COMPLETED":
          verificationStatus = "Completed";
          break;
        case "TERMINATED":
          verificationStatus = "Terminated";
          break;
        default:
          verificationStatus = application.internshipPhase ?? "N/A";
      }

      return {
        studentName: application.student.user?.name ?? "N/A",
        rollNumber: application.student.user?.rollNumber ?? "N/A",
        gender: application.student.gender ?? "N/A",
        phoneNumber: application.student.user?.phoneNo ?? "N/A",
        email: application.student.user?.email ?? "N/A",
        branchName:
          application.student.branch?.name ??
          application.student.user?.branchName ??
          "N/A",
        institutionName: application.student.Institution?.name ?? "N/A",
        institutionCode: application.student.Institution?.code ?? "N/A",
        companyName: application.companyName ?? "N/A",
        companyCity,
        companyAddress: application.companyAddress ?? "N/A",
        companyContact: application.companyContact ?? "N/A",
        companyEmail: application.companyEmail ?? "N/A",
        hrName: application.hrName ?? "N/A",
        hrDesignation: application.hrDesignation ?? "N/A",
        hrContact: application.hrContact ?? "N/A",
        hrEmail: application.hrEmail ?? "N/A",
        jobProfile: application.jobProfile ?? "N/A",
        stipend: stipendValue,
        // Use createdAt as the applied date since it's properly migrated from source data
        // (appliedDate and applicationDate both default to migration timestamp)
        appliedDate: application.createdAt
          ? this.formatToIST(application.createdAt)
          : "N/A",
        startDate: application.startDate
          ? this.formatToISTDateOnly(application.startDate)
          : "N/A",
        endDate: application.endDate
          ? this.formatToISTDateOnly(application.endDate)
          : "N/A",
        duration: durationValue,
        status: application.status ?? "N/A",
        internshipStatus,
        verificationStatus,
        mentorName,
        mentorEmail:
          application.mentor?.email ??
          application.student.mentorAssignments?.[0]?.mentor?.email ??
          "N/A",
        mentorPhone:
          application.mentor?.phoneNo ??
          application.student.mentorAssignments?.[0]?.mentor?.phoneNo ??
          "N/A",
        applicationFillRate,
        joiningLetterStatus: application.joiningLetterUrl
          ? "Submitted"
          : "Pending",
        reportsSubmitted: application._count.monthlyReports ?? 0,
        location: application.companyAddress ?? "N/A",
        isSelfIdentified: application.isSelfIdentified ?? false,
        isActive: application.student.user?.active ?? false,
        userActive: application.student.user?.active ?? true,
      };
    });
  }

  /**
   * Generate Faculty Visit Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateFacultyVisitReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isDeleted: false,
      status: "COMPLETED",
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Build student filter with active checks
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }

    // Default to active students only, unless explicitly filtering for inactive
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.user = { active: isActiveValue };
    } else {
      // By default, only show visits for active students with active accounts
      studentFilter.user = { active: true };
    }

    // Build faculty filter - default to active faculty
    const facultyFilter: Record<string, unknown> = {};
    const facultyActiveValue = this.parseBooleanLike(filters?.facultyActive);
    if (facultyActiveValue !== undefined) {
      facultyFilter.active = facultyActiveValue;
    } else {
      facultyFilter.active = true; // Default to active faculty
    }

    // Handle institution filter through application -> student relation
    if (Object.keys(studentFilter).length > 0) {
      where.application = { student: studentFilter };
    }

    // Apply faculty active filter
    where.faculty = facultyFilter;

    // Handle faculty/mentor filter
    if (filters?.facultyId || filters?.mentorId) {
      where.facultyId = filters.facultyId || filters.mentorId;
    }

    // Handle date range filter (from transformed dateRange or direct startDate/endDate)
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
      }
      where.visitDate = dateFilter;
    }

    // Support direct month/year filtering for report builders using month selectors.
    if (filters?.month || filters?.year) {
      const resolvedYear = filters?.year
        ? Number(filters.year)
        : new Date().getFullYear();
      const dateFilter: Record<string, unknown> = {};

      if (filters?.month) {
        const resolvedMonth = Number(filters.month);
        dateFilter.gte = new Date(
          resolvedYear,
          resolvedMonth - 1,
          1,
          0,
          0,
          0,
          0,
        );
        dateFilter.lte = new Date(
          resolvedYear,
          resolvedMonth,
          0,
          23,
          59,
          59,
          999,
        );
      } else {
        dateFilter.gte = new Date(resolvedYear, 0, 1, 0, 0, 0, 0);
        dateFilter.lte = new Date(resolvedYear, 11, 31, 23, 59, 59, 999);
      }

      where.visitDate = dateFilter;
    }

    // Handle visit type filter
    if (filters?.visitType) {
      where.visitType = filters.visitType;
    }

    // Handle follow-up required filter
    const followUpRequired = this.parseBooleanLike(filters?.followUpRequired);
    if (followUpRequired !== undefined) {
      where.followUpRequired = followUpRequired;
    }

    const visits = await this.prisma.facultyVisitLog.findMany({
      where,
      include: {
        faculty: {
          select: { id: true, name: true, designation: true, active: true },
        },
        application: {
          select: {
            id: true,
            companyName: true,
            student: {
              select: {
                id: true,
                user: {
                  select: { name: true, rollNumber: true, active: true },
                },
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { visitDate: "desc" },
    });

    this.warnOnLargeResultSet(visits.length, "FacultyVisitReport");

    return visits.map((visit) => ({
      facultyName: visit.faculty.name,
      facultyDesignation: visit.faculty.designation,
      facultyActive: visit.faculty.active,
      studentName: visit.application.student.user?.name,
      rollNumber: visit.application.student.user?.rollNumber,
      studentActive: visit.application.student.user?.active,
      companyName: visit.application.companyName,
      visitDate: this.formatToIST(visit.visitDate),
      reportMonth: this.formatReportMonthFromDate(visit.visitDate),
      visitType: visit.visitType,
      visitLocation: visit.visitLocation,
      followUpRequired: visit.followUpRequired,
      nextVisitDate: this.formatToISTDateOnly(visit.nextVisitDate),
      meetingMinutes: visit.meetingMinutes,
    }));
  }

  /**
   * Generate Monthly Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateMonthlyReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isDeleted: false,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    // Build student filter with active checks
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }

    // Default to active students only, unless explicitly filtering for inactive
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.user = { active: isActiveValue };
    } else {
      // By default, only show reports for active students with active accounts
      studentFilter.user = { active: true };
    }

    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    if (filters?.month) {
      where.reportMonth = Number(filters.month);
    }
    if (filters?.year) {
      where.reportYear = Number(filters.year);
    }

    const reports = await this.prisma.monthlyReport.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            user: { select: { name: true, rollNumber: true, active: true } },
          },
        },
        application: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
      take,
      skip,
      orderBy: [{ reportYear: "desc" }, { reportMonth: "desc" }],
    });

    this.warnOnLargeResultSet(reports.length, "MonthlyReport");

    return reports.map((report) => ({
      studentName: report.student.user?.name,
      rollNumber: report.student.user?.rollNumber,
      companyName: report.application.companyName ?? "",
      month: report.reportMonth,
      year: report.reportYear,
      reportMonth: this.formatReportMonth(
        report.reportMonth,
        report.reportYear,
      ),
      status: report.status,
      submittedAt: this.formatToIST(report.submittedAt),
      reportFileUrl: report.reportFileUrl,
      isActive: report.student.user?.active ?? false,
      userActive: report.student.user?.active ?? true,
    }));
  }

  /**
   * Generate Placement Report
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generatePlacementReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    // Placement feature removed from schema
    return [];
  }

  /**
   * Generate Institution Performance Report
   */
  async generateInstitutionPerformanceReport(filters: any): Promise<any[]> {
    const institutionId = filters.institutionId;

    if (!institutionId) {
      throw new Error("Institution ID is required");
    }

    const [
      totalStudents,
      totalFaculty,
      activeInternships,
      completedInternships,
      totalPlacements,
      totalApplications,
      branches,
      avgPlacementSalary,
    ] = await Promise.all([
      // Only count active students with active user accounts
      this.prisma.student.count({
        where: {
          institutionId,
          user: { active: true },
        },
      }),
      // Only count active faculty members
      this.prisma.user.count({
        where: {
          institutionId,
          role: { in: [Role.TEACHER] },
          active: true,
        },
      }),
      // Internship portal removed; derive from self-identified applications
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          isSelfIdentified: true,
          internshipPhase: "ACTIVE" as any,
          student: { institutionId, user: { active: true } },
        },
      }),
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          isSelfIdentified: true,
          internshipPhase: "COMPLETED" as any,
          student: { institutionId, user: { active: true } },
        },
      }),
      Promise.resolve(0),
      // Only count applications from active students with active applications
      this.prisma.internshipApplication.count({
        where: {
          isActive: true,
          student: { institutionId, user: { active: true } },
        },
      }),
      this.prisma.branch.findMany({
        where: { institutionId },
        include: {
          _count: {
            select: {
              students: {
                where: { user: { active: true } },
              },
            },
          },
        },
      }),
      Promise.resolve({ _avg: { salary: 0 } }),
    ]);

    return [
      {
        metric: "Total Students",
        value: totalStudents,
        category: "Students",
      },
      {
        metric: "Total Faculty",
        value: totalFaculty,
        category: "Faculty",
      },
      {
        metric: "Active Internships",
        value: activeInternships,
        category: "Internships",
      },
      {
        metric: "Completed Internships",
        value: completedInternships,
        category: "Internships",
      },
      {
        metric: "Total Applications",
        value: totalApplications,
        category: "Internships",
      },
      {
        metric: "Total Placements",
        value: totalPlacements,
        category: "Placements",
      },
      {
        metric: "Average Placement Salary",
        value: (avgPlacementSalary as any)._avg?.salary || 0,
        category: "Placements",
      },
      {
        metric: "Total Branches",
        value: branches.length,
        category: "Academic",
      },
      ...branches.map((branch) => ({
        metric: `${branch.name} - Students`,
        value: branch._count.students,
        category: "Branch",
      })),
    ];
  }

  /**
   * Generate Student Compliance Report
   * Tracks student compliance with reporting requirements
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentComplianceReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      // Only include active students with active user accounts by default
      user: { active: true },
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    // Handle explicit isActive filter override
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    }

    // Fetch students with their internship applications, mentor assignments and monthly reports
    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            rollNumber: true,
            branchName: true,
            active: true,
          },
        },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        internshipApplications: {
          where: {
            isActive: true, // Only active applications
          },
          include: {
            mentor: { select: { name: true, active: true } },
            monthlyReports: {
              select: { status: true, submittedAt: true },
              orderBy: { submittedAt: "desc" },
            },
          },
        },
        // Get mentor assignments - primary source for mentor info
        mentorAssignments: {
          where: { isActive: true },
          select: {
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { assignmentDate: "desc" },
          take: 1, // Get current mentor
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(students.length, "StudentComplianceReport");

    const results = students.map((student) => {
      const allApplications = student.internshipApplications;
      const hasInternship = allApplications.length > 0;

      // Filter to approved/selected applications for compliance tracking
      const activeApplications = allApplications.filter(
        (app) =>
          app.status === "APPROVED" ||
          app.status === "SELECTED" ||
          app.status === "JOINED",
      );

      const allReports = activeApplications.flatMap(
        (app) => app.monthlyReports,
      );
      const submittedReports = allReports.filter(
        (r) =>
          r.status === MonthlyReportStatus.APPROVED ||
          r.status === MonthlyReportStatus.SUBMITTED,
      );
      const pendingReports = allReports.filter(
        (r) =>
          r.status === MonthlyReportStatus.DRAFT ||
          r.status === MonthlyReportStatus.UNDER_REVIEW ||
          r.status === MonthlyReportStatus.REVISION_REQUIRED,
      );

      // Calculate expected reports (assume 1 per month of active internship)
      const expectedReports = Math.max(activeApplications.length * 3, 1); // At least 3 months expected
      const complianceScore =
        expectedReports > 0
          ? Math.round((submittedReports.length / expectedReports) * 100)
          : 0;

      const lastReport = allReports[0];

      // Get mentor name from mentorAssignments first, then fall back to application mentor
      const mentorName =
        student.mentorAssignments?.[0]?.mentor?.name ??
        activeApplications[0]?.mentor?.name ??
        allApplications[0]?.mentor?.name ??
        "Not Assigned";

      // Determine joining report status based on joiningLetterUrl
      let joiningReportStatus = "No Internship";
      if (hasInternship) {
        const hasJoiningLetter = activeApplications.some(
          (app) => app.joiningLetterUrl,
        );
        if (hasJoiningLetter) {
          joiningReportStatus = "Submitted";
        } else if (activeApplications.length > 0) {
          joiningReportStatus = "Pending";
        } else {
          joiningReportStatus = "Not Started";
        }
      }

      // Determine compliance level
      let complianceLevel = "low";
      if (complianceScore >= 80) complianceLevel = "high";
      else if (complianceScore >= 50) complianceLevel = "medium";

      return {
        rollNumber: student.user?.rollNumber,
        name: student.user?.name,
        gender: student.gender ?? "N/A",
        branchName: student.branch?.name ?? student.user?.branchName,
        institutionName: student.Institution?.name ?? "N/A",
        mentorName,
        hasInternship: hasInternship ? "Yes" : "No",
        joiningReportStatus,
        monthlyReportsSubmitted: submittedReports.length,
        monthlyReportsPending: pendingReports.length,
        lastReportDate: this.formatToIST(lastReport?.submittedAt ?? null),
        complianceScore,
        complianceLevel,
        isActive: student.user?.active ?? false,
        userActive: student.user?.active ?? true,
      };
    });

    return results;
  }

  /**
   * Generate Students Without Internship Report
   * Returns students who have not filled any internship application
   * Includes: Name, Roll Number, College Name, Mentor Name
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateStudentsWithoutInternshipReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Institution filter
    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Branch filter
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    // Year filter
    if (filters?.currentYear !== undefined && filters?.currentYear !== null) {
      where.currentYear = Number(filters.currentYear);
    }

    // Handle isActive filter - default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    } else {
      where.user = { active: true };
    }

    // Mentor filter (applied post-query)
    const mentorFilter = filters?.mentorId;

    // Find students who have NO internship applications at all
    const students = await this.prisma.student.findMany({
      where: {
        ...where,
        internshipApplications: {
          none: {},
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNo: true,
            active: true,
            rollNumber: true,
            branchName: true,
          },
        },
        branch: { select: { id: true, name: true } },
        Institution: { select: { id: true, name: true, shortName: true } },
        mentorAssignments: {
          where: { isActive: true },
          select: {
            mentor: { select: { id: true, name: true } },
          },
          orderBy: { assignmentDate: "desc" },
          take: 1,
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(
      students.length,
      "StudentsWithoutInternshipReport",
    );

    // Apply mentor filter if specified
    let filteredStudents = students;
    if (mentorFilter) {
      filteredStudents = students.filter((student) => {
        const assignedMentor = student.mentorAssignments[0]?.mentor?.id;
        return assignedMentor === mentorFilter;
      });
    }

    return filteredStudents.map((student) => {
      const mentorName =
        student.mentorAssignments[0]?.mentor?.name ?? "Not Assigned";

      return {
        rollNumber: student.user.rollNumber,
        name: student.user.name,
        email: student.user.email ?? "",
        phoneNumber: student.user.phoneNo ?? "",
        branchName: student.branch?.name ?? student.user.branchName ?? "",
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,
        institutionName: student.Institution?.name ?? "",
        mentorName,
        isActive: student.user?.active ?? false,
        createdAt: this.formatToIST(student.createdAt),
      };
    });
  }

  /**
   * Generate User Login Activity Report
   * Tracks user login activity, password changes, and first-time logins
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateUserLoginActivityReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    // Handle login status filter
    if (filters?.loginStatus === "logged_in") {
      where.loginCount = { gt: 0 };
    } else if (filters?.loginStatus === "never_logged_in") {
      where.loginCount = 0;
    }

    // Handle password status filter
    if (filters?.passwordStatus === "changed") {
      where.hasChangedDefaultPassword = true;
    } else if (filters?.passwordStatus === "default") {
      where.hasChangedDefaultPassword = false;
    }

    // Handle activity status filter
    if (filters?.activityStatus) {
      const now = new Date();
      switch (filters.activityStatus) {
        case "active_7":
          where.lastLoginAt = {
            gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          };
          break;
        case "active_30":
          where.lastLoginAt = {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          };
          break;
        case "inactive_30":
          where.OR = [
            {
              lastLoginAt: {
                lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
              },
            },
            { lastLoginAt: null },
          ];
          break;
        case "inactive_90":
          where.OR = [
            {
              lastLoginAt: {
                lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
              },
            },
            { lastLoginAt: null },
          ];
          break;
      }
    }

    // Handle account status filter - checks User.active
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      // For students, also check that Student record exists
      if (accountActive === true) {
        const activeAccountOr = [
          { role: { not: "STUDENT" } }, // Non-students just need User.active
          { role: "STUDENT", Student: { isNot: null } }, // Students need User.active AND Student record
        ];

        if (where.OR) {
          const existingOr = where.OR;
          delete where.OR;
          where.AND = [{ OR: existingOr }, { OR: activeAccountOr }];
        } else {
          where.OR = activeAccountOr;
        }
      }
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { id: true } }, // Include Student relation for accurate reporting
        mentorAssignments: {
          where: { isActive: true },
          select: { id: true },
          take: 1,
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(users.length, "UserLoginActivityReport");

    const now = new Date();

    return users.map((user) => {
      const daysSinceCreation = Math.floor(
        (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysSinceLastLogin = user.lastLoginAt
        ? Math.floor(
            (now.getTime() - user.lastLoginAt.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      let status = "Never Logged In";
      if (user.loginCount > 0) {
        if (daysSinceLastLogin !== null && daysSinceLastLogin <= 7) {
          status = "Active";
        } else if (daysSinceLastLogin !== null && daysSinceLastLogin <= 30) {
          status = "Recently Active";
        } else {
          status = "Inactive";
        }
      }

      // For students: check User.active AND Student record exists
      // For non-students: only check User.active
      const userActive = user.active;
      const studentActive =
        user.role === "STUDENT" ? ((user as any).Student ? true : false) : null;
      // isActive is true only when BOTH conditions are met (for students)
      const isActive =
        user.role === "STUDENT"
          ? userActive && studentActive === true
          : userActive;

      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        isMentor: user.mentorAssignments.length > 0 ? "Yes" : "No",
        institutionName: user.Institution?.name ?? "N/A",
        rollNumber: user.rollNumber,
        designation: user.designation,
        accountCreatedAt: this.formatToIST(user.createdAt),
        loginCount: user.loginCount,
        lastLoginAt: this.formatToIST(user.lastLoginAt),
        previousLoginAt: this.formatToIST(user.previousLoginAt),
        lastLoginIp: user.lastLoginIp,
        hasChangedPassword: user.hasChangedDefaultPassword,
        passwordChangedAt: this.formatToIST(user.passwordChangedAt),
        daysSinceLastLogin,
        daysSinceCreation,
        isActive, // Combined: User.active AND (for students) Student record exists
        userActive, // User account active status
        studentActive, // Student record active status (null for non-students)
        status,
      };
    });
  }

  /**
   * Generate User Session History Report
   * Detailed session history including IP addresses, devices, and session duration
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateUserSessionHistoryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    // Build user filter with institution and active status
    const userFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      userFilter.institutionId = filters.institutionId;
    }

    // Filter by active users only by default (User.active and Student record exists for students)
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      userFilter.active = accountActive;
      if (accountActive === true) {
        userFilter.OR = [
          { role: { not: "STUDENT" } },
          { role: "STUDENT", Student: { isNot: null } },
        ];
      }
    } else {
      // Default to active users only
      userFilter.active = true;
      userFilter.OR = [
        { role: { not: "STUDENT" } },
        { role: "STUDENT", Student: { isNot: null } },
      ];
    }

    if (Object.keys(userFilter).length > 0) {
      where.user = userFilter;
    }

    // Handle session status filter
    const now = new Date();
    if (filters?.sessionStatus === "active") {
      where.expiresAt = { gt: now };
      where.invalidatedAt = null;
    } else if (filters?.sessionStatus === "expired") {
      where.expiresAt = { lt: now };
    } else if (filters?.sessionStatus === "invalidated") {
      where.invalidatedAt = { not: null };
    }

    // Handle date range filter
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
      }
      where.createdAt = dateFilter;
    }

    const sessions = await this.prisma.userSession.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            Institution: { select: { name: true } },
            Student: { select: { id: true } },
          },
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(sessions.length, "UserSessionHistoryReport");

    return sessions.map((session) => {
      const sessionDuration = Math.floor(
        (session.lastActivityAt.getTime() - session.createdAt.getTime()) /
          (1000 * 60),
      );
      const isSessionActive = session.expiresAt > now && !session.invalidatedAt;

      // User active status
      const userActive = session.user.active;
      const studentActive =
        session.user.role === "STUDENT"
          ? (session.user as any).Student
            ? true
            : false
          : null;
      const isUserActive =
        session.user.role === "STUDENT"
          ? userActive && studentActive === true
          : userActive;

      return {
        userId: session.userId,
        userName: session.user.name,
        email: session.user.email,
        role: session.user.role,
        institutionName: session.user.Institution?.name ?? "N/A",
        sessionStartedAt: this.formatToIST(session.createdAt),
        lastActivityAt: this.formatToIST(session.lastActivityAt),
        sessionDuration,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        isActive: isSessionActive, // Session active status
        isUserActive, // User account active status (combined)
        userActive, // User.active
        studentActive, // Student record exists (null for non-students)
        expiresAt: this.formatToIST(session.expiresAt),
      };
    });
  }

  /**
   * Generate Never Logged In Users Report
   * Users who have never logged into the system since account creation
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateNeverLoggedInUsersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      loginCount: 0,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active users only, unless explicitly filtering for inactive
    // This makes sense for "never logged in" report - we want to identify active users who haven't logged in
    // For students, we also check that Student record exists
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      // For students, also filter by Student record existence when filtering for active users
      if (accountActive === true) {
        where.OR = [
          { role: { not: "STUDENT" } }, // Non-students just need User.active
          { role: "STUDENT", Student: { isNot: null } }, // Students need User.active AND Student record
        ];
      }
    } else {
      // Default to active users only (User.active AND Student record exists for students)
      where.active = true;
      where.OR = [
        { role: { not: "STUDENT" } },
        { role: "STUDENT", Student: { isNot: null } },
      ];
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    if (filters?.createdAfter) {
      where.createdAt = {
        ...((where.createdAt as object) || {}),
        gte: new Date(filters.createdAfter),
      };
    }

    if (filters?.createdBefore) {
      where.createdAt = {
        ...((where.createdAt as object) || {}),
        lte: new Date(filters.createdBefore),
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { id: true } }, // Include Student relation
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(users.length, "NeverLoggedInUsersReport");

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive =
        user.role === "STUDENT" ? ((user as any).Student ? true : false) : null;
      const isActive =
        user.role === "STUDENT"
          ? userActive && studentActive === true
          : userActive;

      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? "N/A",
        rollNumber: user.rollNumber,
        accountCreatedAt: this.formatToIST(user.createdAt),
        daysSinceCreation: Math.floor(
          (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
        hasChangedPassword: user.hasChangedDefaultPassword,
        isActive, // Combined: User.active AND (for students) Student record exists
        userActive,
        studentActive,
      };
    });
  }

  /**
   * Generate Default Password Users Report
   * Users who have not changed their default password
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateDefaultPasswordUsersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      hasChangedDefaultPassword: false,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active users only, unless explicitly filtering for inactive
    // Security concern: We want to identify active users with default passwords
    // For students, we also check that Student record exists
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      if (accountActive === true) {
        where.OR = [
          { role: { not: "STUDENT" } },
          { role: "STUDENT", Student: { isNot: null } },
        ];
      }
    } else {
      // Default to active users only (User.active AND Student record exists for students)
      where.active = true;
      where.OR = [
        { role: { not: "STUDENT" } },
        { role: "STUDENT", Student: { isNot: null } },
      ];
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    const hasLoggedIn = this.parseBooleanLike(filters?.hasLoggedIn);
    if (hasLoggedIn !== undefined) {
      where.loginCount = hasLoggedIn ? { gt: 0 } : 0;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { id: true } },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(users.length, "DefaultPasswordUsersReport");

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive =
        user.role === "STUDENT" ? ((user as any).Student ? true : false) : null;
      const isActive =
        user.role === "STUDENT"
          ? userActive && studentActive === true
          : userActive;

      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? "N/A",
        accountCreatedAt: this.formatToIST(user.createdAt),
        daysSinceCreation: Math.floor(
          (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
        loginCount: user.loginCount,
        lastLoginAt: this.formatToIST(user.lastLoginAt),
        isActive,
        userActive,
        studentActive,
      };
    });
  }

  /**
   * Generate Inactive Users Report
   * Users who have not logged in for a specified period
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateInactiveUsersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Default to active users only, unless explicitly filtering for inactive
    // This report identifies active user accounts that haven't been used recently
    // For students, we also check that Student record exists
    const accountActive = this.parseBooleanLike(filters?.isActive);
    if (accountActive !== undefined) {
      where.active = accountActive;
      if (accountActive === true) {
        where.AND = [
          {
            OR: [
              { role: { not: "STUDENT" } },
              { role: "STUDENT", Student: { isNot: null } },
            ],
          },
        ];
      }
    } else {
      // Default to active users only (User.active AND Student record exists for students)
      where.active = true;
      where.AND = [
        {
          OR: [
            { role: { not: "STUDENT" } },
            { role: "STUDENT", Student: { isNot: null } },
          ],
        },
      ];
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        where.role = { in: filters.role };
      } else {
        where.role = filters.role;
      }
    }

    // Apply inactive days filter
    const inactiveDays = Number(filters?.inactiveDays) || 30;
    const cutoffDate = new Date(
      Date.now() - inactiveDays * 24 * 60 * 60 * 1000,
    );

    // Add to existing AND array or create new one
    const inactiveCondition = {
      OR: [
        { lastLoginAt: { lt: cutoffDate } },
        { lastLoginAt: null, loginCount: { gt: 0 } }, // Has logged in before but no lastLoginAt (edge case)
      ],
    };

    if (where.AND) {
      (where.AND as any[]).push(inactiveCondition);
    } else {
      where.AND = [inactiveCondition];
    }

    // Ensure we only get users who have logged in at least once
    where.loginCount = { gt: 0 };

    const users = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        Student: { select: { id: true } },
      },
      take,
      skip,
      orderBy: { lastLoginAt: "asc" },
    });

    this.warnOnLargeResultSet(users.length, "InactiveUsersReport");

    const now = new Date();

    return users.map((user) => {
      const userActive = user.active;
      const studentActive =
        user.role === "STUDENT" ? ((user as any).Student ? true : false) : null;
      const isActive =
        user.role === "STUDENT"
          ? userActive && studentActive === true
          : userActive;

      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        institutionName: user.Institution?.name ?? "N/A",
        lastLoginAt: this.formatToIST(user.lastLoginAt),
        daysSinceLastLogin: user.lastLoginAt
          ? Math.floor(
              (now.getTime() - user.lastLoginAt.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
        loginCount: user.loginCount,
        accountCreatedAt: this.formatToIST(user.createdAt),
        isActive,
        userActive,
        studentActive,
      };
    });
  }

  /**
   * Generate User Audit Log Report
   * Complete audit trail of user actions in the system
   * @param filters - Filter criteria for the report
   * @param pagination - Optional pagination options (take, skip)
   */
  async generateUserAuditLogReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.action) {
      if (Array.isArray(filters.action)) {
        where.action = { in: filters.action };
      } else {
        where.action = filters.action;
      }
    }

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    // Handle date range filter
    // Database stores dates in UTC, so use UTC for filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        dateFilter.gte = new Date(
          Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate(),
            0,
            0,
            0,
            0,
          ),
        );
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        dateFilter.lte = new Date(
          Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );
      }
      where.timestamp = dateFilter;
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            Institution: { select: { name: true } },
          },
        },
      },
      take,
      skip,
      orderBy: { timestamp: "desc" },
    });

    this.warnOnLargeResultSet(auditLogs.length, "UserAuditLogReport");

    return auditLogs.map((log) => ({
      userId: log.userId,
      userName: log.userName ?? log.user?.name ?? "Unknown",
      userRole: log.userRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      institutionName: log.user?.Institution?.name ?? "N/A",
      category: log.category,
      severity: log.severity,
      timestamp: this.formatToIST(log.timestamp),
    }));
  }

  /**
   * Generate report based on type
   * Uses exact type matching with switch statement to prevent routing bugs
   * @param type - Report type (must match keys in definitions/*.definition.ts)
   * @param filters - Filter parameters including institutionId
   * @param isAdmin - Whether the requesting user is an admin (can bypass institution isolation)
   * @param pagination - Optional pagination options (take, skip) to limit result sets
   */
  async generateReport(
    type: ReportType | string,
    filters: any,
    isAdmin: boolean = false,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const typeStr = String(type).toLowerCase();

    // SECURITY: Validate institution isolation before generating any report
    this.validateInstitutionIsolation(typeStr, filters, isAdmin);

    this.logger.log(
      `Generating report: ${type}, institutionId: ${filters?.institutionId || "N/A"}, ` +
        `pagination: take=${pagination?.take ?? DEFAULT_MAX_RECORDS}, skip=${pagination?.skip ?? 0}`,
    );

    // Use exact type matching to prevent routing bugs
    switch (typeStr) {
      // ==================== Student Reports (4) ====================
      case "student-directory":
      case "student-by-branch":
        return this.generateStudentProgressReport(filters, pagination);
      case "student-compliance":
        return this.generateStudentComplianceReport(filters, pagination);
      case "students-without-internship":
        return this.generateStudentsWithoutInternshipReport(
          filters,
          pagination,
        );
      case "student-placement-interest-ppo":
        return this.generateStudentPlacementInterestPpoReport(
          filters,
          pagination,
        );

      // ==================== Mentor Reports (3) ====================
      case "mentor-list":
        return this.generateMentorListReport(filters, pagination);
      case "mentor-student-assignments":
        return this.generateMentorStudentAssignmentsReport(filters, pagination);
      case "unassigned-students":
        return this.generateUnassignedStudentsReport(filters, pagination);

      // ==================== Internship Reports (2) ====================
      case "internship-by-institution":
        return this.generateInternshipByInstitutionReport(filters, pagination);
      case "self-identified-internships":
        // Set filter to only show self-identified internships
        return this.generateInternshipReport(
          { ...filters, isSelfIdentified: true },
          pagination,
        );

      // ==================== Compliance Reports (4) ====================
      case "faculty-visit-compliance":
        return this.generateFacultyVisitComplianceReport(filters, pagination);
      case "monthly-report-compliance":
        return this.generateMonthlyReportComplianceReport(filters, pagination);
      case "joining-report-status":
        return this.generateJoiningReportStatusReport(filters, pagination);
      case "faculty-visit-details":
        return this.generateFacultyVisitDetailsReport(filters, pagination);

      // ==================== Institute Reports (3) ====================
      case "institute-summary":
        return this.generateInstituteSummaryReport(filters, pagination);
      case "institute-comparison":
        return this.generateInstituteComparisonReport(filters, pagination);
      case "branch-wise-summary":
        return this.generateBranchWiseSummaryReport(filters, pagination);

      // ==================== Pending Reports (4) ====================
      case "pending-monthly-visits":
        return this.generatePendingMonthlyVisitsReport(filters, pagination);
      case "pending-monthly-reports":
        return this.generatePendingMonthlyReportsReport(filters, pagination);
      case "pending-joining-letters":
        return this.generatePendingJoiningLettersReport(filters, pagination);
      case "pending-mentor-assignments":
        return this.generateUnassignedStudentsReport(filters, pagination); // Same as unassigned-students

      // ==================== User Activity Reports (6) ====================
      case "user-login-activity":
        return this.generateUserLoginActivityReport(filters, pagination);
      case "user-session-history":
        return this.generateUserSessionHistoryReport(filters, pagination);
      case "never-logged-in-users":
        return this.generateNeverLoggedInUsersReport(filters, pagination);
      case "default-password-users":
        return this.generateDefaultPasswordUsersReport(filters, pagination);
      case "inactive-users":
        return this.generateInactiveUsersReport(filters, pagination);
      case "user-audit-log":
        return this.generateUserAuditLogReport(filters, pagination);

      // ==================== Industry Reports (2) ====================
      case "industry-wise-students-stipend":
        return this.generateIndustryWiseStudentsStipendReport(
          filters,
          pagination,
        );
      case "top-institutes-per-industry":
        return this.generateTopInstitutesPerIndustryReport(filters, pagination);

      // ==================== Principal Reports (2) ====================
      case "principal-visit-logs":
        return this.generatePrincipalVisitLogsReport(filters, pagination);
      case "principal-visit-summary":
        return this.generatePrincipalVisitSummaryReport(filters, pagination);

      // ==================== Training Reports (3) ====================
      case "training-feedback-responses":
        return this.generateTrainingFeedbackResponsesReport(filters, pagination);
      case "training-pre-test-responses":
        return this.generateTrainingPreTestResponsesReport(filters, pagination);
      case "training-post-test-responses":
        return this.generateTrainingPostTestResponsesReport(filters, pagination);

      // ==================== Legacy Support ====================
      // Support for legacy enum values
      case ReportType.STUDENT_PROGRESS:
        return this.generateStudentProgressReport(filters, pagination);
      case ReportType.INTERNSHIP:
        return this.generateInternshipReport(filters, pagination);
      case ReportType.FACULTY_VISIT:
        return this.generateFacultyVisitReport(filters, pagination);
      case ReportType.MONTHLY:
        return this.generateMonthlyReport(filters, pagination);
      case ReportType.PLACEMENT:
        return this.generatePlacementReport(filters, pagination);
      case ReportType.INSTITUTION_PERFORMANCE:
        return this.generateInstitutionPerformanceReport(filters);

      default:
        this.logger.error(`Unknown report type requested: ${type}`);
        throw new ForbiddenException(
          `Unknown report type: ${type}. Valid types: student-directory, mentor-list, internship-applications, etc.`,
        );
    }
  }

  // ==================== Training Report Generators ====================

  /**
   * Generate Training Feedback Responses Report
   */
  async generateTrainingFeedbackResponsesReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);
    const userWhere = this.buildTrainingUserWhere(filters);
    const trainingWhere = this.buildTrainingDateWhere(filters);

    const where: Record<string, unknown> = {};
    if (filters?.trainingId) {
      where.trainingId = filters.trainingId;
    }
    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }
    if (Object.keys(trainingWhere).length > 0) {
      where.training = trainingWhere;
    }

    const responses = await this.prisma.feedbackResponse.findMany({
      where,
      include: {
        training: {
          select: { id: true, title: true, startDate: true, endDate: true },
        },
        user: {
          select: {
            name: true,
            phoneNo: true,
            branchName: true,
            branch: { select: { name: true } },
            Institution: { select: { name: true } },
          },
        },
        feedbackForm: { select: { questions: true } },
      },
      orderBy: { submittedAt: "desc" },
      take,
      skip,
    });

    this.warnOnLargeResultSet(responses.length, "TrainingFeedbackResponsesReport");

    return responses.map((response) => {
      const questions = Array.isArray(response.feedbackForm?.questions)
        ? response.feedbackForm.questions
        : [];
      const answers = (response.responses || {}) as Record<string, unknown>;

      const row: Record<string, unknown> = {
        trainingId: response.training?.id ?? null,
        trainingName: response.training?.title ?? "N/A",
        trainingStartDate: response.training?.startDate
          ? this.formatToISTDateOnly(response.training.startDate)
          : "N/A",
        trainingEndDate: response.training?.endDate
          ? this.formatToISTDateOnly(response.training.endDate)
          : "N/A",
        facultyName: response.user?.name ?? "N/A",
        facultyBranch: response.user?.branch?.name ?? response.user?.branchName ?? "N/A",
        facultyPhone: response.user?.phoneNo ?? "",
        institutionName: response.user?.Institution?.name ?? "N/A",
      };

      questions.forEach((question: any, index: number) => {
        const key = this.buildQuestionKey(question, index);
        row[key] = this.formatResponseValue(answers[question?.id]);
      });

      return row;
    });
  }

  /**
   * Generate Training Pre-Test Responses Report
   */
  async generateTrainingPreTestResponsesReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);
    const userWhere = this.buildTrainingUserWhere(filters);
    const trainingWhere = this.buildTrainingDateWhere(filters);

    const where: Record<string, unknown> = {};
    if (filters?.trainingId) {
      where.trainingId = filters.trainingId;
    }
    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }
    if (Object.keys(trainingWhere).length > 0) {
      where.training = trainingWhere;
    }

    const responses = await this.prisma.preTestResponse.findMany({
      where,
      include: {
        training: {
          select: { id: true, title: true, startDate: true, endDate: true },
        },
        user: {
          select: {
            name: true,
            phoneNo: true,
            branchName: true,
            branch: { select: { name: true } },
            Institution: { select: { name: true } },
          },
        },
        preTestForm: { select: { questions: true } },
      },
      orderBy: { submittedAt: "desc" },
      take,
      skip,
    });

    this.warnOnLargeResultSet(responses.length, "TrainingPreTestResponsesReport");

    return responses.map((response) => {
      const questions = Array.isArray(response.preTestForm?.questions)
        ? response.preTestForm.questions
        : [];
      const answers = (response.responses || {}) as Record<string, unknown>;

      const row: Record<string, unknown> = {
        trainingId: response.training?.id ?? null,
        trainingName: response.training?.title ?? "N/A",
        trainingStartDate: response.training?.startDate
          ? this.formatToISTDateOnly(response.training.startDate)
          : "N/A",
        trainingEndDate: response.training?.endDate
          ? this.formatToISTDateOnly(response.training.endDate)
          : "N/A",
        facultyName: response.user?.name ?? "N/A",
        facultyBranch: response.user?.branch?.name ?? response.user?.branchName ?? "N/A",
        facultyPhone: response.user?.phoneNo ?? "",
        institutionName: response.user?.Institution?.name ?? "N/A",
        score: response.score ?? null,
        passed: response.passed ?? null,
        submittedAt: response.submittedAt
          ? this.formatToIST(response.submittedAt)
          : "N/A",
      };

      questions.forEach((question: any, index: number) => {
        const key = this.buildQuestionKey(question, index);
        row[key] = this.formatResponseValue(answers[question?.id]);
      });

      return row;
    });
  }

  /**
   * Generate Training Post-Test Responses Report
   */
  async generateTrainingPostTestResponsesReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);
    const userWhere = this.buildTrainingUserWhere(filters);
    const trainingWhere = this.buildTrainingDateWhere(filters);

    const where: Record<string, unknown> = {};
    if (filters?.trainingId) {
      where.trainingId = filters.trainingId;
    }
    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }
    if (Object.keys(trainingWhere).length > 0) {
      where.training = trainingWhere;
    }

    const responses = await this.prisma.postTestResponse.findMany({
      where,
      include: {
        training: {
          select: { id: true, title: true, startDate: true, endDate: true },
        },
        user: {
          select: {
            name: true,
            phoneNo: true,
            branchName: true,
            branch: { select: { name: true } },
            Institution: { select: { name: true } },
          },
        },
        postTestForm: { select: { questions: true } },
      },
      orderBy: { submittedAt: "desc" },
      take,
      skip,
    });

    this.warnOnLargeResultSet(responses.length, "TrainingPostTestResponsesReport");

    return responses.map((response) => {
      const questions = Array.isArray(response.postTestForm?.questions)
        ? response.postTestForm.questions
        : [];
      const answers = (response.responses || {}) as Record<string, unknown>;

      const row: Record<string, unknown> = {
        trainingName: response.training?.title ?? "N/A",
        trainingStartDate: response.training?.startDate
          ? this.formatToISTDateOnly(response.training.startDate)
          : "N/A",
        trainingEndDate: response.training?.endDate
          ? this.formatToISTDateOnly(response.training.endDate)
          : "N/A",
        facultyName: response.user?.name ?? "N/A",
        facultyBranch: response.user?.branch?.name ?? response.user?.branchName ?? "N/A",
        facultyPhone: response.user?.phoneNo ?? "",
        institutionName: response.user?.Institution?.name ?? "N/A",
        score: response.score ?? null,
        passed: response.passed ?? null,
        submittedAt: response.submittedAt
          ? this.formatToIST(response.submittedAt)
          : "N/A",
      };

      questions.forEach((question: any, index: number) => {
        const key = this.buildQuestionKey(question, index);
        row[key] = this.formatResponseValue(answers[question?.id]);
      });

      return row;
    });
  }

  // ==================== Mentor Report Generators ====================

  /**
   * Generate Mentor List Report
   * Lists all faculty members who can be assigned as mentors
   * @param filters - Filter criteria (institutionId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateMentorListReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Handle includePrincipal filter - by default only show TEACHER role
    const includePrincipal = this.parseBooleanLike(filters?.includePrincipal);
    if (includePrincipal === true) {
      where.role = { in: [Role.TEACHER, Role.PRINCIPAL] };
    } else {
      where.role = Role.TEACHER;
    }

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.department) {
      where.branchName = filters.department;
    }

    // Default to active faculty only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.active = isActiveValue;
    } else {
      where.active = true;
    }

    this.logger.log(
      `[MentorListReport] Query filters: ${JSON.stringify(filters)}`,
    );
    this.logger.log(
      `[MentorListReport] Where clause: ${JSON.stringify(where)}`,
    );

    const mentors = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                internshipApplications: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    facultyVisitLogs: {
                      where: { isDeleted: false, status: "COMPLETED" },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            mentorAssignments: { where: { isActive: true } },
          },
        },
      },
      take,
      skip,
      orderBy: { name: "asc" },
    });

    this.logger.log(`[MentorListReport] Found ${mentors.length} mentors`);
    this.warnOnLargeResultSet(mentors.length, "MentorListReport");

    // Apply hasAssignments filter if specified
    let filteredMentors = mentors;
    if (filters?.hasAssignments !== undefined) {
      const hasAssignments = this.parseBooleanLike(filters.hasAssignments);
      if (hasAssignments === true) {
        filteredMentors = mentors.filter((m) => m._count.mentorAssignments > 0);
      } else if (hasAssignments === false) {
        filteredMentors = mentors.filter(
          (m) => m._count.mentorAssignments === 0,
        );
      }
    }

    return filteredMentors.map((mentor) => {
      // Count active internships and visits from assignments
      let activeInternships = 0;
      let visitsCompleted = 0;

      mentor.mentorAssignments.forEach((assignment) => {
        assignment.student.internshipApplications.forEach((app) => {
          activeInternships++;
          visitsCompleted += app.facultyVisitLogs.length;
        });
      });

      return {
        name: mentor.name,
        email: mentor.email,
        phoneNumber: mentor.phoneNo,
        designation: mentor.designation,
        department: mentor.branchName ?? "N/A",
        institutionName: mentor.Institution?.name ?? "N/A",
        role: mentor.role,
        assignedStudents: mentor._count.mentorAssignments,
        activeInternships,
        visitsCompleted,
        isActive: mentor.active,
      };
    });
  }

  /**
   * Generate Mentor-Student Assignments Report
   * Shows mentor-student assignment relationships - matches mentor-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, mentorId, branchId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateMentorStudentAssignmentsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isActive: true,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    // Build student filter
    const studentFilter: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentFilter.branchId = filters.branchId;
    }

    // Default to active students and mentors
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentFilter.user = { active: isActiveValue };
      where.mentor = { active: isActiveValue };
    } else {
      studentFilter.user = { active: true };
      where.mentor = { active: true };
    }

    if (Object.keys(studentFilter).length > 0) {
      where.student = studentFilter;
    }

    const assignments = await this.prisma.mentorAssignment.findMany({
      where,
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            active: true,
          },
        },
        student: {
          select: {
            id: true,
            user: {
              select: {
                name: true,
                rollNumber: true,
                branchName: true,
                active: true,
              },
            },
            Institution: { select: { name: true } },
            branch: { select: { name: true } },
            internshipApplications: {
              where: { isActive: true },
              select: {
                companyName: true,
                internshipPhase: true,
                status: true,
                submittedReportsCount: true,
                facultyVisitLogs: {
                  where: { isDeleted: false, status: "COMPLETED" },
                  select: { visitDate: true },
                  orderBy: { visitDate: "desc" },
                  take: 1,
                },
              },
              take: 1,
              orderBy: { createdAt: "desc" },
            },
            monthlyReports: {
              where: { status: "APPROVED" },
              select: { id: true },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { assignmentDate: "desc" },
    });

    this.warnOnLargeResultSet(
      assignments.length,
      "MentorStudentAssignmentsReport",
    );

    return assignments.map((assignment) => {
      const app = assignment.student.internshipApplications[0];
      const lastVisit = app?.facultyVisitLogs[0]?.visitDate ?? null;

      // Map internship phase to status string
      let internshipStatus = "Not Started";
      if (app) {
        switch (app.internshipPhase) {
          case "ACTIVE":
            internshipStatus = "Active";
            break;
          case "COMPLETED":
            internshipStatus = "Completed";
            break;
          case "NOT_STARTED":
            internshipStatus = "Not Started";
            break;
          default:
            internshipStatus = app.status ?? "Unknown";
        }
      }

      return {
        mentorName: assignment.mentor.name,
        mentorEmail: assignment.mentor.email,
        studentName: assignment.student.user?.name,
        studentRollNumber: assignment.student.user?.rollNumber,
        branchName:
          assignment.student.branch?.name ??
          assignment.student.user?.branchName,
        companyName: app?.companyName ?? "N/A",
        internshipStatus,
        assignedDate: this.formatToISTDateOnly(assignment.assignmentDate),
        lastVisitDate: this.formatToIST(lastVisit),
        reportsReviewed: assignment.student.monthlyReports.length,
        studentActive: assignment.student.user?.active ?? false,
        mentorActive: assignment.mentor.active,
      };
    });
  }

  /**
   * Generate Unassigned Students Report
   * Lists students who don't have a mentor assigned
   * @param filters - Filter criteria (institutionId, branchId, isActive)
   * @param pagination - Optional pagination options
   */
  async generateUnassignedStudentsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      // Students with NO active mentor assignment
      mentorAssignments: {
        none: { isActive: true },
      },
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters?.currentYear) {
      where.currentYear = Number(filters.currentYear);
    }

    // Default to active students only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    } else {
      where.user = { active: true };
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            rollNumber: true,
            branchName: true,
            email: true,
            phoneNo: true,
            active: true,
          },
        },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        internshipApplications: {
          where: { isActive: true },
          select: { id: true, status: true, companyName: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(students.length, "UnassignedStudentsReport");

    return students.map((student) => {
      const activeInternship = student.internshipApplications[0];
      return {
        studentName: student.user?.name,
        rollNumber: student.user?.rollNumber,
        email: student.user?.email,
        phoneNo: student.user?.phoneNo,
        branchName: student.branch?.name ?? student.user?.branchName,
        currentYear: student.currentYear,
        currentSemester: student.currentSemester,
        institutionName: student.Institution?.name ?? "N/A",
        hasActiveInternship: !!activeInternship,
        internshipStatus: activeInternship?.status ?? "None",
        companyName: activeInternship?.companyName ?? "N/A",
        isActive: student.user?.active ?? false,
        userActive: student.user?.active ?? true,
      };
    });
  }

  // ==================== Internship Summary Report Generators ====================

  /**
   * Generate Internship by Institution Report
   * Aggregates internship data by institution
   * @param filters - Filter criteria (district, city, startDateRange)
   * @param pagination - Optional pagination options
   */
  async generateInternshipByInstitutionReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);

    // Build institution where clause
    const institutionWhere: Record<string, unknown> = {};
    if (filters?.district) {
      institutionWhere.district = filters.district;
    }
    if (filters?.city) {
      institutionWhere.city = filters.city;
    }

    // Build internship application where clause with start date filter
    const internshipWhere: Record<string, unknown> = { isActive: true };

    // Handle internship start date range filter
    // Note: Frontend sends startDateRange: [start, end], processor transforms to startDateStart/startDateEnd
    let startDateStartValue = filters?.startDateStart;
    let startDateEndValue = filters?.startDateEnd;

    // Handle case where startDateRange array is passed directly
    if (
      !startDateStartValue &&
      !startDateEndValue &&
      Array.isArray(filters?.startDateRange) &&
      filters.startDateRange.length === 2
    ) {
      startDateStartValue = filters.startDateRange[0];
      startDateEndValue = filters.startDateRange[1];
    }

    if (startDateStartValue || startDateEndValue) {
      const startDateFilter: Record<string, unknown> = {};
      if (startDateStartValue) {
        startDateFilter.gte = new Date(startDateStartValue);
      }
      if (startDateEndValue) {
        const endDate = new Date(startDateEndValue);
        endDate.setUTCHours(23, 59, 59, 999);
        startDateFilter.lte = endDate;
      }
      internshipWhere.startDate = startDateFilter;
    }

    const institutions = await this.prisma.institution.findMany({
      where:
        Object.keys(institutionWhere).length > 0 ? institutionWhere : undefined,
      include: {
        _count: {
          select: {
            Student: { where: { user: { active: true } } },
          },
        },
        Student: {
          where: { user: { active: true } },
          include: {
            internshipApplications: {
              where: internshipWhere,
              select: {
                isActive: true,
                status: true,
                internshipPhase: true,
                isSelfIdentified: true,
                joiningLetterUrl: true,
                // Include actual faculty visit logs (not deleted)
                facultyVisitLogs: {
                  where: { isDeleted: false },
                  select: { id: true },
                },
                // Include actual monthly reports (submitted, not deleted)
                monthlyReports: {
                  where: {
                    isDeleted: false,
                    status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
                  },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: "asc" },
    });

    this.warnOnLargeResultSet(
      institutions.length,
      "InternshipByInstitutionReport",
    );

    return institutions.map((inst) => {
      let activeInternships = 0;
      let completedInternships = 0;
      let pendingApplications = 0;
      let selfIdentified = 0;
      let totalSubmittedVisits = 0;
      let totalSubmittedReports = 0;
      let totalJoiningLetters = 0;

      inst.Student.forEach((student) => {
        student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === "ACTIVE") activeInternships++;
          if (app.internshipPhase === "COMPLETED") completedInternships++;
          if (["SUBMITTED", "UNDER_REVIEW"].includes(app.status))
            pendingApplications++;
          if (app.isSelfIdentified) selfIdentified++;
          // Count actual faculty visit logs
          totalSubmittedVisits += app.facultyVisitLogs?.length ?? 0;
          // Count actual submitted monthly reports
          totalSubmittedReports += app.monthlyReports?.length ?? 0;
          if (app.joiningLetterUrl) totalJoiningLetters++;
        });
      });

      const totalStudents = inst._count.Student;
      const totalInternships = activeInternships + completedInternships;
      const internshipRate =
        totalStudents > 0
          ? Math.round((totalInternships / totalStudents) * 100)
          : 0;

      return {
        institutionName: inst.name,
        institutionCode: inst.shortName,
        city: inst.city,
        district: inst.district,
        totalStudents,
        activeInternships,
        completedInternships,
        pendingApplications,
        selfIdentified,
        totalSubmittedVisits,
        totalSubmittedReports,
        totalJoiningLetters,
        internshipRate,
      };
    });
  }

  // ==================== Compliance Report Generators ====================

  /**
   * Generate Faculty Visit Compliance Report
   * Tracks faculty visit compliance for internship monitoring
   * @param filters - Filter criteria (institutionId, month, year)
   * @param pagination - Optional pagination options
   */
  async generateFacultyVisitComplianceReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);
    // Determine reporting period
    const now = new Date();
    const hasMonthFilter =
      filters?.month !== undefined &&
      filters?.month !== null &&
      filters?.month !== "";
    const reportMonth = hasMonthFilter ? Number(filters.month) : undefined;
    const reportYear = filters?.year ? Number(filters.year) : now.getFullYear();
    const reportMonthStr = reportMonth
      ? this.formatReportMonth(reportMonth, reportYear)
      : `Jan-Dec ${reportYear}`;

    // Fetch students the SAME way as Joining Report
    const userFilter: Record<string, unknown> = { active: true };
    if (filters?.institutionId) {
      userFilter.institutionId = filters.institutionId;
    }

    const studentWhere: Record<string, unknown> = {
      user: userFilter,
      Institution: { isActive: true },
    };
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }

    const internshipAppWhere: Record<string, unknown> = {
      isActive: true,
      isSelfIdentified: true,
      status: "APPROVED",
      startDate: { not: null },
    };
    if (filters?.internshipStartDate) {
      const filterDate = new Date(filters.internshipStartDate);
      filterDate.setUTCHours(23, 59, 59, 999);
      internshipAppWhere.startDate = { lte: filterDate };
    }

    const yearStartDate = new Date(reportYear, 0, 1, 0, 0, 0, 0);
    const yearEndDate = new Date(reportYear, 11, 31, 23, 59, 59, 999);
    const selectedMonthStartDate = reportMonth
      ? new Date(reportYear, reportMonth - 1, 1, 0, 0, 0, 0)
      : undefined;
    const selectedMonthEndDate = reportMonth
      ? new Date(reportYear, reportMonth, 0, 23, 59, 59, 999)
      : undefined;

    if (selectedMonthStartDate && selectedMonthEndDate) {
      internshipAppWhere.startDate = { lte: selectedMonthEndDate };
      internshipAppWhere.OR = [
        { endDate: { gte: selectedMonthStartDate } },
        { endDate: null },
      ];
    }

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      include: {
        user: {
          select: {
            name: true,
            rollNumber: true,
            branchName: true,
            active: true,
          },
        },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        mentorAssignments: {
          include: {
            mentor: { select: { id: true, name: true } },
          },
        },
        internshipApplications: {
          where: internshipAppWhere,
          select: {
            companyName: true,
            companyAddress: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            totalExpectedVisits: true,
            facultyVisitLogs: {
              where: {
                isDeleted: false,
                status: "COMPLETED",
                visitDate: {
                  gte: yearStartDate,
                  lte: yearEndDate,
                },
              },
              select: { visitDate: true, visitType: true, status: true },
              orderBy: { visitDate: "desc" as const },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { user: { name: "asc" } },
    });

    this.warnOnLargeResultSet(students.length, "FacultyVisitComplianceReport");

    const results: any[] = [];

    for (const student of students) {
      const mentorName = student.mentorAssignments[0]?.mentor?.name ?? "N/A";
      const emptyMonthColumns = this.buildMonthSubmissionColumns(
        new Set<number>(),
        new Set<number>(),
      );

      if (student.internshipApplications.length === 0) {
        // Student with no active application — still show them
        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          gender: student.gender ?? "N/A",
          branchName: student.branch?.name ?? student.user?.branchName,
          institutionName: student.Institution?.name ?? "N/A",
          companyName: "N/A",
          companyAddress: "N/A",
          internshipStartDate: null,
          mentorName,
          requiredVisits: 0,
          completedVisits: 0,
          pendingVisits: 0,
          compliancePercent: 0,
          complianceLevel: "low",
          lastVisitDate: null,
          lastVisitType: "N/A",
          reportMonth: reportMonthStr,
          studentActive: student.user?.active ?? false,
          ...emptyMonthColumns,
        });
      } else {
        // One row per active application
        for (const app of student.internshipApplications) {
          const startDate = app.startDate ?? app.joiningDate;
          const expectedMonths = this.getEligibleMonthsForYearByCycle(
            startDate,
            app.endDate,
            reportYear,
            "visit",
          );

          if (reportMonth && !expectedMonths.has(reportMonth)) {
            continue;
          }

          const completedVisitMonths = new Set<number>(
            app.facultyVisitLogs
              .map((visit) => new Date(visit.visitDate).getMonth() + 1)
              .filter((month) => month >= 1 && month <= 12),
          );

          const requiredVisits = reportMonth
            ? expectedMonths.has(reportMonth)
              ? 1
              : 0
            : expectedMonths.size;
          const completedVisits = reportMonth
            ? completedVisitMonths.has(reportMonth)
              ? 1
              : 0
            : Array.from(expectedMonths).filter((month) =>
                completedVisitMonths.has(month),
              ).length;
          const pendingVisits = Math.max(0, requiredVisits - completedVisits);
          const compliancePercent =
            requiredVisits > 0
              ? Math.round((completedVisits / requiredVisits) * 100)
              : 0;

          let complianceLevel = "low";
          if (compliancePercent >= 80) complianceLevel = "high";
          else if (compliancePercent >= 50) complianceLevel = "medium";

          const lastVisitLog = app.facultyVisitLogs?.[0];

          results.push({
            studentName: student.user?.name,
            rollNumber: student.user?.rollNumber,
            gender: student.gender ?? "N/A",
            branchName: student.branch?.name ?? student.user?.branchName,
            institutionName: student.Institution?.name ?? "N/A",
            companyName: app.companyName ?? "N/A",
            companyAddress: app.companyAddress ?? "N/A",
            internshipStartDate: this.formatToISTDateOnly(startDate),
            mentorName,
            requiredVisits,
            completedVisits,
            pendingVisits,
            compliancePercent,
            complianceLevel,
            lastVisitDate: this.formatToIST(lastVisitLog?.visitDate ?? null),
            lastVisitType: lastVisitLog?.visitType ?? "N/A",
            reportMonth: reportMonthStr,
            studentActive: student.user?.active ?? false,
            ...this.buildMonthSubmissionColumns(
              completedVisitMonths,
              expectedMonths,
            ),
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate Monthly Report Compliance Report
   * Student monthly report submission compliance
   * @param filters - Filter criteria (institutionId, branchId, mentorId, month, year)
   * @param pagination - Optional pagination options
   */
  async generateMonthlyReportComplianceReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    // Default to active students only
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      where.user = { active: isActiveValue };
    } else {
      where.user = { active: true };
    }
    where.Institution = { isActive: true };

    // Reporting period controls monthly matrix and expected month calculation.
    const now = new Date();
    const hasMonthFilter =
      filters?.month !== undefined &&
      filters?.month !== null &&
      filters?.month !== "";
    const resolvedMonth = hasMonthFilter ? Number(filters.month) : undefined;
    const resolvedYear = filters?.year
      ? Number(filters.year)
      : now.getFullYear();
    const reportMonthStr = resolvedMonth
      ? this.formatReportMonth(resolvedMonth, resolvedYear)
      : `Jan-Dec ${resolvedYear}`;

    const selectedMonthStartDate = resolvedMonth
      ? new Date(resolvedYear, resolvedMonth - 1, 1, 0, 0, 0, 0)
      : undefined;
    const selectedMonthEndDate = resolvedMonth
      ? new Date(resolvedYear, resolvedMonth, 0, 23, 59, 59, 999)
      : undefined;

    const internshipWhere: Record<string, unknown> = {
      isActive: true,
      isSelfIdentified: true,
      status: "APPROVED",
      startDate: { not: null },
    };
    if (selectedMonthStartDate && selectedMonthEndDate) {
      internshipWhere.startDate = { lte: selectedMonthEndDate };
      internshipWhere.OR = [
        { endDate: { gte: selectedMonthStartDate } },
        { endDate: null },
      ];
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            rollNumber: true,
            branchName: true,
            active: true,
          },
        },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            mentor: { select: { id: true, name: true } },
          },
          take: 1,
          orderBy: { assignmentDate: "desc" },
        },
        internshipApplications: {
          where: internshipWhere,
          include: {
            mentor: { select: { id: true, name: true } },
            monthlyReports: {
              where: {
                isDeleted: false,
                reportYear: resolvedYear,
              },
              select: {
                status: true,
                submittedAt: true,
                reportMonth: true,
                reportYear: true,
              },
              orderBy: { submittedAt: "desc" },
            },
          },
          orderBy: { startDate: "desc" },
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(students.length, "MonthlyReportComplianceReport");

    const results: any[] = [];

    for (const student of students) {
      const emptyMonthColumns = this.buildMonthSubmissionColumns(
        new Set<number>(),
        new Set<number>(),
      );
      const assignedMentor = student.mentorAssignments?.[0]?.mentor;

      if (student.internshipApplications.length === 0) {
        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          gender: student.gender ?? "N/A",
          branchName: student.branch?.name ?? student.user?.branchName,
          institutionName: student.Institution?.name ?? "N/A",
          mentorName: assignedMentor?.name ?? "N/A",
          companyName: "N/A",
          reportMonth: reportMonthStr,
          totalReportsExpected: 0,
          reportsSubmitted: 0,
          reportsApproved: 0,
          reportsPending: 0,
          compliancePercent: 0,
          lastSubmissionDate: "",
          isActive: student.user?.active ?? false,
          userActive: student.user?.active ?? true,
          ...emptyMonthColumns,
        });
        continue;
      }

      for (const app of student.internshipApplications) {
        const resolvedMentorId = assignedMentor?.id ?? app?.mentor?.id;
        const resolvedMentorName =
          assignedMentor?.name ?? app?.mentor?.name ?? "N/A";

        if (filters?.mentorId && resolvedMentorId !== filters.mentorId) {
          continue;
        }

        const internshipStart = app.startDate ?? app.joiningDate;
        const expectedMonths = this.getEligibleMonthsForYearByCycle(
          internshipStart,
          app.endDate,
          resolvedYear,
          "report",
        );
        if (resolvedMonth && !expectedMonths.has(resolvedMonth)) {
          continue;
        }

        const submittedMonths = new Set<number>();
        const approvedMonths = new Set<number>();

        for (const report of app.monthlyReports ?? []) {
          if (
            report.status === MonthlyReportStatus.SUBMITTED ||
            report.status === MonthlyReportStatus.UNDER_REVIEW ||
            report.status === MonthlyReportStatus.APPROVED
          ) {
            submittedMonths.add(report.reportMonth);
          }
          if (report.status === MonthlyReportStatus.APPROVED) {
            approvedMonths.add(report.reportMonth);
          }
        }

        const totalExpected = resolvedMonth
          ? expectedMonths.has(resolvedMonth)
            ? 1
            : 0
          : expectedMonths.size;
        const submitted = resolvedMonth
          ? submittedMonths.has(resolvedMonth)
            ? 1
            : 0
          : Array.from(expectedMonths).filter((month) =>
              submittedMonths.has(month),
            ).length;
        const approved = resolvedMonth
          ? approvedMonths.has(resolvedMonth)
            ? 1
            : 0
          : Array.from(expectedMonths).filter((month) =>
              approvedMonths.has(month),
            ).length;

        const pending = Math.max(0, totalExpected - submitted);
        const compliancePercent =
          totalExpected > 0 ? Math.round((submitted / totalExpected) * 100) : 0;

        const lastSubmission = (app.monthlyReports ?? []).find(
          (report) => !!report.submittedAt,
        )?.submittedAt;

        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          gender: student.gender ?? "N/A",
          branchName: student.branch?.name ?? student.user?.branchName,
          institutionName: student.Institution?.name ?? "N/A",
          mentorName: resolvedMentorName,
          companyName: (app as any)?.companyName ?? "N/A",
          reportMonth: reportMonthStr,
          totalReportsExpected: totalExpected,
          reportsSubmitted: submitted,
          reportsApproved: approved,
          reportsPending: pending,
          compliancePercent,
          lastSubmissionDate: this.formatToIST(lastSubmission ?? null),
          isActive: student.user?.active ?? false,
          userActive: student.user?.active ?? true,
          ...this.buildMonthSubmissionColumns(submittedMonths, expectedMonths),
        });
      }
    }

    return results;
  }

  /**
   * Generate Joining Report Status Report
   * Track joining letter/report submission status
   * @param filters - Filter criteria (institutionId, branchId, joiningLetterStatus)
   * @param pagination - Optional pagination options
   */
  async generateJoiningReportStatusReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);

    // Build student filter - fetch ALL students with active user accounts
    const userFilter: Record<string, unknown> = { active: true };

    // Allow override via filter (but default is active only)
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      userFilter.active = isActiveValue;
    }

    // Filter by institution - check both Student.institutionId and User.institutionId
    if (filters?.institutionId) {
      userFilter.institutionId = filters.institutionId;
    }

    const studentWhere: Record<string, unknown> = {
      user: userFilter,
    };

    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      include: {
        user: {
          select: {
            name: true,
            rollNumber: true,
            branchName: true,
            active: true,
          },
        },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        // Include mentor assignments to get the assigned faculty mentor
        mentorAssignments: {
          where: { isActive: true },
          include: {
            mentor: { select: { name: true } },
          },
          take: 1,
        },
        internshipApplications: {
          where: { isActive: true },
          include: {
            mentor: { select: { name: true } },
          },
          orderBy: { startDate: "desc" },
        },
      },
      take,
      skip,
      orderBy: { user: { name: "asc" } },
    });

    this.warnOnLargeResultSet(students.length, "JoiningReportStatusReport");

    const now = new Date();

    const results: any[] = [];

    for (const student of students) {
      // Get mentor name from mentor assignments (primary source) or application mentor (fallback)
      const assignedMentorName = student.mentorAssignments?.[0]?.mentor?.name;

      if (student.internshipApplications.length === 0) {
        // Student has no active applications - still show them
        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          gender: student.gender ?? "N/A",
          branchName: student.branch?.name ?? student.user?.branchName,
          institutionName: student.Institution?.name ?? "N/A",
          companyName: "N/A",
          internshipStartDate: null,
          joiningLetterStatus: "NO APPLICATION",
          joiningLetterSubmittedAt: null,
          joiningLetterApprovedAt: null,
          daysSinceStart: 0,
          mentorName: assignedMentorName ?? "N/A",
          isActive: student.user?.active ?? false,
          userActive: student.user?.active ?? true,
        });
      } else {
        // Include a row for each active application
        for (const app of student.internshipApplications) {
          let joiningLetterStatus = "PENDING";
          if (app.joiningLetterUrl) {
            joiningLetterStatus = "APPROVED";
          }

          const startDate = app.startDate ?? app.joiningDate;
          const daysSinceStart = startDate
            ? Math.floor(
                (now.getTime() - new Date(startDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : 0;

          // Use assigned mentor, then fall back to application mentor
          const mentorName = assignedMentorName ?? app.mentor?.name ?? "N/A";

          results.push({
            studentName: student.user?.name,
            rollNumber: student.user?.rollNumber,
            gender: student.gender ?? "N/A",
            branchName: student.branch?.name ?? student.user?.branchName,
            institutionName: student.Institution?.name ?? "N/A",
            companyName: app.companyName,
            internshipStartDate: this.formatToISTDateOnly(startDate),
            joiningLetterStatus,
            joiningLetterSubmittedAt: this.formatToIST(
              app.joiningLetterUrl ? app.createdAt : null,
            ),
            joiningLetterApprovedAt: this.formatToIST(
              app.joiningLetterUrl ? app.createdAt : null,
            ),
            daysSinceStart,
            mentorName,
            isActive: student.user?.active ?? false,
            userActive: student.user?.active ?? true,
          });
        }
      }
    }

    // Apply joining letter status filter if specified
    if (filters?.joiningLetterStatus) {
      return results.filter(
        (r) => r.joiningLetterStatus === filters.joiningLetterStatus,
      );
    }

    return results;
  }

  /**
   * Generate Faculty Visit Details Report
   * Detailed faculty visit logs with observations and feedback
   * @param filters - Filter criteria (institutionId, branchId, mentorId, visitType, visitStatus, dateRange)
   * @param pagination - Optional pagination options
   */
  async generateFacultyVisitDetailsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);

    // Build the where clause for faculty visit logs
    const visitWhere: Record<string, unknown> = {
      isDeleted: false,
    };

    // Filter by visit type
    if (filters?.visitType) {
      visitWhere.visitType = filters.visitType;
    }

    // Filter by visit status
    if (filters?.visitStatus) {
      visitWhere.status = filters.visitStatus;
    }

    // Filter by date range
    if (filters?.dateRange) {
      const dateFilter: Record<string, unknown> = {};
      if (filters.dateRange.start) {
        dateFilter.gte = new Date(filters.dateRange.start);
      }
      if (filters.dateRange.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setUTCHours(23, 59, 59, 999);
        dateFilter.lte = endDate;
      }
      if (Object.keys(dateFilter).length > 0) {
        visitWhere.visitDate = dateFilter;
      }
    }

    // Filter by mentor
    if (filters?.mentorId) {
      visitWhere.facultyId = filters.mentorId;
    }

    // Support month/year filters directly for compliance-style period filtering.
    if (filters?.month || filters?.year) {
      const resolvedYear = filters?.year
        ? Number(filters.year)
        : new Date().getFullYear();
      if (filters?.month) {
        const resolvedMonth = Number(filters.month);
        visitWhere.visitDate = {
          gte: new Date(resolvedYear, resolvedMonth - 1, 1, 0, 0, 0, 0),
          lte: new Date(resolvedYear, resolvedMonth, 0, 23, 59, 59, 999),
        };
      } else {
        visitWhere.visitDate = {
          gte: new Date(resolvedYear, 0, 1, 0, 0, 0, 0),
          lte: new Date(resolvedYear, 11, 31, 23, 59, 59, 999),
        };
      }
    }

    // Fetch faculty visit logs with related data
    const visitLogs = await this.prisma.facultyVisitLog.findMany({
      where: visitWhere,
      include: {
        faculty: {
          select: {
            id: true,
            name: true,
            institutionId: true,
          },
        },
        application: {
          select: {
            companyName: true,
            companyAddress: true,
            companyContact: true,
            student: {
              select: {
                id: true,
                institutionId: true,
                branchId: true,
                gender: true,
                user: {
                  select: {
                    name: true,
                    rollNumber: true,
                    branchName: true,
                    active: true,
                  },
                },
                branch: { select: { name: true } },
                Institution: { select: { name: true } },
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { visitDate: "desc" },
    });

    this.warnOnLargeResultSet(visitLogs.length, "FacultyVisitDetailsReport");

    const results: any[] = [];

    for (const visit of visitLogs) {
      const student = visit.application?.student;
      const facultyInstitutionId = visit.faculty?.institutionId;

      // Apply institution filter
      if (filters?.institutionId) {
        const matchesInstitution =
          student?.institutionId === filters.institutionId ||
          facultyInstitutionId === filters.institutionId;
        if (!matchesInstitution) {
          continue;
        }
      }

      // Apply branch filter
      if (filters?.branchId && student?.branchId !== filters.branchId) {
        continue;
      }

      const visitDone = visit.status === "COMPLETED";

      results.push({
        mentorName: visit.faculty?.name ?? "N/A",
        reportMonth: this.formatReportMonthFromDate(visit.visitDate),
        studentName: student?.user?.name ?? "N/A",
        rollNumber: student?.user?.rollNumber ?? "N/A",
        institutionName: student?.Institution?.name ?? "N/A",
        branchName: student?.branch?.name ?? student?.user?.branchName ?? "N/A",
        companyName: visit.application?.companyName ?? "N/A",
        companyAddress: visit.application?.companyAddress ?? "N/A",
        companyContact: visit.application?.companyContact ?? "N/A",
        visitDone,
        visitDate: this.formatToISTDateOnly(visit.visitDate),
        visitType: visit.visitType ?? "N/A",
        visitLocation: visit.visitLocation ?? "N/A",
        visitNumber: visit.visitNumber ?? 0,
        visitStatus: visit.status ?? "N/A",
        titleOfProjectWork: visit.titleOfProjectWork ?? "N/A",
        assistanceRequiredFromInstitute:
          visit.assistanceRequiredFromInstitute ?? "N/A",
        responseFromOrganisation: visit.responseFromOrganisation ?? "N/A",
        remarksOfOrganisationSupervisor:
          visit.remarksOfOrganisationSupervisor ?? "N/A",
        significantChangeInPlan: visit.significantChangeInPlan ?? "N/A",
        observationsAboutStudent: visit.observationsAboutStudent ?? "N/A",
        feedbackSharedWithStudent: visit.feedbackSharedWithStudent ?? "N/A",
      });
    }

    return results;
  }

  // ==================== Institute Report Generators ====================

  /**
   * Generate Institute Summary Report
   * Summary statistics for each institution
   * @param filters - Filter criteria
   * @param pagination - Optional pagination options
   */
  async generateInstituteSummaryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const { take, skip } = this.getPaginationParams(pagination);

    const institutions = await this.prisma.institution.findMany({
      include: {
        _count: {
          select: {
            Student: { where: { user: { active: true } } },
            users: { where: { active: true, role: Role.TEACHER } },
            Branch: true,
          },
        },
        Student: {
          where: { user: { active: true } },
          include: {
            internshipApplications: {
              where: { isActive: true },
              select: { internshipPhase: true },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: "asc" },
    });

    this.warnOnLargeResultSet(institutions.length, "InstituteSummaryReport");

    return institutions.map((inst) => {
      let activeInternships = 0;
      let completedInternships = 0;

      inst.Student.forEach((student) => {
        student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === "ACTIVE") activeInternships++;
          if (app.internshipPhase === "COMPLETED") completedInternships++;
        });
      });

      const totalStudents = inst._count.Student;
      const internshipRate =
        totalStudents > 0
          ? Math.round(
              ((activeInternships + completedInternships) / totalStudents) *
                100,
            )
          : 0;

      return {
        institutionName: inst.name,
        institutionCode: inst.shortName,
        city: inst.city,
        district: inst.district,
        totalStudents,
        totalFaculty: inst._count.users,
        totalBranches: inst._count.Branch,
        activeInternships,
        completedInternships,
        internshipRate,
      };
    });
  }

  /**
   * Generate Institute Comparison Report
   * Compare multiple institutions side by side
   * @param filters - Filter criteria
   * @param pagination - Optional pagination options
   */
  async generateInstituteComparisonReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    // Similar to summary but with comparison metrics
    return this.generateInstituteSummaryReport(filters, pagination);
  }

  /**
   * Generate Branch Wise Summary Report
   * Summary statistics broken down by branch
   * @param filters - Filter criteria (institutionId)
   * @param pagination - Optional pagination options
   */
  async generateBranchWiseSummaryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    const branches = await this.prisma.branch.findMany({
      where,
      include: {
        institution: { select: { name: true } },
        students: {
          where: { user: { active: true } },
          include: {
            internshipApplications: {
              where: { isActive: true },
              select: { internshipPhase: true, status: true },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: "asc" },
    });

    this.warnOnLargeResultSet(branches.length, "BranchWiseSummaryReport");

    return branches.map((branch) => {
      let activeInternships = 0;
      let completedInternships = 0;
      let appliedCount = 0;

      branch.students.forEach((student) => {
        student.internshipApplications.forEach((app) => {
          if (app.internshipPhase === "ACTIVE") activeInternships++;
          if (app.internshipPhase === "COMPLETED") completedInternships++;
          if (["APPLIED", "SUBMITTED"].includes(app.status)) appliedCount++;
        });
      });

      const totalStudents = branch.students.length;
      const internshipRate =
        totalStudents > 0
          ? Math.round(
              ((activeInternships + completedInternships) / totalStudents) *
                100,
            )
          : 0;

      return {
        branchName: branch.name,
        branchCode: branch.code,
        institutionName: branch.institution?.name ?? "N/A",
        totalStudents,
        activeInternships,
        completedInternships,
        appliedCount,
        internshipRate,
      };
    });
  }

  // ==================== Pending Report Generators ====================

  /**
   * Generate Pending Monthly Visits Report
   * Faculty with overdue visits - matches pending-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, mentorId, month, year)
   * @param pagination - Optional pagination options
   */
  async generatePendingMonthlyVisitsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      role: Role.TEACHER,
      active: true,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.mentorId) {
      where.id = filters.mentorId;
    }

    // Build date filter for visits based on month/year
    const visitLogsWhere: Record<string, unknown> = {
      isDeleted: false,
      status: "COMPLETED",
    };
    const now = new Date();
    const filterMonth = filters?.month ? Number(filters.month) : null;
    const filterYear = filters?.year
      ? Number(filters.year)
      : filterMonth
        ? now.getFullYear()
        : null;

    if (filterMonth && filterYear) {
      const startDate = new Date(filterYear, filterMonth - 1, 1);
      const endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);
      visitLogsWhere.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    } else if (filterYear) {
      const startDate = new Date(filterYear, 0, 1);
      const endDate = new Date(filterYear, 11, 31, 23, 59, 59, 999);
      visitLogsWhere.visitDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const mentors = await this.prisma.user.findMany({
      where,
      include: {
        Institution: { select: { name: true } },
        mentorAssignments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                user: {
                  select: { name: true, rollNumber: true, active: true },
                },
                internshipApplications: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    companyName: true,
                    totalExpectedVisits: true,
                    facultyVisitLogs: {
                      where: visitLogsWhere,
                      select: { visitDate: true },
                      orderBy: { visitDate: "desc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { name: "asc" },
    });

    this.warnOnLargeResultSet(mentors.length, "PendingMonthlyVisitsReport");

    const results: any[] = [];

    // Determine the reference date for calculations (either filter date or now)
    let referenceDate = now;
    if (filterMonth && filterYear) {
      // Use end of the specified month as reference
      referenceDate = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);
    }

    mentors.forEach((mentor) => {
      mentor.mentorAssignments.forEach((assignment) => {
        // Only include active students
        if (!assignment.student.user?.active) return;

        assignment.student.internshipApplications.forEach((app) => {
          // When filtering by month/year, calculate visits due based on filtered visits
          const completedVisits = app.facultyVisitLogs.length;
          const visitsDue =
            filterMonth && filterYear
              ? completedVisits === 0
                ? 1
                : 0 // If no visit in the period, 1 visit is due
              : app.totalExpectedVisits - completedVisits;

          if (visitsDue > 0) {
            const lastVisit = app.facultyVisitLogs[0]?.visitDate ?? null;
            const daysSinceLastVisit = lastVisit
              ? Math.floor(
                  (referenceDate.getTime() - new Date(lastVisit).getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;

            results.push({
              mentorName: mentor.name,
              mentorEmail: mentor.email,
              mentorPhone: mentor.phoneNo,
              department: mentor.designation ?? "N/A",
              institutionName: mentor.Institution?.name ?? "N/A",
              studentName: assignment.student.user?.name,
              rollNumber: assignment.student.user?.rollNumber,
              companyName: app.companyName,
              lastVisitDate: this.formatToIST(lastVisit),
              pendingMonth: this.formatReportMonth(
                referenceDate.getMonth() + 1,
                referenceDate.getFullYear(),
              ),
              pendingYear: referenceDate.getFullYear(),
              daysSinceLastVisit,
              visitsDue,
            });
          }
        });
      });
    });

    return results;
  }

  /**
   * Generate Pending Monthly Reports Report
   * Students with overdue monthly reports - matches pending-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, branchId, mentorId, month, year)
   * @param pagination - Optional pagination options
   */
  async generatePendingMonthlyReportsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      user: { active: true },
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            rollNumber: true,
            branchName: true,
            active: true,
          },
        },
        branch: { select: { name: true } },
        Institution: { select: { name: true } },
        internshipApplications: {
          where: { isActive: true },
          select: {
            companyName: true,
            startDate: true,
            endDate: true,
            totalExpectedReports: true,
            submittedReportsCount: true,
            mentor: { select: { id: true, name: true } },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        monthlyReports: {
          select: { submittedAt: true, reportMonth: true, reportYear: true },
          orderBy: { submittedAt: "desc" },
        },
      },
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    this.warnOnLargeResultSet(students.length, "PendingMonthlyReportsReport");

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const monthNames = [
      "",
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

    const results: any[] = [];

    // Determine if we're filtering by specific month/year
    const filterMonth = filters?.month ? Number(filters.month) : null;
    const filterYear = filters?.year
      ? Number(filters.year)
      : filterMonth
        ? currentYear
        : null;

    for (const student of students) {
      const app = student.internshipApplications[0];
      if (!app) continue;

      // Apply mentor filter if specified
      if (filters?.mentorId && app.mentor?.id !== filters.mentorId) continue;

      // Get internship date range
      const startDate = app.startDate ? new Date(app.startDate) : null;
      const endDate = app.endDate ? new Date(app.endDate) : null;

      if (!startDate) continue;

      // Create a set of submitted report months for quick lookup
      const submittedMonths = new Set(
        student.monthlyReports.map((r) => `${r.reportYear}-${r.reportMonth}`),
      );

      // Get the last submitted report
      const lastReport = student.monthlyReports[0];

      // If filtering by specific month/year, check if that month's report is pending
      if (filterMonth && filterYear) {
        const filterKey = `${filterYear}-${filterMonth}`;

        // Check if student should have submitted for this month
        // (internship was active during this month)
        const filterMonthStart = new Date(filterYear, filterMonth - 1, 1);
        const filterMonthEnd = new Date(filterYear, filterMonth, 0);

        // Skip if internship hadn't started yet
        if (startDate > filterMonthEnd) continue;

        // Skip if internship ended before this month
        if (endDate && endDate < filterMonthStart) continue;

        // Skip if report already submitted for this month
        if (submittedMonths.has(filterKey)) continue;

        // Calculate reports expected up to and including the filtered month
        // Count months from internship start to filter month
        const internshipStartMonth = startDate.getMonth() + 1;
        const internshipStartYear = startDate.getFullYear();

        let reportsExpectedUpToFilter = 0;
        let tempYear = internshipStartYear;
        let tempMonth = internshipStartMonth;

        while (
          tempYear < filterYear ||
          (tempYear === filterYear && tempMonth <= filterMonth)
        ) {
          // Check if internship was active in this month
          const monthStart = new Date(tempYear, tempMonth - 1, 1);
          if (!endDate || endDate >= monthStart) {
            reportsExpectedUpToFilter++;
          }
          tempMonth++;
          if (tempMonth > 12) {
            tempMonth = 1;
            tempYear++;
          }
        }

        // Calculate reports submitted up to and including the filtered month
        const reportsSubmittedUpToFilter = student.monthlyReports.filter(
          (r) => {
            if (r.reportYear < filterYear) return true;
            if (r.reportYear === filterYear && r.reportMonth <= filterMonth)
              return true;
            return false;
          },
        ).length;

        // Calculate days past due
        const dueDate = new Date(filterYear, filterMonth, 5); // 5th of the next month
        const daysPastDue = Math.max(
          0,
          Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );

        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          branchName: student.branch?.name ?? student.user?.branchName,
          mentorName: app.mentor?.name ?? "N/A",
          companyName: app.companyName,
          pendingMonth: this.formatReportMonth(filterMonth, filterYear),
          pendingYear: filterYear,
          daysPastDue,
          lastSubmittedReport: lastReport?.submittedAt ?? null,
          reportsSubmitted: reportsSubmittedUpToFilter,
          reportsExpected: reportsExpectedUpToFilter,
        });
      } else {
        // No month/year filter - show first pending month for each student
        if (app.totalExpectedReports <= app.submittedReportsCount) continue;

        // Calculate pending month (first month without a report)
        let pendingMonth = currentMonth;
        let pendingYear = currentYear;

        if (lastReport) {
          // Next month after last report
          pendingMonth = lastReport.reportMonth + 1;
          pendingYear = lastReport.reportYear;
          if (pendingMonth > 12) {
            pendingMonth = 1;
            pendingYear++;
          }
        } else {
          // Start from internship start date
          pendingMonth = startDate.getMonth() + 1;
          pendingYear = startDate.getFullYear();
        }

        // Calculate days past due (assuming reports due by 5th of following month)
        const dueDate = new Date(pendingYear, pendingMonth, 5);
        const daysPastDue = Math.max(
          0,
          Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );

        results.push({
          studentName: student.user?.name,
          rollNumber: student.user?.rollNumber,
          branchName: student.branch?.name ?? student.user?.branchName,
          mentorName: app.mentor?.name ?? "N/A",
          companyName: app.companyName,
          pendingMonth: this.formatReportMonth(pendingMonth, pendingYear),
          pendingYear,
          daysPastDue,
          lastSubmittedReport: lastReport?.submittedAt ?? null,
          reportsSubmitted: app.submittedReportsCount,
          reportsExpected: app.totalExpectedReports,
        });
      }
    }

    return results;
  }

  /**
   * Generate Pending Joining Letters Report
   * Students who haven't submitted joining letter - matches pending-reports.definition.ts columns
   * @param filters - Filter criteria (institutionId, branchId, mentorId)
   * @param pagination - Optional pagination options
   */
  async generatePendingJoiningLettersReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isActive: true,
      joiningLetterUrl: null, // No joining letter submitted
    };
    const { take, skip } = this.getPaginationParams(pagination);

    // Build student filter
    const studentFilter: Record<string, unknown> = {
      user: { active: true },
    };
    if (filters?.institutionId) {
      studentFilter.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentFilter.branchId = filters.branchId;
    }

    where.student = studentFilter;

    // Apply mentor filter if specified
    if (filters?.mentorId) {
      where.mentorId = filters.mentorId;
    }

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          select: {
            user: {
              select: {
                name: true,
                email: true,
                phoneNo: true,
                rollNumber: true,
                branchName: true,
                active: true,
              },
            },
            branch: { select: { name: true } },
            Institution: { select: { name: true } },
          },
        },
        mentor: { select: { name: true } },
      },
      take,
      skip,
      orderBy: { startDate: "desc" },
    });

    this.warnOnLargeResultSet(
      applications.length,
      "PendingJoiningLettersReport",
    );

    const now = new Date();

    const results = applications.map((app) => {
      const startDate = app.startDate ?? app.joiningDate;
      const daysSinceStart = startDate
        ? Math.floor(
            (now.getTime() - new Date(startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      return {
        studentName: app.student.user?.name,
        rollNumber: app.student.user?.rollNumber,
        email: app.student.user?.email,
        phoneNumber: app.student.user?.phoneNo,
        branchName: app.student.branch?.name ?? app.student.user?.branchName,
        mentorName: app.mentor?.name ?? "N/A",
        companyName: app.companyName,
        internshipStartDate: this.formatToISTDateOnly(startDate),
        daysSinceStart,
        institutionName: app.student.Institution?.name ?? "N/A",
      };
    });

    return results;
  }

  // ==================== Industry Report Generators ====================

  // Normalization removed - now handled at database level via seed script

  /**
   * Generate Industry-wise Student Distribution & Stipend Analysis Report
   * Groups students by company names (already normalized at database level)
   * @param filters - Filter criteria (institutionId, branchId, minStudents, status, startDateRange)
   * @param pagination - Optional pagination options
   */
  async generateIndustryWiseStudentsStipendReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    // Only include applications with company name
    where.companyName = { not: null };

    // Handle institution filter
    const studentWhere: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }

    // Default to active students with active user accounts
    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentWhere.user = { active: isActiveValue };
    } else {
      studentWhere.user = { active: true };
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    // Handle status filter - use internshipPhase for accurate active status
    if (filters?.status && filters.status !== "ALL") {
      if (filters.status === "ACTIVE") {
        // Active internships: use internshipPhase for accuracy
        where.internshipPhase = "ACTIVE";
        where.isActive = true; // Also ensure application is active
      } else if (filters.status === "COMPLETED") {
        where.internshipPhase = "COMPLETED";
      }
    } else {
      // By default, only include active applications (exclude terminated/withdrawn)
      where.isActive = true;
    }

    // Handle internship start date range filter
    let startDateStartValue = filters?.startDateStart;
    let startDateEndValue = filters?.startDateEnd;

    if (
      !startDateStartValue &&
      !startDateEndValue &&
      Array.isArray(filters?.startDateRange) &&
      filters.startDateRange.length === 2
    ) {
      startDateStartValue = filters.startDateRange[0];
      startDateEndValue = filters.startDateRange[1];
    }

    if (startDateStartValue || startDateEndValue) {
      const startDateFilter: Record<string, unknown> = {};
      if (startDateStartValue) {
        startDateFilter.gte = new Date(startDateStartValue);
      }
      if (startDateEndValue) {
        const endDate = new Date(startDateEndValue);
        endDate.setUTCHours(23, 59, 59, 999);
        startDateFilter.lte = endDate;
      }
      where.startDate = startDateFilter;
    }

    this.logger.log(
      `[IndustryWiseReport] Fetching applications with filters: ${JSON.stringify(where)}`,
    );

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        companyAddress: true,
        stipend: true,
        status: true,
        internshipPhase: true,
        isActive: true,
        student: {
          select: {
            id: true,
            user: {
              select: {
                active: true,
              },
            },
          },
        },
      },
      take: take * 10, // Fetch more records since we'll be grouping
      skip,
    });

    this.logger.log(
      `[IndustryWiseReport] Fetched ${applications.length} applications`,
    );

    // Group by company name (already normalized at database level)
    const companyMap = new Map<
      string,
      {
        companyName: string;
        addressCounts: Map<string, number>;
        students: Set<string>;
        stipends: number[];
        activeStudents: number;
        completedStudents: number;
      }
    >();

    applications.forEach((app) => {
      if (!app.companyName) return;

      const companyName = app.companyName.trim();
      // Normalize key: lowercase, collapse whitespace, strip punctuation for dedup
      const companyKey = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          companyName,
          addressCounts: new Map(),
          students: new Set(),
          stipends: [],
          activeStudents: 0,
          completedStudents: 0,
        });
      }
      const companyData = companyMap.get(companyKey)!;
      if (app.companyAddress) {
        const address = app.companyAddress.trim();
        if (address) {
          companyData.addressCounts.set(
            address,
            (companyData.addressCounts.get(address) || 0) + 1,
          );
        }
      }
      companyData.students.add(app.student.id);

      // Parse stipend (handle string format like "10000" or "10,000" or "₹10000")
      const stipendStr = (app.stipend ?? "0")
        .toString()
        .replace(/[₹,]/g, "")
        .trim();
      const stipendNum = parseFloat(stipendStr) || 0;
      if (stipendNum > 0) {
        companyData.stipends.push(stipendNum);
      }

      // Count by internshipPhase for accurate active/completed status
      // Only count if student's user account is also active
      if (app.student?.user?.active !== false) {
        if (app.internshipPhase === "ACTIVE" && app.isActive) {
          companyData.activeStudents++;
        } else if (app.internshipPhase === "COMPLETED") {
          companyData.completedStudents++;
        }
      }
    });

    this.logger.log(
      `[IndustryWiseReport] Grouped into ${companyMap.size} unique companies`,
    );

    // Convert to array and calculate aggregates
    let results = Array.from(companyMap.values()).map((data) => {
      const totalStudents = data.students.size;
      const totalStipend = data.stipends.reduce((sum, s) => sum + s, 0);
      const avgStipend =
        data.stipends.length > 0 ? totalStipend / data.stipends.length : 0;
      const minStipend =
        data.stipends.length > 0 ? Math.min(...data.stipends) : 0;
      const maxStipend =
        data.stipends.length > 0 ? Math.max(...data.stipends) : 0;
      const companyAddress =
        data.addressCounts.size > 0
          ? Array.from(data.addressCounts.entries()).sort(
              (a, b) => b[1] - a[1],
            )[0][0]
          : "";

      return {
        companyName: data.companyName,
        companyAddress,
        totalStudents,
        totalStipend: Math.round(totalStipend),
        avgStipend: Math.round(avgStipend),
        minStipend: Math.round(minStipend),
        maxStipend: Math.round(maxStipend),
        activeStudents: data.activeStudents,
        completedStudents: data.completedStudents,
      };
    });

    // Apply minStudents filter if specified
    if (filters?.minStudents) {
      const minStudents = parseInt(filters.minStudents);
      if (!isNaN(minStudents)) {
        results = results.filter((r) => r.totalStudents >= minStudents);
      }
    }

    // Sort by total students descending
    results.sort((a, b) => b.totalStudents - a.totalStudents);

    this.warnOnLargeResultSet(
      results.length,
      "IndustryWiseStudentsStipendReport",
    );

    this.logger.log(
      `[IndustryWiseReport] Returning ${results.length} industry records`,
    );

    return results;
  }

  /**
   * Generate Top 3 Institutes per Industry Report
   * For each company/industry, shows the top 3 institutes ranked by student count
   * with total students, average stipend, and active/completed breakdown.
   */
  async generateTopInstitutesPerIndustryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {};
    const { take, skip } = this.getPaginationParams(pagination);

    where.companyName = { not: null };

    const studentWhere: Record<string, unknown> = {};
    if (filters?.institutionId) {
      studentWhere.institutionId = filters.institutionId;
    }
    if (filters?.branchId) {
      studentWhere.branchId = filters.branchId;
    }

    const isActiveValue = this.parseBooleanLike(filters?.isActive);
    if (isActiveValue !== undefined) {
      studentWhere.user = { active: isActiveValue };
    } else {
      studentWhere.user = { active: true };
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    if (filters?.status && filters.status !== "ALL") {
      if (filters.status === "ACTIVE") {
        where.internshipPhase = "ACTIVE";
        where.isActive = true;
      } else if (filters.status === "COMPLETED") {
        where.internshipPhase = "COMPLETED";
      }
    } else {
      where.isActive = true;
    }

    let startDateStartValue = filters?.startDateStart;
    let startDateEndValue = filters?.startDateEnd;

    if (
      !startDateStartValue &&
      !startDateEndValue &&
      Array.isArray(filters?.startDateRange) &&
      filters.startDateRange.length === 2
    ) {
      startDateStartValue = filters.startDateRange[0];
      startDateEndValue = filters.startDateRange[1];
    }

    if (startDateStartValue || startDateEndValue) {
      const startDateFilter: Record<string, unknown> = {};
      if (startDateStartValue) {
        startDateFilter.gte = new Date(startDateStartValue);
      }
      if (startDateEndValue) {
        const endDate = new Date(startDateEndValue);
        endDate.setUTCHours(23, 59, 59, 999);
        startDateFilter.lte = endDate;
      }
      where.startDate = startDateFilter;
    }

    this.logger.log(
      `[TopInstitutesPerIndustry] Fetching applications with filters: ${JSON.stringify(where)}`,
    );

    const applications = await this.prisma.internshipApplication.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        companyAddress: true,
        stipend: true,
        internshipPhase: true,
        isActive: true,
        student: {
          select: {
            id: true,
            institutionId: true,
            Institution: {
              select: {
                name: true,
              },
            },
            user: {
              select: {
                active: true,
              },
            },
          },
        },
      },
      take: take * 20,
      skip,
    });

    this.logger.log(
      `[TopInstitutesPerIndustry] Fetched ${applications.length} applications`,
    );

    // Group by company -> institute
    const companyMap = new Map<
      string,
      {
        companyName: string;
        companyAddress: string;
        companyTotalStudents: Set<string>;
        institutes: Map<
          string,
          {
            instituteName: string;
            students: Set<string>;
            stipends: number[];
            activeStudents: number;
            completedStudents: number;
          }
        >;
      }
    >();

    applications.forEach((app) => {
      if (!app.companyName) return;

      const companyName = app.companyName.trim();
      // Normalize key: lowercase, collapse whitespace, strip punctuation for dedup
      const companyKey = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const instituteName = app.student?.Institution?.name ?? "Unknown";
      const instituteKey = app.student?.institutionId ?? "unknown";

      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          companyName,
          companyAddress: app.companyAddress ?? "",
          companyTotalStudents: new Set(),
          institutes: new Map(),
        });
      }

      const companyData = companyMap.get(companyKey)!;
      companyData.companyTotalStudents.add(app.student.id);

      if (!companyData.institutes.has(instituteKey)) {
        companyData.institutes.set(instituteKey, {
          instituteName,
          students: new Set(),
          stipends: [],
          activeStudents: 0,
          completedStudents: 0,
        });
      }

      const instData = companyData.institutes.get(instituteKey)!;
      instData.students.add(app.student.id);

      const stipendStr = (app.stipend ?? "0")
        .toString()
        .replace(/[₹,]/g, "")
        .trim();
      const stipendNum = parseFloat(stipendStr) || 0;
      if (stipendNum > 0) {
        instData.stipends.push(stipendNum);
      }

      if (app.student?.user?.active !== false) {
        if (app.internshipPhase === "ACTIVE" && app.isActive) {
          instData.activeStudents++;
        } else if (app.internshipPhase === "COMPLETED") {
          instData.completedStudents++;
        }
      }
    });

    this.logger.log(
      `[TopInstitutesPerIndustry] Grouped into ${companyMap.size} companies`,
    );

    // Build flat result: for each company, take top 3 institutes by student count
    const results: any[] = [];

    const companies = Array.from(companyMap.values()).sort(
      (a, b) => b.companyTotalStudents.size - a.companyTotalStudents.size,
    );

    for (const company of companies) {
      const institutesList = Array.from(company.institutes.values())
        .map((inst) => ({
          instituteName: inst.instituteName,
          totalStudents: inst.students.size,
          totalStipend: Math.round(inst.stipends.reduce((s, v) => s + v, 0)),
          avgStipend:
            inst.stipends.length > 0
              ? Math.round(
                  inst.stipends.reduce((s, v) => s + v, 0) /
                    inst.stipends.length,
                )
              : 0,
          activeStudents: inst.activeStudents,
          completedStudents: inst.completedStudents,
        }))
        .sort((a, b) => b.totalStudents - a.totalStudents)
        .slice(0, 3);

      institutesList.forEach((inst, index) => {
        results.push({
          companyName: company.companyName,
          companyAddress: company.companyAddress,
          companyTotalStudents: company.companyTotalStudents.size,
          instituteRank: index + 1,
          instituteName: inst.instituteName,
          totalStudents: inst.totalStudents,
          avgStipend: inst.avgStipend,
          totalStipend: inst.totalStipend,
          activeStudents: inst.activeStudents,
          completedStudents: inst.completedStudents,
        });
      });
    }

    this.warnOnLargeResultSet(results.length, "TopInstitutesPerIndustryReport");

    this.logger.log(
      `[TopInstitutesPerIndustry] Returning ${results.length} records`,
    );

    return results;
  }

  // ==================== Principal Report Generators ====================

  /**
   * Generate Principal Visit Logs Report
   * Detailed report of all principal visit logs with student feedback
   */
  async generatePrincipalVisitLogsReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isDeleted: false,
    };
    const { take, skip } = this.getPaginationParams(pagination);

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    if (filters?.principalId) {
      where.principalId = filters.principalId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.visitType) {
      where.visitType = filters.visitType;
    }

    if (filters?.followUpRequired !== undefined) {
      const followUpRequired = this.parseBooleanLike(filters.followUpRequired);
      if (followUpRequired !== undefined) {
        where.followUpRequired = followUpRequired;
      }
    }

    // Handle date range filter
    if (filters?.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      if (startDate || endDate) {
        where.visitDate = {};
        if (startDate) {
          (where.visitDate as any).gte = new Date(startDate);
        }
        if (endDate) {
          (where.visitDate as any).lte = new Date(endDate);
        }
      }
    }

    const visitLogs = await this.prisma.principalFeedback.findMany({
      where,
      include: {
        principal: {
          select: { id: true, name: true, email: true },
        },
        institution: {
          select: { id: true, name: true },
        },
        students: {
          include: {
            student: {
              select: {
                id: true,
                user: { select: { name: true, rollNumber: true } },
                internshipApplications: {
                  where: { isActive: true },
                  select: { companyName: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      take,
      skip,
      orderBy: { visitDate: "desc" },
    });

    this.warnOnLargeResultSet(visitLogs.length, "PrincipalVisitLogsReport");

    const visitTypeMap: Record<string, string> = {
      PHYSICAL: "Physical",
      VIRTUAL: "Virtual",
      TELEPHONIC: "Telephonic",
      PHONE: "Telephonic",
    };

    const statusMap: Record<string, string> = {
      DRAFT: "Draft",
      SCHEDULED: "Scheduled",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };

    return visitLogs.map((log) => {
      const companyNames = log.students
        .map((s) => s.student?.internshipApplications?.[0]?.companyName || "-")
        .filter((name, index, arr) => arr.indexOf(name) === index)
        .join(", ");

      // Build attendance status
      const presentCount = log.students.filter(
        (s) => s.isPresent !== false,
      ).length;
      const absentCount = log.students.filter(
        (s) => s.isPresent === false,
      ).length;
      const attendanceStatus = `${presentCount} Present, ${absentCount} Absent`;

      return {
        visitDate: this.formatToISTDateOnly(log.visitDate),
        institutionName: log.institution?.name ?? "N/A",
        principalName: log.principal?.name ?? "N/A",
        companyNames,
        visitType: visitTypeMap[log.visitType] || log.visitType,
        visitLocation: log.visitLocation ?? "N/A",
        status: statusMap[log.status] || log.status,
        responseFromOrganisation: log.responseFromOrganisation ?? "",
        observationsAboutIndustry: log.observationsAboutIndustry ?? "",
        followUpRequired: log.followUpRequired,
        nextVisitDate: log.nextVisitDate,
        attendanceStatus,
        createdAt: log.createdAt,
      };
    });
  }

  /**
   * Generate Principal Visit Summary Report
   * Summary statistics of principal visits by institution
   */
  async generatePrincipalVisitSummaryReport(
    filters: any,
    pagination?: ReportPaginationOptions,
  ): Promise<any[]> {
    const where: Record<string, unknown> = {
      isDeleted: false,
    };

    if (filters?.institutionId) {
      where.institutionId = filters.institutionId;
    }

    // Handle date range filter
    if (filters?.dateRange) {
      const [startDate, endDate] = filters.dateRange;
      if (startDate || endDate) {
        where.visitDate = {};
        if (startDate) {
          (where.visitDate as any).gte = new Date(startDate);
        }
        if (endDate) {
          (where.visitDate as any).lte = new Date(endDate);
        }
      }
    }

    const visitLogs = await this.prisma.principalFeedback.findMany({
      where,
      include: {
        principal: {
          select: { id: true, name: true },
        },
        institution: {
          select: { id: true, name: true },
        },
        students: {
          select: {
            studentId: true,
            student: {
              select: {
                internshipApplications: {
                  where: { isActive: true },
                  select: { companyName: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { visitDate: "desc" },
    });

    // Group by institution and principal
    const summaryMap = new Map<
      string,
      {
        institutionId: string;
        institutionName: string;
        principalId: string;
        principalName: string;
        totalVisits: number;
        physicalVisits: number;
        virtualVisits: number;
        telephonicVisits: number;
        completedVisits: number;
        draftVisits: number;
        ratings: number[];
        studentsVisited: Set<string>;
        followUpsRequired: number;
        lastVisitDate: Date | null;
      }
    >();

    visitLogs.forEach((log) => {
      const key = `${log.institutionId}-${log.principalId}`;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          institutionId: log.institutionId ?? "",
          institutionName: log.institution?.name ?? "N/A",
          principalId: log.principalId,
          principalName: log.principal?.name ?? "N/A",
          totalVisits: 0,
          physicalVisits: 0,
          virtualVisits: 0,
          telephonicVisits: 0,
          completedVisits: 0,
          draftVisits: 0,
          ratings: [],
          studentsVisited: new Set(),
          followUpsRequired: 0,
          lastVisitDate: null,
        });
      }

      const summary = summaryMap.get(key)!;
      summary.totalVisits++;

      // Count by visit type
      if (log.visitType === "PHYSICAL") summary.physicalVisits++;
      else if (log.visitType === "VIRTUAL") summary.virtualVisits++;
      else if (log.visitType === "TELEPHONIC" || log.visitType === "PHONE")
        summary.telephonicVisits++;

      // Count by status
      if (log.status === "COMPLETED") summary.completedVisits++;
      else if (log.status === "DRAFT") summary.draftVisits++;

      // Track ratings
      if (log.overallSatisfactionRating) {
        summary.ratings.push(log.overallSatisfactionRating);
      }

      // Track unique students
      log.students.forEach((s) => summary.studentsVisited.add(s.studentId));

      // Count follow-ups
      if (log.followUpRequired) summary.followUpsRequired++;

      // Track last visit date
      if (
        log.visitDate &&
        (!summary.lastVisitDate || log.visitDate > summary.lastVisitDate)
      ) {
        summary.lastVisitDate = log.visitDate;
      }
    });

    const results = Array.from(summaryMap.values()).map((summary) => {
      return {
        institutionName: summary.institutionName,
        principalName: summary.principalName,
        totalVisits: summary.totalVisits,
        physicalVisits: summary.physicalVisits,
        virtualVisits: summary.virtualVisits,
        telephonicVisits: summary.telephonicVisits,
        completedVisitLogs: summary.completedVisits,
        draftVisits: summary.draftVisits,
        avgSatisfactionRating:
          summary.ratings.length > 0
            ? Math.round(
                (summary.ratings.reduce((a, b) => a + b, 0) /
                  summary.ratings.length) *
                  10,
              ) / 10
            : 0,
        studentsVisited: summary.studentsVisited.size,
        followUpsRequired: summary.followUpsRequired,
        lastVisitDate: summary.lastVisitDate,
      };
    });

    // Sort by total visits descending
    results.sort((a, b) => b.totalVisits - a.totalVisits);

    this.warnOnLargeResultSet(results.length, "PrincipalVisitSummaryReport");

    return results;
  }
}
