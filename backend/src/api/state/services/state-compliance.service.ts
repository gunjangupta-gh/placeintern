import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { FileStorageService } from '../../../infrastructure/file-storage/file-storage.service';
import { ApplicationStatus } from '../../../generated/prisma/client';
import { add } from 'winston';

export interface MonthlyComplianceParams {
  month: number;
  year: number;
  page?: number;
  limit?: number;
  search?: string;
}

export interface InstitutionComplianceParams {
  institutionId: string;
  month: number;
  year: number;
}

@Injectable()
export class StateComplianceService {
  private readonly logger = new Logger(StateComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly fileStorage: FileStorageService,
  ) {}

  /**
   * Normalize file keys - extract MinIO object key from full URLs.
   * DB may store full URLs (e.g. https://files.sukeerat.com/cms-uploads/path/file.ext)
   * but getSignedUrl needs just the object key (path/file.ext).
   */
  private normalizeFileKey(fileKey: string): string {
    if (!fileKey) return fileKey;
    const trimmed = fileKey.trim();

    // If it's a full URL, extract just the object key
    try {
      const url = new URL(trimmed);
      // Path: /bucket-name/actual/key/path/file.ext
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 1) {
        // Skip bucket name (first segment), return the rest as the key
        return pathParts.slice(1).join('/');
      }
      if (pathParts.length === 1) {
        return pathParts[0];
      }
    } catch {
      // Not a URL - treat as raw key, continue below
    }

