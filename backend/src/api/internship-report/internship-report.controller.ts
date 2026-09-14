import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { InternshipReportService } from './internship-report.service';
import { InternshipReportBulkService } from './internship-report-bulk.service';
import { CreateInternshipReportDto } from './dto/create-internship-report.dto';
import { UpdateInternshipReportDto } from './dto/update-internship-report.dto';
import { QueryInternshipReportDto } from './dto/query-internship-report.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';

const ALLOWED_BULK_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_BULK_FILE_SIZE = 5 * 1024 * 1024;
const MAX_BULK_ROWS = 1000;

@ApiTags('Internship Reports (TPO Data Gathering)')
@Controller('internship-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternshipReportController {
  constructor(
    private readonly internshipReportService: InternshipReportService,
    private readonly internshipReportBulkService: InternshipReportBulkService,
  ) {}

  @Post()
  @Roles(Role.PRINCIPAL)
  @ApiOperation({ summary: 'Gather a new internship report for a student in the principal\'s own institution' })
  async create(@Req() req: any, @Body() dto: CreateInternshipReportDto) {
    return this.internshipReportService.create(req.user.userId, dto);
  }

  @Get()
  @Roles(Role.PRINCIPAL, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'List internship reports (principal: own institution only, state: all with filters)' })
  async findAll(@Req() req: any, @Query() query: QueryInternshipReportDto) {
    if (req.user.role === Role.STATE_DIRECTORATE) {
      return this.internshipReportService.findAllForState(query);
    }
    return this.internshipReportService.findAllForPrincipal(req.user.userId, query);
  }

  @Get('export')
  @Roles(Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Export internship reports as an Excel file in the TPO government template format' })
  async export(@Query() query: QueryInternshipReportDto, @Res() res: Response) {
    const buffer = await this.internshipReportService.exportForState(query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tpo-internship-report.xlsx');
    res.send(buffer);
  }

  @Get('bulk/template')
  @Roles(Role.PRINCIPAL)
  @ApiOperation({ summary: 'Download a bulk-upload Excel template pre-filled with this institution\'s active students' })
  async downloadBulkTemplate(@Req() req: any, @Res() res: Response) {
    const institutionId = req.user.institutionId;
    if (!institutionId) {
      throw new BadRequestException('Institution not found for this principal');
    }
    const buffer = await this.internshipReportBulkService.getTemplate(institutionId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=internship-confirmation-template.xlsx');
    res.send(buffer);
  }

  @Post('bulk/validate')
  @Roles(Role.PRINCIPAL)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Validate a filled bulk-upload sheet without creating any records' })
  async validateBulk(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const institutionId = req.user.institutionId;
    if (!institutionId) {
      throw new BadRequestException('Institution not found for this principal');
    }
    this.assertValidBulkFile(file);
    const rows = await this.internshipReportBulkService.parseUploadedFile(file.buffer);
    if (rows.length > MAX_BULK_ROWS) {
      throw new BadRequestException(`Maximum ${MAX_BULK_ROWS} rows can be uploaded at once`);
    }
    return this.internshipReportBulkService.validate(rows, institutionId);
  }

  @Post('bulk/upload')
  @Roles(Role.PRINCIPAL)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Bulk-create internship reports from a filled sheet (partial success — invalid rows are skipped)' })
  async uploadBulk(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const institutionId = req.user.institutionId;
    if (!institutionId) {
      throw new BadRequestException('Institution not found for this principal');
    }
    this.assertValidBulkFile(file);
    const rows = await this.internshipReportBulkService.parseUploadedFile(file.buffer);
    if (rows.length === 0) {
      throw new BadRequestException('No data rows found in the file');
    }
    if (rows.length > MAX_BULK_ROWS) {
      throw new BadRequestException(`Maximum ${MAX_BULK_ROWS} rows can be uploaded at once`);
    }
    return this.internshipReportBulkService.upload(rows, institutionId, req.user.userId);
  }

  @Get(':id')
  @Roles(Role.PRINCIPAL, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Get a single internship report' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    if (req.user.role === Role.STATE_DIRECTORATE) {
      return this.internshipReportService.findOneForState(id);
    }
    return this.internshipReportService.findOneForPrincipal(id, req.user.userId);
  }

  @Patch(':id')
  @Roles(Role.PRINCIPAL)
  @ApiOperation({ summary: 'Update an internship report (own institution only)' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateInternshipReportDto) {
    return this.internshipReportService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @Roles(Role.PRINCIPAL)
  @ApiOperation({ summary: 'Delete an internship report (own institution only)' })
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.internshipReportService.remove(id, req.user.userId);
  }

  private assertValidBulkFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!ALLOWED_BULK_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only Excel (.xlsx, .xls) files are allowed.');
    }
    if (file.size > MAX_BULK_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }
  }
}
