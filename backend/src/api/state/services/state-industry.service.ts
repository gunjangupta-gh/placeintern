import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { ApplicationStatus } from '../../../generated/prisma/client';

@Injectable()
export class StateIndustryService {
  private readonly logger = new Logger(StateIndustryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
  ) {}

  /**
   * Get top industries by interns hired
   * OPTIMIZED: Uses caching with 15-minute TTL
   * Supports month/year filtering for applications approved in that period
   */
  async getTopIndustries(params: { limit?: number; month?: number; year?: number }) {
    const { limit = 10, month, year } = params;
    const cacheKey = month && year
      ? `state:top-industries:${limit}:${month}:${year}`
      : `state:top-industries:${limit}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        return this._fetchTopIndustries(limit, month, year);
      },
      { ttl: 15 * 60 * 1000, tags: ['state', 'industries', 'top-industries'] },
    );
  }

  /**
   * Internal method to fetch top industries data
   */
  private async _fetchTopIndustries(limit: number, month?: number, year?: number) {
    // Build date filter for month/year if provided
    const dateFilter: any = {};
    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter.startDate = { gte: startOfMonth, lte: endOfMonth };
    }

    // Get all approved self-identified applications with company info (active students with active users only)
    const applications = await this.prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        status: ApplicationStatus.APPROVED,
        companyName: { not: '' },
        student: { user: { active: true } },
        ...dateFilter,
      },
      select: {
        companyName: true,
        companyAddress: true,
        companyEmail: true,
        jobProfile: true,
        stipend: true,
        student: {
          select: {
            institutionId: true,
            Institution: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate by company name (normalize to lowercase for grouping)
    const companyMap = new Map<string, {
      name: string;
      address: string | null;
      email: string | null;
      internsCount: number;
      institutions: Set<string>;
      jobProfiles: Set<string>;
      avgStipend: number;
      totalStipend: number;
    }>();

    for (const app of applications) {
      // Normalize key: lowercase, trim, replace hyphens with spaces, and collapse multiple spaces
      // This ensures "Multi-Skill" and "Multi Skill" are treated as the same company
      const companyKey = app.companyName?.toLowerCase().trim()
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ') || '';
      if (!companyKey) continue;

      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          name: app.companyName || '',
          address: app.companyAddress,
          email: app.companyEmail,
          internsCount: 0,
          institutions: new Set(),
          jobProfiles: new Set(),
          avgStipend: 0,
          totalStipend: 0,
        });
      }

      const company = companyMap.get(companyKey)!;
      company.internsCount++;
      if (app.student?.Institution?.name) {
        company.institutions.add(app.student.Institution.name);
      }
      if (app.jobProfile) {
        company.jobProfiles.add(app.jobProfile);
      }
      if (app.stipend) {
        company.totalStipend += Number(app.stipend);
      }
    }

    // Convert to array and calculate averages
    // Use map key for ID to ensure uniqueness (key is already normalized)
    const companies = Array.from(companyMap.entries())
      .map(([key, company]) => ({
        id: `self-${key.replace(/\s+/g, '-')}`,
        name: company.name,
        address: company.address,
        email: company.email,
        internsHired: company.internsCount,
        institutionsCount: company.institutions.size,
        jobProfiles: Array.from(company.jobProfiles).slice(0, 3),
        avgStipend: company.internsCount > 0 ? Math.round(company.totalStipend / company.internsCount) : 0,
      }))
      .sort((a, b) => b.internsHired - a.internsHired)
      .slice(0, limit);

    return {
      data: companies,
      total: companyMap.size,
    };
  }

  /**
   * Get joining letter statistics
   * Note: This method delegates to StateReportService
   * Kept here for API compatibility, but requires StateReportService injection
   */
  async getJoiningLetterStats() {
    // This method requires StateReportService to be injected
    // For now, return a placeholder or throw an error
    throw new BadRequestException('This method requires StateReportService. Please use StateReportService.getJoiningLetterStats() directly.');
  }

  /**
   * Get all companies (both industries and self-identified)
   */
  async getAllCompanies(params: {
    page?: number;
    limit?: number;
    search?: string;
    industryType?: string;
    sortBy?: 'studentCount' | 'institutionCount' | 'companyName';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { page = 1, limit = 20, search, industryType, sortBy = 'studentCount', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    // Industry portal removed: only self-identified companies remain
    if (industryType && industryType !== 'Self-Identified') {
      this.logger.debug(`Ignoring industryType filter (industry portal removed): ${industryType}`);
    }

    const selfIdWhere: any = {
      isSelfIdentified: true,
      student: { user: { active: true } },
    };
    if (search) {
      selfIdWhere.companyName = { contains: search, mode: 'insensitive' };
    }

    const selfIdentifiedApps = await this.prisma.internshipApplication.findMany({
      where: selfIdWhere,
      select: {
        id: true,
        companyName: true,
        companyAddress: true,
        companyContact: true,
        companyEmail: true,
        jobProfile: true,
        stipend: true,
        status: true,
        isSelfIdentified: true,
        joiningLetterUrl: true,
        joiningDate: true,
        student: {
          select: {
            id: true,
            institutionId: true,
            user: {
              select: { name: true, rollNumber: true, branchName: true, email: true },
            },
            Institution: {
              select: { id: true, name: true, code: true, city: true },
            },
          },
        },
      },
    });

    const companyMap = new Map<string, any>();

    // Process self-identified applications - group by company name
    // Normalize key to ensure consistent grouping (lowercase, trim, replace hyphens/spaces)
    const selfIdCompanyMap = new Map<string, any>();
    selfIdentifiedApps.forEach((app) => {
      const companyName = app.companyName || 'Unknown Company';
      const normalizedName = companyName.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
      const companyKey = `self-${normalizedName.replace(/\s+/g, '-')}`;

      if (!selfIdCompanyMap.has(companyKey)) {
        selfIdCompanyMap.set(companyKey, {
          id: companyKey,
          companyName,
          industryType: 'Self-Identified',
          city: null,
          state: null,
          address: app.companyAddress,
          email: app.companyEmail,
          phone: app.companyContact,
          isApproved: true,
          isVerified: false,
          isSelfIdentifiedCompany: true,
          totalStudents: 0,
          totalApplications: 0, // Track total applications (not deduplicated)
          institutionCount: 0,
          institutionMap: new Map(),
          studentSet: new Set(),
        });
      }

      const company = selfIdCompanyMap.get(companyKey);
      const student = app.student;
      if (!student?.institutionId) return;

      // Always count the application
      company.totalApplications++;

      if (!company.studentSet.has(student.id)) {
        company.studentSet.add(student.id);
        company.totalStudents++;

        if (!company.institutionMap.has(student.institutionId)) {
          company.institutionMap.set(student.institutionId, {
            id: student.institutionId,
            name: student.Institution?.name || 'Unknown',
            code: student.Institution?.code || '',
            city: student.Institution?.city || '',
            students: [],
            branchWise: {},
          });
        }

        const inst = company.institutionMap.get(student.institutionId);
        inst.students.push({
          id: student.id,
          name: student.user?.name,
          rollNumber: student.user?.rollNumber,
          branch: student.user?.branchName,
          email: student.user?.email,
          jobProfile: app.jobProfile,
          stipend: app.stipend,
          status: app.status,
          hasJoiningLetter: !!app.joiningLetterUrl,
          isSelfIdentified: true,
        });

        const branch = student.user?.branchName || 'Unknown';
        inst.branchWise[branch] = (inst.branchWise[branch] || 0) + 1;
      }
    });

    // Finalize self-identified companies
    selfIdCompanyMap.forEach((company, key) => {
      const institutions = Array.from(company.institutionMap.values()).map((inst: any) => ({
        ...inst,
        studentCount: inst.students.length,
        branchWiseData: Object.entries(inst.branchWise).map(([branch, count]) => ({ branch, count })),
      }));

      // Only add if has students and not filtered by industryType (unless searching for self-identified)
      if (institutions.length > 0 && (!industryType || industryType === 'Self-Identified')) {
        companyMap.set(key, {
          id: company.id,
          companyName: company.companyName,
          industryType: company.industryType,
          city: company.city,
          state: company.state,
          address: company.address,
          email: company.email,
          phone: company.phone,
          isApproved: company.isApproved,
          isVerified: company.isVerified,
          isSelfIdentifiedCompany: company.isSelfIdentifiedCompany,
          totalStudents: company.totalStudents,
          totalApplications: company.totalApplications, // Total internship applications (not deduplicated)
          institutionCount: institutions.length,
          institutions,
        });
      }
    });

    // Convert to array and sort
    let companies = Array.from(companyMap.values());

    // Sort
    companies.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'studentCount':
          comparison = a.totalStudents - b.totalStudents;
          break;
        case 'institutionCount':
          comparison = a.institutionCount - b.institutionCount;
          break;
        case 'companyName':
          comparison = a.companyName.localeCompare(b.companyName);
          break;
        default:
          comparison = a.totalStudents - b.totalStudents;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Paginate
    const total = companies.length;
    const paginatedCompanies = companies.slice(skip, skip + limit);

    // Calculate summary
    // Always use deduplicated studentCount for consistent counting
    const totalStudentsPlaced = companies.reduce((sum, c) => {
      return sum + c.totalStudents;
    }, 0);
    const totalSelfIdentified = companies
      .filter(c => c.isSelfIdentifiedCompany)
      .reduce((sum, c) => sum + c.totalStudents, 0);
    const uniqueIndustryTypes = ['Self-Identified'];

    return {
      companies: paginatedCompanies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalCompanies: total,
        totalStudentsPlaced,
        totalSelfIdentified,
        selfIdentifiedRate: totalStudentsPlaced > 0 ? Math.round((totalSelfIdentified / totalStudentsPlaced) * 100) : 0,
        industryTypes: uniqueIndustryTypes,
      },
    };
  }

  /**
   * Get company details with all institutions and students
   * NOTE: Industry portal removed; self-identified companies only.
   */
  async getCompanyDetails(companyId: string) {
    if (!companyId.startsWith('self-')) {
      throw new NotFoundException('Company not found');
    }

    const normalizedKey = companyId.replace('self-', '');
    const normalize = (name: string) => name.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, '-');

    const allSelfIdApps = await this.prisma.internshipApplication.findMany({
      where: {
        isSelfIdentified: true,
        companyName: { not: '' },
        student: { user: { active: true } },
      },
      select: {
        id: true,
        companyName: true,
        companyAddress: true,
        companyContact: true,
        companyEmail: true,
        hrName: true,
        jobProfile: true,
        stipend: true,
        status: true,
        internshipDuration: true,
        startDate: true,
        endDate: true,
        joiningLetterUrl: true,
        joiningDate: true,
        student: {
          select: {
            id: true,
            institutionId: true,
            user: {
              select: { name: true, rollNumber: true, branchName: true, email: true, phoneNo: true },
            },
            Institution: {
              select: { id: true, name: true, code: true, city: true, district: true },
            },
          },
        },
      },
    });

    const applications = allSelfIdApps.filter((app) => {
      const companyName = app.companyName || 'Unknown Company';
      return normalize(companyName) === normalizedKey;
    });

    if (applications.length === 0) {
      throw new NotFoundException('Company not found');
    }

    const firstApp = applications[0];
    const institutionMap = new Map<string, any>();
    const globalStudentSet = new Set<string>();

    applications.forEach((app) => {
      const student = app.student;
      if (!student?.institutionId) return;

      if (!institutionMap.has(student.institutionId)) {
        institutionMap.set(student.institutionId, {
          id: student.institutionId,
          name: student.Institution?.name || 'Unknown',
          code: student.Institution?.code || '',
          city: student.Institution?.city || '',
          district: student.Institution?.district || '',
          students: [],
          branchWise: {},
        });
      }

      const inst = institutionMap.get(student.institutionId);
      if (!globalStudentSet.has(student.id)) {
        globalStudentSet.add(student.id);
        inst.students.push({
          id: student.id,
          name: student.user?.name,
          rollNumber: student.user?.rollNumber,
          branch: student.user?.branchName,
          email: student.user?.email,
          contact: student.user?.phoneNo,
          jobProfile: app.jobProfile,
          stipend: app.stipend,
          duration: app.internshipDuration,
          startDate: app.startDate,
          endDate: app.endDate,
          status: app.status,
          hasJoiningLetter: !!app.joiningLetterUrl,
          hasJoined: !!app.joiningDate,
        });

        const branch = student.user?.branchName || 'Unknown';
        inst.branchWise[branch] = (inst.branchWise[branch] || 0) + 1;
      }
    });

    const institutions = Array.from(institutionMap.values()).map((inst) => ({
      ...inst,
      studentCount: inst.students.length,
      branchWiseData: Object.entries(inst.branchWise).map(([branch, count]) => ({ branch, count })),
    }));

    return {
      id: companyId,
      companyName: firstApp.companyName,
      industryType: 'Self-Identified',
      address: firstApp.companyAddress,
      email: firstApp.companyEmail,
      phone: firstApp.companyContact,
      hrName: firstApp.hrName,
      isSelfIdentifiedCompany: true,
      isApproved: true,
      isVerified: false,
      totalStudents: globalStudentSet.size,
      institutionCount: institutions.length,
      institutions,
    };
  }
}
