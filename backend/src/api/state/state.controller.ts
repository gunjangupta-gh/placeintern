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
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../core/config/throttle.config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StateService } from './state.service';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Role } from '../../generated/prisma/client';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  CreatePrincipalDto,
  UpdatePrincipalDto,
  CreateStaffDto,
  UpdateStaffDto,
  MonthlyComplianceQueryDto,
  InstitutionComplianceQueryDto,
} from './dto';

@ApiTags('State Directorate')
@ApiBearerAuth()
@Controller('state')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateController {
  constructor(private readonly stateService: StateService) {}

  @Throttle({ default: THROTTLE_PRESETS.dashboard })
  @Get('dashboard')
  @ApiOperation({ summary: 'Get state directorate dashboard data' })
  async getDashboard(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getDashboard({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('dashboard/critical-alerts')
  @ApiOperation({ summary: 'Get critical alerts for state dashboard' })
  async getCriticalAlerts() {
    return this.stateService.getCriticalAlerts();
  }

  @Get('dashboard/actions')
  @ApiOperation({ summary: 'Get action items for state dashboard' })
  async getDashboardActions() {
    return this.stateService.getActionItems();
  }

  @Get('dashboard/visits-by-type')
  @ApiOperation({ summary: 'Get visits grouped by type (PHYSICAL, VIRTUAL, TELEPHONIC) for pie chart' })
  async getVisitsByType(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getVisitsByType({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('dashboard/college-breakdown/:type')
  @ApiOperation({ summary: 'Get college-wise breakdown for dashboard stats' })
  async getCollegeBreakdown(
    @Param('type') type: 'students' | 'reports' | 'mentors' | 'visits',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getCollegeWiseBreakdown(type, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('compliance/summary')
  @ApiOperation({ summary: 'Get compliance overview for all institutions' })
  async getComplianceSummary() {
    return this.stateService.getComplianceSummary();
  }

  @Get('compliance/monthly')
  @ApiOperation({ summary: 'Get institution-wise monthly compliance breakdown (reports & visits)' })
  async getMonthlyCompliance(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    if (!month || !year) {
      throw new BadRequestException('month and year are required query parameters');
    }
    return this.stateService.getMonthlyComplianceByInstitution({
      month: Number(month),
      year: Number(year),
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('compliance/monthly/available-months')
  @ApiOperation({ summary: 'Get available months that have compliance data' })
  async getAvailableComplianceMonths() {
    return this.stateService.getAvailableComplianceMonths();
  }

  @Get('compliance/institution/:id')
  @ApiOperation({ summary: 'Get detailed monthly compliance for a single institution (student-level breakdown)' })
  async getInstitutionComplianceDetails(
    @Param('id') institutionId: string,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    if (!month || !year) {
      throw new BadRequestException('month and year are required query parameters');
    }
    return this.stateService.getInstitutionComplianceDetails({
      institutionId,
      month: Number(month),
      year: Number(year),
    });
  }

  @Get('students/:id/documents')
  @ApiOperation({ summary: 'Get student documents with presigned URLs for compliance viewer' })
  async getStudentDocuments(@Param('id') studentId: string) {
    return this.stateService.getStudentDocuments(studentId);
  }

  @Get('institutions/:id/documents')
  @ApiOperation({ summary: 'Get all documents for students in an institution' })
  async getInstitutionDocuments(@Param('id') institutionId: string) {
    return this.stateService.getInstitutionDocuments(institutionId);
  }

  @Get('institutions/:id/joining-letters')
  @ApiOperation({ summary: 'Get all joining letters for students in an institution' })
  async getInstitutionJoiningLetters(@Param('id') institutionId: string) {
    return this.stateService.getInstitutionJoiningLetters(institutionId);
  }

  @Get('institutions/:id/file-explorer')
  @ApiOperation({ summary: 'Get all files for an institution organized by type (file explorer view)' })
  async getInstitutionFileExplorer(@Param('id') institutionId: string) {
    return this.stateService.getInstitutionFileExplorer(institutionId);
  }

  @Get('files/:type/:id/presigned-url')
  @ApiOperation({ summary: 'Get fresh presigned URL for a file (when cached URL has expired)' })
  async getFilePresignedUrl(
    @Param('type') type: 'document' | 'joining-letter' | 'monthly-report' | 'visit-document' | 'visit-photo' | 'visit-signed-document',
    @Param('id') fileId: string,
  ) {
    const validTypes = ['document', 'joining-letter', 'monthly-report', 'visit-document', 'visit-photo', 'visit-signed-document'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid file type. Must be one of: ${validTypes.join(', ')}`);
    }
    return this.stateService.getFilePresignedUrl(type, fileId);
  }

  // ==================== State-Wide Students ====================

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('students')
  @ApiOperation({ summary: 'Get all students across all institutions with filters and pagination' })
  async getAllStudents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('institutionId') institutionId?: string,
    @Query('branchName') branchName?: string,
    @Query('status') status?: 'active' | 'inactive' | 'all',
    @Query('internshipStatus') internshipStatus?: 'with_internship' | 'without_internship' | 'all',
    @Query('mentorStatus') mentorStatus?: 'assigned' | 'unassigned' | 'all',
    @Query('reportStatus') reportStatus?: 'submitted' | 'pending' | 'not_submitted' | 'all',
  ) {
    return this.stateService.getAllStudents({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      institutionId,
      branchName,
      status,
      internshipStatus,
      mentorStatus,
      reportStatus,
    });
  }

  @Get('students/summary')
  @ApiOperation({ summary: 'Get summary statistics for all students' })
  async getStudentsSummary() {
    return this.stateService.getStudentsSummary();
  }

  @Get('students/export')
  @ApiOperation({ summary: 'Get all students for Excel export (no pagination)' })
  async getAllStudentsForExport(
    @Query('search') search?: string,
    @Query('institutionId') institutionId?: string,
    @Query('branchName') branchName?: string,
    @Query('status') status?: 'active' | 'inactive' | 'all',
    @Query('internshipStatus') internshipStatus?: 'with_internship' | 'without_internship' | 'all',
    @Query('mentorStatus') mentorStatus?: 'assigned' | 'unassigned' | 'all',
  ) {
    return this.stateService.getAllStudentsForExport({
      search,
      institutionId,
      branchName,
      status,
      internshipStatus,
      mentorStatus,
    });
  }

  @Get('institutions')
  @ApiOperation({ summary: 'Get all institutions under state directorate' })
  async getInstitutions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.stateService.getInstitutions({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('institutions/dashboard-stats')
  @ApiOperation({ summary: 'Get institutions with comprehensive stats for dashboard' })
  async getInstitutionsWithStats(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getInstitutionsWithStats({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('institutions/:id/overview')
  @ApiOperation({ summary: 'Get institution overview with detailed statistics' })
  async getInstitutionOverview(@Param('id') id: string) {
    return this.stateService.getInstitutionOverview(id);
  }

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('institutions/:id/students')
  @ApiOperation({ summary: 'Get institution students with cursor pagination and filters' })
  async getInstitutionStudents(
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('filter') filter?: 'assigned' | 'unassigned' | 'all',
    @Query('branch') branch?: string,
    @Query('companyId') companyId?: string,
    @Query('reportStatus') reportStatus?: 'submitted' | 'pending' | 'not_submitted' | 'all',
    @Query('visitStatus') visitStatus?: 'visited' | 'pending' | 'all',
    @Query('selfIdentified') selfIdentified?: 'yes' | 'no' | 'all',
    @Query('status') status?: 'active' | 'inactive' | 'all',
  ) {
    return this.stateService.getInstitutionStudents(id, {
      cursor,
      limit: Number(limit) || 20,
      search,
      filter: filter || 'all',
      branch,
      companyId,
      reportStatus,
      visitStatus,
      selfIdentified,
      status,
    });
  }

  @Get('institutions/:id/companies')
  @ApiOperation({ summary: 'Get institution companies with student counts and branch-wise data' })
  async getInstitutionCompanies(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.stateService.getInstitutionCompanies(id, {
      limit: Number(limit) || 50,
      search,
    });
  }

  // ==================== STATE-WIDE COMPANIES OVERVIEW ====================

  @Get('companies')
  @ApiOperation({ summary: 'Get all companies across all institutions with student breakdown' })
  async getAllCompanies(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('industryType') industryType?: string,
    @Query('sortBy') sortBy?: 'studentCount' | 'institutionCount' | 'companyName',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.stateService.getAllCompanies({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      industryType,
      sortBy,
      sortOrder,
    });
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'Get company details with all institutions and students' })
  async getCompanyDetails(@Param('id') id: string) {
    return this.stateService.getCompanyDetails(id);
  }

  @Get('institutions/:id/faculty-principal')
  @ApiOperation({ summary: 'Get institution faculty and principal with stats' })
  async getInstitutionFacultyAndPrincipal(@Param('id') id: string) {
    return this.stateService.getInstitutionFacultyAndPrincipal(id);
  }

  // Note: Specific routes must come BEFORE generic :id routes
  @Get('institutions/:id/mentors')
  @ApiOperation({ summary: 'Get mentors/faculty from an institution' })
  async getInstitutionMentors(@Param('id') institutionId: string) {
    const mentors = await this.stateService.getInstitutionMentors(institutionId);
    return { success: true, data: mentors };
  }

  @Get('institutions/:id')
  @ApiOperation({ summary: 'Get institution details by ID' })
  async getInstitutionById(@Param('id') id: string) {
    return this.stateService.getInstitutionById(id);
  }

  @Post('institutions')
  @ApiOperation({ summary: 'Create new institution' })
  async createInstitution(@Body() data: CreateInstitutionDto) {
    return this.stateService.createInstitution(data);
  }

  @Put('institutions/:id')
  @ApiOperation({ summary: 'Update institution by ID' })
  async updateInstitution(@Param('id') id: string, @Body() data: UpdateInstitutionDto) {
    return this.stateService.updateInstitution(id, data);
  }

  @Delete('institutions/:id')
  @ApiOperation({ summary: 'Delete institution by ID' })
  async deleteInstitution(@Param('id') id: string) {
    return this.stateService.deleteInstitution(id);
  }

  @Get('principals')
  @ApiOperation({ summary: 'Get all principals across institutions (use active=false to view inactive)' })
  async getPrincipals(
    @Query('institutionId') institutionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.stateService.getPrincipals({
      institutionId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
    });
  }

  @Post('principals')
  @ApiOperation({ summary: 'Create new principal for an institution' })
  async createPrincipal(@Body() data: CreatePrincipalDto) {
    return this.stateService.createPrincipal(data);
  }

  @Get('principals/:id')
  @ApiOperation({ summary: 'Get principal by ID' })
  async getPrincipalById(@Param('id') id: string) {
    return this.stateService.getPrincipalById(id);
  }

  @Put('principals/:id')
  @ApiOperation({ summary: 'Update principal by ID' })
  async updatePrincipal(@Param('id') id: string, @Body() data: UpdatePrincipalDto) {
    return this.stateService.updatePrincipal(id, data);
  }

  @Delete('principals/:id')
  @ApiOperation({ summary: 'Delete principal by ID' })
  async deletePrincipal(@Param('id') id: string) {
    return this.stateService.deletePrincipal(id);
  }

  @Patch('principals/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle principal active status (activate/deactivate)' })
  async togglePrincipalStatus(@Param('id') id: string) {
    return this.stateService.togglePrincipalStatus(id);
  }

  @Post('principals/:id/reset-password')
  @ApiOperation({ summary: 'Reset principal password' })
  async resetPrincipalPassword(@Param('id') id: string) {
    return this.stateService.resetPrincipalPassword(id);
  }

  // ==================== Staff Management ====================

  @Get('staff')
  @ApiOperation({ summary: 'Get all staff across institutions with filtering' })
  async getStaff(
    @Query('institutionId') institutionId?: string,
    @Query('role') role?: string,
    @Query('branchName') branchName?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getStaff({
      institutionId,
      role,
      branchName,
      search,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create new staff member for an institution' })
  async createStaff(@Body() data: CreateStaffDto) {
    return this.stateService.createStaff(data);
  }

  @Get('staff/:id')
  @ApiOperation({ summary: 'Get staff member by ID' })
  async getStaffById(@Param('id') id: string) {
    return this.stateService.getStaffById(id);
  }

  @Put('staff/:id')
  @ApiOperation({ summary: 'Update staff member by ID' })
  async updateStaff(@Param('id') id: string, @Body() data: UpdateStaffDto) {
    return this.stateService.updateStaff(id, data);
  }

  @Delete('staff/:id')
  @ApiOperation({ summary: 'Delete staff member by ID' })
  async deleteStaff(@Param('id') id: string) {
    return this.stateService.deleteStaff(id);
  }

  @Delete('faculty/:id')
  @ApiOperation({ summary: 'Delete faculty member by ID' })
  async deleteFaculty(@Param('id') id: string) {
    return this.stateService.deleteFaculty(id);
  }

  @Patch('faculty/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle faculty active status (activate/deactivate)' })
  async toggleFacultyStatus(@Param('id') id: string) {
    return this.stateService.toggleFacultyStatus(id);
  }

  @Post('staff/:id/reset-password')
  @ApiOperation({ summary: 'Reset staff member password' })
  async resetStaffPassword(@Param('id') id: string) {
    return this.stateService.resetStaffPassword(id);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users for credentials management' })
  async getUsers(
    @Query('role') role?: string,
    @Query('institutionId') institutionId?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getUsers({
      role,
      institutionId,
      search,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('reports/institutions')
  @ApiOperation({ summary: 'Get institutional performance reports' })
  async getInstitutionReports(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('reportType') reportType?: string,
  ) {
    return this.stateService.getInstitutionReports({ fromDate, toDate, reportType });
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get system-wide audit logs' })
  async getAuditLogs(
    @Query('institutionId') institutionId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stateService.getAuditLogs({
      institutionId,
      userId,
      action,
      fromDate,
      toDate,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('analytics/performers')
  @ApiOperation({ summary: 'Get top and bottom performing institutions' })
  async getPerformers(
    @Query('limit') limit?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getTopPerformers({
      limit: limit ? Number(limit) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/industries')
  @ApiOperation({ summary: 'Get top industry partners by hiring' })
  async getTopIndustries(
    @Query('limit') limit?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getTopIndustries({
      limit: limit ? Number(limit) : undefined,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/monthly')
  @ApiOperation({ summary: 'Get monthly analytics data' })
  async getMonthlyAnalytics(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getMonthlyAnalytics({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/institution/:id')
  @ApiOperation({ summary: 'Get performance metrics for a specific institution' })
  async getInstitutionPerformance(
    @Param('id') id: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.stateService.getInstitutionPerformance(id, {
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('analytics/reports')
  @ApiOperation({ summary: 'Get monthly report statistics' })
  async getMonthlyReportStats(
    @Query('institutionId') institutionId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getMonthlyReportStats({
      institutionId,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('analytics/visits')
  @ApiOperation({ summary: 'Get faculty visit statistics' })
  async getFacultyVisitStats(
    @Query('institutionId') institutionId?: string,
    @Query('facultyId') facultyId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.stateService.getFacultyVisitStats({
      institutionId,
      facultyId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('placements/stats')
  @ApiOperation({ summary: 'Get state-wide placement statistics' })
  async getPlacementStats() {
    return this.stateService.getStateWidePlacementStats();
  }

  @Get('placements/trends')
  @ApiOperation({ summary: 'Get state-wide placement trends' })
  async getPlacementTrends(
    @Query('years') years?: string,
  ) {
    return this.stateService.getStateWidePlacementTrends(years ? Number(years) : undefined);
  }

  @Get('joining-letters/stats')
  @ApiOperation({ summary: 'Get joining letter statistics' })
  async getJoiningLetterStats(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.stateService.getJoiningLetterStats({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Throttle({ default: THROTTLE_PRESETS.export })
  @Post('export/dashboard')
  @ApiOperation({ summary: 'Export dashboard data as report' })
  async exportDashboard(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const monthNum = month ? Number(month) : undefined;
    const yearNum = year ? Number(year) : undefined;

    // OPTIMIZED: Parallelize all data fetching calls for better performance
    const [stats, performers, industries, monthlyData] = await Promise.all([
      this.stateService.getDashboardStats(),
      this.stateService.getTopPerformers({ limit: 10, month: monthNum, year: yearNum }),
      this.stateService.getTopIndustries({ limit: 10 }),
      this.stateService.getMonthlyAnalytics({ month: monthNum, year: yearNum }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      format,
      data: {
        stats,
        performers,
        industries,
        monthlyAnalytics: monthlyData,
      },
    };
  }

  // ==================== Mentor Management ====================

  @Get('mentors')
  @ApiOperation({ summary: 'Get all mentors across all institutions' })
  async getAllMentors(
    @Query('search') search?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const mentors = await this.stateService.getAllMentors({ search, institutionId });
    return { success: true, data: mentors };
  }

  @Get('mentors/institution-overview')
  @ApiOperation({
    summary: 'Get institution mentor overview with cross-institutional statistics',
    description: 'Shows internal and external mentoring stats for each institution',
  })
  async getInstitutionMentorOverview() {
    const overview = await this.stateService.getInstitutionMentorOverview();
    return { success: true, data: overview };
  }

  @Post('students/:id/assign-mentor')
  @ApiOperation({ summary: 'Assign mentor to student' })
  async assignMentorToStudent(
    @Param('id') studentId: string,
    @Body('mentorId') mentorId: string,
    @Req() req,
  ) {
    const assignedBy = req.user?.userId || 'state-admin';
    return this.stateService.assignMentorToStudent(studentId, mentorId, assignedBy);
  }

  @Delete('students/:id/mentor')
  @ApiOperation({ summary: 'Remove mentor from student' })
  async removeMentorFromStudent(
    @Param('id') studentId: string,
    @Req() req,
  ) {
    const removedBy = req.user?.userId || 'state-admin';
    return this.stateService.removeMentorFromStudent(studentId, removedBy);
  }

  @Delete('students/:id')
  @ApiOperation({ summary: 'Delete student by ID' })
  async deleteStudent(
    @Param('id') studentId: string,
    @Req() req,
  ) {
    const deletedBy = req.user?.userId || 'state-admin';
    return this.stateService.deleteStudent(studentId, deletedBy);
  }

  @Patch('students/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle student active status (activate/deactivate)' })
  async toggleStudentStatus(
    @Param('id') studentId: string,
    @Req() req,
  ) {
    const toggledBy = req.user?.userId || 'state-admin';
    return this.stateService.toggleStudentStatus(studentId, toggledBy);
  }

  // ==================== Restore Center ====================

  private readonly VALID_RESTORE_TYPES = ['monthly-reports', 'faculty-visits', 'documents'] as const;

  private validateRestoreType(type: string): type is 'monthly-reports' | 'faculty-visits' | 'documents' {
    return this.VALID_RESTORE_TYPES.includes(type as any);
  }

  @Get('restore/summary')
  @ApiOperation({ summary: 'Get summary of deleted items counts across all types' })
  async getDeletedItemsSummary(
    @Query('institutionId') institutionId?: string,
  ) {
    return this.stateService.getDeletedItemsSummary(institutionId);
  }

  @Get('restore/:type')
  @ApiOperation({ summary: 'Get deleted items by type with pagination and filters' })
  async getDeletedItems(
    @Param('type') type: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('institutionId') institutionId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    if (!this.validateRestoreType(type)) {
      throw new BadRequestException(
        `Invalid type: ${type}. Valid types are: ${this.VALID_RESTORE_TYPES.join(', ')}`
      );
    }
    return this.stateService.getDeletedItems(type, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      institutionId,
      fromDate,
      toDate,
    });
  }

  // IMPORTANT: Bulk route must come BEFORE the parameterized :id route
  @Post('restore/:type/bulk')
  @ApiOperation({ summary: 'Bulk restore multiple deleted items' })
  async bulkRestore(
    @Param('type') type: string,
    @Body('ids') ids: string[],
    @Req() req,
  ) {
    if (!this.validateRestoreType(type)) {
      throw new BadRequestException(
        `Invalid type: ${type}. Valid types are: ${this.VALID_RESTORE_TYPES.join(', ')}`
      );
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array of strings');
    }
    // Validate each ID is a non-empty string
    const invalidIds = ids.filter(id => typeof id !== 'string' || !id.trim());
    if (invalidIds.length > 0) {
      throw new BadRequestException('All ids must be non-empty strings');
    }
    const restoredBy = req.user?.userId || 'state-admin';
    return this.stateService.bulkRestore(type, ids, restoredBy);
  }

  @Post('restore/:type/:id')
  @ApiOperation({ summary: 'Restore a single deleted item' })
  async restoreItem(
    @Param('type') type: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    if (!this.validateRestoreType(type)) {
      throw new BadRequestException(
        `Invalid type: ${type}. Valid types are: ${this.VALID_RESTORE_TYPES.join(', ')}`
      );
    }
    if (!id || !id.trim()) {
      throw new BadRequestException('id is required');
    }
    const restoredBy = req.user?.userId || 'state-admin';
    return this.stateService.restoreItem(type, id, restoredBy);
  }
}
