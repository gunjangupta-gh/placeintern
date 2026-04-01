import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../../core/config/throttle.config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Role } from '../../../generated/prisma/client';
import { TrainingService } from '../../../domain/training/training.service';
import { TrainingApplicationService } from '../../../domain/training/training-application.service';
import { TrainingAttendanceService } from '../../../domain/training/training-attendance.service';
import { LessonPlanService } from '../../../domain/training/lesson-plan.service';
import { TrainingCertificateService } from '../../../domain/training/training-certificate.service';
import {
  CreateTrainingDto,
  UpdateTrainingDto,
  TrainingFilterDto,
  BulkReviewApplicationDto,
  ReviewApplicationDto,
  BulkMarkAttendanceDto,
  BulkIssueCertificateDto,
  ReviewLessonPlanDto,
  LessonPlanFilterDto,
  ApplicationFilterDto,
  CertificateFilterDto,
  RevokeCertificateDto,
} from '../../../domain/training/dto';

@ApiTags('State - Training Management')
@ApiBearerAuth()
@Controller('state/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE, Role.FACULTY_COORDINATOR)
export class StateTrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly applicationService: TrainingApplicationService,
    private readonly attendanceService: TrainingAttendanceService,
    private readonly lessonPlanService: LessonPlanService,
    private readonly certificateService: TrainingCertificateService,
  ) {}

  // ==================== TRAINING CRUD ====================

  @Post()
  @ApiOperation({ summary: 'Create a new training' })
  async createTraining(@Body() dto: CreateTrainingDto, @Req() req) {
    return this.trainingService.create(dto, req.user.userId);
  }

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get all trainings with filters' })
  async getTrainings(@Query() filters: TrainingFilterDto) {
    return this.trainingService.findAll(filters, true); // Include unpublished
  }

  // ==================== LESSON PLANS ====================

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('lesson-plans')
  @ApiOperation({ summary: 'Get all lesson plans for review' })
  async getLessonPlans(@Query() filters: LessonPlanFilterDto) {
    return this.lessonPlanService.getForReview(filters);
  }

  @Get('lesson-plans/:id')
  @ApiOperation({ summary: 'Get lesson plan details' })
  async getLessonPlan(@Param('id') id: string) {
    return this.lessonPlanService.getById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get training details' })
  async getTraining(@Param('id') id: string) {
    return this.trainingService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get training statistics' })
  async getTrainingStats(@Param('id') id: string) {
    return this.trainingService.getTrainingStats(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update training' })
  async updateTraining(@Param('id') id: string, @Body() dto: UpdateTrainingDto, @Req() req) {
    return this.trainingService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete training' })
  async deleteTraining(@Param('id') id: string, @Req() req) {
    return this.trainingService.delete(id, req.user.userId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish training' })
  async publishTraining(@Param('id') id: string, @Req() req) {
    return this.trainingService.publish(id, req.user.userId);
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish training' })
  async unpublishTraining(@Param('id') id: string, @Req() req) {
    return this.trainingService.unpublish(id, req.user.userId);
  }

  // ==================== APPLICATIONS ====================

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('applications/all')
  @ApiOperation({ summary: 'Get all applications across trainings' })
  async getAllApplications(@Query() filters: ApplicationFilterDto) {
    // This would need a method to get all applications, not by training
    return this.applicationService.getByInstitution('', filters);
  }

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get(':id/applications')
  @ApiOperation({ summary: 'Get applications for a training' })
  async getApplications(@Param('id') trainingId: string, @Query() filters: ApplicationFilterDto) {
    return this.applicationService.getByTraining(trainingId, filters);
  }

  @Get('applications/:appId')
  @ApiOperation({ summary: 'Get application details' })
  async getApplication(@Param('appId') id: string) {
    return this.applicationService.getById(id);
  }

  @Patch('applications/:appId/review')
  @ApiOperation({ summary: 'Review an application' })
  async reviewApplication(
    @Param('appId') id: string,
    @Body() dto: ReviewApplicationDto,
    @Req() req,
  ) {
    return this.applicationService.review(id, dto, req.user.userId);
  }

  @Delete('applications/:appId/permanent')
  @Roles(Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Permanently delete an application (State only)' })
  async permanentlyDeleteApplication(@Param('appId') id: string, @Req() req) {
    return this.applicationService.permanentlyDelete(id, req.user.userId);
  }

  @Post('applications/bulk-review')
  @ApiOperation({ summary: 'Bulk review applications' })
  async bulkReviewApplications(@Body() dto: BulkReviewApplicationDto, @Req() req) {
    return this.applicationService.bulkReview(dto, req.user.userId);
  }

  // ==================== ATTENDANCE ====================

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Get attendance for a training' })
  async getAttendance(
    @Param('id') trainingId: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getByTraining(trainingId, date ? new Date(date) : undefined);
  }

  @Post(':id/attendance/mark')
  @ApiOperation({ summary: 'Bulk mark attendance' })
  async markBulkAttendance(
    @Param('id') trainingId: string,
    @Body() dto: BulkMarkAttendanceDto,
    @Req() req,
  ) {
    return this.attendanceService.bulkMarkAttendance(trainingId, dto, req.user.userId);
  }

  // ==================== CERTIFICATES ====================

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get(':id/certificates')
  @ApiOperation({ summary: 'Get certificates for a training' })
  async getCertificates(@Param('id') trainingId: string, @Query() filters: CertificateFilterDto) {
    return this.certificateService.getByTraining(trainingId, filters);
  }

  @Post(':id/certificates/issue')
  @ApiOperation({ summary: 'Issue certificate to a user' })
  async issueCertificate(
    @Param('id') trainingId: string,
    @Body('userId') userId: string,
    @Req() req,
  ) {
    return this.certificateService.issue(trainingId, userId, req.user.userId);
  }

  @Post(':id/certificates/bulk-issue')
  @ApiOperation({ summary: 'Bulk issue certificates' })
  async bulkIssueCertificates(
    @Param('id') trainingId: string,
    @Body() dto: BulkIssueCertificateDto,
    @Req() req,
  ) {
    return this.certificateService.bulkIssue(trainingId, dto.userIds, req.user.userId);
  }

  @Patch('certificates/:certId/revoke')
  @ApiOperation({ summary: 'Revoke a certificate' })
  async revokeCertificate(
    @Param('certId') id: string,
    @Body() dto: RevokeCertificateDto,
    @Req() req,
  ) {
    return this.certificateService.revoke(id, dto, req.user.userId);
  }

  @Get('certificates/:number/verify')
  @ApiOperation({ summary: 'Verify a certificate by number' })
  async verifyCertificate(@Param('number') certificateNumber: string) {
    return this.certificateService.verify(certificateNumber);
  }

  @Get(':id/lesson-plans')
  @ApiOperation({ summary: 'Get lesson plans for a training' })
  async getTrainingLessonPlans(@Param('id') trainingId: string) {
    return this.lessonPlanService.getByTraining(trainingId);
  }

  @Patch('lesson-plans/:id/review')
  @ApiOperation({ summary: 'Review a lesson plan' })
  async reviewLessonPlan(
    @Param('id') id: string,
    @Body() dto: ReviewLessonPlanDto,
    @Req() req,
  ) {
    return this.lessonPlanService.review(id, dto, req.user.userId);
  }
}
