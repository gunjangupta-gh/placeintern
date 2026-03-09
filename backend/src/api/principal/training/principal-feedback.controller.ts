import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { THROTTLE_PRESETS } from '../../../core/config/throttle.config';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Role } from '../../../generated/prisma/client';
import { FeedbackResponseService } from '../../../domain/feedback/feedback-response.service';

@ApiTags('Principal - Feedback Responses')
@ApiBearerAuth()
@Controller('principal/training/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalFeedbackController {
  constructor(private readonly feedbackResponseService: FeedbackResponseService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('summary')
  @ApiOperation({ summary: 'Get feedback completion summary for institution' })
  async getFeedbackSummary(@Req() req) {
    return this.feedbackResponseService.getInstitutionFeedbackSummary(req.user.institutionId);
  }

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get(':trainingId')
  @ApiOperation({ summary: 'Get feedback responses for a training (institution scope)' })
  async getTrainingFeedbackResponses(@Param('trainingId') trainingId: string, @Req() req) {
    return this.feedbackResponseService.getByTrainingAndInstitution(
      trainingId,
      req.user.institutionId,
    );
  }
}
