import {
  Controller,
  Get,
  Post,
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
import { TrainingApplicationService } from '../../../domain/training/training-application.service';
import { ApplyForTrainingDto, ApplicationFilterDto } from '../../../domain/training/dto';

@ApiTags('Faculty - Training Applications')
@ApiBearerAuth()
@Controller('faculty/training/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyApplicationController {
  constructor(private readonly applicationService: TrainingApplicationService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get my training applications' })
  async getMyApplications(@Query() filters: ApplicationFilterDto, @Req() req) {
    return this.applicationService.getByUser(req.user.userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application details' })
  async getApplication(@Param('id') id: string, @Req() req) {
    return this.applicationService.getByIdForUser(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Apply for a training' })
  async apply(@Body() dto: ApplyForTrainingDto, @Req() req) {
    return this.applicationService.applyWithDto(dto, req.user.userId, req.user.institutionId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Withdraw application' })
  async withdraw(@Param('id') id: string, @Req() req) {
    return this.applicationService.withdraw(id, req.user.userId);
  }

  @Get('training/:trainingId/status')
  @ApiOperation({ summary: 'Check application status for a training' })
  async checkStatus(@Param('trainingId') trainingId: string, @Req() req) {
    return this.applicationService.getStatusForTraining(trainingId, req.user.userId);
  }
}
