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
import { ReviewRecommendationDto, RecommendationFilterDto } from '../../../domain/training/dto';

@ApiTags('State - Training Recommendations')
@ApiBearerAuth()
@Controller('state/training/recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateRecommendationController {
  constructor(private readonly recommendationService: TrainingRecommendationService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get all training recommendations' })
  async getAll(@Query() filters: RecommendationFilterDto) {
    return this.recommendationService.getAll(filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get recommendation statistics' })
  async getStats() {
    return this.recommendationService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recommendation details' })
  async getRecommendation(@Param('id') id: string) {
    return this.recommendationService.getById(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review a recommendation' })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewRecommendationDto,
    @Req() req,
  ) {
    return this.recommendationService.review(id, dto, req.user.userId);
  }
}
