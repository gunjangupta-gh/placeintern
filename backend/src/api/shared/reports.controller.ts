import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';

@Controller('shared/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Get('catalog')
  async getReportCatalog(@Request() req) {
    return this.reportsService.getReportCatalog(req.user.role);
  }

  @Get('config/:type')
  async getReportConfig(@Param('type') type: string) {
    return this.reportsService.getReportConfig(type);
  }

  @Post('generate')
  async generateReport(@Request() req, @Body() reportData: any) {
    return this.reportsService.generateReport(req.user.userId, req.user.role, reportData);
  }

  @Get('history')
  async getReportHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getReportHistory(req.user.userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get(':id')
  async getReport(@Param('id') id: string, @Request() req) {
    return this.reportsService.getReport(req.user.userId, id);
  }

  @Get(':id/download')
  async downloadReport(
    @Param('id') id: string,
    @Request() req,
    @Res() res: Response,
  ) {
    this.logger.log(`Download request for report: ${id}`);

    try {
      // Get report info from service
      const reportInfo = await this.reportsService.downloadReport(id, req.user.userId);

      if (!reportInfo.url) {
        return res.status(400).json({
          success: false,
          message: 'Report file not available',
        });
      }

      // Extract file key from URL
      this.logger.log(`Processing download for fileUrl: ${reportInfo.url}`);

      let fileKey: string;
      try {
        const url = new URL(reportInfo.url);
        const pathParts = url.pathname.split('/');
        // Remove empty first element and bucket name
        fileKey = pathParts.slice(2).join('/');
      } catch {
        this.logger.warn(`Could not parse fileUrl as URL, using as key directly`);
        fileKey = reportInfo.url;
      }

      if (!fileKey) {
        throw new Error('Could not extract file key from URL');
      }

      this.logger.log(`Extracted file key: ${fileKey}`);

      // Get file from MinIO
      const fileBuffer = await this.fileStorageService.getFile(fileKey);
      this.logger.log(`Retrieved file buffer: ${fileBuffer.length} bytes`);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Retrieved file is empty');
      }

      // Determine content type and filename from the file key
      const extension = fileKey.split('.').pop()?.toLowerCase() || 'xlsx';
      const contentTypes: Record<string, string> = {
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        pdf: 'application/pdf',
        csv: 'text/csv',
        json: 'application/json',
      };
      const contentType = contentTypes[extension] || 'application/octet-stream';
      const filename = fileKey.split('/').pop() || `report.${extension}`;

      this.logger.log(`Sending file: ${filename}, type: ${contentType}, size: ${fileBuffer.length}`);

      // Set headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Cache-Control', 'no-cache');

      // Send the file buffer
      res.end(fileBuffer);
    } catch (error) {
      this.logger.error(`Failed to download report ${id}: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to download report file',
      });
    }
  }
}
