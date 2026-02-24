import {
  Controller,
  Get,
  Post,
  Patch,
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
import { TrainingRecommendationService } from '../../../domain/training/training-recommendation.service';
import {
  CreateRecommendationDto,
  UpdateRecommendationDto,
  RecommendationFilterDto,
} from '../../../domain/training/dto';

@ApiTags('Faculty - Training Recommendations')
@ApiBearerAuth()
@Controller('faculty/training/recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.FACULTY_COORDINATOR)
export class FacultyRecommendationController {
  constructor(private readonly recommendationService: TrainingRecommendationService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get my training recommendations' })
  async getMyRecommendations(@Query() filters: RecommendationFilterDto, @Req() req) {
    return this.recommendationService.getMyRecommendations(req.user.userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recommendation details' })
  async getRecommendation(@Param('id') id: string) {
    return this.recommendationService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a training recommendation' })
  async create(@Body() dto: CreateRecommendationDto, @Req() req) {
    return this.recommendationService.create(dto, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update recommendation' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRecommendationDto,
    @Req() req,
  ) {
    return this.recommendationService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete recommendation' })
  async delete(@Param('id') id: string, @Req() req) {
    return this.recommendationService.delete(id, req.user.userId);
  }
}
