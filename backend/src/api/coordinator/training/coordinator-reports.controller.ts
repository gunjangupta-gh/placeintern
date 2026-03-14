import {
  Controller,
  Get,
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
import { TrainingAttendanceService } from '../../../domain/training/training-attendance.service';
import { TrainingCertificateService } from '../../../domain/training/training-certificate.service';
import { FeedbackResponseService } from '../../../domain/feedback/feedback-response.service';

@ApiTags('Coordinator - Training Reports')
@ApiBearerAuth()
@Controller('coordinator/training/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorReportsController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly attendanceService: TrainingAttendanceService,
    private readonly certificateService: TrainingCertificateService,
    private readonly feedbackResponseService: FeedbackResponseService,
  ) {}

  @Throttle({ default: THROTTLE_PRESETS.dashboard })
  @Get('dashboard')
  @ApiOperation({ summary: 'Get institution training dashboard' })
  async getDashboard(@Req() req) {
    return this.trainingService.getInstitutionDashboard(undefined, req.user.branchName, req.user.branchId);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance report for institution faculty' })
  async getAttendanceReport(
    @Query('trainingId') trainingId?: string,
    @Query('date') date?: string,
    @Req() req?,
  ) {
    return this.attendanceService.getInstitutionAttendanceReport(
      undefined,
      { trainingId, date },
      req.user.branchName,
      req.user.branchId,
    );
  }

  @Get('certificates')
  @ApiOperation({ summary: 'Get certificates issued to institution faculty' })
  async getCertificates(@Req() req) {
    return this.certificateService.getByInstitution(undefined, req.user.branchName, req.user.branchId);
  }

  @Get('participation')
  @ApiOperation({ summary: 'Get faculty participation summary' })
  async getParticipationReport(@Req() req) {
    return this.trainingService.getInstitutionParticipationReport(undefined, req.user.branchName, req.user.branchId);
  }

  @Get('feedback')
  @ApiOperation({ summary: 'Get feedback summary for institution' })
  async getFeedbackSummary(
    @Query('trainingId') trainingId?: string,
    @Req() req?,
  ) {
    return this.feedbackResponseService.getInstitutionFeedbackSummary(
      undefined,
      trainingId,
      req.user.branchName,
      req.user.branchId,
    );
  }
}
