import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { Role } from '../../../generated/prisma/client';
import { TrainingCertificateService } from '../../../domain/training/training-certificate.service';

@ApiTags('Faculty - Certificates')
@ApiBearerAuth()
@Controller('faculty/training/certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.FACULTY_COORDINATOR)
export class FacultyCertificateController {
  constructor(private readonly certificateService: TrainingCertificateService) {}

  @Get()
  @ApiOperation({ summary: 'Get my certificates' })
  async getMyCertificates(@Req() req) {
    return this.certificateService.getByUser(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get certificate details' })
  async getCertificate(@Param('id') id: string, @Req() req) {
    return this.certificateService.getByIdForUser(id, req.user.userId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download certificate PDF' })
  async downloadCertificate(
    @Param('id') id: string,
    @Req() req,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificateService.generatePdf(
      id,
      req.user.userId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('training/:trainingId')
  @ApiOperation({ summary: 'Get my certificate for a training' })
  async getTrainingCertificate(@Param('trainingId') trainingId: string, @Req() req) {
    return this.certificateService.getByTrainingForUser(trainingId, req.user.userId);
  }
}
