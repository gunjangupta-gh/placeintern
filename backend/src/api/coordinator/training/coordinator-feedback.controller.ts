import {
  Controller,
  Get,
  Param,
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
import { FeedbackResponseService } from '../../../domain/feedback/feedback-response.service';

@ApiTags('Coordinator - Feedback Responses')
@ApiBearerAuth()
@Controller('coordinator/training/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorFeedbackController {
  constructor(private readonly feedbackResponseService: FeedbackResponseService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('summary')
  @ApiOperation({ summary: 'Get feedback completion summary for coordinator branch' })
  async getFeedbackSummary(@Req() req) {
    return this.feedbackResponseService.getInstitutionFeedbackSummary(
      undefined,
      undefined,
      req.user.branchName,
      req.user.branchId,
    );
  }

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get(':trainingId')
  @ApiOperation({ summary: 'Get feedback responses for a training (coordinator branch scope)' })
  async getTrainingFeedbackResponses(@Param('trainingId') trainingId: string, @Req() req) {
    return this.feedbackResponseService.getByTrainingAndInstitution(
      trainingId,
      undefined,
      req.user.branchName,
      req.user.branchId,
    );
  }
}
