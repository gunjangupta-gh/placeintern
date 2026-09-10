import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { InternshipReportService } from './internship-report.service';
import { CreateInternshipReportDto } from './dto/create-internship-report.dto';
import { UpdateInternshipReportDto } from './dto/update-internship-report.dto';
import { QueryInternshipReportDto } from './dto/query-internship-report.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';

@ApiTags('Internship Reports (TPO Data Gathering)')
@Controller('internship-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InternshipReportController {
  constructor(private readonly internshipReportService: InternshipReportService) {}

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
}
