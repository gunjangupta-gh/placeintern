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
import { LessonPlanService } from '../../../domain/training/lesson-plan.service';
import {
  CreateLessonPlanDto,
  UpdateLessonPlanDto,
  LessonPlanFilterDto,
} from '../../../domain/training/dto';

@ApiTags('Faculty - Lesson Plans')
@ApiBearerAuth()
@Controller('faculty/training/lesson-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyLessonPlanController {
  constructor(private readonly lessonPlanService: LessonPlanService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  @ApiOperation({ summary: 'Get my lesson plans' })
  async getMyLessonPlans(@Query() filters: LessonPlanFilterDto, @Req() req) {
    return this.lessonPlanService.getByUser(req.user.userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lesson plan details' })
  async getLessonPlan(@Param('id') id: string, @Req() req) {
    return this.lessonPlanService.getByIdForUser(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a lesson plan' })
  async create(@Body() dto: CreateLessonPlanDto, @Req() req) {
    return this.lessonPlanService.create(dto, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lesson plan' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonPlanDto,
    @Req() req,
  ) {
    return this.lessonPlanService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lesson plan' })
  async delete(@Param('id') id: string, @Req() req) {
    return this.lessonPlanService.delete(id, req.user.userId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit lesson plan for review' })
  async submit(@Param('id') id: string, @Req() req) {
    return this.lessonPlanService.submitForReview(id, req.user.userId);
  }

  @Get('training/:trainingId')
  @ApiOperation({ summary: 'Get my lesson plans for a training' })
  async getTrainingLessonPlans(@Param('trainingId') trainingId: string, @Req() req) {
    return this.lessonPlanService.getByTrainingForUser(trainingId, req.user.userId);
  }
}
