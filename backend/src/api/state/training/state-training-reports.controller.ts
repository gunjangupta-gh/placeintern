import {
  Controller,
  Get,
  Query,
  UseGuards,
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
import { CalendarFilterDto } from '../../../domain/training/dto';

@ApiTags('State - Training Reports')
@ApiBearerAuth()
@Controller('state/training/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateTrainingReportsController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly attendanceService: TrainingAttendanceService,
  ) {}

  @Throttle({ default: THROTTLE_PRESETS.dashboard })
  @Get('dashboard')
  @ApiOperation({ summary: 'Get training dashboard statistics' })
  async getDashboard() {
    return this.trainingService.getDashboardStats();
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get training calendar' })
  async getCalendar(@Query() filters: CalendarFilterDto) {
    return this.trainingService.getCalendar(filters);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Get upcoming trainings' })
  async getUpcoming(@Query('limit') limit?: string) {
    return this.trainingService.getUpcoming(limit ? Number(limit) : 10);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance report' })
  async getAttendanceReport(
    @Query('trainingId') trainingId?: string,
    @Query('date') date?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.attendanceService.getAttendanceReport({
      trainingId,
      date,
      institutionId,
    });
  }
}
