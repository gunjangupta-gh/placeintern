import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FacultyService } from './faculty.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';
import {
  CreateVisitLogDto,
  UpdateVisitLogDto,
  ReviewMonthlyReportDto,
  ApproveMonthlyReportDto,
  RejectMonthlyReportDto,
  UpdateSelfIdentifiedApprovalDto,
  SubmitMonthlyFeedbackDto,
  UpdateInternshipDto,
  VerifyJoiningLetterDto,
  RejectJoiningLetterDto,
  UploadVisitDocumentDto,
  UpdateStudentDto,
  UploadStudentDocumentDto,
} from './dto';
import {
  validateVisitDocument,
  validateJoiningLetter,
} from '../../core/common/utils/file-validation.util';

@ApiTags('Faculty Portal')
@Controller('faculty')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FacultyController {
  constructor(
    private readonly facultyService: FacultyService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Get('dashboard')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get faculty dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(@Req() req) {
    return this.facultyService.getDashboard(req.user.userId);
  }

  @Get('dashboard/monthly-stats')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get current month compliance stats (uses monthly inclusion rules)' })
  @ApiResponse({ status: 200, description: 'Monthly stats retrieved successfully' })
  async getCurrentMonthStats(@Req() req) {
    return this.facultyService.getCurrentMonthStats(req.user.userId);
  }

  @Get('profile')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get faculty profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req) {
    return this.facultyService.getProfile(req.user.userId);
  }

  @Get('students')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get assigned students list' })
  @ApiResponse({ status: 200, description: 'Students list retrieved successfully' })
  async getAssignedStudents(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.facultyService.getAssignedStudents(req.user.userId, { page, limit, search });
  }

  @Get('students/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get student detail' })
  @ApiResponse({ status: 200, description: 'Student detail retrieved successfully' })
  async getStudentDetail(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getStudentDetail(studentId, req.user.userId);
  }

  @Get('students/:id/progress')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get student progress' })
  @ApiResponse({ status: 200, description: 'Student progress retrieved successfully' })
  async getStudentProgress(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getStudentProgress(studentId, req.user.userId);
  }

  @Get('students/:id/unmasked-contact')
  @Roles(Role.TEACHER, Role.PRINCIPAL)
  @ApiOperation({ summary: 'Get unmasked contact details for a student (requires verification)' })
  @ApiResponse({ status: 200, description: 'Unmasked contact details retrieved successfully' })
  async getUnmaskedContactDetails(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getUnmaskedContactDetails(studentId, req.user.userId);
  }

  // Visit Logs
  @Get('visit-logs')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get all visit logs' })
  @ApiResponse({ status: 200, description: 'Visit logs retrieved successfully' })
  async getVisitLogs(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
  ) {
    return this.facultyService.getVisitLogs(req.user.userId, { page, limit, studentId });
  }

  @Get('visit-logs/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get visit log by ID' })
  @ApiResponse({ status: 200, description: 'Visit log retrieved successfully' })
  async getVisitLogById(@Param('id') id: string, @Req() req) {
    return this.facultyService.getVisitLogById(id, req.user.userId);
  }

  @Post('visit-logs')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({
    summary: 'Create visit log (supports quick visit logging)',
    description: 'Required fields: (applicationId OR studentId), visitType, visitLocation. All other fields are optional. Auto-sets visitDate to now and status to COMPLETED if not provided.',
  })
  @ApiResponse({ status: 201, description: 'Visit log created successfully' })
  async createVisitLog(@Req() req, @Body() createVisitLogDto: CreateVisitLogDto) {
    return this.facultyService.createVisitLog(req.user.userId, createVisitLogDto);
  }

  @Put('visit-logs/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Update visit log' })
  @ApiResponse({ status: 200, description: 'Visit log updated successfully' })
  async updateVisitLog(@Param('id') id: string, @Body() updateVisitLogDto: UpdateVisitLogDto, @Req() req) {
    return this.facultyService.updateVisitLog(id, updateVisitLogDto, req.user.userId);
  }

  @Delete('visit-logs/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete visit log' })
  @ApiResponse({ status: 200, description: 'Visit log deleted successfully' })
  async deleteVisitLog(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteVisitLog(id, req.user.userId);
  }

  // Monthly Reports
  @Get('monthly-reports')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get monthly reports for review' })
  @ApiResponse({ status: 200, description: 'Monthly reports retrieved successfully' })
  async getMonthlyReports(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.facultyService.getMonthlyReports(req.user.userId, { page, limit, status });
  }

  @Put('monthly-reports/:id/review')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Review monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report reviewed successfully' })
  async reviewMonthlyReport(@Param('id') id: string, @Body() reviewDto: ReviewMonthlyReportDto, @Req() req) {
    return this.facultyService.reviewMonthlyReport(id, {
      facultyId: req.user.userId,
      reviewComments: reviewDto.remarks,
      isApproved: reviewDto.status === 'APPROVED',
    });
  }

  // Approvals
  @Get('approvals/self-identified')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get self-identified internship approvals' })
  @ApiResponse({ status: 200, description: 'Self-identified approvals retrieved successfully' })
  async getSelfIdentifiedApprovals(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.facultyService.getSelfIdentifiedApprovals(req.user.userId, { page, limit, status });
  }

  @Put('approvals/self-identified/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Approve or reject self-identified internship' })
  @ApiResponse({ status: 200, description: 'Self-identified internship approval updated successfully' })
  async updateSelfIdentifiedApproval(@Param('id') id: string, @Body() approvalDto: UpdateSelfIdentifiedApprovalDto, @Req() req) {
    return this.facultyService.updateSelfIdentifiedApproval(id, {
      facultyId: req.user.userId,
      status: approvalDto.status,
      reviewRemarks: approvalDto.remarks || approvalDto.reason,
    });
  }

  // Feedback
  @Post('feedback/monthly')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Submit monthly feedback for student' })
  @ApiResponse({ status: 201, description: 'Monthly feedback submitted successfully' })
  async submitMonthlyFeedback(@Req() req, @Body() feedbackDto: SubmitMonthlyFeedbackDto) {
    return this.facultyService.submitMonthlyFeedback(req.user.userId, feedbackDto);
  }

  @Get('feedback/history')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get feedback history' })
  @ApiResponse({ status: 200, description: 'Feedback history retrieved successfully' })
  async getFeedbackHistory(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('studentId') studentId?: string,
  ) {
    return this.facultyService.getFeedbackHistory(req.user.userId, { page, limit, studentId });
  }

  // ==================== Internship Management ====================

  @Get('students/:id/internships')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get student internships' })
  @ApiResponse({ status: 200, description: 'Student internships retrieved successfully' })
  async getStudentInternships(@Param('id') studentId: string, @Req() req) {
    return this.facultyService.getStudentInternships(studentId, req.user.userId);
  }

  @Put('internships/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Update internship application' })
  @ApiResponse({ status: 200, description: 'Internship updated successfully' })
  async updateInternship(@Param('id') id: string, @Body() updateDto: UpdateInternshipDto, @Req() req) {
    return this.facultyService.updateInternship(id, updateDto, req.user.userId);
  }

  @Delete('internships/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete internship application' })
  @ApiResponse({ status: 200, description: 'Internship deleted successfully' })
  async deleteInternship(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteInternship(id, req.user.userId);
  }

  // ==================== Monthly Report Actions ====================

  @Put('monthly-reports/:id/approve')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Approve monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report approved successfully' })
  async approveMonthlyReport(@Param('id') id: string, @Body() body: ApproveMonthlyReportDto, @Req() req) {
    return this.facultyService.approveMonthlyReport(id, body.remarks, req.user.userId);
  }

  @Put('monthly-reports/:id/reject')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Reject monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report rejected successfully' })
  async rejectMonthlyReport(@Param('id') id: string, @Body() body: RejectMonthlyReportDto, @Req() req) {
    return this.facultyService.rejectMonthlyReport(id, body.reason, req.user.userId);
  }

  @Delete('monthly-reports/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report deleted successfully' })
  async deleteMonthlyReport(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteMonthlyReport(id, req.user.userId);
  }

  // ==================== Joining Letter Management ====================

  @Get('joining-letters')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get joining letters for review' })
  @ApiResponse({ status: 200, description: 'Joining letters retrieved successfully' })
  async getJoiningLetters(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.facultyService.getJoiningLetters(req.user.userId, { page, limit, status });
  }

  @Put('joining-letters/:id/verify')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Verify joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter verified successfully' })
  async verifyJoiningLetter(@Param('id') id: string, @Body() body: VerifyJoiningLetterDto, @Req() req) {
    return this.facultyService.verifyJoiningLetter(id, body.remarks, req.user.userId);
  }

  @Put('joining-letters/:id/reject')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Reject joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter rejected successfully' })
  async rejectJoiningLetter(@Param('id') id: string, @Body() body: RejectJoiningLetterDto, @Req() req) {
    return this.facultyService.rejectJoiningLetter(id, body.reason, req.user.userId);
  }

  @Delete('joining-letters/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Delete joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter deleted successfully' })
  async deleteJoiningLetter(@Param('id') id: string, @Req() req) {
    return this.facultyService.deleteJoiningLetter(id, req.user.userId);
  }

  @Post('joining-letters/:id/upload')
  @Roles(Role.TEACHER, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload joining letter for a student' })
  @ApiResponse({ status: 200, description: 'Joining letter uploaded successfully' })
  async uploadJoiningLetter(
    @Param('id') applicationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // SECURITY: Validate file type, size, and magic bytes
    validateJoiningLetter(file);

    // Get application details to determine student info for file path
    const application = await this.facultyService.getApplicationForUpload(applicationId);

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    // Get institution name for folder structure
    const institutionName = application.student?.Institution?.name || 'default';

    // Upload to MinIO with organized folder structure
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: application.student?.user?.rollNumber || application.studentId,
      documentType: 'joining-letter',
    });

    return this.facultyService.uploadJoiningLetter(applicationId, result.url, req.user.userId);
  }

  @Get('monthly-reports/:id/download')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Download monthly report file' })
  @ApiResponse({ status: 200, description: 'Monthly report file downloaded successfully' })
  async downloadMonthlyReport(@Param('id') id: string, @Req() req) {
    return this.facultyService.downloadMonthlyReport(id, req.user.userId);
  }

  @Post('monthly-reports/upload')
  @Roles(Role.TEACHER, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload monthly report for a student' })
  @ApiResponse({ status: 200, description: 'Monthly report uploaded successfully' })
  async uploadMonthlyReport(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { applicationId?: string; month: string; year: string; studentId?: string },
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const maxSizeInBytes = 1 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      throw new BadRequestException('File size must be under 1MB');
    }

    return this.facultyService.uploadMonthlyReport(file, body, req.user.userId, this.fileStorageService);
  }

  @Get('monthly-reports/:id/view')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Get presigned URL to view monthly report' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated successfully' })
  async viewMonthlyReport(@Param('id') id: string, @Req() req) {
    return this.facultyService.getMonthlyReportViewUrl(id, req.user.userId, this.fileStorageService);
  }

  @Post('assignments')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Create assignment for student' })
  @ApiResponse({ status: 201, description: 'Assignment created successfully' })
  async createAssignment(@Req() req, @Body() assignmentData: any) {
    return this.facultyService.createAssignment(req.user.userId, assignmentData);
  }

  @Post('visit-logs/upload-document')
  @Roles(Role.TEACHER, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload a document for visit log (photo or signed document)' })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  async uploadVisitDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadVisitDocumentDto,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // SECURITY: Validate file type, size, and magic bytes (prevents file spoofing)
    validateVisitDocument(file);

    // Get faculty for determining storage path
    const faculty = await this.facultyService.getProfile(req.user.userId);
    const docType = body.documentType || 'visit-photo';

    // Get institution name for folder structure
    const institutionName = faculty?.Institution?.name || 'default';
    const sanitizedInstitution = this.sanitizeFolderName(institutionName);
    const sanitizedDocType = this.sanitizeFolderName(docType);
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase() || 'bin';

    // Check if file is an image that should be optimized
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const fileExt = file.originalname.split('.').pop()?.toLowerCase();
    const isImage = imageExtensions.includes(fileExt || '');

    let result;

    if (isImage) {
      // Optimize image: resize to max 1200x1200, convert to WebP, compress
      const optimized = await this.fileStorageService.optimizeImage(file.buffer, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 85,
        format: 'webp',
      });

      // Upload the optimized image
      result = await this.fileStorageService.uploadBuffer(
        optimized.buffer,
        `${sanitizedDocType}_${Date.now()}.webp`,
        {
          folder: sanitizedInstitution,
          subfolder: `visit-logs/${sanitizedDocType}`,
          contentType: optimized.contentType,
          metadata: {
            originalName: file.originalname,
            documentType: docType,
          },
        },
      );
    } else {
      // Non-image files (PDFs, etc.) - upload as-is
      result = await this.fileStorageService.uploadBuffer(
        file.buffer,
        `${sanitizedDocType}_${Date.now()}.${fileExtension}`,
        {
          folder: sanitizedInstitution,
          subfolder: `visit-logs/${sanitizedDocType}`,
          contentType: file.mimetype || 'application/octet-stream',
          metadata: {
            originalName: file.originalname,
            documentType: docType,
          },
        },
      );
    }

    return { url: result.url, documentType: docType };
  }

  /**
   * Sanitize folder name for storage path
   */
  private sanitizeFolderName(name: string): string {
    if (!name) return 'default';
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 100);
  }

  private mapDocumentTypeForStorage(type?: string): {
    documentType: 'profile' | 'joining-letter' | 'monthly-report' | 'completion-certificate' | 'offer-letter' | 'noc' | 'document' | 'other';
    customName?: string;
  } {
    const rawType = (type || 'document').toString().trim();
    const normalized = rawType.toLowerCase().replace(/[_\s]+/g, '-');

    if (['profile', 'profile-image', 'profile-photo', 'photo'].includes(normalized)) {
      return { documentType: 'profile' };
    }

    if (['joining-letter', 'joiningletter', 'joining'].includes(normalized)) {
      return { documentType: 'joining-letter' };
    }

    if (['monthly-report', 'monthlyreport', 'report'].includes(normalized)) {
      return { documentType: 'monthly-report' };
    }

    if (['completion-certificate', 'certificate'].includes(normalized)) {
      return { documentType: 'completion-certificate' };
    }

    if (['offer-letter', 'offerletter'].includes(normalized)) {
      return { documentType: 'offer-letter' };
    }

    if (normalized === 'noc') {
      return { documentType: 'noc' };
    }

    return {
      documentType: 'document',
      customName: rawType,
    };
  }

  // ==================== Student Management ====================

  @Put('students/:id')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Update student profile' })
  @ApiResponse({ status: 200, description: 'Student updated successfully' })
  async updateStudent(
    @Param('id') studentId: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @Req() req,
  ) {
    return this.facultyService.updateStudent(studentId, updateStudentDto, req.user.userId);
  }

  @Post('students/:id/documents')
  @Roles(Role.TEACHER, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Upload student document' })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  async uploadStudentDocument(
    @Param('id') studentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadStudentDocumentDto,
    @Req() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Get student details for file path
    const student = await this.facultyService.getStudentDetail(studentId, req.user.userId);

    if (!student) {
      throw new BadRequestException('Student not found');
    }

    // Get institution name for folder structure
    const institutionName = student.Institution?.name || 'default';
    const storageType = this.mapDocumentTypeForStorage(body.type);

    // Upload to MinIO with organized folder structure
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: student.user?.rollNumber || studentId,
      documentType: storageType.documentType,
      ...(storageType.customName ? { customName: storageType.customName } : {}),
    });

    return this.facultyService.saveStudentDocument(studentId, result.url, body.type, req.user.userId);
  }

  @Patch('students/:id/toggle-status')
  @Roles(Role.TEACHER, Role.TEACHER)
  @ApiOperation({ summary: 'Toggle student active status (also toggles mentor assignments and internship applications)' })
  @ApiResponse({ status: 200, description: 'Student status toggled successfully' })
  async toggleStudentStatus(
    @Param('id') studentId: string,
    @Req() req,
  ) {
    return this.facultyService.toggleStudentStatus(studentId, req.user.userId);
  }
}
