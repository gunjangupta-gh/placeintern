import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  Res,
  HttpStatus,
  Query,
  Body,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { BulkUserService } from './bulk-user.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { BulkUserResultDto } from './dto/bulk-user.dto';
import { BulkQueueService } from '../shared/bulk-queue.service';

@ApiTags('Bulk Operations - Users')
@Controller('bulk/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkUserController {
  private readonly logger = new Logger(BulkUserController.name);

  constructor(
    private readonly bulkUserService: BulkUserService,
    private readonly bulkQueueService: BulkQueueService,
  ) {}

  @Post('upload')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Bulk upload users (staff/faculty) from CSV/Excel file',
    description: 'Upload faculty/staff users. Institution is auto-linked from "Name of the College" column in Excel. Branch is auto-linked from "Course" column.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'async', type: Boolean, required: false, description: 'Process asynchronously via queue (recommended for large files)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing user data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk upload results or job queued response',
    type: BulkUserResultDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or data' })
  async bulkUploadUsers(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Query('async') async?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only CSV and Excel files are allowed.');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    const user = req.user;

    // For PRINCIPAL, use their institution as default fallback
    // For STATE_DIRECTORATE, institution comes from Excel "Name of the College" column
    const defaultInstitutionId = user.role === Role.PRINCIPAL ? user.institutionId : null;

    this.logger.log(`Bulk user upload - User: ${user.userId}, Role: ${user.role}, DefaultInstitutionId: ${defaultInstitutionId}`);

    // Parse file
    const users = await this.bulkUserService.parseFile(file.buffer, file.originalname);

    if (users.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    if (users.length > 500) {
      throw new BadRequestException('Maximum 500 users can be uploaded at once');
    }

    // Check if async processing is requested (default to async for large files)
    const useAsync = async === 'true' || async === '1' || users.length > 50;

    if (useAsync) {
      // Queue the job for background processing
      const result = await this.bulkQueueService.queueUserUpload(
        users,
        defaultInstitutionId,
        user.userId,
        file.originalname,
        file.size,
      );

      return {
        ...result,
        message: `Bulk upload of ${users.length} users queued for processing. You can track progress in the Job History.`,
      };
    }

    // Process synchronously for smaller files
    const result = await this.bulkUserService.bulkUploadUsers(users, defaultInstitutionId, user.userId);

    return result;
  }

  @Post('validate')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Validate user data from CSV/Excel file without creating records',
    description: 'Validates user data including institution matching from "Name of the College" column.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing user data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateUsers(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const user = req.user;
    const defaultInstitutionId = user.role === Role.PRINCIPAL ? user.institutionId : null;

    this.logger.log(`Bulk user validate - User: ${user.userId}, Role: ${user.role}, DefaultInstitutionId: ${defaultInstitutionId}`);

    // Parse file
    const users = await this.bulkUserService.parseFile(file.buffer, file.originalname);

    if (users.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    // Validate users
    const validationResult = await this.bulkUserService.validateUsers(users, defaultInstitutionId);

    return validationResult;
  }

  @Get('template')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
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
  async downloadTemplate(@Res() res: Response) {
    const template = await this.bulkUserService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-user-upload-template.xlsx');

    res.send(template);
  }

  @Post('download-created-report')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Download Excel report for successfully created users with credentials' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        successRecords: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of successfully created user records from upload result',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel file with created users and their credentials',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadCreatedReport(
    @Body() body: { successRecords: any[] },
    @Res() res: Response,
  ) {
    const { successRecords } = body;

    if (!successRecords || !Array.isArray(successRecords) || successRecords.length === 0) {
      throw new BadRequestException('No success records provided');
    }

    const excelBuffer = await this.bulkUserService.generateCreatedUsersExcel(successRecords);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=created_users_${timestamp}.xlsx`);

    res.send(excelBuffer);
  }

  @Post('download-error-report')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @ApiOperation({ summary: 'Download Excel report for failed/error users' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        failedRecords: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of failed user records from upload result',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Excel file with failed users and error details',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async downloadErrorReport(
    @Body() body: { failedRecords: any[] },
    @Res() res: Response,
  ) {
    const { failedRecords } = body;

    if (!failedRecords || !Array.isArray(failedRecords) || failedRecords.length === 0) {
      throw new BadRequestException('No error records provided');
    }

    const excelBuffer = await this.bulkUserService.generateErrorUsersExcel(failedRecords);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=error_users_${timestamp}.xlsx`);

    res.send(excelBuffer);
  }
}
