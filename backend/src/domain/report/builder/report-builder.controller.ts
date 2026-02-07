import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../../core/config/throttle.config';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { ReportBuilderService } from './report-builder.service';
import { GenerateReportDto, validateReportFilters } from './dto/generate-report.dto';
import { ReportHistoryDto } from './dto/report-history.dto';
import { FileStorageService } from '../../../infrastructure/file-storage/file-storage.service';

@Controller('shared/reports')
@UseGuards(JwtAuthGuard)
export class ReportBuilderController {
  private readonly logger = new Logger(ReportBuilderController.name);

  constructor(
    private reportBuilderService: ReportBuilderService,
    private fileStorageService: FileStorageService,
  ) {}

  /**
   * Transform filters to normalize dateRange arrays to startDate/endDate
   * Handles frontend DatePicker ranges which come as arrays
   */
  private transformFilters(filters: Record<string, unknown>): Record<string, unknown> {
    if (!filters) return {};

    const transformed = { ...filters };

    // Transform dateRange arrays to startDate/endDate
    if (Array.isArray(filters.dateRange) && filters.dateRange.length === 2) {
      const [start, end] = filters.dateRange;
      // Handle both ISO strings and date objects
      transformed.startDate = typeof start === 'string' ? start : start?.toISOString?.() || start;
      transformed.endDate = typeof end === 'string' ? end : end?.toISOString?.() || end;
      delete transformed.dateRange;
    }

    // Also handle any other date range fields
    Object.keys(transformed).forEach((key) => {
      const value = transformed[key];
      if (Array.isArray(value) && value.length === 2) {
        const [start, end] = value;
        // Check if both elements look like dates
        const isDateArray = (start instanceof Date || (typeof start === 'string' && /^\d{4}-\d{2}/.test(start))) &&
                           (end instanceof Date || (typeof end === 'string' && /^\d{4}-\d{2}/.test(end)));
        if (isDateArray && key.toLowerCase().includes('date')) {
          const baseName = key.replace(/Range$/i, '');
          transformed[`${baseName}Start`] = typeof start === 'string' ? start : start?.toISOString?.() || start;
          transformed[`${baseName}End`] = typeof end === 'string' ? end : end?.toISOString?.() || end;
          delete transformed[key];
        }
      }
    });

    return transformed;
  }

  // ==================== Health Check ====================

