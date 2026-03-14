import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import { SubmitFeedbackDto } from '../../../domain/feedback/dto';

@ApiTags('Faculty - Feedback')
@ApiBearerAuth()
@Controller('faculty/training/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.FACULTY_COORDINATOR)
export class FacultyFeedbackController {
  constructor(
    private readonly feedbackFormService: FeedbackFormService,
    private readonly feedbackResponseService: FeedbackResponseService,
  ) {}

  @Get('training/:trainingId/form')
  @ApiOperation({ summary: 'Get feedback form for a training' })
  async getFeedbackForm(@Param('trainingId') trainingId: string) {
    return this.feedbackFormService.getByTraining(trainingId);
  }

  @Post('training/:trainingId/submit')
  @ApiOperation({ summary: 'Submit feedback for a training' })
  async submitFeedback(
    @Param('trainingId') trainingId: string,
    @Body() dto: SubmitFeedbackDto,
    @Req() req,
  ) {
    // Set trainingId from path if not in dto
    dto.trainingId = dto.trainingId || trainingId;
    return this.feedbackResponseService.submit(dto, req.user.userId);
  }

  @Get('training/:trainingId/status')
  @ApiOperation({ summary: 'Check if feedback is submitted for training' })
  async checkFeedbackStatus(@Param('trainingId') trainingId: string, @Req() req) {
    // Get training's feedback form first
    const training = await this.feedbackFormService.getByTraining(trainingId);
    
    if (!training) {
      return { submitted: false, hasSubmitted: false };
    }
    
    // Check if user has submitted feedback for this training
    const result = await this.feedbackResponseService.hasSubmitted(
      req.user.userId,
      training.id,
      trainingId
    );
    
    return { 
      submitted: result.hasSubmitted, 
      hasSubmitted: result.hasSubmitted 
    };
  }

  @Get('my-responses')
  @ApiOperation({ summary: 'Get my submitted feedback responses' })
  async getMyResponses(@Req() req) {
    return this.feedbackResponseService.getByUser(req.user.userId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get trainings with pending feedback' })
  async getPendingFeedback(@Req() req) {
    return this.feedbackResponseService.getPendingForUser(req.user.userId);
  }
}
