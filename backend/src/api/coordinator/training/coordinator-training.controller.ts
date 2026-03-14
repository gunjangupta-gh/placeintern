import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { THROTTLE_PRESETS } from '../../../core/config/throttle.config';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Role } from '../../../generated/prisma/client';
import { TrainingService } from '../../../domain/training/training.service';
import { TrainingApplicationService } from '../../../domain/training/training-application.service';
import { TrainingAttendanceService } from '../../../domain/training/training-attendance.service';

@ApiTags('Coordinator - Training')
@ApiBearerAuth()
@Controller('coordinator/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorTrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly applicationService: TrainingApplicationService,
    private readonly attendanceService: TrainingAttendanceService,
  ) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get(':id')
  @ApiOperation({ summary: 'Get training details for coordinator scope' })
  async getTraining(@Param('id') id: string) {
    return this.trainingService.findOne(id);
  }

  @Throttle({ default: THROTTLE_PRESETS.dashboard })
  @Get(':id/stats')
  @ApiOperation({ summary: 'Get training statistics for coordinator branch scope' })
  async getTrainingStats(@Param('id') id: string, @Req() req) {
    const applicationsResponse = await this.applicationService.getByTrainingAndInstitution(
      id,
      undefined,
      { page: 1, limit: 2000 },
      req.user.branchName,
      req.user.branchId,
    );

    const applications = Array.isArray(applicationsResponse?.data)
      ? applicationsResponse.data
      : [];

    const approved = applications.filter((app) => app.status === 'APPROVED').length;
    const pending = applications.filter((app) => ['PENDING', 'SUBMITTED'].includes(app.status)).length;
    const rejected = applications.filter((app) => app.status === 'REJECTED').length;

    const attendance = await this.attendanceService.getByTraining(
      id,
      undefined,
      undefined,
      req.user.branchName,
      req.user.branchId,
    );

    return {
      applications: {
        total: applications.length,
        approved,
        pending,
        rejected,
      },
      attendance: {
        uniqueAttendees: attendance?.summary?.uniqueAttendees || 0,
        totalRecords: attendance?.summary?.totalRecords || 0,
        averageAttendanceRate: attendance?.summary?.averageAttendanceRate || 0,
      },
    };
  }

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get(':id/attendance')
  @ApiOperation({ summary: 'Get training attendance for coordinator branch scope' })
  async getTrainingAttendance(
    @Param('id') id: string,
    @Query('date') date: string | undefined,
    @Req() req,
  ) {
    return this.attendanceService.getByTraining(
      id,
      date ? new Date(date) : undefined,
      undefined,
      req.user.branchName,
      req.user.branchId,
    );
  }
}
