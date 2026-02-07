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
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../core/config/throttle.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { PrincipalService } from './principal.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AssignMentorDto } from './dto/assign-mentor.dto';

@ApiTags('Principal')
@ApiBearerAuth()
@Controller('principal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalController {
  constructor(private readonly principalService: PrincipalService) {}

  // Dashboard
  @Throttle({ default: THROTTLE_PRESETS.dashboard })
  @Get('dashboard')
  @ApiOperation({ summary: 'Get principal dashboard overview' })
  async getDashboard(@Request() req, @Query('refresh') refresh?: string) {
    return this.principalService.getDashboard(req.user.userId, refresh === 'true');
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Get('dashboard/alerts')
  @ApiOperation({ summary: 'Get pending actions and alerts' })
  async getDashboardAlerts(@Request() req) {
    return this.principalService.getDashboardAlerts(req.user.userId);
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Get('dashboard/mentor-coverage')
  @ApiOperation({ summary: 'Get mentor coverage statistics for dashboard' })
  async getMentorCoverage(@Request() req) {
    return this.principalService.getMentorCoverage(req.user.userId);
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Get('dashboard/compliance')
  @ApiOperation({ summary: 'Get compliance metrics with 6-month trend' })
  async getComplianceMetrics(@Request() req) {
    return this.principalService.getComplianceMetrics(req.user.userId);
  }

  @Throttle({ default: THROTTLE_PRESETS.mutation })
  @Get('dashboard/alerts-enhanced')
  @ApiOperation({ summary: 'Get enhanced dashboard alerts' })
  async getDashboardAlertsEnhanced(@Request() req) {
    return this.principalService.getDashboardAlertsEnhanced(req.user.userId);
  }

  // Institution Management
  @Get('institution')
  @ApiOperation({ summary: 'Get own institution details' })
  async getInstitution(@Request() req) {
    return this.principalService.getInstitution(req.user.userId);
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get institution branches/departments' })
  async getBranches(@Request() req) {
    return this.principalService.getBranches(req.user.userId);
  }

  @Put('institution')
  @ApiOperation({ summary: 'Update institution details' })
  async updateInstitution(@Request() req, @Body() updateData: any) {
    return this.principalService.updateInstitution(req.user.userId, updateData);
  }

  // Student Management
  @Get('students/progress')
  @ApiOperation({ summary: 'Get student internship progress with reports' })
  async getStudentProgress(@Request() req, @Query() query: any) {
    return this.principalService.getStudentProgress(req.user.userId, query);
  }

  @Get('students')
  @ApiOperation({ summary: 'Get paginated list of students' })
  async getStudents(@Request() req, @Query() query: any) {
    return this.principalService.getStudents(req.user.userId, query);
  }

  @Get('students/:id')
  @ApiOperation({ summary: 'Get student details by ID' })
  async getStudentById(@Request() req, @Param('id') id: string) {
    return this.principalService.getStudentById(req.user.userId, id);
  }

  @Get('students/:id/unmasked-contact')
  @ApiOperation({ summary: 'Get unmasked contact details for a student' })
  async getUnmaskedContactDetails(@Request() req, @Param('id') studentId: string) {
    return this.principalService.getUnmaskedContactDetails(req.user.userId, studentId);
  }

  @Post('students')
  @ApiOperation({ summary: 'Create new student' })
  async createStudent(@Request() req, @Body() createStudentDto: CreateStudentDto) {
    return this.principalService.createStudent(req.user.userId, createStudentDto);
  }

  @Put('students/:id')
  @ApiOperation({ summary: 'Update student details' })
  async updateStudent(
    @Request() req,
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return this.principalService.updateStudent(req.user.userId, id, updateStudentDto);
  }

  @Delete('students/:id')
  @ApiOperation({ summary: 'Delete student (soft delete)' })
  async deleteStudent(@Request() req, @Param('id') id: string) {
    return this.principalService.deleteStudent(req.user.userId, id);
  }

  @Patch('students/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle student active status (also toggles mentor assignments and internship applications)' })
  async toggleStudentStatus(@Request() req, @Param('id') id: string) {
    return this.principalService.toggleStudentStatus(req.user.userId, id);
  }

  @Post('students/bulk-upload')
  @ApiOperation({ summary: 'Bulk upload students from file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadStudents(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.principalService.bulkUploadStudents(req.user.userId, [file]);
  }

  // Staff Management
  @Post('staff/bulk-upload')
  @ApiOperation({ summary: 'Bulk upload staff from file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadStaff(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.principalService.bulkUploadStaff(req.user.userId, [file]);
  }
  @Get('staff')
  @ApiOperation({ summary: 'Get institution staff list' })
  async getStaff(@Request() req, @Query() query: any) {
    return this.principalService.getStaff(req.user.userId, query);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create new staff member' })
  async createStaff(@Request() req, @Body() createStaffDto: CreateStaffDto) {
    return this.principalService.createStaff(req.user.userId, createStaffDto);
  }

  @Put('staff/:id')
  @ApiOperation({ summary: 'Update staff details' })
  async updateStaff(@Request() req, @Param('id') id: string, @Body() updateData: any) {
    return this.principalService.updateStaff(req.user.userId, id, updateData);
  }

  @Delete('staff/:id')
  @ApiOperation({ summary: 'Delete staff member' })
  async deleteStaff(@Request() req, @Param('id') id: string) {
    return this.principalService.deleteStaff(req.user.userId, id);
  }

  @Patch('staff/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle staff member active status' })
  async toggleStaffStatus(@Request() req, @Param('id') id: string) {
    return this.principalService.toggleStaffStatus(req.user.userId, id);
  }

  // Mentor Management
  @Get('mentors')
  @ApiOperation({ summary: 'Get list of mentors' })
  async getMentors(@Request() req) {
    return this.principalService.getMentors(req.user.userId);
  }

  @Get('mentors/assignments')
  @ApiOperation({ summary: 'Get mentor-student assignments' })
  async getMentorAssignments(@Request() req) {
    return this.principalService.getMentorAssignments(req.user.userId);
  }

  @Get('mentors/external-assignments')
  @ApiOperation({ summary: 'Get external mentor assignments (our faculty mentoring students from other institutions)' })
  async getExternalMentorAssignments(@Request() req) {
    return this.principalService.getExternalMentorAssignments(req.user.userId);
  }

  @Post('mentors/assign')
  @ApiOperation({ summary: 'Assign mentor to students' })
  async assignMentor(@Request() req, @Body() assignMentorDto: AssignMentorDto) {
    return this.principalService.assignMentor(req.user.userId, assignMentorDto);
  }

  @Get('mentors/stats')
  @ApiOperation({ summary: 'Get mentor assignment statistics' })
  async getMentorStats(@Request() req) {
    return this.principalService.getMentorStats(req.user.userId);
  }

  @Delete('students/:id/mentor')
  @ApiOperation({ summary: 'Remove mentor assignment from student' })
  async removeMentorAssignment(@Request() req, @Param('id') studentId: string) {
    return this.principalService.removeMentorAssignment(req.user.userId, studentId);
  }

  @Post('mentors/bulk-unassign')
  @ApiOperation({ summary: 'Bulk unassign mentors from students' })
  async bulkUnassignMentors(@Request() req, @Body() body: { studentIds: string[] }) {
    return this.principalService.bulkUnassignMentors(req.user.userId, body.studentIds);
  }

  @Post('mentors/auto-assign')
  @ApiOperation({ summary: 'Auto-assign unassigned students to mentors evenly' })
  async autoAssignMentors(@Request() req) {
    return this.principalService.autoAssignMentors(req.user.userId);
  }

  // Reports
  @Get('faculty/reports')
  @ApiOperation({ summary: 'Get faculty visit reports with stats for principal dashboard' })
  async getFacultyReportsForDashboard(@Request() req, @Query() query: any) {
    return this.principalService.getFacultyReportsForDashboard(req.user.userId, query);
  }

  @Get('reports/pending-by-month')
  @ApiOperation({ summary: 'Get pending/missing reports grouped by month' })
  async getPendingReportsByMonth(@Request() req, @Query() query: any) {
    return this.principalService.getPendingReportsByMonth(req.user.userId, query);
  }

  @Get('reports/students')
  @ApiOperation({ summary: 'Get student reports' })
  async getStudentReports(@Request() req, @Query() query: any) {
    return this.principalService.getStudentReports(req.user.userId, query);
  }

  @Get('reports/faculty-visits')
  @ApiOperation({ summary: 'Get faculty visit reports' })
  async getFacultyVisitReports(@Request() req, @Query() query: any) {
    return this.principalService.getFacultyVisitReports(req.user.userId, query);
  }

  @Get('reports/monthly')
  @ApiOperation({ summary: 'Get monthly reports' })
  async getMonthlyReports(@Request() req, @Query() query: any) {
    return this.principalService.getMonthlyReports(req.user.userId, query);
  }

  // Academic Management
  @Get('batches')
  @ApiOperation({ summary: 'Get institution batches' })
  async getBatches(@Request() req) {
    return this.principalService.getBatches(req.user.userId);
  }

  @Post('batches')
  @ApiOperation({ summary: 'Create new batch' })
  async createBatch(@Request() req, @Body() batchData: any) {
    return this.principalService.createBatch(req.user.userId, batchData);
  }

  @Get('semesters')
  @ApiOperation({ summary: 'Get institution semesters' })
  async getSemesters(@Request() req) {
    return this.principalService.getSemesters(req.user.userId);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Get institution subjects' })
  async getSubjects(@Request() req) {
    return this.principalService.getSubjects(req.user.userId);
  }

  // Analytics
  @Get('analytics')
  @ApiOperation({ summary: 'Get institution analytics' })
  async getAnalytics(@Request() req) {
    return this.principalService.getAnalytics(req.user.userId);
  }

  @Get('internships/stats')
  @ApiOperation({ summary: 'Get internship statistics' })
  async getInternshipStats(@Request() req) {
    return this.principalService.getInternshipStats(req.user.userId);
  }

  @Get('placements/stats')
  @ApiOperation({ summary: 'Get placement statistics' })
  async getPlacementStats(@Request() req) {
    return this.principalService.getPlacementStats(req.user.userId);
  }

  // Faculty Progress Tracking
  @Get('faculty/progress')
  @ApiOperation({ summary: 'Get faculty progress list with assigned students count' })
  async getFacultyProgressList(@Request() req, @Query() query: any) {
    return this.principalService.getFacultyProgressList(req.user.userId, query);
  }

  @Get('faculty/progress/:facultyId')
  @ApiOperation({ summary: 'Get detailed faculty progress with students and visits' })
  async getFacultyProgressDetails(@Request() req, @Param('facultyId') facultyId: string) {
    return this.principalService.getFacultyProgressDetails(req.user.userId, facultyId);
  }

  // ==================== Joining Letters ====================

  @Get('joining-letters/stats')
  @ApiOperation({ summary: 'Get joining letter statistics for institution' })
  async getJoiningLetterStats(@Request() req) {
    return this.principalService.getJoiningLetterStats(req.user.userId);
  }

  @Get('joining-letters/by-mentor')
  @ApiOperation({ summary: 'Get joining letter stats grouped by mentor for dashboard' })
  async getJoiningLettersByMentor(@Request() req) {
    return this.principalService.getJoiningLettersByMentor(req.user.userId);
  }

  @Get('joining-letters')
  @ApiOperation({ summary: 'Get list of joining letters with filtering' })
  async getJoiningLetters(
    @Request() req,
    @Query('status') status?: 'all' | 'pending' | 'verified' | 'rejected' | 'noLetter',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.principalService.getJoiningLetters(req.user.userId, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('joining-letters/activity')
  @ApiOperation({ summary: 'Get recent joining letter activity' })
  async getJoiningLetterActivity(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    return this.principalService.getJoiningLetterActivity(
      req.user.userId,
      limit ? Number(limit) : 10,
    );
  }

  @Put('joining-letters/:id/verify')
  @ApiOperation({ summary: 'Verify a joining letter' })
  async verifyJoiningLetter(
    @Request() req,
    @Param('id') applicationId: string,
    @Body() data: { joiningDate?: Date; remarks?: string },
  ) {
    return this.principalService.verifyJoiningLetter(req.user.userId, applicationId, data);
  }

  @Put('joining-letters/:id/reject')
  @ApiOperation({ summary: 'Reject a joining letter' })
  async rejectJoiningLetter(
    @Request() req,
    @Param('id') applicationId: string,
    @Body() data: { remarks: string },
  ) {
    return this.principalService.rejectJoiningLetter(req.user.userId, applicationId, data);
  }

  // ==================== Internship Management ====================

  @Get('internships/:id')
  @ApiOperation({ summary: 'Get internship details by ID' })
  async getInternshipById(@Request() req, @Param('id') applicationId: string) {
    return this.principalService.getInternshipById(req.user.userId, applicationId);
  }

  @Put('internships/:id')
  @ApiOperation({ summary: 'Update internship details' })
  async updateInternship(
    @Request() req,
    @Param('id') applicationId: string,
    @Body() updateData: any,
  ) {
    return this.principalService.updateInternship(req.user.userId, applicationId, updateData);
  }

  @Post('internships/bulk-status')
  @ApiOperation({ summary: 'Bulk update internship statuses' })
  async bulkUpdateInternshipStatus(
    @Request() req,
    @Body() data: { applicationIds: string[]; status: string; remarks?: string },
  ) {
    return this.principalService.bulkUpdateInternshipStatus(req.user.userId, data);
  }

  @Delete('internships/:id')
  @ApiOperation({ summary: 'Delete internship application' })
  @ApiResponse({ status: 200, description: 'Internship deleted successfully' })
  async deleteInternship(@Request() req, @Param('id') applicationId: string) {
    return this.principalService.deleteInternship(req.user.userId, applicationId);
  }

  // ==================== Student Documents ====================

  @Get('students/:id/documents')
  @ApiOperation({ summary: 'Get documents for a student' })
  async getStudentDocuments(@Request() req, @Param('id') studentId: string) {
    return this.principalService.getStudentDocuments(req.user.userId, studentId);
  }

  @Post('students/:id/documents')
  @ApiOperation({ summary: 'Upload a document for a student' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadStudentDocument(
    @Request() req,
    @Param('id') studentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
  ) {
    return this.principalService.uploadStudentDocument(req.user.userId, studentId, file, type);
  }

  @Delete('students/:id/documents/:documentId')
  @ApiOperation({ summary: 'Delete a student document' })
  async deleteStudentDocument(
    @Request() req,
    @Param('id') studentId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.principalService.deleteStudentDocument(req.user.userId, studentId, documentId);
  }
}
