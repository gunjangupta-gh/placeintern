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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Role } from '../../../generated/prisma/client';
import { FeedbackFormService } from '../../../domain/feedback/feedback-form.service';
import { FeedbackResponseService } from '../../../domain/feedback/feedback-response.service';
import { CreateFeedbackFormDto, UpdateFeedbackFormDto, FeedbackFilterDto } from '../../../domain/feedback/dto';

@ApiTags('State - Feedback Forms')
@ApiBearerAuth()
@Controller('state/feedback-forms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE, Role.FACULTY_COORDINATOR)
export class StateFeedbackFormController {
  constructor(
    private readonly feedbackFormService: FeedbackFormService,
    private readonly feedbackResponseService: FeedbackResponseService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a feedback form' })
  async createForm(@Body() dto: CreateFeedbackFormDto, @Req() req) {
    return this.feedbackFormService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all feedback forms' })
  async getForms(@Query() filters: FeedbackFilterDto) {
    return this.feedbackFormService.findAll(filters, true); // Include unpublished
  }

  // IMPORTANT: Static routes must come BEFORE parameterized routes
  @Get('stats')
  @ApiOperation({ summary: 'Get feedback response statistics' })
  async getStats(@Query('trainingId') trainingId?: string) {
    return this.feedbackResponseService.getResponseStats(trainingId);
  }

  @Get('training/:trainingId/responses')
  @ApiOperation({ summary: 'Get feedback responses for a training' })
  async getTrainingResponses(@Param('trainingId') trainingId: string) {
    return this.feedbackResponseService.getByTraining(trainingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feedback form details' })
  async getForm(@Param('id') id: string) {
    return this.feedbackFormService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feedback form' })
  async updateForm(@Param('id') id: string, @Body() dto: UpdateFeedbackFormDto, @Req() req) {
    return this.feedbackFormService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete feedback form' })
  async deleteForm(@Param('id') id: string, @Req() req) {
    return this.feedbackFormService.delete(id, req.user.userId);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish feedback form' })
  async publishForm(@Param('id') id: string, @Req() req) {
    return this.feedbackFormService.publish(id, req.user.userId);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate feedback form' })
  async duplicateForm(
    @Param('id') id: string,
    @Body('title') title: string,
    @Req() req,
  ) {
    return this.feedbackFormService.duplicate(id, title, req.user.userId);
  }

  @Post(':id/assign/:trainingId')
  @ApiOperation({ summary: 'Assign feedback form to training' })
  async assignToTraining(
    @Param('id') formId: string,
    @Param('trainingId') trainingId: string,
    @Req() req,
  ) {
    return this.feedbackFormService.assignToTraining(formId, trainingId, req.user.userId);
  }

  // ==================== RESPONSES & ANALYTICS ====================

  @Get(':id/responses')
  @ApiOperation({ summary: 'Get responses for a feedback form' })
  async getResponses(
    @Param('id') formId: string,
    @Query('trainingId') trainingId?: string,
  ) {
    return this.feedbackResponseService.getAggregatedResults(formId, trainingId);
  }
}