  /**
   * Check MinIO storage health
   */
  @Get('storage/health')
  async checkStorageHealth() {
    try {
      const isConnected = this.fileStorageService.isMinioConnected();
      return {
        success: true,
        data: {
          connected: isConnected,
          message: isConnected ? 'MinIO is connected' : 'MinIO is not connected',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ==================== Catalog & Configuration (specific routes first) ====================

  /**
   * Get available report types grouped by category
   */
  @Get('catalog')
  async getReportCatalog(@Req() req: any) {
    const userRole = req.user.role;
    const catalog = this.reportBuilderService.getReportCatalog(userRole);
    return {
      success: true,
      data: catalog,
    };
  }

  /**
   * Get report configuration/filters
   */
  @Get('config/:type')
  async getReportConfig(@Param('type') type: string) {
    const config = this.reportBuilderService.getReportConfig(type);
    if (!config) {
      return {
        success: false,
        message: 'Report type not found',
      };
    }
    return {
      success: true,
      data: config,
    };
  }

  /**
   * Get dynamic filter values
   */
  @Get('filters/:reportType/:filterId')
  async getFilterValues(
    @Param('reportType') reportType: string,
    @Param('filterId') filterId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    try {
      const values = await this.reportBuilderService.getFilterValues(
        reportType,
        filterId,
        institutionId,
      );
      return {
        success: true,
        data: values,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ==================== Template Endpoints (before :id routes) ====================

  /**
   * Get user's templates
   */
  @Get('templates/list')
  async getTemplates(
    @Req() req: any,
    @Query('reportType') reportType?: string,
  ) {
    const userId = req.user.userId;
    const templates = await this.reportBuilderService.getTemplates(
      userId,
      reportType,
    );

    return {
      success: true,
      data: templates,
    };
  }

  /**
   * Save report template
   */
  @Post('templates')
  async saveTemplate(@Req() req: any, @Body() body: any) {
    const userId = req.user.userId;

    const result = await this.reportBuilderService.saveTemplate(userId, {
      name: body.name,
      description: body.description,
      reportType: body.reportType,
      configuration: body.configuration,
      isPublic: body.isPublic,
    });

    return {
      success: true,
      message: 'Template saved successfully',
      data: result,
    };
  }

  /**
   * Delete template
   */
  @Delete('templates/:id')
  async deleteTemplate(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;

    await this.reportBuilderService.deleteTemplate(id, userId);

    return {
      success: true,
      message: 'Template deleted successfully',
    };
  }

  // ==================== Report Generation ====================

  /**
   * Queue report generation (async)
   * Rate limited: 10 reports per minute per user to prevent queue flooding
   */
  @Post('generate')
  @Throttle({ default: THROTTLE_PRESETS.mutation })
  async generateReport(@Req() req: any, @Body() dto: GenerateReportDto) {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const institutionId = req.user.institutionId;

    // Validate format
    const validFormats = ['excel', 'csv', 'pdf', 'json'] as const;
    const format = validFormats.includes(dto.format as any)
      ? (dto.format as 'excel' | 'csv' | 'pdf' | 'json')
      : 'excel';

    // Transform filters (handle dateRange arrays, etc.)
    const transformedFilters = this.transformFilters(dto.filters || {});

    // Validate filters based on report type using class-validator DTOs
    const filterValidation = await validateReportFilters(dto.type, transformedFilters);
    if (!filterValidation.isValid) {
      this.logger.warn(`Filter validation failed for report ${dto.type}: ${filterValidation.errors.join(', ')}`);
      throw new BadRequestException({
        message: 'Invalid filter values',
        errors: filterValidation.errors,
      });
    }

    // Determine if user is admin (can view all institutions)
    const normalizedRole = userRole?.toUpperCase();
    const isAdmin = normalizedRole === 'STATE_DIRECTORATE' || normalizedRole === 'SYSTEM_ADMIN';
    this.logger.log(`User role: ${userRole}, isAdmin: ${isAdmin}, institutionId from token: ${institutionId}`);

    // Build config from DTO with validated filters
    // For admin users, don't auto-fill institutionId if they want to see all institutions
    const config = {
      type: dto.type,
      columns: dto.columns || [],
      filters: {
        ...transformedFilters,
        // Only auto-fill institutionId for non-admin users
        institutionId: transformedFilters.institutionId || (isAdmin ? undefined : institutionId),
      } as Record<string, unknown>,
      groupBy: dto.groupBy,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
      format,
    };

    this.logger.log(`Final institutionId in config: ${config.filters.institutionId}`);

    const result = await this.reportBuilderService.queueReportGeneration(
      userId,
      dto.type,
      config,
      userRole,
    );

    return {
      success: true,
      message: 'Report generation queued successfully',
      data: result,
    };
  }

  /**
   * Generate report synchronously
   * Rate limited: 5 sync reports per minute (more restrictive as sync is resource-intensive)
   */
  @Post('generate-sync')
  @Throttle({ default: THROTTLE_PRESETS.export })
  async generateReportSync(@Req() req: any, @Body() dto: GenerateReportDto) {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const institutionId = req.user.institutionId;

    // Validate format
    const validFormats = ['excel', 'csv', 'pdf', 'json'] as const;
    const format = validFormats.includes(dto.format as any)
      ? (dto.format as 'excel' | 'csv' | 'pdf' | 'json')
      : 'excel';

    // Transform filters (handle dateRange arrays, etc.)
    const transformedFilters = this.transformFilters(dto.filters || {});

    // Validate filters based on report type using class-validator DTOs
    const filterValidation = await validateReportFilters(dto.type, transformedFilters);
    if (!filterValidation.isValid) {
      this.logger.warn(`Filter validation failed for report ${dto.type}: ${filterValidation.errors.join(', ')}`);
      throw new BadRequestException({
        message: 'Invalid filter values',
        errors: filterValidation.errors,
      });
    }

    // Determine if user is admin (can view all institutions)
    const normalizedRole = userRole?.toUpperCase();
    const isAdmin = normalizedRole === 'STATE_DIRECTORATE' || normalizedRole === 'SYSTEM_ADMIN';
    this.logger.log(`[Sync] User role: ${userRole}, isAdmin: ${isAdmin}, institutionId from token: ${institutionId}`);

    const config = {
      type: dto.type,
      columns: dto.columns || [],
      filters: {
        ...transformedFilters,
        // Only auto-fill institutionId for non-admin users
        institutionId: transformedFilters.institutionId || (isAdmin ? undefined : institutionId),
      } as Record<string, unknown>,
      groupBy: dto.groupBy,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
      format,
    };

    this.logger.log(`[Sync] Final institutionId in config: ${config.filters.institutionId}`);

    const result = await this.reportBuilderService.generateReportSync(
      userId,
      dto.type,
      config,
    );

    return {
      success: true,
      data: result,
    };
  }

  // ==================== Queue Management ====================

  /**
   * Get queue statistics
   * Returns queue counts for waiting, active, completed, failed, and delayed jobs.
   * May return partial data if Redis connection issues occur.
   */
  @Get('queue/stats')
  async getQueueStats() {
    try {
      const stats = await this.reportBuilderService.getQueueStats();
      return {
        success: !stats.error,
        data: stats,
        message: stats.error || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      return {
        success: false,
        data: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        },
        message: 'Failed to retrieve queue statistics',
      };
    }
  }

  /**
   * Get active/pending reports for current user
   */
  @Get('queue/active')
  async getActiveReports(@Req() req: any) {
    const userId = req.user.userId;
    const reports = await this.reportBuilderService.getActiveReports(userId);
    return {
      success: true,
      data: reports,
    };
  }

  /**
   * Get failed reports for current user
   */
  @Get('queue/failed')
  async getFailedReports(@Req() req: any) {
    const userId = req.user.userId;
    const reports = await this.reportBuilderService.getFailedReports(userId);
    return {
      success: true,
      data: reports,
    };
  }

  /**
   * Cancel a report
   */
  @Post('cancel/:id')
  async cancelReport(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    const result = await this.reportBuilderService.cancelReport(id, userId);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Retry a failed report
   */
  @Post('retry/:id')
  async retryReport(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    const userRole = req.user.role;
    const result = await this.reportBuilderService.retryReport(id, userId, userRole);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Delete a report
   */
  @Delete('report/:id')
  async deleteReport(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    const result = await this.reportBuilderService.deleteReport(id, userId);
    return {
      success: true,
      ...result,
    };
  }

  // ==================== Report History (root route) ====================

  /**
   * Get user's report history
   */
  @Get()
  async getReportHistory(@Req() req: any, @Query() query: ReportHistoryDto) {
    const userId = req.user.userId;
    const pagination = {
      page: query.page || 1,
      limit: query.limit || 10,
    };

    const result = await this.reportBuilderService.getReportHistory(
      userId,
      pagination,
    );

    return {
      success: true,
      data: result,
    };
  }

  // ==================== Report by ID (parameterized routes last) ====================

  /**
   * Get report status (lightweight)
   */
  @Get(':id/status')
  async getReportStatus(@Param('id') id: string) {
    const report = await this.reportBuilderService.getReportStatus(id);

    if (!report) {
      return {
        success: false,
        message: 'Report not found',
      };
    }

    return {
      success: true,
      data: report,
    };
  }

  /**
   * Download generated report - streams file from MinIO
   */
  @Get(':id/download')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    this.logger.log(`Download request for report: ${id}`);

    const report = await this.reportBuilderService.getReportStatus(id);

    if (!report) {
      this.logger.warn(`Report not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    this.logger.log(`Report status: ${report.status}, format: ${report.format}`);

    if (report.status !== 'completed') {
      this.logger.warn(`Report not ready: ${id}, status: ${report.status}`);
      return res.status(400).json({
        success: false,
        message: 'Report is not ready for download',
        status: report.status,
      });
    }

    if (!report.fileUrl) {
      this.logger.warn(`Report has no file URL: ${id}`);
      return res.status(400).json({
        success: false,
        message: 'Report file not available',
      });
    }

    try {
      // Extract file key from URL
      // URL format: http://localhost:9000/bucket-name/path/to/file.xlsx
      this.logger.log(`Processing download for fileUrl: ${report.fileUrl}`);

      let fileKey: string;

      try {
        const url = new URL(report.fileUrl);
        const pathParts = url.pathname.split('/');
        this.logger.log(`URL pathname: ${url.pathname}`);
        this.logger.log(`Path parts: ${JSON.stringify(pathParts)}`);

        // Remove empty first element and bucket name
        // Path: /bucket-name/reports/type/filename.xlsx -> reports/type/filename.xlsx
        fileKey = pathParts.slice(2).join('/');
      } catch {
        // If URL parsing fails, treat fileUrl as the key directly
        this.logger.warn(`Could not parse fileUrl as URL, using as key directly`);
        fileKey = report.fileUrl;
      }

      if (!fileKey) {
        throw new Error('Could not extract file key from URL');
      }

      // SECURITY: Validate file key to prevent path traversal attacks
      // 1. Remove any path traversal sequences
      // 2. Ensure key starts with expected prefixes (reports/ or institutions/)
      // 3. Block absolute paths and null bytes
      const sanitizedKey = fileKey
        .replace(/\.\./g, '') // Remove path traversal
        .replace(/\0/g, '')   // Remove null bytes
        .replace(/^\/+/, ''); // Remove leading slashes

      // Validate the key matches expected report file patterns
      const validPrefixes = ['reports/', 'institutions/'];
      const hasValidPrefix = validPrefixes.some(prefix => sanitizedKey.startsWith(prefix));

      if (!hasValidPrefix) {
        this.logger.error(`Invalid file key prefix: ${sanitizedKey}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid report file path',
        });
      }

      // Validate file extension
      const validExtensions = ['.xlsx', '.csv', '.pdf', '.json'];
      const hasValidExtension = validExtensions.some(ext => sanitizedKey.toLowerCase().endsWith(ext));

      if (!hasValidExtension) {
        this.logger.error(`Invalid file extension in key: ${sanitizedKey}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid report file type',
        });
      }

      fileKey = sanitizedKey;
      this.logger.log(`Validated file key: ${fileKey}`);
      this.logger.log(`MinIO connected: ${this.fileStorageService.isMinioConnected()}`);

      // Get file from MinIO
      const fileBuffer = await this.fileStorageService.getFile(fileKey);
      this.logger.log(`Retrieved file buffer: ${fileBuffer.length} bytes`);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Retrieved file is empty');
      }

      // Determine content type and filename
      const extension = report.format === 'excel' ? 'xlsx' : report.format;
      const contentTypes: Record<string, string> = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf',
        csv: 'text/csv',
        json: 'application/json',
      };
      const contentType = contentTypes[extension] || 'application/octet-stream';
      const filename = `${report.type}_${new Date().toISOString().split('T')[0]}.${extension}`;

      this.logger.log(`Sending file: ${filename}, type: ${contentType}, size: ${fileBuffer.length}`);

      // Set headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send the file buffer
      return res.end(fileBuffer);
    } catch (error) {
      this.logger.error(`Failed to download report ${id}: ${error.message}`);
      this.logger.error(error.stack);
      return res.status(500).json({
        success: false,
        message: 'Failed to download report file',
        error: error.message,
      });
    }
  }

  /**
   * Get full report details (must be last to not catch other routes)
   */
  @Get(':id')
  async getReport(@Param('id') id: string) {
    const report = await this.reportBuilderService.getReportStatus(id);

    if (!report) {
      return {
        success: false,
        message: 'Report not found',
      };
    }

    return {
      success: true,
      data: report,
    };
  }
}
