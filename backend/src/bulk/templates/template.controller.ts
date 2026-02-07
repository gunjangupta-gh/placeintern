import { Controller, Get, UseGuards, Res, HttpStatus, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { BulkUserService } from '../bulk-user/bulk-user.service';
import { BulkStudentService } from '../bulk-student/bulk-student.service';
import { BulkInstitutionService } from '../bulk-institution/bulk-institution.service';
import { BulkSelfInternshipService } from '../bulk-self-internship/bulk-self-internship.service';

@ApiTags('Bulk Operations - Templates')
@Controller('bulk/templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplateController {
  constructor(
    private readonly bulkUserService: BulkUserService,
    private readonly bulkStudentService: BulkStudentService,
    private readonly bulkInstitutionService: BulkInstitutionService,
    private readonly bulkSelfInternshipService: BulkSelfInternshipService,
  ) {}

  @Get('users')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Download template Excel file for bulk user upload' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel template file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadUserTemplate(@Res() res: Response) {
    const template = this.bulkUserService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-user-upload-template.xlsx');

    res.send(template);
  }

  @Get('students')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Download template Excel file for bulk student upload' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel template file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadStudentTemplate(@Res() res: Response) {
    const template = this.bulkStudentService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-student-upload-template.xlsx');

    res.send(template);
  }

  @Get('institutions')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Download template Excel file for bulk institution upload' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel template file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadInstitutionTemplate(@Res() res: Response) {
    const template = this.bulkInstitutionService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-institution-upload-template.xlsx');

    res.send(template);
  }

  @Get(':type')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Download template by type (users, students, institutions, self-internships)' })
  @ApiParam({
    name: 'type',
    enum: ['users', 'students', 'institutions', 'self-internships'],
    description: 'Template type',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel template file',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadTemplateByType(@Param('type') type: string, @Res() res: Response) {
    let template: Buffer;
    let filename: string;

    switch (type) {
      case 'users':
        template = await this.bulkUserService.getTemplate();
        filename = 'bulk-user-upload-template.xlsx';
        break;
      case 'students':
        template = await this.bulkStudentService.getTemplate();
        filename = 'bulk-student-upload-template.xlsx';
        break;
      case 'institutions':
        template = await this.bulkInstitutionService.getTemplate();
        filename = 'bulk-institution-upload-template.xlsx';
        break;
      case 'self-internships':
        template = await this.bulkSelfInternshipService.getTemplate();
        filename = 'bulk-self-internship-upload-template.xlsx';
        break;
      default:
        res.status(HttpStatus.BAD_REQUEST).send({ error: 'Invalid template type' });
        return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    res.send(template);
  }
}
