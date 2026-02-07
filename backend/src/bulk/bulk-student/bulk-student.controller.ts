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
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { BulkStudentService } from './bulk-student.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { BulkStudentResultDto } from './dto/bulk-student.dto';
import { BulkQueueService } from '../shared/bulk-queue.service';

@ApiTags('Bulk Operations - Students')
@Controller('bulk/students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkStudentController {
  private readonly logger = new Logger(BulkStudentController.name);

  constructor(
    private readonly bulkStudentService: BulkStudentService,
    private readonly bulkQueueService: BulkQueueService,
  ) {}

  @Post('upload')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload students from CSV/Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'async', type: Boolean, required: false, description: 'Process asynchronously via queue (recommended for large files)' })
  @ApiQuery({ name: 'institutionId', type: String, required: false, description: 'Institution ID (required for STATE_DIRECTORATE)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing student data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk upload results or job queued response',
    type: BulkStudentResultDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or data' })
  async bulkUploadStudents(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Query('async') async?: string,
    @Query('institutionId') queryInstitutionId?: string,
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

    // Validate file size (max 10MB for students as there can be more records)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const user = req.user;
    let institutionId: string;

    this.logger.log(`Bulk student upload - User: ${user.userId}, Role: ${user.role}, User InstitutionId: ${user.institutionId}`);

    // STATE_DIRECTORATE must provide institutionId in query
    if (user.role === Role.STATE_DIRECTORATE) {
      if (!queryInstitutionId) {
        throw new BadRequestException('Institution ID is required for State Directorate');
      }
      institutionId = queryInstitutionId;
    } else {
      // PRINCIPAL uses their own institution
      institutionId = user.institutionId;
      if (!institutionId) {
        throw new BadRequestException('Institution ID not found for the user');
      }
    }

    this.logger.log(`Using institutionId: ${institutionId} for bulk upload`);

    // Parse file
    const students = await this.bulkStudentService.parseFile(file.buffer, file.originalname);

    if (students.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    if (students.length > 1000) {
      throw new BadRequestException('Maximum 1000 students can be uploaded at once');
    }

    // Check if async processing is requested (default to async for large files)
    const useAsync = async === 'true' || async === '1' || students.length > 100;

    if (useAsync) {
      // Queue the job for background processing
      const result = await this.bulkQueueService.queueStudentUpload(
        students,
        institutionId,
        user.userId,
        file.originalname,
        file.size,
      );

      return {
        ...result,
        message: `Bulk upload of ${students.length} students queued for processing. You can track progress in the Job History.`,
      };
    }

    // Process synchronously for smaller files
    const result = await this.bulkStudentService.bulkUploadStudents(students, institutionId, user.userId);

    return result;
  }

  @Post('validate')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate student data from CSV/Excel file without creating records' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'institutionId', type: String, required: false, description: 'Institution ID (required for STATE_DIRECTORATE)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing student data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateStudents(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
    @Query('institutionId') queryInstitutionId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const user = req.user;
    let institutionId: string;

    if (user.role === Role.STATE_DIRECTORATE) {
      if (!queryInstitutionId) {
        throw new BadRequestException('Institution ID is required for State Directorate');
      }
      institutionId = queryInstitutionId;
    } else {
      institutionId = user.institutionId;
      if (!institutionId) {
        throw new BadRequestException('Institution ID not found for the user');
      }
    }

    // Parse file
    const students = await this.bulkStudentService.parseFile(file.buffer, file.originalname);

    // Validate students
    const validationResult = await this.bulkStudentService.validateStudents(students, institutionId);

    return validationResult;
  }

  @Get('template')
  @Roles(Role.PRINCIPAL, Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
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
  async downloadTemplate(@Res() res: Response) {
    const template = await this.bulkStudentService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-student-upload-template.xlsx');

    res.send(template);
  }
}
