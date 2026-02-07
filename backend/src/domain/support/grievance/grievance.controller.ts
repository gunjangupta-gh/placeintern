import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  GrievanceService,
  SubmitGrievanceDto,
  RespondToGrievanceDto,
  AssignGrievanceDto,
  EscalateGrievanceDto,
} from './grievance.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { GrievanceStatus } from '../../../generated/prisma/client';

@Controller('grievances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GrievanceController {
  constructor(private readonly grievanceService: GrievanceService) {}

  /**
   * Get all grievances (with optional filtering)
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   * STATE_DIRECTORATE users see ALL grievances (no institution filter)
   * Other roles see grievances for their institution
   */
  @Get()
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async getAllGrievances(@Query() params: any, @Request() req: any) {
    // STATE_DIRECTORATE users can see all grievances across all institutions
    if (req.user.role === 'STATE_DIRECTORATE') {
      // Optionally filter by escalation level if provided
      const escalationLevel = params.escalationLevel || null;
      return this.grievanceService.getAllGrievances(escalationLevel);
    }

    // For other roles, filter by institution
    const institutionId = params.institutionId || req.user.institutionId;
    if (!institutionId) {
      throw new HttpException('Institution ID is required', HttpStatus.BAD_REQUEST);
    }
    return this.grievanceService.getGrievancesByInstitution(institutionId);
  }

  /**
   * Get grievance statistics
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   * STATE_DIRECTORATE users see stats for ALL grievances (no institution filter)
   */
  @Get('statistics')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async getStatistics(@Query('institutionId') institutionId?: string, @Request() req?: any) {
    // STATE_DIRECTORATE users see global statistics
    if (req?.user?.role === 'STATE_DIRECTORATE') {
      return this.grievanceService.getStatistics(); // No institutionId filter
    }
    const instId = institutionId || req?.user?.institutionId;
    return this.grievanceService.getStatistics(instId);
  }

  /**
   * Get assignable users for grievance assignment
   * Access: Any authenticated user
   */
  @Get('assignable-users/list')
  async getAssignableUsers(@Query('institutionId') institutionId?: string, @Request() req?: any) {
    const instId = institutionId || req?.user?.institutionId;
    if (!instId) {
      throw new HttpException('Institution ID is required', HttpStatus.BAD_REQUEST);
    }
    return this.grievanceService.getAssignableUsers(instId);
  }

  /**
   * Get grievances by institution ID
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Get('institution/:institutionId')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async getGrievancesByInstitution(@Param('institutionId') institutionId: string) {
    return this.grievanceService.getGrievancesByInstitution(institutionId);
  }

  /**
   * Get grievances assigned to faculty member
   * Access: TEACHER, FACULTY_SUPERVISOR, PRINCIPAL
   */
  @Get('faculty/:userId')
  @Roles('TEACHER', 'PRINCIPAL')
  async getGrievancesByFaculty(@Param('userId') userId: string, @Request() req: any) {
    // Faculty can only see their own assigned grievances unless they're admin
    if (req.user.userId !== userId && !['STATE_DIRECTORATE', 'PRINCIPAL'].includes(req.user.role)) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.grievanceService.getGrievancesByFaculty(userId);
  }

  /**
   * Get grievances by user ID (for students viewing their own)
   * Access: Any authenticated user (for their own grievances)
   */
  @Get('user/:userId')
  async getGrievancesByUser(@Param('userId') userId: string, @Request() req: any) {
    console.log(`[GrievanceController] getGrievancesByUser called - userId param: ${userId}, req.user.userId: ${req.user?.userId}, role: ${req.user?.role}`);

    // Ensure users can only access their own grievances unless they're admin
    if (req.user.userId !== userId && !['STATE_DIRECTORATE', 'PRINCIPAL'].includes(req.user.role)) {
      console.log(`[GrievanceController] Unauthorized - userId mismatch`);
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }
    return this.grievanceService.getGrievancesByUser(userId);
  }

  /**
   * Get grievances by student ID
   * Access: Any authenticated user
   */
  @Get('student/:studentId')
  async getGrievancesByStudentId(@Param('studentId') studentId: string, @Request() req: any) {
    return this.grievanceService.getGrievancesByStudentId(studentId);
  }

  /**
   * Get escalation chain for a grievance
   * Access: Any authenticated user
   */
  @Get(':id/escalation-chain')
  async getEscalationChain(@Param('id') id: string) {
    return this.grievanceService.getEscalationChain(id);
  }

  /**
   * Get a single grievance by ID
   * Access: Owner or admin
   */
  @Get(':id')
  async getGrievanceById(@Param('id') id: string, @Request() req: any) {
    const grievance = await this.grievanceService.getGrievanceById(id);

    // Check access - student can see their own, faculty/admin can see all
    const isOwner = grievance.student?.userId === req.user.userId;
    const isAssigned = grievance.assignedToId === req.user.userId || grievance.facultySupervisorId === req.user.userId;
    const isAdmin = ['STATE_DIRECTORATE', 'PRINCIPAL', 'FACULTY_SUPERVISOR', 'TEACHER'].includes(req.user.role);

    if (!isOwner && !isAssigned && !isAdmin) {
      throw new HttpException('Grievance not found', HttpStatus.NOT_FOUND);
    }

    return grievance;
  }

  /**
   * Submit a new grievance
   * Access: STUDENT
   */
  @Post()
  @Roles('STUDENT')
  async submitGrievance(@Body() data: SubmitGrievanceDto, @Request() req: any) {
    return this.grievanceService.submitGrievance(req.user.userId, data);
  }

  /**
   * Respond to a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR, TEACHER
   */
  @Post(':id/respond')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'TEACHER')
  async respondToGrievance(
    @Param('id') id: string,
    @Body() data: RespondToGrievanceDto,
    @Request() req: any,
  ) {
    return this.grievanceService.respondToGrievance(id, req.user.userId, data);
  }

  /**
   * Escalate a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR, TEACHER
   */
  @Post(':id/escalate')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'TEACHER')
  async escalateGrievance(
    @Param('id') id: string,
    @Body() data: EscalateGrievanceDto,
    @Request() req: any,
  ) {
    return this.grievanceService.escalateGrievance(id, req.user.userId, data);
  }

  /**
   * Assign grievance to a user
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Patch(':id/assign')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async assignGrievance(
    @Param('id') id: string,
    @Body() data: AssignGrievanceDto,
    @Request() req: any,
  ) {
    return this.grievanceService.assignGrievance(id, req.user.userId, data);
  }

  /**
   * Update grievance status
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR, TEACHER
   */
  @Patch(':id/status')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL', 'TEACHER')
  async updateGrievanceStatus(
    @Param('id') id: string,
    @Body() data: { status: GrievanceStatus; remarks?: string },
    @Request() req: any,
  ) {
    return this.grievanceService.updateGrievanceStatus(id, req.user.userId, data.status, data.remarks);
  }

  /**
   * Close a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Patch(':id/close')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async closeGrievance(
    @Param('id') id: string,
    @Body() data: { remarks?: string },
    @Request() req: any,
  ) {
    return this.grievanceService.closeGrievance(id, req.user.userId, data?.remarks);
  }

  /**
   * Reject a grievance
   * Access: STATE_DIRECTORATE, PRINCIPAL, FACULTY_SUPERVISOR
   */
  @Patch(':id/reject')
  @Roles('STATE_DIRECTORATE', 'PRINCIPAL')
  async rejectGrievance(
    @Param('id') id: string,
    @Body() data: { reason: string },
    @Request() req: any,
  ) {
    if (!data.reason) {
      throw new HttpException('Rejection reason is required', HttpStatus.BAD_REQUEST);
    }
    return this.grievanceService.rejectGrievance(id, req.user.userId, data.reason);
  }

  /**
   * Migrate existing grievances to have default escalation level
   * Access: STATE_DIRECTORATE only (admin operation)
   */
  @Post('migrate/escalation-levels')
  @Roles('STATE_DIRECTORATE')
  async migrateEscalationLevels() {
    return this.grievanceService.migrateGrievancesEscalationLevel();
  }
}
