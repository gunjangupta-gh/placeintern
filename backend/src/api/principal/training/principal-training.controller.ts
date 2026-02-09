import {
  Controller,
  Get,
  Param,
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
import { TrainingFilterDto, CalendarFilterDto } from '../../../domain/training/dto';

@ApiTags('Principal - Training (View Only)')
@ApiBearerAuth()
@Controller('principal/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalTrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get all published trainings' })
  async getTrainings(@Query() filters: TrainingFilterDto) {
    return this.trainingService.findAll(filters, false); // Only published trainings
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
}
