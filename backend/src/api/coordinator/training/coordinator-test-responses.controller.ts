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
import { TestResponseService } from '../../../domain/training/test-response.service';

@ApiTags('Coordinator - Test Responses')
@ApiBearerAuth()
@Controller('coordinator/training/test-responses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FACULTY_COORDINATOR)
export class CoordinatorTestResponsesController {
  constructor(private readonly testResponseService: TestResponseService) {}

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get('summary')
  @ApiOperation({ summary: 'Get test completion summary for institution' })
  async getTestSummary(@Req() req) {
    return this.testResponseService.getInstitutionTestSummary(req.user.institutionId);
  }

  @Get('pre-test/:trainingId')
  @ApiOperation({ summary: 'Get pre-test responses for a training (institution faculty only)' })
  async getPreTestResponses(@Param('trainingId') trainingId: string, @Req() req) {
    return this.testResponseService.getPreTestResponsesByTrainingAndInstitution(
      trainingId,
      req.user.institutionId,
    );
  }

  @Get('post-test/:trainingId')
  @ApiOperation({ summary: 'Get post-test responses for a training (institution faculty only)' })
  async getPostTestResponses(@Param('trainingId') trainingId: string, @Req() req) {
    return this.testResponseService.getPostTestResponsesByTrainingAndInstitution(
      trainingId,
      req.user.institutionId,
    );
  }
}
