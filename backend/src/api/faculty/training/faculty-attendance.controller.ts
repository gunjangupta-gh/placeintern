import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Role } from '../../../generated/prisma/client';
import { TrainingAttendanceService } from '../../../domain/training/training-attendance.service';
import { MarkSelfAttendanceDto } from '../../../domain/training/dto';

@ApiTags('Faculty - Attendance')
@ApiBearerAuth()
@Controller('faculty/training/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.FACULTY_COORDINATOR)
export class FacultyAttendanceController {
  constructor(private readonly attendanceService: TrainingAttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get my attendance records' })
  async getMyAttendance(@Req() req) {
    return this.attendanceService.getByUser(req.user.userId);
  }

  @Get('training/:trainingId')
  @ApiOperation({ summary: 'Get my attendance for a specific training' })
  async getTrainingAttendance(@Param('trainingId') trainingId: string, @Req() req) {
    return this.attendanceService.getUserAttendanceForTraining(trainingId, req.user.userId);
  }

  @Post('mark')
  @ApiOperation({ summary: 'Mark self attendance (if enabled)' })
  async markSelfAttendance(@Body() dto: MarkSelfAttendanceDto, @Req() req) {
    return this.attendanceService.markSelfAttendance(dto, req.user.userId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get attendance summary' })
  async getAttendanceSummary(@Req() req) {
    return this.attendanceService.getUserAttendanceSummary(req.user.userId);
  }
}