    return trimmed;
  }

  private parseVisitLogFiles(fileValue?: string | null): string[] {
    if (!fileValue) return [];
    const trimmed = fileValue.trim();
    if (!trimmed) return [];

    try {
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      }
    } catch {
      // fallthrough to comma parsing
    }

    if (trimmed.includes(',')) {
      return trimmed.split(',').map(v => v.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  /**
   * Get institution-wise monthly compliance breakdown
   * Shows expected vs actual reports/visits per institution for a selected month
  * Uses monthly inclusion rules from monthly-cycle.util for accurate calculations
   */
  async getMonthlyComplianceByInstitution(params: MonthlyComplianceParams) {
    const { month, year, page = 1, limit = 50, search } = params;
    const cacheKey = `state:compliance:monthly:${month}-${year}:${page}:${limit}:${search || ''}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get date boundaries for the month
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        // Get all active institutions with search filter
        const whereClause: any = { isActive: true };
        if (search) {
          whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [institutions, totalCount] = await Promise.all([
          this.prisma.institution.findMany({
            where: whereClause,
            select: {
              id: true,
              name: true,
              code: true,
              city: true,
              shortName: true,
            },
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.institution.count({ where: whereClause }),
        ]);

        // For each institution, calculate compliance data
        const institutionCompliance = await Promise.all(
          institutions.map(async (institution) => {
            return this.calculateInstitutionMonthlyCompliance(
              institution.id,
              month,
              year,
              startOfMonth,
              endOfMonth,
              institution,
            );
          }),
        );

        // Calculate state-wide totals
        const stateWideTotals = institutionCompliance.reduce(
          (acc, inst) => ({
            totalExpectedReports: acc.totalExpectedReports + inst.expectedReports,
            totalSubmittedReports: acc.totalSubmittedReports + inst.submittedReports,
            totalExpectedVisits: acc.totalExpectedVisits + inst.expectedVisits,
            totalCompletedVisits: acc.totalCompletedVisits + inst.completedVisits,
            totalStudentsInTraining: acc.totalStudentsInTraining + inst.studentsInTraining,
          }),
          {
            totalExpectedReports: 0,
            totalSubmittedReports: 0,
            totalExpectedVisits: 0,
            totalCompletedVisits: 0,
            totalStudentsInTraining: 0,
          },
        );

        // Calculate compliance rates
        const reportComplianceRate = stateWideTotals.totalExpectedReports > 0
          ? Math.round((stateWideTotals.totalSubmittedReports / stateWideTotals.totalExpectedReports) * 100)
          : null;
        const visitComplianceRate = stateWideTotals.totalExpectedVisits > 0
          ? Math.round((stateWideTotals.totalCompletedVisits / stateWideTotals.totalExpectedVisits) * 100)
          : null;

        // Calculate overall compliance rate (average of report and visit rates)
        const validRates = [reportComplianceRate, visitComplianceRate].filter(r => r !== null) as number[];
        const overallComplianceRate = validRates.length > 0
          ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length)
          : null;

        return {
          month,
          year,
          monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
          stateWideSummary: {
            ...stateWideTotals,
            reportComplianceRate,
            visitComplianceRate,
            overallComplianceRate,
          },
          institutions: institutionCompliance,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit),
          },
        };
      },
      { ttl: 300, tags: ['state', 'compliance', 'monthly'] }, // 5 minute cache
    );
  }

  /**
   * Calculate compliance for a single institution for a specific month
   */
  private async calculateInstitutionMonthlyCompliance(
    institutionId: string,
    month: number,
    year: number,
    startOfMonth: Date,
    endOfMonth: Date,
    institutionData?: { id: string; name: string; code: string; city: string; shortName: string },
  ) {
    // Get internships that are active during this month
    // Must have startDate before endOfMonth and (endDate after startOfMonth OR no endDate)
    const internshipsInTraining = await this.prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        isActive: true,
        status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
        startDate: { not: null, lte: endOfMonth },
        student: {
          user: { active: true },
          institutionId: institutionId,
        },
        OR: [
          { endDate: { gte: startOfMonth } },
          { endDate: null },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        studentId: true,
      },
    });

    // Use all active internships in the month (legacy behavior - no monthly-cycle filtering)
    const expectedReports = internshipsInTraining.length;
    const expectedVisits = internshipsInTraining.length;
    const qualifyingInternshipIds = internshipsInTraining.map(i => i.id);

    // Get actual submitted reports for this month
    const submittedReports = await this.prisma.monthlyReport.count({
      where: {
        isDeleted: false,
        reportMonth: month,
        reportYear: year,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] },
        applicationId: { in: qualifyingInternshipIds.length > 0 ? qualifyingInternshipIds : ['none'] },
      },
    });

   // Get actual completed visits for this month (only COMPLETED, consistent with dashboard)
    const completedVisits = await this.prisma.facultyVisitLog.count({
      where: {
        isDeleted: false,
        status: { in: [ 'COMPLETED'] },
        applicationId: { in: qualifyingInternshipIds.length > 0 ? qualifyingInternshipIds : ['none'] },
        OR: [
          { visitMonth: month, visitYear: year },
          {
            visitDate: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        ],
      },
    });

    // Calculate compliance rates
    const reportComplianceRate = expectedReports > 0
      ? Math.round((submittedReports / expectedReports) * 100)
      : null;
    const visitComplianceRate = expectedVisits > 0
      ? Math.round((completedVisits / expectedVisits) * 100)
      : null;

    // Overall compliance (average of report and visit rates)
    const validRates = [reportComplianceRate, visitComplianceRate].filter(r => r !== null) as number[];
    const overallCompliance = validRates.length > 0
      ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length)
      : null;

    return {
      institutionId,
      institutionName: institutionData?.name || '',
      institutionCode: institutionData?.code || '',
      city: institutionData?.city || '',
      shortName: institutionData?.shortName || '',
      studentsInTraining: qualifyingInternshipIds.length,
      expectedReports,
      submittedReports,
      missingReports: Math.max(0, expectedReports - submittedReports),
      reportComplianceRate,
      expectedVisits,
      completedVisits,
      missingVisits: Math.max(0, expectedVisits - completedVisits),
      visitComplianceRate,
      overallCompliance,
    };
  }

  /**
   * Get detailed compliance data for a single institution
   * Includes student-level breakdown with their report/visit status
   */
  async getInstitutionComplianceDetails(params: InstitutionComplianceParams) {
    const { institutionId, month, year } = params;
    const cacheKey = `state:compliance:institution:${institutionId}:${month}-${year}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        // Get institution details
        const institution = await this.prisma.institution.findUnique({
          where: { id: institutionId },
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            shortName: true,
            contactEmail: true,
            contactPhone: true,
            address: true,
          },
        });

        if (!institution) {
          return { error: 'Institution not found' };
        }

        // Get all internships active during this month with student details
        const internshipsWithStudents = await this.prisma.internshipApplication.findMany({
          where: {
            isSelfIdentified: true,
            isActive: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
            startDate: { not: null, lte: endOfMonth },
            student: {
              user: { active: true },
              institutionId: institutionId,
            },
            OR: [
              { endDate: { gte: startOfMonth } },
              { endDate: null },
            ],
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            companyName: true,
            studentId: true,
            student: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                    rollNumber: true,
                    email: true,
                  },
                },
                branch: {
                  select: {
                    name: true,
                    shortName: true,
                  },
                },
              },
            },
            // Get reports for this month
            monthlyReports: {
              where: {
                isDeleted: false,
                reportMonth: month,
                reportYear: year,
              },
              select: {
                id: true,
                status: true,
                submittedAt: true,
              },
            },
            // Get visits for this month
            facultyVisitLogs: {
              where: {
                isDeleted: false,
                OR: [
                  { visitMonth: month, visitYear: year },
                  {
                    visitDate: {
                      gte: startOfMonth,
                      lte: endOfMonth,
                    },
                  },
                ],
              },
              select: {
                id: true,
                status: true,
                visitDate: true,
                visitType: true,
              },
            },
          },
          orderBy: {
            student: {
              user: {
                name: 'asc',
              },
            },
          },
        });

        // Process student-level data
        const students: any[] = [];
        let totalExpectedReports = 0;
        let totalSubmittedReports = 0;
        let totalExpectedVisits = 0;
        let totalCompletedVisits = 0;

        // Track visit type counts
        const visitTypeCounts = { PHYSICAL: 0, VIRTUAL: 0, TELEPHONIC: 0 };

        for (const internship of internshipsWithStudents) {
          if (!internship.startDate) continue;

          // Check report status
          // Consider SUBMITTED, UNDER_REVIEW, or APPROVED as "submitted"
          const report = internship.monthlyReports[0];
          const reportStatus = report
            ? ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(report.status)
              ? 'submitted'
              : 'pending'
            : 'not_submitted';

          // Check visit status
        // Check visit status (only COMPLETED visits, consistent with dashboard)
          const visit = internship.facultyVisitLogs.find(v => v.status === 'COMPLETED');
          const visitStatus = visit ? 'completed' : 'pending';

          // Count visit types from all qualifying visits
          for (const v of internship.facultyVisitLogs) {
         if (v.status === 'COMPLETED' && v.visitType) {
              if (v.visitType in visitTypeCounts) {
                visitTypeCounts[v.visitType]++;
              }
            }
          }

          // Update totals
          totalExpectedReports++;
          totalExpectedVisits++;
          if (reportStatus === 'submitted') totalSubmittedReports++;
          if (visitStatus === 'completed') totalCompletedVisits++;

          students.push({
            studentId: internship.student.id,
            studentName: internship.student.user.name,
            rollNumber: internship.student.user.rollNumber,
            email: internship.student.user.email,
            branch: internship.student.branch?.shortName || internship.student.branch?.name || 'N/A',
            companyName: internship.companyName || 'N/A',
            internshipId: internship.id,
            internshipPeriod: {
              startDate: internship.startDate,
              endDate: internship.endDate,
            },
            reportStatus,
            reportSubmittedAt: report?.submittedAt || null,
            visitStatus,
            visitDate: visit?.visitDate || null,
          });
        }

        // Calculate summary metrics
        const reportComplianceRate = totalExpectedReports > 0
          ? Math.round((totalSubmittedReports / totalExpectedReports) * 100)
          : null;
        const visitComplianceRate = totalExpectedVisits > 0
          ? Math.round((totalCompletedVisits / totalExpectedVisits) * 100)
          : null;
        const validRates = [reportComplianceRate, visitComplianceRate].filter(r => r !== null) as number[];
        const overallCompliance = validRates.length > 0
          ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length)
          : null;

        return {
          month,
          year,
          monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
          institution: {
            id: institution.id,
            name: institution.name,
            code: institution.code,
            city: institution.city,
            shortName: institution.shortName,
            contactEmail: institution.contactEmail,
            contactPhone: institution.contactPhone,
            address: institution.address,
          },
          summary: {
            studentsInTraining: students.length,
            expectedReports: totalExpectedReports,
            submittedReports: totalSubmittedReports,
            missingReports: Math.max(0, totalExpectedReports - totalSubmittedReports),
            reportComplianceRate,
            expectedVisits: totalExpectedVisits,
            completedVisits: totalCompletedVisits,
            missingVisits: Math.max(0, totalExpectedVisits - totalCompletedVisits),
            visitComplianceRate,
            overallCompliance,
          },
          students,
          // Group students by status for quick filtering
          statusBreakdown: {
            reports: {
              submitted: students.filter(s => s.reportStatus === 'submitted').length,
              pending: students.filter(s => s.reportStatus === 'pending').length,
              notSubmitted: students.filter(s => s.reportStatus === 'not_submitted').length,
            },
            visits: {
              completed: students.filter(s => s.visitStatus === 'completed').length,
              pending: students.filter(s => s.visitStatus === 'pending').length,
            },
          },
          // Visit type breakdown: PHYSICAL = in-person, VIRTUAL + TELEPHONIC = online
          visitsByType: {
            physical: visitTypeCounts.PHYSICAL,
            virtual: visitTypeCounts.VIRTUAL,
            telephonic: visitTypeCounts.TELEPHONIC,
            inPerson: visitTypeCounts.PHYSICAL,
            online: visitTypeCounts.VIRTUAL + visitTypeCounts.TELEPHONIC,
            total: visitTypeCounts.PHYSICAL + visitTypeCounts.VIRTUAL + visitTypeCounts.TELEPHONIC,
          },
        };
      },
      { ttl: 300, tags: ['state', 'compliance', 'institution', institutionId] },
    );
  }

  /**
   * Get available months that have compliance data
   * Returns list of months with at least one active internship
   */
  async getAvailableComplianceMonths() {
    const cacheKey = 'state:compliance:available-months';

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get the date range of all active internships
        const dateRange = await this.prisma.internshipApplication.aggregate({
          where: {
            isSelfIdentified: true,
            isActive: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
            startDate: { not: null },
            student: { user: { active: true }, Institution: { isActive: true } },
          },
          _min: { startDate: true },
          _max: { endDate: true },
        });

        if (!dateRange._min.startDate) {
          return { months: [] };
        }

        const startDate = dateRange._min.startDate;
        const endDate = dateRange._max.endDate || new Date();
        const now = new Date();

        // Generate list of months from start to end (or current month)
        const months: { month: number; year: number; label: string }[] = [];
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const maxDate = new Date(Math.min(endDate.getTime(), now.getTime()));

        while (currentDate <= maxDate) {
          months.push({
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
            label: currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
          });
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Return in reverse order (most recent first)
        return { months: months.reverse() };
      },
      { ttl: 3600, tags: ['state', 'compliance'] }, // 1 hour cache
    );
  }

  /**
   * Get student documents with presigned URLs for viewing
   * Returns documents from the Document table with MinIO presigned URLs
   */
  async getStudentDocuments(studentId: string) {
    const cacheKey = `state:student:documents:${studentId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get student info
        const student = await this.prisma.student.findUnique({
          where: { id: studentId },
          select: {
            id: true,
            user: {
              select: {
                name: true,
                rollNumber: true,
                email: true,
              },
            },
            Institution: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        });

        if (!student) {
          return { error: 'Student not found', documents: [] };
        }

        // Get documents from database
        const documents = await this.prisma.document.findMany({
          where: {
            studentId,
            isDeleted: false,
          },
          select: {
            id: true,
            type: true,
            fileName: true,
            fileUrl: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        // Generate presigned URLs for each document
        const documentsWithUrls = await Promise.all(
          documents.map(async (doc) => {
            let presignedUrl = null;
            try {
              // fileUrl stores the MinIO key
              if (doc.fileUrl) {
                presignedUrl = await this.fileStorage.getSignedUrl(doc.fileUrl, 3600);
              }
            } catch (error) {
              this.logger.warn(`Failed to get presigned URL for document ${doc.id}: ${error.message}`);
            }

            return {
              id: doc.id,
              type: doc.type,
              fileName: doc.fileName,
              downloadUrl: presignedUrl,
              createdAt: doc.createdAt,
            };
          }),
        );

        return {
          student: {
            id: student.id,
            name: student.user.name,
            rollNumber: student.user.rollNumber,
            email: student.user.email,
            institutionName: student.Institution?.name,
            institutionCode: student.Institution?.code,
          },
          documents: documentsWithUrls,
        };
      },
      { ttl: 300, tags: ['state', 'student', 'documents', studentId] }, // 5 minute cache
    );
  }

  /**
   * Get all documents for students in an institution
   * Returns documents with presigned URLs for viewing
   */
  async getInstitutionDocuments(institutionId: string) {
    const cacheKey = `state:institution:documents:${institutionId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get all students in the institution
        const students = await this.prisma.student.findMany({
          where: {
            institutionId,
            user: { active: true },
          },
          select: {
            id: true,
            user: {
              select: {
                name: true,
                rollNumber: true,
              },
            },
          },
        });

        const studentIds = students.map((s) => s.id);
        const studentMap = new Map(students.map((s) => [s.id, s]));

        // Get all documents for these students
        const documents = await this.prisma.document.findMany({
          where: {
            studentId: { in: studentIds },
            isDeleted: false,
          },
          select: {
            id: true,
            studentId: true,
            type: true,
            fileName: true,
            fileUrl: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        // Generate presigned URLs for each document
        const documentsWithUrls = await Promise.all(
          documents.map(async (doc) => {
            let presignedUrl = null;
            try {
              if (doc.fileUrl) {
                presignedUrl = await this.fileStorage.getSignedUrl(doc.fileUrl, 3600);
              }
            } catch (error) {
              this.logger.warn(`Failed to get presigned URL for document ${doc.id}: ${error.message}`);
            }

            const student = studentMap.get(doc.studentId);

            return {
              id: doc.id,
              studentId: doc.studentId,
              studentName: student?.user?.name || 'Unknown',
              rollNumber: student?.user?.rollNumber || 'N/A',
              type: doc.type,
              fileName: doc.fileName,
              downloadUrl: presignedUrl,
              createdAt: doc.createdAt,
            };
          }),
        );

        return {
          institutionId,
          totalDocuments: documentsWithUrls.length,
          documents: documentsWithUrls,
        };
      },
      { ttl: 300, tags: ['state', 'institution', 'documents', institutionId] }, // 5 minute cache
    );
  }

  /**
   * Get all joining letters for students in an institution
   * Returns joining letters with presigned URLs for viewing
   */
  async getInstitutionJoiningLetters(institutionId: string) {
    const cacheKey = `state:institution:joining-letters:${institutionId}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get all approved internship applications with joining letters
        const applications = await this.prisma.internshipApplication.findMany({
          where: {
            student: {
              institutionId,
              user: { active: true },
            },
            isSelfIdentified: true,
            isActive: true,
            status: { in: [ApplicationStatus.APPROVED, ApplicationStatus.JOINED, ApplicationStatus.SELECTED, ApplicationStatus.COMPLETED] },
            joiningLetterUrl: { not: null },
          },
          select: {
            id: true,
            companyName: true,
            joiningLetterUrl: true,
            joiningLetterUploadedAt: true,
            joiningDate: true,
            startDate: true,
            endDate: true,
            reviewedAt: true,
            internshipPhase: true,
            student: {
              select: {
                id: true,
                user: {
                  select: {
                    name: true,
                    rollNumber: true,
                    email: true,
                  },
                },
                branch: {
                  select: {
                    name: true,
                    shortName: true,
                  },
                },
              },
            },
          },
          orderBy: { joiningLetterUploadedAt: 'desc' },
        });

        // Generate presigned URLs for each joining letter
        const joiningLettersWithUrls = await Promise.all(
          applications.map(async (app) => {
            let presignedUrl = null;
            try {
              if (app.joiningLetterUrl) {
                presignedUrl = await this.fileStorage.getSignedUrl(app.joiningLetterUrl, 3600);
              }
            } catch (error) {
              this.logger.warn(`Failed to get presigned URL for joining letter ${app.id}: ${error.message}`);
            }

            // Determine status
            let status = 'PENDING';
            if (app.joiningDate || ['ACTIVE', 'COMPLETED'].includes(app.internshipPhase)) {
              status = 'APPROVED';
            } else if (app.reviewedAt) {
              status = 'REJECTED';
            }

            return {
              id: app.id,
              studentId: app.student.id,
              studentName: app.student.user?.name || 'Unknown',
              rollNumber: app.student.user?.rollNumber || 'N/A',
              email: app.student.user?.email || 'N/A',
              branch: app.student.branch?.shortName || app.student.branch?.name || 'N/A',
              companyName: app.companyName || 'N/A',
              downloadUrl: presignedUrl,
              uploadedAt: app.joiningLetterUploadedAt,
              joiningDate: app.joiningDate,
              internshipPeriod: {
                startDate: app.startDate,
                endDate: app.endDate,
              },
              status,
            };
          }),
        );

        // Summary stats
        const summary = {
          total: joiningLettersWithUrls.length,
          approved: joiningLettersWithUrls.filter(j => j.status === 'APPROVED').length,
          pending: joiningLettersWithUrls.filter(j => j.status === 'PENDING').length,
          rejected: joiningLettersWithUrls.filter(j => j.status === 'REJECTED').length,
        };

        return {
          institutionId,
          summary,
          joiningLetters: joiningLettersWithUrls,
        };
      },
      { ttl: 300, tags: ['state', 'institution', 'joining-letters', institutionId] }, // 5 minute cache
    );
  }

  /**
   * Get all files for an institution organized by type (for file explorer)
   * Returns a hierarchical structure of documents, joining letters, and reports
   * Uses MinIO presigned URLs for secure file access (valid for 1 hour)
   */
  async getInstitutionFileExplorer(institutionId: string) {
    const cacheKey = `state:institution:file-explorer:${institutionId}`;
    const PRESIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get institution info
        const institution = await this.prisma.institution.findUnique({
          where: { id: institutionId },
          select: { id: true, name: true, code: true },
        });

        if (!institution) {
          return { error: 'Institution not found', folders: [], summary: { totalFiles: 0 } };
        }

        // Get all students (including inactive ones for file access)
        const students = await this.prisma.student.findMany({
          where: { institutionId },
          select: { id: true, user: { select: { name: true, rollNumber: true, active: true } } },
        });

        if (students.length === 0) {
          return {
            institutionId: institution.id,
            institutionName: institution.name,
            institutionCode: institution.code,
            folders: [],
            summary: { totalFiles: 0, documents: 0, joiningLetters: 0, monthlyReports: 0 },
          };
        }

        const studentIds = students.map(s => s.id);
        const studentMap = new Map(students.map(s => [s.id, s]));

        // Fetch all file types in parallel
        const [documents, joiningLetters, monthlyReports, visitLogs] = await Promise.all([
          // Documents
          this.prisma.document.findMany({
            where: { studentId: { in: studentIds }, isDeleted: false },
            select: {
              id: true, studentId: true, type: true, fileName: true, fileUrl: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          }),

          // Joining Letters
          this.prisma.internshipApplication.findMany({
            where: {
              student: { id: { in: studentIds } },
              joiningLetterUrl: { not: null },
              isSelfIdentified: true,
              isActive: true,
            },
            select: {
              id: true, studentId: true, joiningLetterUrl: true, joiningLetterUploadedAt: true, companyName: true,
            },
            orderBy: { joiningLetterUploadedAt: 'desc' },
          }),

          // Monthly Reports
          this.prisma.monthlyReport.findMany({
            where: { studentId: { in: studentIds }, isDeleted: false, reportFileUrl: { not: null } },
            select: {
              id: true, studentId: true, reportFileUrl: true, reportMonth: true, reportYear: true, submittedAt: true,
            },
            orderBy: { submittedAt: 'desc' },
          }),

          // Faculty Visit Logs (all visit logs for students of this institution)
          this.prisma.facultyVisitLog.findMany({
            where: {
              application: {
                student: {
                  institutionId: institutionId, // Direct institution check
                },
              },
            },
            select: {
              id: true,
              visitDate: true,
              createdAt: true,
              visitPhotos: true,
              filesUrl: true,
              signedDocumentUrl: true,
              application: { select: { studentId: true, companyName: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
        ]);

        // Helper function to get download URL for a file
        // Always generates a presigned URL for security (MinIO buckets are private)
        const getPresignedUrlSafe = async (fileKey: string | null, fileId: string, fileType: string): Promise<{ url: string | null; error: string | null }> => {
          if (!fileKey) {
            return { url: null, error: 'No file key' };
          }
          try {
            // Normalize the key (extract from full URL if needed)
            const extractedKey = this.normalizeFileKey(fileKey);
            
            // Generate presigned URL from the key
            const presignedUrl = await this.fileStorage.getSignedUrl(extractedKey, PRESIGNED_URL_EXPIRY);
            
            return { url: presignedUrl, error: null };
          } catch (error) {
            this.logger.warn(`Failed to get presigned URL for ${fileType} ${fileId}: ${error.message}`);
            return { url: null, error: error.message || 'Failed to generate download URL' };
          }
        };

        // Process documents with robust error handling
        const processedDocuments = await Promise.allSettled(
          documents.map(async (doc) => {
            const student = studentMap.get(doc.studentId);
            const { url, error } = await getPresignedUrlSafe(doc.fileUrl, doc.id, 'document');
            return {
              id: doc.id,
              name: doc.fileName || 'Unknown file',
              type: doc.type,
              fileKey: doc.fileUrl, // Store for retry
              studentId: doc.studentId,
              studentName: student?.user?.name || 'Unknown',
              rollNumber: student?.user?.rollNumber || 'N/A',
              uploadedAt: doc.createdAt,
              downloadUrl: url,
              urlError: error,
            };
          }),
        );

        // Process joining letters
        const processedJoiningLetters = await Promise.allSettled(
          joiningLetters.map(async (jl) => {
            const student = studentMap.get(jl.studentId);
            const { url, error } = await getPresignedUrlSafe(jl.joiningLetterUrl, jl.id, 'joining-letter');
            const rollNumber = student?.user?.rollNumber || 'unknown';
            return {
              id: jl.id,
              name: `${rollNumber}_joining_letter.pdf`,
              type: 'JOINING_LETTER',
              fileKey: jl.joiningLetterUrl,
              studentId: jl.studentId,
              studentName: student?.user?.name || 'Unknown',
              rollNumber: student?.user?.rollNumber || 'N/A',
              companyName: jl.companyName || 'N/A',
              uploadedAt: jl.joiningLetterUploadedAt,
              downloadUrl: url,
              urlError: error,
            };
          }),
        );

        // Process monthly reports
        const processedMonthlyReports = await Promise.allSettled(
          monthlyReports.map(async (mr) => {
            const student = studentMap.get(mr.studentId);
            const { url, error } = await getPresignedUrlSafe(mr.reportFileUrl, mr.id, 'monthly-report');
            const monthName = new Date(2000, mr.reportMonth - 1).toLocaleString('default', { month: 'short' });
            const rollNumber = student?.user?.rollNumber || 'unknown';
            return {
              id: mr.id,
              name: `${rollNumber}_${monthName}_${mr.reportYear}_report.pdf`,
              type: 'MONTHLY_REPORT',
              fileKey: mr.reportFileUrl,
              studentId: mr.studentId,
              studentName: student?.user?.name || 'Unknown',
              rollNumber: student?.user?.rollNumber || 'N/A',
              month: mr.reportMonth,
              year: mr.reportYear,
              uploadedAt: mr.submittedAt,
              downloadUrl: url,
              urlError: error,
            };
          }),
        );

        // Process visit logs - same pattern as joining letters & monthly reports
        // Each file (photo, signed doc, extra file) becomes one entry with its DB-stored URL
        const processedVisitLogs = await Promise.allSettled(
          visitLogs.flatMap((log) => {
            const studentId = log.application?.studentId;
            const student = studentId ? studentMap.get(studentId) : undefined;
            const rollNumber = student?.user?.rollNumber || 'unknown';
            const visitDate = log.visitDate || log.createdAt;
            const visitMonth = visitDate ? visitDate.getMonth() + 1 : null;
            const visitYear = visitDate ? visitDate.getFullYear() : null;
            const dateLabel = visitDate
              ? new Date(visitDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: '2-digit',
                }).replace(/\s/g, '')
              : 'unknown';

            const entries: Array<Promise<any>> = [];

            // Visit photos - pass raw DB URL to getPresignedUrlSafe (same as joining letters)
            if (log.visitPhotos && log.visitPhotos.length > 0) {
              log.visitPhotos.forEach((photoUrl, index) => {
                entries.push(
                  (async () => {
                    const photoId = `${log.id}:${index}`;
                    const { url, error } = await getPresignedUrlSafe(photoUrl, photoId, 'visit-photo');
                    return {
                      id: photoId,
                      name: `${rollNumber}_visit_${dateLabel}_photo_${index + 1}.jpg`,
                      type: 'VISIT_PHOTO',
                      fileKey: photoUrl,
                      studentId,
                      studentName: student?.user?.name || 'Unknown',
                      rollNumber: student?.user?.rollNumber || 'N/A',
                      companyName: log.application?.companyName || 'N/A',
                      uploadedAt: log.createdAt,
                      visitDate: log.visitDate,
                      month: visitMonth,
                      year: visitYear,
                      downloadUrl: url,
                      urlError: error,
                    };
                  })(),
                );
              });
            }

            // Extra files from filesUrl field
            const extraFiles = this.parseVisitLogFiles(log.filesUrl);
            if (extraFiles.length > 0) {
              extraFiles.forEach((fileUrl, index) => {
                entries.push(
                  (async () => {
                    const fileId = `${log.id}:files:${index}`;
                    const ext = fileUrl.split('.').pop()?.toLowerCase();
                    const isPhoto = ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                    const { url, error } = await getPresignedUrlSafe(fileUrl, fileId, isPhoto ? 'visit-photo' : 'visit-document');
                    return {
                      id: fileId,
                      name: `${rollNumber}_visit_${dateLabel}_${index + 1}.${ext || 'file'}`,
                      type: isPhoto ? 'VISIT_PHOTO' : 'VISIT_DOCUMENT',
                      fileKey: fileUrl,
                      studentId,
                      studentName: student?.user?.name || 'Unknown',
                      rollNumber: student?.user?.rollNumber || 'N/A',
                      companyName: log.application?.companyName || 'N/A',
                      uploadedAt: log.createdAt,
                      visitDate: log.visitDate,
                      month: visitMonth,
                      year: visitYear,
                      downloadUrl: url,
                      urlError: error,
                    };
                  })(),
                );
              });
            }

            // Signed document - pass raw DB URL (same as joining letters)
            if (log.signedDocumentUrl) {
              entries.push(
                (async () => {
                  const fileId = `${log.id}:signed`;
                  const ext = log.signedDocumentUrl.split('.').pop()?.toLowerCase() || 'pdf';
                  const { url, error } = await getPresignedUrlSafe(log.signedDocumentUrl, fileId, 'visit-signed-document');
                  return {
                    id: fileId,
                    name: `${rollNumber}_visit_${dateLabel}_signed_document.${ext}`,
                    type: 'VISIT_SIGNED_DOCUMENT',
                    fileKey: log.signedDocumentUrl,
                    studentId,
                    studentName: student?.user?.name || 'Unknown',
                    rollNumber: student?.user?.rollNumber || 'N/A',
                    companyName: log.application?.companyName || 'N/A',
                    uploadedAt: log.createdAt,
                    visitDate: log.visitDate,
                    month: visitMonth,
                    year: visitYear,
                    downloadUrl: url,
                    urlError: error,
                  };
                })(),
              );
            }

            return entries;
          }),
        );

        // Extract fulfilled values, filter out rejected promises
        const extractFulfilled = <T>(results: PromiseSettledResult<T>[]): T[] => {
          return results
            .filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
            .map(r => r.value);
        };

        const documentFiles = extractFulfilled(processedDocuments);
        const joiningLetterFiles = extractFulfilled(processedJoiningLetters);
        const monthlyReportFiles = extractFulfilled(processedMonthlyReports);
        const visitLogFiles = extractFulfilled(processedVisitLogs);

        // Count URL generation errors
        const urlErrorCount = [
          ...documentFiles.filter(f => f.urlError),
          ...joiningLetterFiles.filter(f => f.urlError),
          ...monthlyReportFiles.filter(f => f.urlError),
          ...visitLogFiles.filter(f => f.urlError),
        ].length;

        // Build file tree structure
        const fileTree = {
          institutionId: institution.id,
          institutionName: institution.name,
          institutionCode: institution.code,
          folders: [
            {
              name: 'Joining Letters',
              type: 'joining-letters',
              count: joiningLetterFiles.length,
              files: joiningLetterFiles,
            },
            {
              name: 'Monthly Reports',
              type: 'monthly-reports',
              count: monthlyReportFiles.length,
              files: monthlyReportFiles,
            },
            {
              name: 'Visit Logs',
              type: 'visit-logs',
              count: visitLogs.length,
              files: visitLogFiles,
            },
            {
              name: 'Documents',
              type: 'documents',
              count: documentFiles.length,
              files: documentFiles,
            },
          ],
          summary: {
            totalFiles: documentFiles.length + joiningLetterFiles.length + monthlyReportFiles.length + visitLogFiles.length,
            documents: documentFiles.length,
            joiningLetters: joiningLetterFiles.length,
            monthlyReports: monthlyReportFiles.length,
            visitLogs: visitLogs.length,
            urlErrors: urlErrorCount,
          },
          generatedAt: new Date().toISOString(),
          urlExpiresIn: PRESIGNED_URL_EXPIRY,
        };

        return fileTree;
      },
      { ttl: 180, tags: ['state', 'institution', 'file-explorer', institutionId] }, // 3 minute cache (shorter than URL expiry)
    );
  }

  /**
   * Generate a fresh presigned URL for a specific file
   * Used when a cached URL has expired or failed
   */
  async getFilePresignedUrl(
    fileType: 'document' | 'joining-letter' | 'monthly-report' | 'visit-document' | 'visit-photo' | 'visit-signed-document',
    fileId: string,
  ): Promise<{ downloadUrl: string | null; error: string | null; expiresIn: number }> {
    const PRESIGNED_URL_EXPIRY = 3600;

    try {
      let fileKey: string | null = null;

      switch (fileType) {
        case 'document': {
          const doc = await this.prisma.document.findUnique({
            where: { id: fileId },
            select: { fileUrl: true },
          });
          fileKey = doc?.fileUrl || null;
          break;
        }
        case 'joining-letter': {
          const app = await this.prisma.internshipApplication.findUnique({
            where: { id: fileId },
            select: { joiningLetterUrl: true },
          });
          fileKey = app?.joiningLetterUrl || null;
          break;
        }
        case 'monthly-report': {
          const report = await this.prisma.monthlyReport.findUnique({
            where: { id: fileId },
            select: { reportFileUrl: true },
          });
          fileKey = report?.reportFileUrl || null;
          break;
        }
        case 'visit-document': {
          const parts = fileId.split(':');
          const visitId = parts[0];
          const indexStr = parts.length >= 3 && parts[1] === 'files' ? parts[2] : parts[1];
          const index = Number(indexStr);

          if (!visitId) {
            return { downloadUrl: null, error: 'Invalid visit document id', expiresIn: 0 };
          }

          // Check if this is a summary request (no index or index is NaN)
          if (parts.length === 1 || Number.isNaN(index)) {
            // Generate summary document for the visit log
            const visit = await this.prisma.facultyVisitLog.findUnique({
              where: { id: visitId },
              select: {
                id: true,
                visitDate: true,
                createdAt: true,
                visitPhotos: true,
                filesUrl: true,
                signedDocumentUrl: true,
                application: {
                  select: {
                    student: { select: { user: { select: { name: true, rollNumber: true } } } },
                    companyName: true,
                  },
                },
              },
            });

            if (!visit) {
              return { downloadUrl: null, error: 'Visit log not found', expiresIn: 0 };
            }

            const summaryData = {
              visitId: visit.id,
              visitDate: visit.visitDate,
              createdAt: visit.createdAt,
              studentName: visit.application?.student?.user?.name || 'Unknown',
              studentRollNumber: visit.application?.student?.user?.rollNumber || 'Unknown',
              companyName: visit.application?.companyName || 'Unknown',
              visitPhotosCount: visit.visitPhotos?.length || 0,
              documentsCount: this.parseVisitLogFiles(visit.filesUrl).length,
              hasSignedDocument: !!visit.signedDocumentUrl,
            };

            const summaryJson = JSON.stringify(summaryData, null, 2);
            const base64Data = Buffer.from(summaryJson).toString('base64');
            const dataUrl = `data:text/plain;base64,${base64Data}`;

            return {
              downloadUrl: dataUrl,
              error: null,
              expiresIn: PRESIGNED_URL_EXPIRY,
            };
          }

          const visit = await this.prisma.facultyVisitLog.findUnique({
            where: { id: visitId },
            select: { filesUrl: true },
          });

          const files = this.parseVisitLogFiles(visit?.filesUrl);

          if (Number.isFinite(index)) {
            fileKey = files[index] || null;
            break;
          }

          // Fallback: first non-image file
          fileKey = files.find((key) => {
            const ext = key.split('.').pop()?.toLowerCase();
            return ext && !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
          }) || files[0] || null;
          break;
        }
        case 'visit-photo': {
          const parts = fileId.split(':');
          const visitId = parts[0];
          const indexStr = parts.length >= 3 && parts[1] === 'files' ? parts[2] : parts[1];
          const index = Number(indexStr);
          if (!visitId || Number.isNaN(index)) {
            return { downloadUrl: null, error: 'Invalid visit photo id', expiresIn: 0 };
          }
          const visit = await this.prisma.facultyVisitLog.findUnique({
            where: { id: visitId },
            select: { visitPhotos: true, filesUrl: true },
          });
          const files = visit?.visitPhotos || [];
          if (parts.length >= 3 && parts[1] === 'files') {
            const extraFiles = this.parseVisitLogFiles(visit?.filesUrl);
            fileKey = extraFiles[index] || null;
          } else {
            fileKey = files[index] || null;
          }
          break;
        }
        case 'visit-signed-document': {
          const visitId = fileId.replace(':signed', '');
          if (!visitId) {
            return { downloadUrl: null, error: 'Invalid visit signed document id', expiresIn: 0 };
          }
          const visit = await this.prisma.facultyVisitLog.findUnique({
            where: { id: visitId },
            select: { signedDocumentUrl: true },
          });
          fileKey = visit?.signedDocumentUrl || null;
          break;
        }
      }

      if (!fileKey) {
        return { downloadUrl: null, error: 'File not found', expiresIn: 0 };
      }

      // Normalize the key (extract from full URL if needed)
      const extractedKey = this.normalizeFileKey(fileKey);

      // Generate presigned URL from the key
      const presignedUrl = await this.fileStorage.getSignedUrl(extractedKey, PRESIGNED_URL_EXPIRY);
      
      return { downloadUrl: presignedUrl, error: null, expiresIn: PRESIGNED_URL_EXPIRY };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${fileType} ${fileId}: ${error.message}`);
      return { downloadUrl: null, error: error.message || 'Failed to generate URL', expiresIn: 0 };
    }
  }
}
