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
import { TestFormService } from '../../../domain/training/test-form.service';
import { TestResponseService } from '../../../domain/training/test-response.service';
import { SubmitTestResponseDto } from '../../../domain/training/dto';

@ApiTags('Faculty - Training Tests')
@ApiBearerAuth()
@Controller('faculty/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF)
export class FacultyTestController {
  constructor(
    private readonly testFormService: TestFormService,
    private readonly testResponseService: TestResponseService,
  ) {}

  // ==================== PRE-TEST ====================

  @Get(':id/pre-test')
  @ApiOperation({ summary: 'Get pre-test form for a training' })
  async getPreTestForm(@Param('id') trainingId: string) {
    return this.testFormService.getPreTestFormByTraining(trainingId);
  }

  @Get(':id/pre-test/status')
  @ApiOperation({ summary: 'Get pre-test submission status' })
  async getPreTestStatus(@Param('id') trainingId: string, @Req() req) {
    return this.testResponseService.getPreTestStatus(trainingId, req.user.userId);
  }

  @Post(':id/pre-test/start')
  @ApiOperation({ summary: 'Start pre-test attempt timer' })
  async startPreTest(@Param('id') trainingId: string, @Req() req) {
    return this.testResponseService.startPreTestAttempt(trainingId, req.user.userId);
  }

  @Post(':id/pre-test/submit')
  @ApiOperation({ summary: 'Submit pre-test response' })
  async submitPreTest(
    @Param('id') trainingId: string,
    @Body() dto: SubmitTestResponseDto,
    @Req() req,
  ) {
    // Ensure trainingId matches
    dto.trainingId = trainingId;
    return this.testResponseService.submitPreTestResponse(dto, req.user.userId);
  }

  // ==================== POST-TEST ====================

  @Get(':id/post-test')
  @ApiOperation({ summary: 'Get post-test form for a training' })
  async getPostTestForm(@Param('id') trainingId: string) {
    return this.testFormService.getPostTestFormByTraining(trainingId);
  }

  @Get(':id/post-test/status')
  @ApiOperation({ summary: 'Get post-test submission status' })
  async getPostTestStatus(@Param('id') trainingId: string, @Req() req) {
    return this.testResponseService.getPostTestStatus(trainingId, req.user.userId);
  }

  @Post(':id/post-test/start')
  @ApiOperation({ summary: 'Start post-test attempt timer' })
  async startPostTest(@Param('id') trainingId: string, @Req() req) {
    return this.testResponseService.startPostTestAttempt(trainingId, req.user.userId);
  }

  @Post(':id/post-test/submit')
  @ApiOperation({ summary: 'Submit post-test response' })
  async submitPostTest(
    @Param('id') trainingId: string,
    @Body() dto: SubmitTestResponseDto,
    @Req() req,
  ) {
    // Ensure trainingId matches
    dto.trainingId = trainingId;
    return this.testResponseService.submitPostTestResponse(dto, req.user.userId);
  }

  // ==================== COMBINED ====================

  @Get(':id/tests/status')
  @ApiOperation({ summary: 'Get all test statuses for a training' })
  async getTestStatuses(@Param('id') trainingId: string, @Req() req) {
    return this.testResponseService.getTestStatusForTraining(trainingId, req.user.userId);
  }

  @Get('tests/pending')
  @ApiOperation({ summary: 'Get all pending tests for user' })
  async getPendingTests(@Req() req) {
    return this.testResponseService.getPendingTestsForUser(req.user.userId);
  }
}
