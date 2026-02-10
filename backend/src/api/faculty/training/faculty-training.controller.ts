import {
  Controller,
  Get,
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
import { TrainingFilterDto, CalendarFilterDto } from '../../../domain/training/dto';

@ApiTags('Faculty - Training')
@ApiBearerAuth()
@Controller('faculty/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyTrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get all available trainings' })
  async getTrainings(@Query() filters: TrainingFilterDto) {
    return this.trainingService.findAll(filters, false); // Only published trainings
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

  @Get('my-trainings')
  @ApiOperation({ summary: 'Get trainings user is registered for' })
  async getMyTrainings(@Req() req) {
    return this.trainingService.getUserTrainings(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get training details' })
  async getTraining(@Param('id') id: string) {
    return this.trainingService.findOne(id);
  }

  @Get(':id/eligibility')
  @ApiOperation({ summary: 'Check eligibility for a training' })
  async checkEligibility(@Param('id') trainingId: string, @Req() req) {
    return this.trainingService.checkUserEligibility(trainingId, req.user.userId);
  }
}
