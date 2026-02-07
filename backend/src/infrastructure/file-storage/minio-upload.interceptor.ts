import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileStorageService } from './file-storage.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for MinIO upload interceptor
 */
export interface MinioUploadConfig {
  /** Field name containing the file (default: 'file') */
  fieldName?: string;
  /** Folder prefix for the upload (e.g., 'profiles', 'documents') */
  folder?: string;
  /** Max file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Allowed mime types (e.g., ['image/jpeg', 'image/png', 'application/pdf']) */
  allowedMimeTypes?: string[];
}

/**
 * Interceptor that uploads files to MinIO and attaches the URL to the request
 *
 * Usage:
 * @UseInterceptors(FileInterceptor('file'), new MinioUploadInterceptor(fileStorageService, { folder: 'profiles' }))
 *
 * After processing, the file object will have additional properties:
 * - file.minioUrl: The public URL of the uploaded file
 * - file.minioKey: The storage key for the file
 */
@Injectable()
export class MinioUploadInterceptor implements NestInterceptor {
  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly config: MinioUploadConfig = {},
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const fieldName = this.config.fieldName || 'file';
    const file = request[fieldName] || request.file;

    if (!file) {
      // No file uploaded, continue without error
      return next.handle();
    }

    // Validate file size
    const maxSize = this.config.maxSize || 10 * 1024 * 1024; // 10MB default
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`,
      );
    }

    // Validate mime type
    if (this.config.allowedMimeTypes && this.config.allowedMimeTypes.length > 0) {
      if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `File type ${file.mimetype} is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
        );
      }
    }

    try {
      // Upload to MinIO
      const result = await this.fileStorageService.uploadFile(file, {
        folder: this.config.folder,
        filename: `${uuidv4()}-${file.originalname}`,
      });

      // Attach MinIO info to the file object
      file.minioUrl = result.url;
      file.minioKey = result.key;
      file.path = result.url; // For backward compatibility with controllers expecting file.path
      file.url = result.url;  // Alternative accessor
      file.location = result.url; // AWS S3 style

      return next.handle();
    } catch (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }
}

/**
 * Factory function to create MinIO upload interceptor with configuration
 */
export function createMinioUploadInterceptor(
  fileStorageService: FileStorageService,
  config: MinioUploadConfig = {},
): MinioUploadInterceptor {
  return new MinioUploadInterceptor(fileStorageService, config);
}
