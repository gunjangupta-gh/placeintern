import {
  Controller,
  Get,
  Post,
  Put,
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
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../core/config/throttle.config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';

@ApiTags('Student Portal')
@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StudentController {
  constructor(
    private readonly studentService: StudentService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Throttle({ default: THROTTLE_PRESETS.dashboard })
  @Get('dashboard')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get student dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(@Req() req) {
    return this.studentService.getDashboard(req.user.userId);
  }

  @Get('profile')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get student profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Req() req) {
    return this.studentService.getProfile(req.user.userId);
  }

  @Put('profile')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Update student profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Req() req, @Body() updateProfileDto: any) {
    return this.studentService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Post('profile/image')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Upload profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Profile image uploaded successfully' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadProfileImage(@Req() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    // Get student info for proper file path
    const profile = await this.studentService.getProfile(req.user.userId);

    // Get institution name for folder structure (Student has direct Institution relation)
    const institutionName = (profile as any).Institution?.name || 'default';

    // Upload to MinIO with automatic optimization (resizes, converts to WebP)
    const result = await this.fileStorageService.uploadProfileImage(
      file.buffer,
      file.originalname,
      institutionName,
      profile.user?.rollNumber || profile.id,
    );

    // Store the relative key (not full URL) in database
    return this.studentService.uploadProfileImage(req.user.userId, result.key);
  }

  @Get('applications')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all student applications' })
  @ApiResponse({ status: 200, description: 'Applications retrieved successfully' })
  async getApplications(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.studentService.getApplications(req.user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status
    });
  }

  @Get('applications/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get application details' })
  @ApiResponse({ status: 200, description: 'Application details retrieved successfully' })
  async getApplicationDetails(@Req() req, @Param('id') id: string) {
    return this.studentService.getApplicationDetails(req.user.userId, id);
  }

  @Post('applications/:id/withdraw')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Withdraw application' })
  @ApiResponse({ status: 200, description: 'Application withdrawn successfully' })
  async withdrawApplication(@Req() req, @Param('id') id: string) {
    return this.studentService.withdrawApplication(req.user.userId, id);
  }

  @Put('applications/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Update self-identified application (company info, joining letter)' })
  @ApiResponse({ status: 200, description: 'Application updated successfully' })
  async updateApplication(@Req() req, @Param('id') id: string, @Body() updateDto: any) {
    return this.studentService.updateSelfIdentifiedApplication(req.user.userId, id, updateDto);
  }

  @Put('applications/:id/joining-letter')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Upload or replace joining letter' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Joining letter uploaded successfully' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadJoiningLetter(
    @Req() req,
    @Param('id') applicationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File size must be less than 5MB');
    }

    // Get student info for proper file path
    const profile = await this.studentService.getProfile(req.user.userId);

    // Get institution name for folder structure (Student has direct Institution relation)
    const institutionName = (profile as any).Institution?.name || 'default';

    // Upload to MinIO
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: profile.user?.rollNumber || profile.id,
      documentType: 'joining-letter',
    });

    // Update application with new joining letter URL
    return this.studentService.updateSelfIdentifiedApplication(req.user.userId, applicationId, {
      joiningLetterUrl: result.url,
    });
  }

  @Delete('applications/:id/joining-letter')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Delete joining letter' })
  @ApiResponse({ status: 200, description: 'Joining letter deleted successfully' })
  async deleteJoiningLetter(@Req() req, @Param('id') applicationId: string) {
    return this.studentService.updateSelfIdentifiedApplication(req.user.userId, applicationId, {
      deleteJoiningLetter: true,
    });
  }

  // Self-Identified Internships
  @Post('self-identified')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit self-identified internship' })
  @ApiResponse({ status: 201, description: 'Self-identified internship submitted successfully' })
  async submitSelfIdentified(@Req() req, @Body() selfIdentifiedDto: any) {
    return this.studentService.submitSelfIdentified(req.user.userId, selfIdentifiedDto);
  }

  @Get('self-identified')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get self-identified internships' })
  @ApiResponse({ status: 200, description: 'Self-identified internships retrieved successfully' })
  async getSelfIdentified(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studentService.getSelfIdentified(req.user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined
    });
  }

  // Monthly Reports
  @Get('monthly-reports')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all monthly reports' })
  @ApiResponse({ status: 200, description: 'Monthly reports retrieved successfully' })
  async getMonthlyReports(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('applicationId') applicationId?: string,
  ) {
    return this.studentService.getMonthlyReports(req.user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      applicationId,
    });
  }

  @Post('monthly-reports')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit monthly report' })
  @ApiResponse({ status: 201, description: 'Monthly report submitted successfully' })
  async submitMonthlyReport(@Req() req, @Body() reportDto: any) {
    return this.studentService.submitMonthlyReport(req.user.userId, reportDto);
  }

  @Put('monthly-reports/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Update monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report updated successfully' })
  async updateMonthlyReport(@Req() req, @Param('id') id: string, @Body() reportDto: any) {
    return this.studentService.updateMonthlyReport(req.user.userId, id, reportDto);
  }

  @Delete('monthly-reports/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Delete monthly report' })
  @ApiResponse({ status: 200, description: 'Monthly report deleted successfully' })
  async deleteMonthlyReport(@Req() req, @Param('id') id: string) {
    return this.studentService.deleteMonthlyReport(req.user.userId, id);
  }

  @Get('monthly-reports/:id/view')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'View monthly report details' })
  @ApiResponse({ status: 200, description: 'Report details retrieved successfully' })
  async viewMonthlyReport(@Req() req, @Param('id') id: string) {
    return this.studentService.viewMonthlyReport(req.user.userId, id);
  }

  @Get('applications/:id/reports')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get monthly reports with status for an application' })
  @ApiResponse({ status: 200, description: 'Reports with status retrieved successfully' })
  async getApplicationReports(@Req() req, @Param('id') applicationId: string) {
    return this.studentService.getMonthlyReportsWithStatus(req.user.userId, applicationId);
  }

  // REMOVED: generateApplicationReports endpoint
  // Legacy system that created DRAFT records has been replaced by counter-based tracking
  // Expected counts are now calculated when internship is created/updated via ExpectedCycleService

  @Post('monthly-reports/upload')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Upload report file as draft' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Report file uploaded successfully' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadReportFile(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() reportDto: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Get student info for proper file path
    const profile = await this.studentService.getProfile(req.user.userId);
    const reportMonth = parseInt(reportDto.reportMonth, 10);
    const reportYear = parseInt(reportDto.reportYear, 10);

    // Get institution name for folder structure (Student has direct Institution relation)
    const institutionName = (profile as any).Institution?.name || 'default';

    // Get month name
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'];

    // Upload to MinIO
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: profile.user?.rollNumber || profile.id,
      documentType: 'monthly-report',
      month: monthNames[reportMonth - 1],
      year: reportYear.toString(),
    });

    return this.studentService.uploadReportFile(req.user.userId, {
      applicationId: reportDto.applicationId,
      reportMonth,
      reportYear,
      reportFileUrl: result.url,
    });
  }

  // Faculty Visits
  @Get('applications/:id/faculty-visits')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get faculty visits with status for an application' })
  @ApiResponse({ status: 200, description: 'Faculty visits retrieved successfully' })
  async getApplicationFacultyVisits(@Req() req, @Param('id') applicationId: string) {
    // Verify ownership first
    await this.studentService.getApplicationDetails(req.user.userId, applicationId);
    return this.studentService.getFacultyVisitsWithStatus(applicationId);
  }

  // Documents
  @Get('documents')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all student documents' })
  @ApiResponse({ status: 200, description: 'Documents retrieved successfully' })
  async getDocuments(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.studentService.getDocuments(req.user.userId, { page, limit, type });
  }

  @Post('documents')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Upload document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadDocument(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() documentDto: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Get student info for proper file path
    const profile = await this.studentService.getProfile(req.user.userId);

    // Get institution name for folder structure (Student has direct Institution relation)
    const institutionName = (profile as any).Institution?.name || 'default';

    // Upload to MinIO
    const result = await this.fileStorageService.uploadStudentDocument(file, {
      institutionName,
      rollNumber: profile.user?.rollNumber || profile.id,
      documentType: 'document',
      customName: documentDto.type || 'document',
    });

    // Create a modified file object with MinIO URL
    const fileWithUrl = {
      ...file,
      path: result.url,
      url: result.url,
      location: result.url,
    };

    return this.studentService.uploadDocument(req.user.userId, fileWithUrl, documentDto);
  }

  @Delete('documents/:id')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(@Req() req, @Param('id') id: string) {
    return this.studentService.deleteDocument(req.user.userId, id);
  }

  // Support
  @Post('grievances')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Submit grievance' })
  @ApiResponse({ status: 201, description: 'Grievance submitted successfully' })
  async submitGrievance(@Req() req, @Body() grievanceDto: any) {
    return this.studentService.submitGrievance(req.user.userId, grievanceDto);
  }

  @Get('grievances')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get all grievances' })
  @ApiResponse({ status: 200, description: 'Grievances retrieved successfully' })
  async getGrievances(
    @Req() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.studentService.getGrievances(req.user.userId, { 
      page: page ? parseInt(page, 10) : undefined, 
      limit: limit ? parseInt(limit, 10) : undefined, 
      status 
    });
  }

  // Support Tickets: Students should use /support/tickets endpoints
  // POST /support/tickets - Create ticket (all authenticated users)
  // GET /support/tickets/my-tickets - Get user's own tickets

  // Mentor
  @Get('my-mentor')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get assigned mentor for the student' })
  @ApiResponse({ status: 200, description: 'Mentor information retrieved successfully' })
  async getMyMentor(@Req() req) {
    return this.studentService.getMyMentor(req.user.userId);
  }

  // Companies
  @Get('companies')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get companies list for dropdown selection' })
  @ApiResponse({ status: 200, description: 'Companies retrieved successfully' })
  async getCompanies(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studentService.getCompanies({
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
