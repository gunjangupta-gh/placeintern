import {
  Controller,
  Get,
  Patch,
  Post,
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
import {
  ReviewApplicationDto,
  BulkReviewApplicationDto,
  ApplicationFilterDto,
} from '../../../domain/training/dto';

@ApiTags('Coordinator - Training Applications')
@ApiBearerAuth()
@Controller('coordinator/training/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorApplicationController {
  constructor(private readonly applicationService: TrainingApplicationService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get applications from institution faculty' })
  async getApplications(@Query() filters: ApplicationFilterDto, @Req() req) {
    return this.applicationService.getByInstitution(req.user.institutionId, filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get application statistics for institution' })
  async getStats(@Req() req) {
    return this.applicationService.getInstitutionStats(req.user.institutionId);
  }

  @Get('training/:trainingId')
  @ApiOperation({ summary: 'Get applications for a specific training from institution' })
  async getTrainingApplications(
    @Param('trainingId') trainingId: string,
    @Query() filters: ApplicationFilterDto,
    @Req() req,
  ) {
    return this.applicationService.getByTrainingAndInstitution(
      trainingId,
      req.user.institutionId,
      filters,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application details' })
  async getApplication(@Param('id') id: string, @Req() req) {
    return this.applicationService.getById(id, req.user.institutionId);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review application (approve/reject)' })
  async reviewApplication(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
    @Req() req,
  ) {
    return this.applicationService.review(id, dto, req.user.userId, req.user.institutionId);
  }

  @Post('bulk-review')
  @ApiOperation({ summary: 'Bulk review applications' })
  async bulkReviewApplications(@Body() dto: BulkReviewApplicationDto, @Req() req) {
    return this.applicationService.bulkReview(dto, req.user.userId, req.user.institutionId);
  }
}
