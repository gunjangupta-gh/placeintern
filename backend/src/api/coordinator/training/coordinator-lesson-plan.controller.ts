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
import { LessonPlanService } from '../../../domain/training/lesson-plan.service';
import { ReviewLessonPlanDto, LessonPlanFilterDto } from '../../../domain/training/dto';

@ApiTags('Coordinator - Lesson Plans')
@ApiBearerAuth()
@Controller('coordinator/training/lesson-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorLessonPlanController {
  constructor(private readonly lessonPlanService: LessonPlanService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get lesson plans from institution faculty' })
  async getLessonPlans(@Query() filters: LessonPlanFilterDto, @Req() req) {
    return this.lessonPlanService.getByInstitution(req.user.institutionId, filters);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending lesson plans for review' })
  async getPendingLessonPlans(@Req() req) {
    return this.lessonPlanService.getPendingForInstitution(req.user.institutionId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get lesson plan statistics for institution' })
  async getStats(@Req() req) {
    return this.lessonPlanService.getInstitutionStats(req.user.institutionId);
  }

  @Get('training/:trainingId')
  @ApiOperation({ summary: 'Get lesson plans for a training from institution' })
  async getTrainingLessonPlans(
    @Param('trainingId') trainingId: string,
    @Req() req,
  ) {
    return this.lessonPlanService.getByTrainingAndInstitution(
      trainingId,
      req.user.institutionId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lesson plan details' })
  async getLessonPlan(@Param('id') id: string) {
    return this.lessonPlanService.getById(id);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Review lesson plan (approve/reject/request changes)' })
  async reviewLessonPlan(
    @Param('id') id: string,
    @Body() dto: ReviewLessonPlanDto,
    @Req() req,
  ) {
    return this.lessonPlanService.review(id, dto, req.user.userId);
  }
}
