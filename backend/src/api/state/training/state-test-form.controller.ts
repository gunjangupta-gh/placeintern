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
import { TestFormService } from '../../../domain/training/test-form.service';
import { TestResponseService } from '../../../domain/training/test-response.service';
import { CreateTestFormDto, UpdateTestFormDto, TestFormFilterDto } from '../../../domain/training/dto';

@ApiTags('State - Test Forms')
@ApiBearerAuth()
@Controller('state/test-forms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateTestFormController {
  constructor(
    private readonly testFormService: TestFormService,
    private readonly testResponseService: TestResponseService,
  ) {}

  // ==================== PRE-TEST FORMS ====================

  @Post('pre-test')
  @ApiOperation({ summary: 'Create a pre-test form' })
  async createPreTestForm(@Body() dto: CreateTestFormDto, @Req() req) {
    return this.testFormService.createPreTestForm(dto, req.user.userId);
  }

  @Get('pre-test')
  @ApiOperation({ summary: 'Get all pre-test forms' })
  async getPreTestForms(@Query() filters: TestFormFilterDto) {
    return this.testFormService.findAllPreTestForms(filters, true);
  }

  @Get('pre-test/:id')
  @ApiOperation({ summary: 'Get pre-test form details' })
  async getPreTestForm(@Param('id') id: string) {
    return this.testFormService.findOnePreTestForm(id);
  }

  @Patch('pre-test/:id')
  @ApiOperation({ summary: 'Update pre-test form' })
  async updatePreTestForm(
    @Param('id') id: string,
    @Body() dto: UpdateTestFormDto,
    @Req() req,
  ) {
    return this.testFormService.updatePreTestForm(id, dto, req.user.userId);
  }

  @Delete('pre-test/:id')
  @ApiOperation({ summary: 'Delete pre-test form' })
  async deletePreTestForm(@Param('id') id: string, @Req() req) {
    return this.testFormService.deletePreTestForm(id, req.user.userId);
  }

  @Post('pre-test/:id/publish')
  @ApiOperation({ summary: 'Publish pre-test form' })
  async publishPreTestForm(@Param('id') id: string, @Req() req) {
    return this.testFormService.publishPreTestForm(id, req.user.userId);
  }

  @Post('pre-test/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate pre-test form' })
  async duplicatePreTestForm(
    @Param('id') id: string,
    @Body('title') title: string,
    @Req() req,
  ) {
    return this.testFormService.duplicatePreTestForm(id, title, req.user.userId);
  }

  @Get('pre-test/:id/responses')
  @ApiOperation({ summary: 'Get all responses for a pre-test form' })
  async getPreTestFormResponses(@Param('id') formId: string) {
    return this.testResponseService.getPreTestResponsesByForm(formId);
  }

  @Post('pre-test/:id/assign/:trainingId')
  @ApiOperation({ summary: 'Assign pre-test form to training' })
  async assignPreTestToTraining(
    @Param('id') formId: string,
    @Param('trainingId') trainingId: string,
    @Req() req,
  ) {
    return this.testFormService.assignPreTestToTraining(formId, trainingId, req.user.userId);
  }

  @Get('pre-test/training/:trainingId/responses')
  @ApiOperation({ summary: 'Get pre-test responses for a training' })
  async getPreTestResponses(@Param('trainingId') trainingId: string) {
    return this.testResponseService.getPreTestResponsesByTraining(trainingId);
  }

  // ==================== POST-TEST FORMS ====================

  @Post('post-test')
  @ApiOperation({ summary: 'Create a post-test form' })
  async createPostTestForm(@Body() dto: CreateTestFormDto, @Req() req) {
    return this.testFormService.createPostTestForm(dto, req.user.userId);
  }

  @Get('post-test')
  @ApiOperation({ summary: 'Get all post-test forms' })
  async getPostTestForms(@Query() filters: TestFormFilterDto) {
    return this.testFormService.findAllPostTestForms(filters, true);
  }

  @Get('post-test/:id')
  @ApiOperation({ summary: 'Get post-test form details' })
  async getPostTestForm(@Param('id') id: string) {
    return this.testFormService.findOnePostTestForm(id);
  }

  @Patch('post-test/:id')
  @ApiOperation({ summary: 'Update post-test form' })
  async updatePostTestForm(
    @Param('id') id: string,
    @Body() dto: UpdateTestFormDto,
    @Req() req,
  ) {
    return this.testFormService.updatePostTestForm(id, dto, req.user.userId);
  }

  @Delete('post-test/:id')
  @ApiOperation({ summary: 'Delete post-test form' })
  async deletePostTestForm(@Param('id') id: string, @Req() req) {
    return this.testFormService.deletePostTestForm(id, req.user.userId);
  }

  @Post('post-test/:id/publish')
  @ApiOperation({ summary: 'Publish post-test form' })
  async publishPostTestForm(@Param('id') id: string, @Req() req) {
    return this.testFormService.publishPostTestForm(id, req.user.userId);
  }

  @Post('post-test/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate post-test form' })
  async duplicatePostTestForm(
    @Param('id') id: string,
    @Body('title') title: string,
    @Req() req,
  ) {
    return this.testFormService.duplicatePostTestForm(id, title, req.user.userId);
  }

  @Get('post-test/:id/responses')
  @ApiOperation({ summary: 'Get all responses for a post-test form' })
  async getPostTestFormResponses(@Param('id') formId: string) {
    return this.testResponseService.getPostTestResponsesByForm(formId);
  }

  @Post('post-test/:id/assign/:trainingId')
  @ApiOperation({ summary: 'Assign post-test form to training' })
  async assignPostTestToTraining(
    @Param('id') formId: string,
    @Param('trainingId') trainingId: string,
    @Req() req,
  ) {
    return this.testFormService.assignPostTestToTraining(formId, trainingId, req.user.userId);
  }

  @Get('post-test/training/:trainingId/responses')
  @ApiOperation({ summary: 'Get post-test responses for a training' })
  async getPostTestResponses(@Param('trainingId') trainingId: string) {
    return this.testResponseService.getPostTestResponsesByTraining(trainingId);
  }
}
