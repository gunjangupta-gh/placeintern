import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { OpportunityExportService } from './opportunity-export.service';
import { OpportunityImportService } from './opportunity-import.service';
import { OpportunityService } from './opportunity.service';
import {
  ApproveApplicationDto,
  BulkApplicationActionDto,
  ExportApplicationsQueryDto,
  ListApplicationsQueryDto,
  ListOpportunitiesQueryDto,
  RejectApplicationDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function assertXlsx(file?: Express.Multer.File) {
  if (!file) throw new BadRequestException('File is required');
  const name = (file.originalname || '').toLowerCase();
  if (!name.endsWith('.xlsx') || file.mimetype !== XLSX_MIME) {
    throw new BadRequestException('Only the .xlsx template file is accepted');
  }
}

/**
 * State Directorate only. ADMIN_STAFF and SYSTEM_ADMIN are intentionally NOT allowed.
 */
@ApiTags('State - Internship Opportunities')
@Controller('state/opportunities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateOpportunityController {
  constructor(
    private readonly importService: OpportunityImportService,
    private readonly service: OpportunityService,
    private readonly exportService: OpportunityExportService,
  ) {}

  private actor(req: any) {
    return { userId: req.user.userId, userName: req.user.name, role: req.user.role };
  }

  // ---- Template & import (static routes first) ----

  @Get('template')
  @ApiOperation({ summary: 'Download the clean internship opportunity upload template' })
  async template(@Res() res: Response) {
    const buf = await this.importService.getTemplate();
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename=internship-opportunities-template.xlsx');
    res.send(buf);
  }

  @Post('import/preview')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Validate an uploaded template and preview rows/errors. Saves nothing.' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async preview(@UploadedFile() file: Express.Multer.File) {
    assertXlsx(file);
    return this.importService.validate(file.buffer);
  }

  @Post('import/confirm')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Re-validate and save the uploaded template' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async confirm(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Query('skipInvalid') skipInvalid?: string,
  ) {
    assertXlsx(file);
    return this.importService.confirm(file.buffer, this.actor(req), skipInvalid === 'true');
  }

  // ---- Applications ----

  @Get('applications')
  @ApiOperation({ summary: 'List applications made against published opportunities' })
  listApplications(@Query() q: ListApplicationsQueryDto) {
    return this.service.listApplications(q);
  }

  @Get('applications/export')
  @ApiOperation({ summary: 'Export applications (with the same filters as the list) to Excel' })
  async exportApplications(@Query() q: ExportApplicationsQueryDto, @Req() req: any, @Res() res: Response) {
    const buf = await this.exportService.buildWorkbook(q, this.actor(req));
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename=internship-applications-${stamp}.xlsx`);
    res.send(buf);
  }

  @Delete('applications/:applicationId')
  @ApiOperation({ summary: 'Delete an application (undoes the approval if it was confirmed)' })
  deleteApplication(@Param('applicationId', ParseUUIDPipe) applicationId: string, @Req() req: any) {
    return this.service.deleteApplication(applicationId, this.actor(req));
  }

  @Post('applications/bulk')
  @ApiOperation({ summary: 'Approve, reject or delete several applications' })
  bulk(@Body() dto: BulkApplicationActionDto, @Req() req: any) {
    return this.service.bulkAction(dto.action, dto.applicationIds, dto.remarks, this.actor(req));
  }

  @Post('applications/:applicationId/approve')
  @ApiOperation({ summary: 'Mark a student as having got the internship (approved)' })
  approve(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: ApproveApplicationDto,
    @Req() req: any,
  ) {
    return this.service.approve(applicationId, dto, this.actor(req));
  }

  @Post('applications/:applicationId/reject')
  @ApiOperation({ summary: 'Reject an application (frees the seat and the student)' })
  reject(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: RejectApplicationDto,
    @Req() req: any,
  ) {
    return this.service.reject(applicationId, dto.reason, this.actor(req));
  }

  // ---- Opportunities ----

  @Get()
  @ApiOperation({ summary: 'List internship opportunities' })
  list(@Query() q: ListOpportunitiesQueryDto) {
    return this.service.list(q);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOpportunityDto, @Req() req: any) {
    return this.service.update(id, dto, this.actor(req));
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.remove(id, this.actor(req));
  }
}
