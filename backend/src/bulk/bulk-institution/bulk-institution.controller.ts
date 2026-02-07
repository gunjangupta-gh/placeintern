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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { BulkInstitutionService } from './bulk-institution.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { BulkInstitutionResultDto } from './dto/bulk-institution.dto';
import { BulkQueueService } from '../shared/bulk-queue.service';

@ApiTags('Bulk Operations - Institutions')
@Controller('bulk/institutions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkInstitutionController {
  constructor(
    private readonly bulkInstitutionService: BulkInstitutionService,
    private readonly bulkQueueService: BulkQueueService,
  ) {}

  @Post('upload')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Bulk upload institutions from CSV/Excel file (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'async', type: Boolean, required: false, description: 'Process asynchronously via queue (recommended for large files)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing institution data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk upload results or job queued response',
    type: BulkInstitutionResultDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid file or data' })
  async bulkUploadInstitutions(
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

    // Parse file
    const institutions = await this.bulkInstitutionService.parseFile(file.buffer, file.originalname);

    if (institutions.length === 0) {
      throw new BadRequestException('No valid data found in the file');
    }

    if (institutions.length > 100) {
      throw new BadRequestException('Maximum 100 institutions can be uploaded at once');
    }

    // Check if async processing is requested (default to async for large files)
    const useAsync = async === 'true' || async === '1' || institutions.length > 20;

    if (useAsync) {
      // Queue the job for background processing
      // For state-level uploads, use 'SYSTEM' as institutionId
      const result = await this.bulkQueueService.queueInstitutionUpload(
        institutions,
        user.userId,
        file.originalname,
        file.size,
        'SYSTEM',
      );

      return {
        ...result,
        message: `Bulk upload of ${institutions.length} institutions queued for processing. You can track progress in the Job History.`,
      };
    }

    // Process synchronously for smaller files
    const result = await this.bulkInstitutionService.bulkUploadInstitutions(institutions, user.userId);

    return result;
  }

  @Post('validate')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate institution data from CSV/Excel file without creating records' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV or Excel file containing institution data',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Validation results',
  })
  async validateInstitutions(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Parse file
    const institutions = await this.bulkInstitutionService.parseFile(file.buffer, file.originalname);

    // Validate institutions
    const validationResult = await this.bulkInstitutionService.validateInstitutions(institutions);

    return validationResult;
  }

  @Get('template')
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
  async downloadTemplate(@Res() res: Response) {
    const template = await this.bulkInstitutionService.getTemplate();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-institution-upload-template.xlsx');

    res.send(template);
  }
}
