import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileStorageService } from './file-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}

export { MinioUploadInterceptor, MinioUploadConfig, createMinioUploadInterceptor } from './minio-upload.interceptor';
