import { BadRequestException, Controller, Get, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { BulkMentorService } from './bulk-mentor.service';

const ALLOWED_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/octet-stream',
];

/** Principal only: the institution always comes from the logged-in principal, never from the request. */
@ApiTags('Bulk Operations - Mentor Assignment')
@Controller('bulk/mentor-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class BulkMentorController {
  constructor(private readonly service: BulkMentorService) {}

  private institutionOf(req: any): string {
    const id = req.user?.institutionId;
    if (!id) throw new BadRequestException('Institution not found for this user');
    return id;
  }

  private async rows(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('File is required');
    if (!ALLOWED_TYPES.includes(file.mimetype)) throw new BadRequestException('Only Excel (.xlsx) or CSV files are allowed');
    return this.service.parseFile(file.buffer);
  }

  @Get('template')
  @ApiOperation({ summary: 'Excel template pre-filled with the institution students, plus a list of its mentors' })
  async template(@Req() req: any, @Res() res: Response) {
    const buf = await this.service.getTemplate(this.institutionOf(req));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=bulk-mentor-assignment-template.xlsx');
    res.send(buf);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Check the file row by row without saving anything' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async validate(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.process(req.user.userId, this.institutionOf(req), await this.rows(file), true);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Assign mentors from the file (valid rows are saved, failed rows are reported)' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'academicYear', required: false })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async upload(@Req() req: any, @UploadedFile() file: Express.Multer.File, @Query('academicYear') academicYear?: string) {
    const year = academicYear && /^\d{4}-\d{2}$/.test(academicYear) ? academicYear : undefined;
    return this.service.process(req.user.userId, this.institutionOf(req), await this.rows(file), false, year);
  }
}
