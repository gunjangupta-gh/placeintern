import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { ReportGeneratorService } from './report-generator.service';
import { ExcelService } from './export/excel.service';
import { PdfService } from './export/pdf.service';
import { CsvService } from './export/csv.service';
import {
  ReportJobData,
  ReportStatus,
  ExportFormat,
  ReportType,
  ExportConfig,
} from './interfaces/report.interface';
import { FileStorageService } from '../../../infrastructure/file-storage/file-storage.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';

@Processor('report-generation')
@Injectable()
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private prisma: PrismaService,
    private reportGenerator: ReportGeneratorService,
    private excelService: ExcelService,
    private pdfService: PdfService,
    private csvService: CsvService,
    private fileStorage: FileStorageService,
    private webSocketService: WebSocketService,
  ) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<any> {
    const { userId, userRole, reportType, config: jobConfig, reportId } = job.data;

    // Extract format from config or use default
    const formatStr = jobConfig?.format || job.data.format || 'excel';
    let filters = jobConfig?.filters || job.data.filters || {};
    const selectedColumns = jobConfig?.columns || [];

    // Transform dateRange arrays to Start/End fields (in case controller transformation didn't work)
    filters = this.transformDateRangeFilters(filters);

    // Determine if user is admin (can view all institutions)
    const normalizedRole = userRole?.toUpperCase();
    const isAdmin = normalizedRole === 'STATE_DIRECTORATE' || normalizedRole === 'SYSTEM_ADMIN';
    this.logger.log(`User role: ${userRole}, normalized: ${normalizedRole}, isAdmin: ${isAdmin}`);

    // Convert string format to ExportFormat enum
    const formatMap: Record<string, ExportFormat> = {
      'excel': ExportFormat.EXCEL,
      'pdf': ExportFormat.PDF,
      'csv': ExportFormat.CSV,
      'json': ExportFormat.JSON,
    };
    const format = formatMap[formatStr] || ExportFormat.EXCEL;

    this.logger.log(
      `Processing report generation job ${job.id} for user ${userId}`,
    );
    this.logger.log(`Selected columns: ${selectedColumns.length > 0 ? selectedColumns.join(', ') : 'all'}`);

    try {
      // Update status to processing (with WebSocket notification)
      await this.updateReportStatus(reportId, ReportStatus.PROCESSING, null, null, userId, reportType);

      // Fetch data based on report type
      this.logger.log(`Fetching data for report type: ${reportType}, isAdmin: ${isAdmin}`);
      const data = await this.reportGenerator.generateReport(
        reportType as ReportType,
        filters,
        isAdmin,
      );

      if (!data || data.length === 0) {
        throw new Error('No data found for the given filters');
      }

      // Get report configuration with selected columns
      const config = this.getExportConfig(reportType, data, filters, userId, format, selectedColumns);

      // Generate file based on format
      this.logger.log(`Generating ${format} file`);
      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      const trainingSheetReports = new Set([
        'training-pre-test-responses',
        'training-post-test-responses',
        'training-wise-compliance',
      ]);

      switch (format) {
        case ExportFormat.EXCEL:
          if (trainingSheetReports.has(reportType)) {
            const sheets = this.buildTrainingSheets(config, data);
            fileBuffer = await this.excelService.generateMultiSheetExcel(
              config.title,
              sheets,
            );
          } else {
            fileBuffer = await this.excelService.generateExcel(config);
          }
          fileName = `${reportType}_${Date.now()}.xlsx`;
          mimeType =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;

        case ExportFormat.PDF:
          fileBuffer = await this.pdfService.generatePdf(config);
          fileName = `${reportType}_${Date.now()}.pdf`;
          mimeType = 'application/pdf';
          break;

        case ExportFormat.CSV:
          fileBuffer = await this.csvService.generateCsv(config);
          fileName = `${reportType}_${Date.now()}.csv`;
          mimeType = 'text/csv';
          break;

        case ExportFormat.JSON:
          // Generate JSON export with structured data
          const jsonData = {
            title: config.title,
            generatedAt: new Date().toISOString(),
            generatedBy: config.metadata?.generatedBy,
            filters: config.metadata?.filters,
            totalRecords: config.data.length,
            columns: config.columns.map(col => ({
              field: col.field,
              header: col.header,
              type: col.type,
            })),
            data: config.data,
          };
          fileBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');
          fileName = `${reportType}_${Date.now()}.json`;
          mimeType = 'application/json';
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Validate buffer before upload
      this.logger.log(`Generated file buffer size: ${fileBuffer?.length || 0} bytes`);

      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('Generated file buffer is empty');
      }

      // Upload to MinIO
      this.logger.log('Uploading file to MinIO');
      const institutionId = filters?.institutionId as string;

      // Get institution name for folder structure
      let institutionName: string | undefined;
      if (institutionId) {
        const institution = await this.prisma.institution.findUnique({
          where: { id: institutionId },
          select: { name: true },
        });
        institutionName = institution?.name;
      }

      const formatExtMap: Record<ExportFormat, string> = {
        [ExportFormat.EXCEL]: 'xlsx',
        [ExportFormat.PDF]: 'pdf',
        [ExportFormat.CSV]: 'csv',
        [ExportFormat.JSON]: 'json',
      };
      const formatExt = formatExtMap[format] || 'xlsx';

      const uploadResult = await this.fileStorage.uploadReport(fileBuffer, {
        institutionName,
        reportType,
        format: formatExt,
      });

      this.logger.log(`Upload complete. File size: ${uploadResult.size} bytes, URL: ${uploadResult.url}`);

      // Update report status to completed (with WebSocket notification)
      await this.updateReportStatus(
        reportId,
        ReportStatus.COMPLETED,
        uploadResult.url,
        null,
        userId,
        reportType,
        data.length,
      );

      // Send notification to user (non-blocking)
      this.sendNotification(userId, reportType, uploadResult.url).catch((err) => {
        this.logger.warn(`Failed to send notification: ${err.message}`);
      });

      this.logger.log(`Report generation completed for job ${job.id}`);

      return {
        success: true,
        downloadUrl: uploadResult.url,
      };
    } catch (error) {
      this.logger.error(
        `Error processing report generation job ${job.id}:`,
        error,
      );

      // Update report status to failed (with WebSocket notification)
      await this.updateReportStatus(
        reportId,
        ReportStatus.FAILED,
        null,
        error.message,
        userId,
        reportType,
      );

      throw error;
    }
  }

  /**
   * Transform dateRange arrays to Start/End fields
   * e.g., startDateRange: [date1, date2] -> startDateStart: date1, startDateEnd: date2
   */
  private transformDateRangeFilters(filters: Record<string, unknown>): Record<string, unknown> {
    if (!filters) return {};

    const transformed = { ...filters };

    Object.keys(transformed).forEach((key) => {
      const value = transformed[key];
      if (Array.isArray(value) && value.length === 2) {
        const [start, end] = value;
        // Check if both elements look like dates (ISO strings)
        const isDateArray = (typeof start === 'string' && /^\d{4}-\d{2}/.test(start)) &&
                           (typeof end === 'string' && /^\d{4}-\d{2}/.test(end));
        if (isDateArray && key.toLowerCase().includes('date')) {
          const baseName = key.replace(/Range$/i, '');
          transformed[`${baseName}Start`] = start;
          transformed[`${baseName}End`] = end;
          delete transformed[key];
          this.logger.log(`[ReportProcessor] Transformed ${key} to ${baseName}Start and ${baseName}End`);
        }
      }
    });

    return transformed;
  }

  /**
   * Update report status in database and emit WebSocket event
   */
  private async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    downloadUrl?: string,
    errorMessage?: string,
    userId?: string,
    reportType?: string,
    totalRecords?: number,
  ) {
    try {
      const updateData: Record<string, unknown> = {
        status: status,
      };

      if (status === ReportStatus.COMPLETED && downloadUrl) {
        updateData.fileUrl = downloadUrl;
        updateData.generatedAt = new Date();
      }

      if (status === ReportStatus.FAILED && errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      const updatedReport = await this.prisma.generatedReport.update({
        where: { id: reportId },
        data: updateData,
      });

      this.logger.log(`Report ${reportId} status updated to ${status}`);

      // Emit WebSocket event for real-time updates
      if (userId) {
        this.webSocketService.sendReportStatus(userId, {
          reportId,
          status: status.toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed',
          reportType,
          reportName: updatedReport.reportName,
          format: updatedReport.format,
          totalRecords,
          fileUrl: downloadUrl,
          errorMessage,
          generatedAt: updatedReport.generatedAt,
        });
      }
    } catch (err) {
      this.logger.error(`Failed to update report status: ${err.message}`);
    }
  }

  /**
   * Get export configuration
   */
  private getExportConfig(
    reportType: string,
    data: any[],
    filters: any,
    userId: string,
    format: ExportFormat,
    selectedColumns: string[] = [],
  ): ExportConfig {
    // Normalize report type for matching
    const normalizedType = reportType.toLowerCase().replace(/-/g, '_');

    // Title mapping - supports both enum values and string variants
    const reportTitles: Record<string, string> = {
      'student_progress': 'Student Progress Report',
      'student_directory': 'Student Directory Report',
      'student_placement_interest_ppo': 'Student Placement Interest & PPO Report',
      'internship': 'Internship Report',
      'internship_applications': 'Internship Applications Report',
      'internship_status': 'Internship Status Report',
      'self_identified_internships': 'Self-Identified Internships Report',
      'joining_report_status': 'Joining Report Status',
      'faculty_visit_compliance': 'Faculty Visit Compliance Report',
      'faculty_visit_details': 'Faculty Visit Details Report',
      'faculty_visit': 'Faculty Visit Report',
      'mentor_list': 'Mentor List Report',
      'monthly': 'Monthly Report',
      'monthly_report_status': 'Monthly Report Status',
      'placement': 'Placement Report',
      'institution_performance': 'Institution Performance Report',
      'internship_by_institution': 'Internships by Institution Report',
      'industry_wise_students_stipend': 'Industry-wise Student Distribution & Stipend Analysis',
      'top_institutes_per_industry': 'Top 3 Institutes per Industry/Company',
      'principal_visit_logs': 'Principal Visit Logs Report',
      'principal_visit_summary': 'Principal Visit Summary Report',
      'user_login_activity': 'User Login Activity Report',
      'training_feedback_responses': 'Training Feedback Responses Report',
      'training_pre_test_responses': 'Training Pre-Test Responses Report',
      'training_post_test_responses': 'Training Post-Test Responses Report',
      'training_wise_summary': 'Training-wise Summary Report',
      'training_non_compliance': 'Training Non-Compliance Report',
    };

    // Column mapping - matches actual data fields from generator
    const reportColumns: Record<string, any[]> = {
      // Student reports - matches generateStudentProgressReport output
      'student_progress': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'phoneNumber', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'branch', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'currentYear', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'currentSemester', header: 'Semester', type: 'number' as const, width: 10 },
        { field: 'internshipsCount', header: 'Internships', type: 'number' as const, width: 12 },
        { field: 'placementsCount', header: 'Placements', type: 'number' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'studentActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
        { field: 'userActive', header: 'User Active', type: 'boolean' as const, width: 12 },
      ],
      'student_directory': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'phoneNumber', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'currentYear', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'currentSemester', header: 'Semester', type: 'number' as const, width: 10 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'internshipStatus', header: 'Internship Status', type: 'string' as const, width: 15 },
        { field: 'internshipsCount', header: 'Internships', type: 'number' as const, width: 12 },
        { field: 'placementsCount', header: 'Placements', type: 'number' as const, width: 12 },
        { field: 'studentActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
        { field: 'userActive', header: 'User Active', type: 'boolean' as const, width: 12 },
      ],
      'student_placement_interest_ppo': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 22 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 28 },
        { field: 'branchName', header: 'Branch Name (Course)', type: 'string' as const, width: 22 },
        { field: 'planAfterDiploma', header: 'Plan After Diploma', type: 'string' as const, width: 18 },
        { field: 'interestedForPrivateJob', header: 'Job Location Preference', type: 'string' as const, width: 20 },
        { field: 'expectedSalary', header: 'Expected Salary Range', type: 'string' as const, width: 18 },
        { field: 'prePlacementOfferReceived', header: 'PPO Received', type: 'boolean' as const, width: 12 },
        { field: 'prePlacementOfferCompany', header: 'PPO Company', type: 'string' as const, width: 22 },
        { field: 'prePlacementOfferMarkedAt', header: 'PPO Marked At', type: 'date' as const, width: 18 },
        { field: 'interestSubmittedAt', header: 'Interest Submitted At', type: 'date' as const, width: 18 },
        { field: 'interestUpdatedAt', header: 'Interest Updated At', type: 'date' as const, width: 18 },
      ],
      // Internship reports - matches generateInternshipReport output
      'internship': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'jobProfile', header: 'Job Profile', type: 'string' as const, width: 20 },
        { field: 'appliedDate', header: 'Applied Date', type: 'date' as const, width: 12 },
        { field: 'startDate', header: 'Start Date', type: 'date' as const, width: 12 },
        { field: 'endDate', header: 'End Date', type: 'date' as const, width: 12 },
        { field: 'duration', header: 'Duration', type: 'string' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'reportsSubmitted', header: 'Reports', type: 'number' as const, width: 10 },
        { field: 'location', header: 'Location', type: 'string' as const, width: 15 },
        { field: 'isSelfIdentified', header: 'Self Identified', type: 'boolean' as const, width: 12 },
        { field: 'isActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
      ],
      // Self-identified internships report
      'self_identified_internships': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'phoneNumber', header: 'Phone Number', type: 'string' as const, width: 15 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'companyCity', header: 'Company City', type: 'string' as const, width: 15 },
        { field: 'companyAddress', header: 'Company Address', type: 'string' as const, width: 30 },
        { field: 'companyContact', header: 'Company Contact', type: 'string' as const, width: 15 },
        { field: 'companyEmail', header: 'Company Email', type: 'string' as const, width: 25 },
        { field: 'hrName', header: 'HR Name', type: 'string' as const, width: 18 },
        { field: 'hrDesignation', header: 'HR Designation', type: 'string' as const, width: 15 },
        { field: 'hrContact', header: 'HR Contact', type: 'string' as const, width: 15 },
        { field: 'hrEmail', header: 'HR Email', type: 'string' as const, width: 25 },
        { field: 'jobProfile', header: 'Job Profile', type: 'string' as const, width: 20 },
        { field: 'stipend', header: 'Stipend', type: 'number' as const, width: 12 },
        { field: 'appliedDate', header: 'Applied Date', type: 'date' as const, width: 12 },
        { field: 'startDate', header: 'Start Date', type: 'date' as const, width: 12 },
        { field: 'endDate', header: 'End Date', type: 'date' as const, width: 12 },
        { field: 'duration', header: 'Duration', type: 'string' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'internshipStatus', header: 'Internship Status', type: 'string' as const, width: 15 },
        { field: 'verificationStatus', header: 'Verification', type: 'string' as const, width: 12 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'mentorEmail', header: 'Mentor Email', type: 'string' as const, width: 25 },
        { field: 'mentorPhone', header: 'Mentor Phone', type: 'string' as const, width: 15 },
        { field: 'applicationFillRate', header: 'Fill Rate %', type: 'number' as const, width: 12 },
        { field: 'joiningLetterStatus', header: 'Joining Letter', type: 'string' as const, width: 15 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 12 },
      ],
      // Internship by Institution report - matches generateInternshipByInstitutionReport output
      'internship_by_institution': [
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 30 },
        { field: 'totalStudents', header: 'Total Students', type: 'number' as const, width: 12 },
        { field: 'activeInternships', header: 'Active Internships', type: 'number' as const, width: 15 },
        { field: 'completedInternships', header: 'Completed', type: 'number' as const, width: 12 },
        { field: 'pendingApplications', header: 'Pending', type: 'number' as const, width: 12 },
        { field: 'totalSubmittedVisits', header: 'Submitted Visits', type: 'number' as const, width: 15 },
        { field: 'totalSubmittedReports', header: 'Submitted Reports', type: 'number' as const, width: 15 },
        { field: 'totalJoiningLetters', header: 'Joining Report', type: 'number' as const, width: 15 },
        { field: 'internshipRate', header: 'Internship Rate %', type: 'number' as const, width: 15 },
      ],
      'internship_status': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'reportsSubmitted', header: 'Reports', type: 'number' as const, width: 10 },
        { field: 'isActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
      ],
      // Faculty/Mentor reports - matches generateFacultyVisitReport output
      'joining_report_status': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 22 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'internshipStartDate', header: 'Internship Start', type: 'date' as const, width: 15 },
        { field: 'joiningLetterStatus', header: 'Joining Letter Status', type: 'string' as const, width: 18 },
        { field: 'joiningLetterSubmittedAt', header: 'Submitted At', type: 'date' as const, width: 15 },
        { field: 'joiningLetterApprovedAt', header: 'Approved At', type: 'date' as const, width: 15 },
        { field: 'daysSinceStart', header: 'Days Since Start', type: 'number' as const, width: 14 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 20 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 10 },
      ],
      'faculty_visit_compliance': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 22 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'companyAddress', header: 'Company Address', type: 'string' as const, width: 35 },
        { field: 'reportMonth', header: 'Report Month', type: 'string' as const, width: 14 },
        { field: 'jan', header: 'Jan', type: 'number' as const, width: 8 },
        { field: 'feb', header: 'Feb', type: 'number' as const, width: 8 },
        { field: 'mar', header: 'Mar', type: 'number' as const, width: 8 },
        { field: 'apr', header: 'Apr', type: 'number' as const, width: 8 },
        { field: 'may', header: 'May', type: 'number' as const, width: 8 },
        { field: 'jun', header: 'Jun', type: 'number' as const, width: 8 },
        { field: 'jul', header: 'Jul', type: 'number' as const, width: 8 },
        { field: 'aug', header: 'Aug', type: 'number' as const, width: 8 },
        { field: 'sep', header: 'Sep', type: 'number' as const, width: 8 },
        { field: 'oct', header: 'Oct', type: 'number' as const, width: 8 },
        { field: 'nov', header: 'Nov', type: 'number' as const, width: 8 },
        { field: 'dec', header: 'Dec', type: 'number' as const, width: 8 },
        { field: 'internshipStartDate', header: 'Internship Start', type: 'date' as const, width: 15 },
        { field: 'mentorName', header: 'Mentor Name', type: 'string' as const, width: 20 },
        { field: 'requiredVisits', header: 'Required Visits', type: 'number' as const, width: 14 },
        { field: 'completedVisits', header: 'Completed Visits', type: 'number' as const, width: 14 },
        { field: 'pendingVisits', header: 'Pending Visits', type: 'number' as const, width: 14 },
        { field: 'compliancePercent', header: 'Compliance %', type: 'number' as const, width: 14 },
        { field: 'lastVisitDate', header: 'Last Visit Date', type: 'date' as const, width: 15 },
        { field: 'lastVisitType', header: 'Visit Type', type: 'string' as const, width: 14 },
      ],
      'faculty_visit_details': [
        { field: 'mentorName', header: 'Mentor Name', type: 'string' as const, width: 20 },
        { field: 'reportMonth', header: 'Report Month', type: 'string' as const, width: 14 },
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'companyAddress', header: 'Company Address', type: 'string' as const, width: 35 },
        { field: 'companyContact', header: 'Company Contact', type: 'string' as const, width: 15 },
        { field: 'visitDone', header: 'Visit Done', type: 'boolean' as const, width: 10 },
        { field: 'visitDate', header: 'Visit Date', type: 'date' as const, width: 12 },
        { field: 'visitType', header: 'Visit Type', type: 'string' as const, width: 12 },
        { field: 'visitLocation', header: 'Visit Location', type: 'string' as const, width: 20 },
        { field: 'visitNumber', header: 'Visit Number', type: 'number' as const, width: 12 },
        { field: 'visitStatus', header: 'Visit Status', type: 'string' as const, width: 12 },
        { field: 'titleOfProjectWork', header: 'Title of Project Work', type: 'string' as const, width: 30 },
        { field: 'assistanceRequiredFromInstitute', header: 'Assistance Required', type: 'string' as const, width: 30 },
        { field: 'responseFromOrganisation', header: 'Response from Organisation', type: 'string' as const, width: 30 },
        { field: 'remarksOfOrganisationSupervisor', header: 'Supervisor Remarks', type: 'string' as const, width: 30 },
        { field: 'significantChangeInPlan', header: 'Significant Change in Plan', type: 'string' as const, width: 30 },
        { field: 'observationsAboutStudent', header: 'Observations About Student', type: 'string' as const, width: 40 },
        { field: 'feedbackSharedWithStudent', header: 'Feedback Shared', type: 'string' as const, width: 40 },
      ],
      'monthly_report_compliance': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 22 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'mentorName', header: 'Mentor Name', type: 'string' as const, width: 20 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'reportMonth', header: 'Report Month', type: 'string' as const, width: 14 },
        { field: 'jan', header: 'Jan', type: 'number' as const, width: 8 },
        { field: 'feb', header: 'Feb', type: 'number' as const, width: 8 },
        { field: 'mar', header: 'Mar', type: 'number' as const, width: 8 },
        { field: 'apr', header: 'Apr', type: 'number' as const, width: 8 },
        { field: 'may', header: 'May', type: 'number' as const, width: 8 },
        { field: 'jun', header: 'Jun', type: 'number' as const, width: 8 },
        { field: 'jul', header: 'Jul', type: 'number' as const, width: 8 },
        { field: 'aug', header: 'Aug', type: 'number' as const, width: 8 },
        { field: 'sep', header: 'Sep', type: 'number' as const, width: 8 },
        { field: 'oct', header: 'Oct', type: 'number' as const, width: 8 },
        { field: 'nov', header: 'Nov', type: 'number' as const, width: 8 },
        { field: 'dec', header: 'Dec', type: 'number' as const, width: 8 },
        { field: 'totalReportsExpected', header: 'Expected Reports', type: 'number' as const, width: 14 },
        { field: 'reportsSubmitted', header: 'Submitted', type: 'number' as const, width: 12 },
        { field: 'reportsApproved', header: 'Approved', type: 'number' as const, width: 12 },
        { field: 'reportsPending', header: 'Pending', type: 'number' as const, width: 12 },
        { field: 'compliancePercent', header: 'Compliance %', type: 'number' as const, width: 12 },
        { field: 'lastSubmissionDate', header: 'Last Submission', type: 'date' as const, width: 15 },
      ],
      'pending_monthly_visits': [
        { field: 'mentorName', header: 'Mentor Name', type: 'string' as const, width: 20 },
        { field: 'mentorEmail', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'mentorPhone', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'department', header: 'Department', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'studentName', header: 'Student', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'pendingMonth', header: 'Report Month', type: 'string' as const, width: 14 },
        { field: 'pendingYear', header: 'Year', type: 'number' as const, width: 10 },
        { field: 'lastVisitDate', header: 'Last Visit', type: 'date' as const, width: 15 },
        { field: 'daysSinceLastVisit', header: 'Days Since Visit', type: 'number' as const, width: 14 },
        { field: 'visitsDue', header: 'Visits Due', type: 'number' as const, width: 10 },
      ],
      'pending_monthly_reports': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 22 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 20 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'pendingMonth', header: 'Report Month', type: 'string' as const, width: 14 },
        { field: 'pendingYear', header: 'Year', type: 'number' as const, width: 10 },
        { field: 'daysPastDue', header: 'Days Past Due', type: 'number' as const, width: 14 },
        { field: 'lastSubmittedReport', header: 'Last Submitted', type: 'date' as const, width: 15 },
        { field: 'reportsSubmitted', header: 'Reports Submitted', type: 'number' as const, width: 14 },
        { field: 'reportsExpected', header: 'Reports Expected', type: 'number' as const, width: 14 },
      ],
      // 'faculty_visit': [
      //   { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
      //   { field: 'facultyDesignation', header: 'Designation', type: 'string' as const, width: 15 },
      //   { field: 'facultyActive', header: 'Faculty Active', type: 'boolean' as const, width: 12 },
      //   { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
      //   { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
      //   { field: 'studentActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
      //   { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
      //   { field: 'visitDate', header: 'Visit Date', type: 'date' as const, width: 12 },
      //   { field: 'visitType', header: 'Visit Type', type: 'string' as const, width: 12 },
      //   { field: 'visitLocation', header: 'Location', type: 'string' as const, width: 15 },
      //   { field: 'followUpRequired', header: 'Follow-up', type: 'boolean' as const, width: 10 },
      //   { field: 'nextVisitDate', header: 'Next Visit', type: 'date' as const, width: 12 },
      // ],
      'mentor_list': [
        { field: 'name', header: 'Name', type: 'string' as const, width: 20 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'phoneNumber', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'designation', header: 'Designation', type: 'string' as const, width: 15 },
        { field: 'department', header: 'Department', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'role', header: 'Role', type: 'string' as const, width: 12 },
        { field: 'assignedStudents', header: 'Assigned Students', type: 'number' as const, width: 15 },
        { field: 'activeInternships', header: 'Active Internships', type: 'number' as const, width: 15 },
        { field: 'visitsCompleted', header: 'Visits Completed', type: 'number' as const, width: 15 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 10 },
      ],
      // Monthly reports - matches generateMonthlyReport output
      'monthly': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'month', header: 'Month', type: 'number' as const, width: 8 },
        { field: 'year', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'submittedAt', header: 'Submitted At', type: 'date' as const, width: 15 },
        { field: 'reportFileUrl', header: 'Report URL', type: 'string' as const, width: 30 },
        { field: 'isActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
      ],
      'monthly_report_status': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'month', header: 'Month', type: 'number' as const, width: 8 },
        { field: 'year', header: 'Year', type: 'number' as const, width: 8 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'isActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
      ],
      // Placement reports - matches generatePlacementReport output
      'placement': [
        { field: 'studentName', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'companyName', header: 'Company', type: 'string' as const, width: 25 },
        { field: 'jobRole', header: 'Job Role', type: 'string' as const, width: 20 },
        { field: 'salary', header: 'Salary (LPA)', type: 'number' as const, width: 12 },
        { field: 'offerDate', header: 'Offer Date', type: 'date' as const, width: 12 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'isActive', header: 'Student Active', type: 'boolean' as const, width: 12 },
      ],
      // Institution performance - matches generateInstitutionPerformanceReport output
      'institution_performance': [
        { field: 'metric', header: 'Metric', type: 'string' as const, width: 25 },
        { field: 'value', header: 'Value', type: 'number' as const, width: 15 },
        { field: 'category', header: 'Category', type: 'string' as const, width: 15 },
      ],
      'industry_wise_students_stipend': [
        { field: 'companyName', header: 'Company/Industry Name', type: 'string' as const, width: 30 },
        { field: 'companyAddress', header: 'Company Address', type: 'string' as const, width: 35 },
        { field: 'totalStudents', header: 'Total Students', type: 'number' as const, width: 12 },
        { field: 'activeStudents', header: 'Active Students', type: 'number' as const, width: 12 },
        { field: 'completedStudents', header: 'Completed Students', type: 'number' as const, width: 12 },
        { field: 'totalStipend', header: 'Total Stipend', type: 'number' as const, width: 12 },
        { field: 'avgStipend', header: 'Avg Stipend', type: 'number' as const, width: 12 },
        { field: 'minStipend', header: 'Min Stipend', type: 'number' as const, width: 12 },
        { field: 'maxStipend', header: 'Max Stipend', type: 'number' as const, width: 12 },
      ],
      'top_institutes_per_industry': [
        { field: 'companyName', header: 'Company/Industry Name', type: 'string' as const, width: 30 },
        { field: 'companyAddress', header: 'Company Address', type: 'string' as const, width: 30 },
        { field: 'companyTotalStudents', header: 'Company Total Students', type: 'number' as const, width: 18 },
        { field: 'instituteRank', header: 'Rank', type: 'number' as const, width: 6 },
        { field: 'instituteName', header: 'Institute Name', type: 'string' as const, width: 30 },
        { field: 'totalStudents', header: 'Students from Institute', type: 'number' as const, width: 18 },
        { field: 'avgStipend', header: 'Average Stipend', type: 'number' as const, width: 14 },
        { field: 'totalStipend', header: 'Total Stipend', type: 'number' as const, width: 14 },
        { field: 'activeStudents', header: 'Active Students', type: 'number' as const, width: 14 },
        { field: 'completedStudents', header: 'Completed Students', type: 'number' as const, width: 14 },
      ],
      'principal_visit_logs': [
        { field: 'visitDate', header: 'Visit Date', type: 'string' as const, width: 14 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'principalName', header: 'Principal Name', type: 'string' as const, width: 20 },
        { field: 'companyNames', header: 'Companies', type: 'string' as const, width: 30 },
        { field: 'visitType', header: 'Visit Type', type: 'string' as const, width: 14 },
        { field: 'visitLocation', header: 'Location', type: 'string' as const, width: 25 },
        { field: 'status', header: 'Status', type: 'string' as const, width: 12 },
        { field: 'responseFromOrganisation', header: 'Response From Organisation', type: 'string' as const, width: 35 },
        { field: 'observationsAboutIndustry', header: 'Observations About Industry', type: 'string' as const, width: 35 },
        { field: 'followUpRequired', header: 'Follow-up Required', type: 'boolean' as const, width: 14 },
        { field: 'nextVisitDate', header: 'Next Visit Date', type: 'date' as const, width: 14 },
        { field: 'attendanceStatus', header: 'Attendance Status', type: 'string' as const, width: 18 },
        { field: 'createdAt', header: 'Created At', type: 'date' as const, width: 14 },
      ],
      'principal_visit_summary': [
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'principalName', header: 'Principal Name', type: 'string' as const, width: 20 },
        { field: 'totalVisits', header: 'Total Visits', type: 'number' as const, width: 12 },
        { field: 'physicalVisits', header: 'Physical Visits', type: 'number' as const, width: 14 },
        { field: 'virtualVisits', header: 'Virtual Visits', type: 'number' as const, width: 14 },
        { field: 'telephonicVisits', header: 'Telephonic Visits', type: 'number' as const, width: 16 },
        { field: 'completedVisitLogs', header: 'Completed Visit Logs', type: 'number' as const, width: 16 },
        { field: 'draftVisits', header: 'Drafts', type: 'number' as const, width: 10 },
        { field: 'avgSatisfactionRating', header: 'Avg Satisfaction Rating', type: 'number' as const, width: 16 },
        { field: 'studentsVisited', header: 'Students Visited', type: 'number' as const, width: 14 },
        { field: 'followUpsRequired', header: 'Follow-ups Required', type: 'number' as const, width: 16 },
        { field: 'lastVisitDate', header: 'Last Visit Date', type: 'date' as const, width: 14 },
      ],
      'user_login_activity': [
        { field: 'userId', header: 'User ID', type: 'string' as const, width: 18 },
        { field: 'userName', header: 'User Name', type: 'string' as const, width: 20 },
        { field: 'email', header: 'Email', type: 'string' as const, width: 28 },
        { field: 'phoneNo', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'role', header: 'Role', type: 'string' as const, width: 16 },
        { field: 'isMentor', header: 'Is Mentor', type: 'string' as const, width: 12 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 28 },
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 14 },
        { field: 'designation', header: 'Designation', type: 'string' as const, width: 18 },
        { field: 'accountCreatedAt', header: 'Account Created', type: 'date' as const, width: 18 },
        { field: 'loginCount', header: 'Login Count', type: 'number' as const, width: 12 },
        { field: 'lastLoginAt', header: 'Last Login', type: 'date' as const, width: 18 },
        { field: 'previousLoginAt', header: 'Previous Login', type: 'date' as const, width: 18 },
        { field: 'lastLoginIp', header: 'Last Login IP', type: 'string' as const, width: 18 },
        { field: 'hasChangedPassword', header: 'Password Changed', type: 'boolean' as const, width: 15 },
        { field: 'passwordChangedAt', header: 'Password Changed At', type: 'date' as const, width: 20 },
        { field: 'daysSinceLastLogin', header: 'Days Since Last Login', type: 'number' as const, width: 18 },
        { field: 'daysSinceCreation', header: 'Days Since Creation', type: 'number' as const, width: 16 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 10 },
        { field: 'userActive', header: 'User Account Active', type: 'boolean' as const, width: 16 },
        { field: 'studentActive', header: 'Student Record Active', type: 'boolean' as const, width: 16 },
        { field: 'status', header: 'Login Status', type: 'string' as const, width: 16 },
      ],
      'training_feedback_responses': [
        { field: 'trainingName', header: 'Training Name', type: 'string' as const, width: 30 },
        { field: 'trainingStartDate', header: 'Training Start Date', type: 'date' as const, width: 16 },
        { field: 'trainingEndDate', header: 'Training End Date', type: 'date' as const, width: 16 },
        { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
        { field: 'facultyBranch', header: 'Branch', type: 'string' as const, width: 16 },
        { field: 'facultyPhone', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
      ],
      'training_pre_test_responses': [
        { field: 'trainingName', header: 'Training Name', type: 'string' as const, width: 30 },
        { field: 'trainingStartDate', header: 'Training Start Date', type: 'date' as const, width: 16 },
        { field: 'trainingEndDate', header: 'Training End Date', type: 'date' as const, width: 16 },
        { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
        { field: 'facultyBranch', header: 'Branch', type: 'string' as const, width: 16 },
        { field: 'facultyPhone', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'score', header: 'Score', type: 'number' as const, width: 10 },
        { field: 'passed', header: 'Passed', type: 'boolean' as const, width: 10 },
        { field: 'submittedAt', header: 'Submitted At', type: 'date' as const, width: 18 },
      ],
      'training_post_test_responses': [
        { field: 'trainingName', header: 'Training Name', type: 'string' as const, width: 30 },
        { field: 'trainingStartDate', header: 'Training Start Date', type: 'date' as const, width: 16 },
        { field: 'trainingEndDate', header: 'Training End Date', type: 'date' as const, width: 16 },
        { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
        { field: 'facultyBranch', header: 'Branch', type: 'string' as const, width: 16 },
        { field: 'facultyPhone', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'score', header: 'Score', type: 'number' as const, width: 10 },
        { field: 'passed', header: 'Passed', type: 'boolean' as const, width: 10 },
        { field: 'submittedAt', header: 'Submitted At', type: 'date' as const, width: 18 },
      ],      'training_wise_summary': [
        { field: 'trainingName', header: 'Training Name', type: 'string' as const, width: 30 },
        { field: 'totalDays', header: 'Total Days', type: 'number' as const, width: 12 },
        { field: 'totalHours', header: 'Total Hours', type: 'number' as const, width: 12 },
        { field: 'startDate', header: 'Start Date', type: 'date' as const, width: 14 },
        { field: 'endDate', header: 'End Date', type: 'date' as const, width: 14 },
        { field: 'course', header: 'Course/Target Branches', type: 'string' as const, width: 25 },
        { field: 'deliveryMode', header: 'Delivery Mode', type: 'string' as const, width: 14 },
        { field: 'totalParticipants', header: 'Total Participants', type: 'number' as const, width: 16 },
        { field: 'attendanceCount', header: 'Attendance Filled', type: 'number' as const, width: 16 },
        { field: 'attendancePercentage', header: 'Attendance %', type: 'number' as const, width: 14 },
        { field: 'preTestFilledCount', header: 'Pre-Test Filled', type: 'number' as const, width: 14 },
        { field: 'preTestPercentage', header: 'Pre-Test %', type: 'number' as const, width: 12 },
        { field: 'postTestFilledCount', header: 'Post-Test Filled', type: 'number' as const, width: 14 },
        { field: 'postTestPercentage', header: 'Post-Test %', type: 'number' as const, width: 12 },
        { field: 'feedbackFilledCount', header: 'Feedback Filled', type: 'number' as const, width: 14 },
        { field: 'feedbackPercentage', header: 'Feedback %', type: 'number' as const, width: 12 },
        { field: 'lessonPlanFilledCount', header: 'Lesson Plan Filled', type: 'number' as const, width: 16 },
        { field: 'lessonPlanPercentage', header: 'Lesson Plan %', type: 'number' as const, width: 14 },
      ],
      'training_non_compliance': [
        { field: 'facultyName', header: 'Faculty Name', type: 'string' as const, width: 20 },
        { field: 'facultyEmail', header: 'Email', type: 'string' as const, width: 25 },
        { field: 'facultyPhone', header: 'Phone', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution/College', type: 'string' as const, width: 25 },
        { field: 'branchName', header: 'Branch/Course', type: 'string' as const, width: 18 },
        { field: 'trainingName', header: 'Training Name', type: 'string' as const, width: 28 },
        { field: 'trainingStartDate', header: 'Training Start Date', type: 'date' as const, width: 16 },
        { field: 'trainingEndDate', header: 'Training End Date', type: 'date' as const, width: 16 },
        { field: 'attendanceFilled', header: 'Attendance', type: 'boolean' as const, width: 12 },
        { field: 'preTestFilled', header: 'Pre-Test', type: 'boolean' as const, width: 10 },
        { field: 'postTestFilled', header: 'Post-Test', type: 'boolean' as const, width: 10 },
        { field: 'feedbackFilled', header: 'Feedback', type: 'boolean' as const, width: 10 },
        { field: 'lessonPlanFilled', header: 'Lesson Plan', type: 'boolean' as const, width: 12 },
        { field: 'missingItems', header: 'Missing Items', type: 'string' as const, width: 30 },
        { field: 'missingCount', header: 'Missing Count', type: 'number' as const, width: 14 },
      ],

      // Compliance reports - matches generateStudentComplianceReport output
      'student_compliance': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'hasInternship', header: 'Has Internship', type: 'string' as const, width: 12 },
        { field: 'joiningReportStatus', header: 'Joining Report', type: 'string' as const, width: 15 },
        { field: 'monthlyReportsSubmitted', header: 'Reports Submitted', type: 'number' as const, width: 15 },
        { field: 'lastReportDate', header: 'Last Report Date', type: 'date' as const, width: 15 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 8 },
      ],
      'compliance': [
        { field: 'rollNumber', header: 'Roll Number', type: 'string' as const, width: 15 },
        { field: 'name', header: 'Student Name', type: 'string' as const, width: 20 },
        { field: 'gender', header: 'Gender', type: 'string' as const, width: 10 },
        { field: 'branchName', header: 'Branch', type: 'string' as const, width: 15 },
        { field: 'institutionName', header: 'Institution', type: 'string' as const, width: 25 },
        { field: 'mentorName', header: 'Mentor', type: 'string' as const, width: 18 },
        { field: 'hasInternship', header: 'Has Internship', type: 'string' as const, width: 12 },
        { field: 'joiningReportStatus', header: 'Joining Report', type: 'string' as const, width: 15 },
        { field: 'monthlyReportsSubmitted', header: 'Reports Submitted', type: 'number' as const, width: 15 },
        { field: 'lastReportDate', header: 'Last Report Date', type: 'date' as const, width: 15 },
        { field: 'isActive', header: 'Active', type: 'boolean' as const, width: 8 },
      ],
    };

    // Get columns for this report type
    let columns = reportColumns[normalizedType];

    // If no predefined columns, generate from data
    if (!columns || columns.length === 0) {
      this.logger.warn(`No predefined columns for report type: ${reportType}, generating from data`);
      if (data.length > 0) {
        const firstRow = data[0];
        columns = Object.keys(firstRow).map(key => ({
          field: key,
          header: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
          type: this.inferColumnType(firstRow[key]),
          width: 15,
        }));
      } else {
        columns = [];
      }
    }

    // For training response reports, append dynamic question columns from data
    const dynamicColumnReports = new Set([
      'training_feedback_responses',
      'training_pre_test_responses',
      'training_post_test_responses',
    ]);

    if (dynamicColumnReports.has(normalizedType) && data.length > 0) {
      const existingFields = new Set(columns.map((c) => c.field));
      const firstRow = data[0];

      // Collect dynamic fields and sort by question number
      const dynamicFields = Object.keys(firstRow)
        .filter((key) => !existingFields.has(key))
        .sort((a, b) => {
          const numA = parseInt(a.match(/Question (\d+)/)?.[1] || '0', 10);
          const numB = parseInt(b.match(/Question (\d+)/)?.[1] || '0', 10);
          return numA - numB;
        });

      dynamicFields.forEach((key) => {
        // Calculate width based on header length (min 20, max 60)
        const headerWidth = Math.min(60, Math.max(20, Math.ceil(key.length * 1.2)));
        columns.push({
          field: key,
          header: key,
          type: this.inferColumnType(firstRow[key]),
          width: headerWidth,
        });
      });
    }

    const skipColumnFiltering = dynamicColumnReports.has(normalizedType);

    // Filter columns based on user selection (if provided)
    // Apply for both predefined and inferred columns.
    if (!skipColumnFiltering && selectedColumns && selectedColumns.length > 0) {
      let effectiveSelectedColumns = [...selectedColumns];

      if (dynamicColumnReports.has(normalizedType) && data.length > 0) {
        const baseColumns = reportColumns[normalizedType] || [];
        const baseFieldSet = new Set(baseColumns.map((col) => col.field));
        const firstRow = data[0];
        const dynamicFields = Object.keys(firstRow).filter(
          (key) => !baseFieldSet.has(key) && !effectiveSelectedColumns.includes(key),
        );
        if (dynamicFields.length > 0) {
          effectiveSelectedColumns = [...effectiveSelectedColumns, ...dynamicFields];
        }
      }

      this.logger.log(`Filtering to selected columns: ${effectiveSelectedColumns.join(', ')}`);

      const inferredColumnsByField = new Map<string, any>();
      if (data.length > 0) {
        const firstRow = data[0];
        Object.keys(firstRow).forEach((key) => {
          if (!columns.find((c) => c.field === key)) {
            inferredColumnsByField.set(key, {
              field: key,
              header: key,
              type: this.inferColumnType(firstRow[key]),
              width: 15,
            });
          }
        });
      }

      // Filter to only include selected columns while preserving order
      const filteredColumns = effectiveSelectedColumns
        .map(colId => columns.find(c => c.field === colId) || inferredColumnsByField.get(colId))
        .filter(Boolean);

      // Only use filtered columns if at least one matched
      if (filteredColumns.length > 0) {
        columns = filteredColumns;

        // Also filter the data to only include selected fields
        const selectedFields = new Set(effectiveSelectedColumns);
        data = data.map(row => {
          const filteredRow: Record<string, unknown> = {};
          for (const field of selectedFields) {
            if (field in row) {
              filteredRow[field] = row[field];
            }
          }
          return filteredRow;
        });
      } else {
        this.logger.warn('No selected columns matched export columns, keeping default column set');
      }
    }

    const title = reportTitles[normalizedType] ||
      reportType.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' Report';

    this.logger.log(`Export config: type=${reportType}, columns=${columns.length}, rows=${data.length}`);

    // Define merge columns for specific report types
    const mergeColumnsMap: Record<string, string[]> = {
      'top_institutes_per_industry': ['companyName', 'companyAddress', 'companyTotalStudents'],
    };

    return {
      title,
      columns,
      data,
      format,
      metadata: {
        generatedAt: new Date(),
        generatedBy: userId,
        filters,
      },
      mergeColumns: mergeColumnsMap[normalizedType],
    };
  }

  /**
   * Build per-training sheet configs for test response reports.
   */
  private buildTrainingSheets(config: ExportConfig, data: any[]): { name: string; config: ExportConfig }[] {
    const staticFieldMap: Record<string, string[]> = {
      'Training Pre-Test Responses Report': [
        'trainingName',
        'trainingStartDate',
        'trainingEndDate',
        'facultyName',
        'facultyBranch',
        'facultyPhone',
        'institutionName',
        'score',
        'passed',
        'submittedAt',
      ],
      'Training Post-Test Responses Report': [
        'trainingName',
        'trainingStartDate',
        'trainingEndDate',
        'facultyName',
        'facultyBranch',
        'facultyPhone',
        'institutionName',
        'score',
        'passed',
        'submittedAt',
      ],
      'Training-wise Compliance Report': [
        'facultyName',
        'email',
        'phone',
        'department',
        'institutionName',
        'attendanceStatus',
        'preTestStatus',
        'postTestStatus',
        'feedbackStatus',
        'lessonPlanStatus',
        'completedItems',
        'totalItems',
        'compliancePercentage',
        'complianceStatus',
      ],
    };

    const staticFields = staticFieldMap[config.title] ?? [];
    const baseColumns = (staticFields.length > 0
      ? config.columns.filter((col) => staticFields.includes(col.field))
      : config.columns
    ).filter((col) => col.field !== 'trainingId');
    const grouped = new Map<string, { label: string; rows: any[] }>();

    data.forEach((row) => {
      const trainingId = row.trainingId || row.trainingTitle || 'unknown-training';
      const trainingName = row.trainingName || row.trainingTitle || 'Training';
      const label = String(trainingName);
      if (!grouped.has(trainingId)) {
        grouped.set(trainingId, { label, rows: [] });
      }
      grouped.get(trainingId)!.rows.push(row);
    });

    const sheets: { name: string; config: ExportConfig }[] = [];
    const usedSheetNames = new Set<string>();

    grouped.forEach((group, trainingId) => {
      const dynamicFields = new Set<string>();
      const baseFieldSet = new Set(baseColumns.map((col) => col.field));

      group.rows.forEach((row) => {
        Object.keys(row).forEach((key) => {
          if (!baseFieldSet.has(key) && key !== 'trainingId' && key !== 'trainingTitle') {
            dynamicFields.add(key);
          }
        });
      });

      // Sort dynamic fields by question number (Question 1, Question 2, etc.)
      const sortedDynamicFields = Array.from(dynamicFields).sort((a, b) => {
        const numA = parseInt(a.match(/Question (\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/Question (\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

      const dynamicColumns = sortedDynamicFields.map((field) => {
        const sampleRow = group.rows.find((r) => r[field] !== undefined && r[field] !== null) || group.rows[0];
        // Calculate width based on header length (min 20, max 60)
        const headerWidth = Math.min(60, Math.max(20, Math.ceil(field.length * 1.2)));
        return {
          field,
          header: field,
          type: this.inferColumnType(sampleRow?.[field]),
          width: headerWidth,
        };
      });

      const sheetColumns = [...baseColumns, ...dynamicColumns];
      const sheetName = this.toUniqueWorksheetName(group.label || trainingId, usedSheetNames);

      sheets.push({
        name: sheetName,
        config: {
          ...config,
          title: `${config.title} - ${group.label}`,
          columns: sheetColumns,
          data: group.rows,
        },
      });
    });

    return sheets;
  }

  /**
   * Excel worksheet names are limited to 31 chars and cannot include certain symbols.
   */
  private toWorksheetName(label: string): string {
    const cleaned = label.replace(/[\\/?*\[\]:]/g, ' ').trim();
    if (!cleaned) return 'Training';
    return cleaned.slice(0, 31);
  }

  /**
   * Generate a unique worksheet name by appending a counter if the name already exists.
   * Excel worksheet names are limited to 31 chars and cannot include certain symbols.
   */
  private toUniqueWorksheetName(label: string, usedNames: Set<string>): string {
    const baseName = this.toWorksheetName(label);

    if (!usedNames.has(baseName)) {
      usedNames.add(baseName);
      return baseName;
    }

    // Name already exists, append a counter
    let counter = 2;
    let uniqueName: string;

    do {
      const suffix = ` (${counter})`;
      // Ensure we don't exceed 31 chars when adding suffix
      const maxBaseLength = 31 - suffix.length;
      uniqueName = baseName.slice(0, maxBaseLength) + suffix;
      counter++;
    } while (usedNames.has(uniqueName) && counter < 100);

    usedNames.add(uniqueName);
    return uniqueName;
  }

  /**
   * Infer column type from value
   */
  private inferColumnType(value: any): 'string' | 'number' | 'date' | 'boolean' {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    }
    return 'string';
  }


  /**
   * Send notification to user
   */
  private async sendNotification(
    userId: string,
    reportType: string,
    downloadUrl: string,
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: 'Report Generated',
          body: `Your ${reportType} report has been generated successfully.`,
          type: 'REPORT',
          data: {
            reportType,
            downloadUrl,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      // Don't throw error, notification failure shouldn't fail the job
    }
  }
}
