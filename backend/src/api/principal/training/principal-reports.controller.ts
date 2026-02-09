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

@ApiTags('Principal - Training Reports')
@ApiBearerAuth()
@Controller('principal/training/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalReportsController {
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
    return this.trainingService.getInstitutionDashboard(req.user.institutionId);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance report for institution faculty' })
  async getAttendanceReport(
    @Query('trainingId') trainingId?: string,
    @Query('date') date?: string,
    @Req() req?,
  ) {
    return this.attendanceService.getInstitutionAttendanceReport(
      req.user.institutionId,
      { trainingId, date },
    );
  }

  @Get('certificates')
  @ApiOperation({ summary: 'Get certificates issued to institution faculty' })
  async getCertificates(@Req() req) {
    return this.certificateService.getByInstitution(req.user.institutionId);
  }

  @Get('participation')
  @ApiOperation({ summary: 'Get faculty participation summary' })
  async getParticipationReport(@Req() req) {
    return this.trainingService.getInstitutionParticipationReport(req.user.institutionId);
  }

  @Get('feedback')
  @ApiOperation({ summary: 'Get feedback summary for institution' })
  async getFeedbackSummary(
    @Query('trainingId') trainingId?: string,
    @Req() req?,
  ) {
    return this.feedbackResponseService.getInstitutionFeedbackSummary(
      req.user.institutionId,
      trainingId,
    );
  }
}
