import {
  Controller,
  Get,
  Patch,
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
import { TrainingRecommendationService } from '../../../domain/training/training-recommendation.service';
import { RecommendationFilterDto, ReviewRecommendationDto } from '../../../domain/training/dto';

@ApiTags('Coordinator - Training Recommendations')
@ApiBearerAuth()
@Controller('coordinator/training/recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorRecommendationController {
  constructor(private readonly recommendationService: TrainingRecommendationService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get recommendations from faculty of institution' })
  async getInstitutionRecommendations(@Query() filters: RecommendationFilterDto, @Req() req) {
    return this.recommendationService.getByInstitution(req.user.institutionId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recommendation details (institution scoped)' })
  async getRecommendation(@Param('id') id: string, @Req() req) {
    return this.recommendationService.getByIdForInstitution(id, req.user.institutionId);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review recommendation (approve/reject/under review)' })
  async reviewRecommendation(
    @Param('id') id: string,
    @Body() dto: ReviewRecommendationDto,
    @Req() req,
  ) {
    return this.recommendationService.reviewForInstitution(
      id,
      dto,
      req.user.userId,
      req.user.institutionId,
    );
  }
}
