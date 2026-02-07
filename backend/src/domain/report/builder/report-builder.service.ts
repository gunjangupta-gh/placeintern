import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import {
  ReportType,
  ReportConfig,
  ReportCatalogItem,
  ReportJobData,
  ReportStatus,
} from './interfaces/report.interface';
import {
  ReportDefinition,
  ReportGenerationConfig,
  GeneratedReportResult,
} from './interfaces/report-definition.interface';
import {
  allReportDefinitions,
  reportCategories,
} from './definitions';

// Cache TTL for report templates (1 hour)
const TEMPLATE_CACHE_TTL = 60 * 60 * 1000;

@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  // Queue configuration for robustness
  private readonly QUEUE_OPTIONS = {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  };

  // Map actual user roles to definition roles
  private static readonly ROLE_MAP: Record<string, string[]> = {
    'statedashboard': ['STATE_DIRECTORATE'],
    'state_directorate': ['STATE_DIRECTORATE'],
    'principal': ['PRINCIPAL'],
    'faculty': ['FACULTY'],
    'teacher': ['FACULTY'],
    'mentor': ['FACULTY'],
    'faculty_supervisor': ['FACULTY'],
    'student': ['STUDENT'],
    'admin': ['SYSTEM_ADMIN'],
    'system_admin': ['SYSTEM_ADMIN'],
    'superadmin': ['SYSTEM_ADMIN'],
  };

  constructor(
    @InjectQueue('report-generation') private reportQueue: Queue,
    private prisma: PrismaService,
    private cache: LruCacheService,
  ) {}

  /**
   * Normalize user role to match definition roles
   */
  private normalizeRole(role: string): string[] {
    if (!role) {
      // If no role, grant access to all reports
      return ['STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY', 'STUDENT', 'SYSTEM_ADMIN'];
    }

    const normalizedRole = role?.toLowerCase()?.trim();

    // Check direct mapping
    if (ReportBuilderService.ROLE_MAP[normalizedRole]) {
      return ReportBuilderService.ROLE_MAP[normalizedRole];
    }

    // Check if role matches any definition role (case-insensitive)
    const upperRole = role?.toUpperCase();
    const definitionRoles = ['STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY', 'STUDENT', 'SYSTEM_ADMIN'];
    if (definitionRoles.includes(upperRole)) {
      return [upperRole];
    }

    // If role contains 'state' or 'admin', grant full access
    if (normalizedRole.includes('state') || normalizedRole.includes('admin')) {
      return ['STATE_DIRECTORATE', 'SYSTEM_ADMIN'];
    }

    // Default: grant STATE_DIRECTORATE access as fallback
    this.logger.debug(`Unknown role: ${role}, granting STATE_DIRECTORATE access`);
    return ['STATE_DIRECTORATE'];
  }

  /**
   * Get report catalog grouped by category based on user role
   */
  getReportCatalog(role: string): Record<string, ReportCatalogItem[]> {
    const catalog: Record<string, ReportCatalogItem[]> = {};
    const normalizedRoles = this.normalizeRole(role);

    this.logger.debug(`getReportCatalog called with role: ${role}`);
    this.logger.debug(`Normalized roles: ${JSON.stringify(normalizedRoles)}`);
    this.logger.debug(`Available categories: ${Object.keys(reportCategories).join(', ')}`);
    this.logger.debug(`Total definitions: ${Object.keys(allReportDefinitions).length}`);

    Object.entries(reportCategories).forEach(([categoryKey, category]) => {
      const categoryReports: ReportCatalogItem[] = [];

      category.reports.forEach((reportType) => {
        const definition = allReportDefinitions[reportType];
        if (definition) {
          // Check if any of the normalized roles match
          const hasAccess = normalizedRoles.some(r =>
            definition.availableFor.includes(r)
          );

          if (hasAccess) {
            categoryReports.push({
              type: definition.type,
              name: definition.name,
              description: definition.description,
              icon: definition.icon,
              category: definition.category,
              columnsCount: definition.columns.length,
              filtersCount: definition.filters.length,
            });
          }
        }
      });

      if (categoryReports.length > 0) {
        catalog[category.label] = categoryReports;
      }
    });

    this.logger.debug(`Catalog result: ${JSON.stringify(Object.keys(catalog))}`);
    return catalog;
  }

  /**
   * Get report configuration with full details
   */
  getReportConfig(type: string): ReportDefinition | null {
    return allReportDefinitions[type] || null;
  }

  /**
   * Get dynamic filter values based on filter type
   */
  async getFilterValues(
    reportType: string,
    filterId: string,
    institutionId?: string,
  ): Promise<{ label: string; value: string }[]> {
    const definition = allReportDefinitions[reportType];
    if (!definition) {
      throw new NotFoundException(`Report type ${reportType} not found`);
    }

    const filter = definition.filters.find((f) => f.id === filterId);
    if (!filter || !filter.dynamic) {
      throw new BadRequestException(`Filter ${filterId} is not dynamic`);
    }

    switch (filterId) {
      case 'institutionId':
        return this.getInstitutionOptions();
      case 'branchId':
        return this.getBranchOptions(institutionId);
      case 'mentorId':
        return this.getMentorOptions(institutionId);
      case 'department':
        return this.getDepartmentOptions(institutionId);
      case 'district':
        return this.getDistrictOptions();
      case 'city':
        return this.getCityOptions();
      case 'industryType':
        return this.getIndustryTypeOptions();
      case 'academicYear':
        return this.getAcademicYearOptions();
      case 'year':
        return this.getYearOptions();
      default:
        return [];
    }
  }

  private async getInstitutionOptions(): Promise<{ label: string; value: string }[]> {
    const institutions = await this.prisma.institution.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return institutions.map((i) => ({
      label: `${i.name} (${i.code})`,
      value: i.id,
    }));
  }

  private async getBranchOptions(institutionId?: string): Promise<{ label: string; value: string }[]> {
    const where = institutionId ? { institutionId } : {};
    const branches = await this.prisma.branch.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return branches.map((b) => ({ label: b.name, value: b.id }));
  }

  private async getMentorOptions(institutionId?: string): Promise<{ label: string; value: string }[]> {
    const where: Record<string, unknown> = {
      role: { in: ['TEACHER'] }, // FACULTY_SUPERVISOR role removed
      active: true, // Only show active mentors
    };
    if (institutionId) {
      where.institutionId = institutionId;
    }
    const mentors = await this.prisma.user.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return mentors.map((m) => ({ label: m.name, value: m.id }));
  }

  private async getDepartmentOptions(institutionId?: string): Promise<{ label: string; value: string }[]> {
    const where = institutionId ? { institutionId } : {};
    const branches = await this.prisma.branch.findMany({
      where,
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    });
    return branches.map((b) => ({ label: b.name, value: b.name }));
  }

  private async getDistrictOptions(): Promise<{ label: string; value: string }[]> {
    const institutions = await this.prisma.institution.findMany({
      where: { district: { not: null } },
      select: { district: true },
      distinct: ['district'],
      orderBy: { district: 'asc' },
    });
    return institutions
      .filter((i) => i.district)
      .map((i) => ({ label: i.district!, value: i.district! }));
  }

  private async getCityOptions(): Promise<{ label: string; value: string }[]> {
    const institutions = await this.prisma.institution.findMany({
      where: { city: { not: null } },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    return institutions
      .filter((i) => i.city)
      .map((i) => ({ label: i.city!, value: i.city! }));
  }

  private async getIndustryTypeOptions(): Promise<{ label: string; value: string }[]> {
    // Industry model removed - return empty array
    return [];
  }

  private getAcademicYearOptions(): { label: string; value: string }[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      const startYear = currentYear - i;
      const endYear = startYear + 1;
      years.push({
        label: `${startYear}-${endYear}`,
        value: `${startYear}-${endYear}`,
      });
    }
    return years;
  }

  private getYearOptions(): { label: string; value: string }[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i;
      years.push({
        label: year.toString(),
        value: year.toString(),
      });
    }
    return years;
  }

  /**
   * Queue report generation (async)
   */
  async queueReportGeneration(
    userId: string,
    type: string,
    config: ReportGenerationConfig,
    userRole?: string,
  ): Promise<{ jobId: string; reportId: string }> {
    const reportDefinition = this.getReportConfig(type);
    if (!reportDefinition) {
      throw new NotFoundException(`Report type ${type} not found`);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create report record in database
    const report = await this.prisma.generatedReport.create({
      data: {
        reportType: type,
        reportName: reportDefinition.name,
        configuration: JSON.parse(JSON.stringify({
          columns: config.columns,
          filters: config.filters,
          groupBy: config.groupBy,
          sortBy: config.sortBy,
          sortOrder: config.sortOrder,
        })),
        format: config.format || 'excel',
        status: ReportStatus.PENDING,
        errorMessage: null,
        generatedBy: userId,
        institutionId: (config.filters?.institutionId as string) || null,
        expiresAt,
      },
      select: { id: true },
    });

    // Add job to queue with retry options
    const job = await this.reportQueue.add(
      'generate-report',
      {
        userId,
        userRole,
        reportType: type,
        config,
        reportId: report.id,
      } as ReportJobData,
      this.QUEUE_OPTIONS,
    );

    return {
      jobId: job.id as string,
      reportId: report.id,
    };
  }

  /**
   * Generate report synchronously (with timeout)
   */
  async generateReportSync(
    userId: string,
    type: string,
    config: ReportGenerationConfig,
  ): Promise<GeneratedReportResult> {
    const reportDefinition = this.getReportConfig(type);
    if (!reportDefinition) {
      throw new NotFoundException(`Report type ${type} not found`);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create report record
    const report = await this.prisma.generatedReport.create({
      data: {
        reportType: type,
        reportName: reportDefinition.name,
        configuration: JSON.parse(JSON.stringify({
          columns: config.columns,
          filters: config.filters,
          groupBy: config.groupBy,
          sortBy: config.sortBy,
          sortOrder: config.sortOrder,
        })),
        format: config.format || 'excel',
        status: ReportStatus.PROCESSING,
        generatedBy: userId,
        institutionId: (config.filters?.institutionId as string) || null,
        expiresAt,
      },
    });

    // Process synchronously (the processor will handle the actual generation)
    // For now, return the report ID for polling
    return {
      id: report.id,
      type: report.reportType,
      status: 'processing',
      format: report.format,
      createdAt: report.createdAt,
    };
  }

  /**
   * Get report status
   */
  async getReportStatus(reportId: string): Promise<GeneratedReportResult | null> {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        reportType: true,
        status: true,
        format: true,
        fileUrl: true,
        errorMessage: true,
        createdAt: true,
        generatedAt: true,
        expiresAt: true,
      },
    });

    if (!report) return null;

    return {
      id: report.id,
      type: report.reportType,
      status: report.status as 'pending' | 'processing' | 'completed' | 'failed',
      format: report.format,
      fileUrl: report.fileUrl || undefined,
      errorMessage: report.errorMessage || undefined,
      createdAt: report.createdAt,
      completedAt: report.generatedAt || undefined,
      expiresAt: report.expiresAt || undefined,
    };
  }

  /**
   * Get report history for user with pagination
   */
  async getReportHistory(
    userId: string,
    pagination: { page: number; limit: number },
  ) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [reports, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where: { generatedBy: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit,
        select: {
          id: true,
          reportType: true,
          reportName: true,
          status: true,
          format: true,
          fileUrl: true,
          createdAt: true,
          generatedAt: true,
          configuration: true,
        },
      }),
      this.prisma.generatedReport.count({ where: { generatedBy: userId } }),
    ]);

    return {
      data: reports.map((report) => ({
        id: report.id,
        type: report.reportType,
        name: report.reportName,
        status: report.status,
        format: report.format,
        downloadUrl: report.fileUrl,
        createdAt: report.createdAt,
        completedAt: report.generatedAt,
        configuration: report.configuration,
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  /**
   * Save report template
   */
  async saveTemplate(
    userId: string,
    data: {
      name: string;
      description?: string;
      reportType: string;
      configuration: {
        columns?: string[];
        filters?: Record<string, unknown>;
        groupBy?: string;
        sortBy?: string;
        sortOrder?: string;
      };
      isPublic?: boolean;
    },
  ) {
    const definition = this.getReportConfig(data.reportType);
    if (!definition) {
      throw new NotFoundException(`Report type ${data.reportType} not found`);
    }

    const config = data.configuration || {};

    const result = await this.prisma.reportTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        reportType: data.reportType,
        columns: config.columns || [],
        filters: JSON.parse(JSON.stringify(config.filters || {})),
        groupBy: config.groupBy,
        sortBy: config.sortBy,
        sortOrder: config.sortOrder,
        isPublic: data.isPublic || false,
        createdBy: userId,
      },
    });

    // Invalidate cache for this user's templates
    await this.cache.invalidateByTags([`user:${userId}`, 'report-templates']);

    return result;
  }

  /**
   * Get user's templates
   * OPTIMIZED: Uses caching with 1-hour TTL
   */
  async getTemplates(userId: string, reportType?: string) {
    const cacheKey = reportType
      ? `report:templates:${userId}:${reportType}`
      : `report:templates:${userId}:all`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const where: Record<string, unknown> = {
          OR: [{ createdBy: userId }, { isPublic: true }],
        };

        if (reportType) {
          where.reportType = reportType;
        }

        const templates = await this.prisma.reportTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            description: true,
            reportType: true,
            columns: true,
            filters: true,
            groupBy: true,
            sortBy: true,
            sortOrder: true,
            isPublic: true,
            createdBy: true,
            createdAt: true,
          },
        });

        // Transform to include configuration object for frontend compatibility
        return templates.map((t) => ({
          ...t,
          configuration: {
            columns: t.columns,
            filters: t.filters,
            groupBy: t.groupBy,
            sortBy: t.sortBy,
            sortOrder: t.sortOrder,
          },
        }));
      },
      { ttl: TEMPLATE_CACHE_TTL, tags: ['report-templates', `user:${userId}`] },
    );
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: string) {
    const template = await this.prisma.reportTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.createdBy !== userId) {
      throw new BadRequestException('You can only delete your own templates');
    }

    const result = await this.prisma.reportTemplate.delete({
      where: { id: templateId },
    });

    // Invalidate cache for this user's templates
    await this.cache.invalidateByTags([`user:${userId}`, 'report-templates']);

    return result;
  }

  /**
   * Clean up expired reports
   */
  async cleanupExpiredReports() {
    const now = new Date();
    return this.prisma.generatedReport.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
  }

  // ==================== Queue Management ====================

  /**
   * Get queue statistics
   * Note: This may fail in Redis Cluster mode if not properly configured.
   * The {bull} prefix ensures all keys hash to the same slot for cluster compatibility.
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    error?: string;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.reportQueue.getWaitingCount(),
        this.reportQueue.getActiveCount(),
        this.reportQueue.getCompletedCount(),
        this.reportQueue.getFailedCount(),
        this.reportQueue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      this.logger.warn(`Failed to get queue statistics: ${error.message}`);
      // Return default values when queue stats are unavailable
      // This can happen in Redis Cluster mode or when Redis is disconnected
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        error: 'Queue statistics temporarily unavailable',
      };
    }
  }

  /**
   * Get active and pending reports for a user
   */
  async getActiveReports(userId: string): Promise<any[]> {
    const reports = await this.prisma.generatedReport.findMany({
      where: {
        generatedBy: userId,
        status: { in: ['pending', 'processing'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reportType: true,
        reportName: true,
        status: true,
        format: true,
        createdAt: true,
        configuration: true,
      },
    });

    return reports;
  }

  /**
   * Cancel a report generation
   */
  async cancelReport(reportId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.generatedBy !== userId) {
      throw new BadRequestException('You can only cancel your own reports');
    }

    if (report.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed report');
    }

    if (report.status === 'failed' || report.status === 'cancelled') {
      throw new BadRequestException('Report is already cancelled or failed');
    }

    // Try to remove the job from the queue
    const jobs = await this.reportQueue.getJobs(['waiting', 'active', 'delayed']);
    const job = jobs.find((j) => j.data?.reportId === reportId);

    if (job) {
      try {
        await job.remove();
      } catch (err) {
        console.warn(`Could not remove job from queue: ${err.message}`);
      }
    }

    // Update report status to cancelled
    await this.prisma.generatedReport.update({
      where: { id: reportId },
      data: {
        status: 'cancelled',
        errorMessage: 'Cancelled by user',
      },
    });

    return { success: true, message: 'Report cancelled successfully' };
  }

  /**
   * Retry a failed report
   */
  async retryReport(reportId: string, userId: string, userRole?: string): Promise<{ success: boolean; jobId: string }> {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.generatedBy !== userId) {
      throw new BadRequestException('You can only retry your own reports');
    }

    if (report.status !== 'failed' && report.status !== 'cancelled') {
      throw new BadRequestException('Can only retry failed or cancelled reports');
    }

    // Parse the configuration
    const config = report.configuration as any;

    // Reset report status
    await this.prisma.generatedReport.update({
      where: { id: reportId },
      data: {
        status: 'pending',
        errorMessage: null,
      },
    });

    // Re-queue the job with retry options
    const job = await this.reportQueue.add(
      'generate-report',
      {
        userId,
        userRole,
        reportType: report.reportType,
        config: {
          type: report.reportType,
          columns: config?.columns || [],
          filters: config?.filters || {},
          groupBy: config?.groupBy,
          sortBy: config?.sortBy,
          sortOrder: config?.sortOrder,
          format: report.format,
        },
        reportId: report.id,
      } as ReportJobData,
      this.QUEUE_OPTIONS,
    );

    return { success: true, jobId: job.id as string };
  }

  /**
   * Delete a report (only if completed, failed, or cancelled)
   */
  async deleteReport(reportId: string, userId: string): Promise<{ success: boolean }> {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.generatedBy !== userId) {
      throw new BadRequestException('You can only delete your own reports');
    }

    if (report.status === 'pending' || report.status === 'processing') {
      throw new BadRequestException('Cannot delete an active report. Cancel it first.');
    }

    await this.prisma.generatedReport.delete({
      where: { id: reportId },
    });

    return { success: true };
  }

  /**
   * Get failed reports for retry
   */
  async getFailedReports(userId: string): Promise<any[]> {
    return this.prisma.generatedReport.findMany({
      where: {
        generatedBy: userId,
        status: { in: ['failed', 'cancelled'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        reportType: true,
        reportName: true,
        status: true,
        format: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  }
}
