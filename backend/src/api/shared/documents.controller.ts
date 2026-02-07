import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('shared/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: any,
    @Request() req,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.documentsService.uploadDocument(req.user.userId, file, metadata, ipAddress, userAgent);
  }

  @Get('presigned-url')
  async getPresignedUrl(
    @Query('url') fileUrl: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    if (!fileUrl) {
      throw new BadRequestException('File URL is required');
    }
    const expiry = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const presignedUrl = await this.documentsService.getPresignedUrl(fileUrl, expiry);
    return { url: presignedUrl };
  }

  @Get(':id')
  async getDocument(@Param('id') id: string, @Request() req) {
    return this.documentsService.getDocument(id, req.user.userId);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string, @Request() req) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.documentsService.deleteDocument(id, req.user.userId, ipAddress, userAgent);
  }
}
