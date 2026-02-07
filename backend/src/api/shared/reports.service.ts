import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ReportBuilderService } from '../../domain/report/builder/report-builder.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface GenerateReportDto {
  type: string;
  columns?: string[];
  filters?: any;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  format?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilderService: ReportBuilderService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get report catalog based on user role
   */
  async getReportCatalog(userRole: string) {
    try {
      const catalog = this.reportBuilderService.getReportCatalog(userRole);

      return {
        reports: catalog,
        total: catalog.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get report catalog for role ${userRole}`, error.stack);
      throw error;
    }
  }

  /**
   * Get report configuration by type
   */
  async getReportConfig(type: string) {
    try {
      const config = this.reportBuilderService.getReportConfig(type);

      if (!config) {
        throw new NotFoundException(`Report configuration not found for type: ${type}`);
      }

      return config;
    } catch (error) {
      this.logger.error(`Failed to get report config for type ${type}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a report
   */
  async generateReport(userId: string, userRole: string, reportDto: GenerateReportDto) {
    try {
      const { type, columns = [], filters = {}, groupBy, sortBy, sortOrder, format = 'excel' } = reportDto;

      // Build config object
      const validFormats = ['excel', 'csv', 'pdf', 'json'] as const;
      const validFormat = validFormats.includes(format as any)
        ? (format as 'excel' | 'csv' | 'pdf' | 'json')
        : 'excel';

      const config = {
        type,
        columns,
        filters: filters as Record<string, unknown>,
        groupBy,
        sortBy,
        sortOrder,
        format: validFormat,
      };

      // Queue the report generation with user role for admin checks
      const result = await this.reportBuilderService.queueReportGeneration(
        userId,
        type,
        config,
        userRole,
      );

      // Audit log for report generation
      this.auditService.log({
        action: AuditAction.REPORT_GENERATE,
        entityType: 'GeneratedReport',
        entityId: result.reportId,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        description: `Report generation initiated: ${type} (${format})`,
        newValues: {
          reportType: type,
          format,
          columns: columns.length,
          filters,
        },
      }).catch(() => {});

      this.logger.log(`Report generation queued: ${result.reportId} for user ${userId} (role: ${userRole})`);

      return {
        success: true,
        reportId: result.reportId,
        jobId: result.jobId,
        message: 'Report generation initiated',
      };
    } catch (error) {
      this.logger.error(`Failed to generate report for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get report status by ID
   */
  async getReportStatus(reportId: string, userId: string) {
    try {
      const report = await this.prisma.generatedReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          reportType: true,
          reportName: true,
          status: true,
          format: true,
          fileUrl: true,
          totalRecords: true,
          errorMessage: true,
          generatedAt: true,
          generatedBy: true,
        },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      // Verify user has access to this report
      if (report.generatedBy !== userId) {
        throw new NotFoundException('Report not found');
      }

      return {
        id: report.id,
        type: report.reportType,
        name: report.reportName,
        status: report.status,
        format: report.format,
        downloadUrl: report.fileUrl,
        totalRecords: report.totalRecords,
        errorMessage: report.errorMessage,
        generatedAt: report.generatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get report status ${reportId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a report by ID (alias for status/details)
   */
  async getReport(userId: string, reportId: string) {
    return this.getReportStatus(reportId, userId);
  }

  /**
   * Download a report
   */
  async downloadReport(reportId: string, userId: string) {
    try {
      const report = await this.prisma.generatedReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          fileUrl: true,
          status: true,
          generatedBy: true,
          expiresAt: true,
        },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      // Verify user has access to this report
      if (report.generatedBy !== userId) {
        throw new NotFoundException('Report not found');
      }

      // Check if report is completed
      if (report.status !== 'completed') {
        throw new Error('Report is not ready for download');
      }

      // Check if report has expired
      if (report.expiresAt && new Date() > new Date(report.expiresAt)) {
        throw new Error('Report has expired');
      }

      // Audit log for report download
      this.auditService.log({
        action: AuditAction.REPORT_DOWNLOAD,
        entityType: 'GeneratedReport',
        entityId: reportId,
        userId,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        description: `Report downloaded: ${reportId}`,
      }).catch(() => {});

      return {
        url: report.fileUrl,
        expiresAt: report.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to download report ${reportId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get report history for a user
   */
  async getReportHistory(userId: string, pagination?: PaginationParams) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      const [reports, total] = await Promise.all([
        this.prisma.generatedReport.findMany({
          where: { generatedBy: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            reportType: true,
            reportName: true,
            status: true,
            format: true,
            fileUrl: true,
            totalRecords: true,
            generatedAt: true,
            expiresAt: true,
          },
        }),
        this.prisma.generatedReport.count({
          where: { generatedBy: userId },
        }),
      ]);

      return {
        data: reports,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get report history for user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a report from history
   */
  async deleteReport(reportId: string, userId: string) {
    try {
      const report = await this.prisma.generatedReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          reportName: true,
          reportType: true,
          format: true,
          generatedBy: true,
        },
      });

      if (!report) {
        throw new NotFoundException('Report not found');
      }

      // Verify user has access to this report
      if (report.generatedBy !== userId) {
        throw new NotFoundException('Report not found');
      }

      // Delete the report
      await this.prisma.generatedReport.delete({
        where: { id: reportId },
      });

      // Audit log the deletion
      this.auditService.log({
        action: AuditAction.BULK_OPERATION,
        entityType: 'GeneratedReport',
        entityId: reportId,
        userId,
        description: `Generated report deleted: ${report.reportName} (${report.reportType})`,
        category: AuditCategory.DATA_MANAGEMENT,
        severity: AuditSeverity.LOW,
        oldValues: {
          id: report.id,
          name: report.reportName,
          type: report.reportType,
          format: report.format,
        },
      }).catch(() => {}); // Non-blocking audit

      this.logger.log(`Report ${reportId} deleted by user ${userId}`);

      return {
        success: true,
        message: 'Report deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete report ${reportId}`, error.stack);
      throw error;
    }
  }
}
