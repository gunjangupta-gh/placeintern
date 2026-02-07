import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import sharp from 'sharp';

export interface FileUploadOptions {
  folder?: string;
  subfolder?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  optimizeImage?: boolean;
  imageOptions?: ImageOptimizationOptions;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

export interface StudentDocumentOptions {
  institutionName: string;
  rollNumber: string;
  documentType: 'profile' | 'joining-letter' | 'monthly-report' | 'completion-certificate' | 'offer-letter' | 'noc' | 'document' | 'other';
  month?: string; // e.g., 'january'
  year?: string;
  customName?: string;
}

export interface ReportUploadOptions {
  institutionName?: string;
  reportType: string;
  format: string;
}

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
}

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    this.endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'cms-uploads');

    // SECURITY: Require explicit credentials - no default fallbacks
    const accessKeyId = this.configService.get<string>('MINIO_ROOT_USER');
    const secretAccessKey = this.configService.get<string>('MINIO_ROOT_PASSWORD');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('MINIO_ROOT_USER and MINIO_ROOT_PASSWORD environment variables are required');
    }

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('MINIO_REGION', 'us-east-1'),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  /**
   * Bootstrap: Verify MinIO connection and ensure bucket exists
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('='.repeat(50));
    this.logger.log('MinIO Storage Service - Initializing...');
    this.logger.log(`Endpoint: ${this.endpoint}`);
    this.logger.log(`Bucket: ${this.bucket}`);
    this.logger.log('='.repeat(50));

    try {
      // Test connection by listing buckets
      const { Buckets } = await this.s3Client.send(new ListBucketsCommand({}));
      this.logger.log(`MinIO connected successfully! Found ${Buckets?.length || 0} bucket(s)`);

      // Ensure our bucket exists
      await this.ensureBucketExists();

      this.isConnected = true;
      this.logger.log('MinIO Storage Service - Ready');
      this.logger.log('='.repeat(50));
    } catch (error) {
      this.isConnected = false;
      this.logger.error('='.repeat(50));
      this.logger.error('MinIO CONNECTION FAILED!');
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Endpoint: ${this.endpoint}`);
      this.logger.error('Please ensure MinIO is running and credentials are correct.');
      this.logger.error('='.repeat(50));

      // Don't throw - allow app to start but log the error
      // Uploads will fail gracefully with proper error messages
    }
  }

  /**
   * Check if MinIO is connected
   */
  isMinioConnected(): boolean {
    return this.isConnected;
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" exists and accessible`);
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.logger.log(`Bucket "${this.bucket}" created successfully`);
        } catch (createError) {
          this.logger.error(`Failed to create bucket "${this.bucket}": ${createError.message}`);
          throw createError;
        }
      } else {
        this.logger.error(`Failed to check bucket "${this.bucket}": ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Verify connection before operations - attempts reconnect if needed
   */
  private async ensureConnectedAsync(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // Try to reconnect
    this.logger.log('Attempting to reconnect to MinIO...');
    try {
      const { Buckets } = await this.s3Client.send(new ListBucketsCommand({}));
      this.logger.log(`MinIO reconnected! Found ${Buckets?.length || 0} bucket(s)`);
      await this.ensureBucketExists();
      this.isConnected = true;
    } catch (error) {
      this.logger.error(`MinIO reconnection failed: ${error.message}`);
      throw new Error('MinIO storage is not connected. Please check MinIO server status.');
    }
  }

  /**
   * Sync version for backward compatibility (logs warning if not connected)
   */
  private ensureConnected(): void {
    if (!this.isConnected) {
      this.logger.warn('MinIO connection not verified - operation may fail');
    }
  }

  /**
   * Sanitize institution name for use as folder name
   * Removes special characters and replaces spaces with underscores
   */
  private sanitizeFolderName(name: string): string {
    if (!name) return 'default';
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-+/g, '_') // Replace hyphens with underscores
      .replace(/_+/g, '_') // Remove duplicate underscores
      .substring(0, 100); // Limit length
  }

  /**
   * Sanitize roll number for use in filenames
   */
  private sanitizeRollNumber(rollNumber: string): string {
    if (!rollNumber) return 'unknown';
    return rollNumber.replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Build file path from options
   * Structure: folder/subfolder/filename
   */
  private buildFilePath(originalName: string, options: FileUploadOptions = {}): string {
    const { folder, subfolder, filename } = options;
    const parts: string[] = [];

    if (folder) parts.push(folder);
    if (subfolder) parts.push(subfolder);

    const finalName = filename || `${uuidv4()}-${originalName}`;
    parts.push(finalName);

    return parts.join('/');
  }

  /**
   * Build student document path
   * Structure: {institutionName}/{documentType}/{rollNumber}_{documentType}.{ext}
   * Examples:
   *   - dte_punjab/profile/2021001_profile.webp
   *   - dte_punjab/joining-letters/2021001_joiningletter.pdf
   *   - dte_punjab/reports/2021001_january_2025_monthlyreport.pdf
   *   - dte_punjab/documents/2021001_resume_document.pdf
   */
  private buildStudentDocumentPath(
    originalName: string,
    options: StudentDocumentOptions,
  ): string {
    const { institutionName, rollNumber, documentType, month, year, customName } = options;
    const sanitizedInstitution = this.sanitizeFolderName(institutionName);
    const sanitizedRollNumber = this.sanitizeRollNumber(rollNumber);
    const ext = originalName.split('.').pop()?.toLowerCase() || 'pdf';

    let filename: string;
    let folderPath: string;

    switch (documentType) {
      case 'profile':
        filename = `${sanitizedRollNumber}_profile.${ext}`;
        folderPath = `${sanitizedInstitution}/profile`;
        break;
      case 'joining-letter':
        filename = `${sanitizedRollNumber}_joiningletter.${ext}`;
        folderPath = `${sanitizedInstitution}/joining-letters`;
        break;
      case 'monthly-report':
        const monthName = month || new Date().toLocaleString('default', { month: 'long' }).toLowerCase();
        const yearStr = year || new Date().getFullYear().toString();
        filename = `${sanitizedRollNumber}_${monthName}_${yearStr}_monthlyreport.${ext}`;
        folderPath = `${sanitizedInstitution}/reports`;
        break;
      case 'completion-certificate':
        filename = `${sanitizedRollNumber}_completion_certificate.${ext}`;
        folderPath = `${sanitizedInstitution}/certificates`;
        break;
      case 'offer-letter':
        filename = `${sanitizedRollNumber}_offer_letter.${ext}`;
        folderPath = `${sanitizedInstitution}/offer-letters`;
        break;
      case 'noc':
        filename = `${sanitizedRollNumber}_noc.${ext}`;
        folderPath = `${sanitizedInstitution}/noc`;
        break;
      case 'document':
        const docType = customName?.toLowerCase().replace(/\s+/g, '_') || 'other';
        filename = `${sanitizedRollNumber}_${docType}_document.${ext}`;
        folderPath = `${sanitizedInstitution}/documents`;
        break;
      default:
        filename = customName
          ? `${sanitizedRollNumber}_${customName}.${ext}`
          : `${sanitizedRollNumber}_${Date.now()}.${ext}`;
        folderPath = `${sanitizedInstitution}/other`;
    }

    return `${folderPath}/${filename}`;
  }

  /**
   * Build report path
   * Structure: {institutionName}/reports/{reportType}/{filename}
   * Or: reports/{reportType}/{filename} if no institution
   */
  private buildReportPath(options: ReportUploadOptions): string {
    const { institutionName, reportType, format } = options;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `${reportType}_${dateStr}_${timeStr}.${format}`;

    if (institutionName) {
      const sanitizedInstitution = this.sanitizeFolderName(institutionName);
      return `${sanitizedInstitution}/reports/${reportType}/${filename}`;
    }
    return `reports/${reportType}/${filename}`;
  }

  private getCurrentMonth(): string {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];
    const now = new Date();
    return `${months[now.getMonth()]}-${now.getFullYear()}`;
  }

  // ============================================
  // Core Upload Methods
  // ============================================

  /**
   * Upload a file buffer
   */
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    options: FileUploadOptions = {},
  ): Promise<UploadResult> {
    this.ensureConnected();

    const key = this.buildFilePath(originalName, options);
    const contentType = options.contentType || this.getContentType(originalName);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: options.metadata,
        }),
      );

      const url = `${this.endpoint}/${this.bucket}/${key}`;
      this.logger.log(`Uploaded: ${key}`);

      return {
        key,
        url,
        filename: key.split('/').pop(),
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`);
      throw new Error(`Failed to upload file to storage: ${error.message}`);
    }
  }

  /**
   * Upload a Multer file
   */
  async uploadFile(
    file: Express.Multer.File,
    options: FileUploadOptions = {},
  ): Promise<UploadResult> {
    return this.uploadBuffer(file.buffer, file.originalname, {
      ...options,
      contentType: options.contentType || file.mimetype,
    });
  }

  // ============================================
  // Student Document Methods
  // ============================================

  /**
   * Upload a student document with proper naming
   * Path: {institutionName}/{documentType}/{rollNumber}_{documentType}.ext
   */
  async uploadStudentDocument(
    file: Express.Multer.File,
    options: StudentDocumentOptions,
  ): Promise<UploadResult> {
    this.ensureConnected();

    const key = this.buildStudentDocumentPath(file.originalname, options);
    const contentType = file.mimetype || this.getContentType(file.originalname);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: contentType,
          Metadata: {
            rollNumber: options.rollNumber,
            institutionName: options.institutionName,
            documentType: options.documentType,
            ...(options.month && { month: options.month }),
          },
        }),
      );

      const url = `${this.endpoint}/${this.bucket}/${key}`;
      this.logger.log(`Student document uploaded: ${key}`);

      return {
        key,
        url,
        filename: key.split('/').pop(),
        size: file.buffer.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload student document: ${error.message}`);
      throw new Error(`Failed to upload student document: ${error.message}`);
    }
  }

  /**
   * Upload student document from buffer
   */
  async uploadStudentDocumentBuffer(
    buffer: Buffer,
    originalName: string,
    options: StudentDocumentOptions,
  ): Promise<UploadResult> {
    const key = this.buildStudentDocumentPath(originalName, options);
    const contentType = this.getContentType(originalName);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          rollNumber: options.rollNumber,
          institutionName: options.institutionName,
          documentType: options.documentType,
        },
      }),
    );

    const url = `${this.endpoint}/${this.bucket}/${key}`;
    this.logger.log(`Student document uploaded: ${key}`);

    return {
      key,
      url,
      filename: key.split('/').pop(),
      size: buffer.length,
      contentType,
    };
  }

  // ============================================
  // Report Methods
  // ============================================

  /**
   * Upload a generated report
   * Path: {institutionName}/reports/{reportType}/{reportType}_{timestamp}.{format}
   */
  async uploadReport(
    buffer: Buffer,
    options: ReportUploadOptions,
  ): Promise<UploadResult> {
    this.ensureConnected();

    const key = this.buildReportPath(options);
    const contentType = this.getContentType(`file.${options.format}`);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          Metadata: {
            reportType: options.reportType,
            ...(options.institutionName && { institutionName: this.sanitizeFolderName(options.institutionName) }),
          },
        }),
      );

      const url = `${this.endpoint}/${this.bucket}/${key}`;
      this.logger.log(`Report uploaded: ${key}`);

      return {
        key,
        url,
        filename: key.split('/').pop(),
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload report: ${error.message}`);
      throw new Error(`Failed to upload report: ${error.message}`);
    }
  }

  // ============================================
  // File Operations
  // ============================================

  /**
   * Get file as buffer
   * Note: For large files (>50MB), consider using getFileStream() instead
   */
  async getFile(key: string): Promise<Buffer> {
    await this.ensureConnectedAsync();

    try {
      this.logger.log(`Fetching file from MinIO - Bucket: ${this.bucket}, Key: ${key}`);

      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      if (!response.Body) {
        throw new Error('Empty response body from MinIO');
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      this.logger.log(`File fetched successfully: ${key} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to get file - Bucket: ${this.bucket}, Key: ${key}`);
      this.logger.error(`Error details: ${error.name} - ${error.message}`);

      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        throw new Error(`File not found in storage: ${key}`);
      }

      throw new Error(`Failed to retrieve file from storage: ${error.message}`);
    }
  }

  /**
   * Get file as a readable stream with backpressure support
   * Use this for large files to avoid memory issues
   * @param key The file key in storage
   * @returns Object containing the stream and metadata
   */
  async getFileStream(key: string): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    await this.ensureConnectedAsync();

    try {
      this.logger.log(`Opening stream for file: ${key}`);

      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      if (!response.Body) {
        throw new Error('Empty response body from MinIO');
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error) {
      this.logger.error(`Failed to open stream for file: ${key}`);
      this.logger.error(`Error details: ${error.name} - ${error.message}`);

      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        throw new Error(`File not found in storage: ${key}`);
      }

      throw new Error(`Failed to retrieve file stream from storage: ${error.message}`);
    }
  }

  /**
   * Stream a large file to a writable destination with backpressure
   * This is the preferred method for downloading large files
   * @param key The file key in storage
   * @param destination The writable stream destination (e.g., HTTP response, file write stream)
   * @param options Optional settings for the transfer
   */
  async streamFileTo(
    key: string,
    destination: NodeJS.WritableStream,
    options?: { onProgress?: (bytesTransferred: number) => void },
  ): Promise<void> {
    const { stream, contentLength } = await this.getFileStream(key);

    return new Promise((resolve, reject) => {
      let bytesTransferred = 0;

      stream.on('data', (chunk: Buffer) => {
        bytesTransferred += chunk.length;
        if (options?.onProgress) {
          options.onProgress(bytesTransferred);
        }
      });

      stream.on('error', (error) => {
        this.logger.error(`Stream error for file ${key}: ${error.message}`);
        reject(error);
      });

      destination.on('error', (error) => {
        this.logger.error(`Destination stream error for file ${key}: ${error.message}`);
        stream.destroy();
        reject(error);
      });

      stream.on('end', () => {
        this.logger.log(`Stream completed for file ${key}: ${bytesTransferred} bytes transferred`);
        resolve();
      });

      // Pipe with automatic backpressure handling
      stream.pipe(destination, { end: false });
    });
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`Deleted: ${key}`);
  }

  // SECURITY: Maximum presigned URL expiry time (1 hour)
  private readonly MAX_PRESIGNED_EXPIRY = 3600;

  /**
   * Get presigned download URL
   * SECURITY: Expiry time is capped at 1 hour maximum
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // Cap expiry time at maximum allowed value
    const cappedExpiry = Math.min(expiresIn, this.MAX_PRESIGNED_EXPIRY);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3Client, command, { expiresIn: cappedExpiry });
  }

  /**
   * Get presigned upload URL
   * SECURITY: Expiry time is capped at 1 hour maximum
   */
  async getUploadUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    // Cap expiry time at maximum allowed value
    const cappedExpiry = Math.min(expiresIn, this.MAX_PRESIGNED_EXPIRY);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: cappedExpiry });
  }

  /**
   * List files in a folder
   */
  async listFiles(prefix: string): Promise<string[]> {
    const response = await this.s3Client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
    );
    return (response.Contents || []).map((obj) => obj.Key);
  }

  /**
   * List all documents for a student by searching across all document type folders
   * @param institutionName - Name of the institution
   * @param rollNumber - Student roll number (optional - if not provided, lists all files in institution)
   */
  async listStudentDocuments(institutionName: string, rollNumber?: string): Promise<string[]> {
    const sanitizedInstitution = this.sanitizeFolderName(institutionName);
    const prefix = `${sanitizedInstitution}/`;
    const allFiles = await this.listFiles(prefix);

    if (!rollNumber) {
      return allFiles;
    }

    // Filter files that contain the roll number
    const sanitizedRollNumber = this.sanitizeRollNumber(rollNumber);
    return allFiles.filter(file => file.includes(`${sanitizedRollNumber}_`));
  }

  /**
   * List all documents of a specific type for an institution
   */
  async listDocumentsByType(
    institutionName: string,
    documentType: 'profile' | 'joining-letters' | 'reports' | 'certificates' | 'offer-letters' | 'noc' | 'documents' | 'other'
  ): Promise<string[]> {
    const sanitizedInstitution = this.sanitizeFolderName(institutionName);
    const prefix = `${sanitizedInstitution}/${documentType}/`;
    return this.listFiles(prefix);
  }

  /**
   * Get public URL
   */
  getPublicUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      zip: 'application/zip',
    };
    return types[ext] || 'application/octet-stream';
  }

  // ============================================
  // Image Optimization
  // ============================================

  private isImageFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  }

  /**
   * Optimize image buffer using sharp
   * - Resizes to max dimensions while maintaining aspect ratio
   * - Converts to WebP format for better compression
   * - Applies quality settings
   */
  async optimizeImage(
    buffer: Buffer,
    options: ImageOptimizationOptions = {},
  ): Promise<{ buffer: Buffer; format: string; contentType: string }> {
    const {
      maxWidth = 800,
      maxHeight = 800,
      quality = 80,
      format = 'webp',
    } = options;

    try {
      let sharpInstance = sharp(buffer);

      // Get metadata to check if resize is needed
      const metadata = await sharpInstance.metadata();

      // Resize if image exceeds max dimensions
      if ((metadata.width && metadata.width > maxWidth) ||
          (metadata.height && metadata.height > maxHeight)) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Convert to specified format with quality settings
      let outputBuffer: Buffer;
      let contentType: string;

      switch (format) {
        case 'jpeg':
          outputBuffer = await sharpInstance.jpeg({ quality, mozjpeg: true }).toBuffer();
          contentType = 'image/jpeg';
          break;
        case 'png':
          outputBuffer = await sharpInstance.png({ quality, compressionLevel: 9 }).toBuffer();
          contentType = 'image/png';
          break;
        case 'webp':
        default:
          outputBuffer = await sharpInstance.webp({ quality }).toBuffer();
          contentType = 'image/webp';
          break;
      }

      const originalSize = buffer.length;
      const optimizedSize = outputBuffer.length;
      const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

      this.logger.log(
        `Image optimized: ${(originalSize / 1024).toFixed(1)}KB -> ${(optimizedSize / 1024).toFixed(1)}KB (${savings}% reduction)`,
      );

      return { buffer: outputBuffer, format, contentType };
    } catch (error) {
      this.logger.warn(`Image optimization failed, using original: ${error.message}`);
      return { buffer, format: 'original', contentType: 'image/jpeg' };
    }
  }

  /**
   * Upload an optimized image
   * Automatically compresses and converts to WebP
   */
  async uploadOptimizedImage(
    buffer: Buffer,
    originalName: string,
    options: FileUploadOptions = {},
  ): Promise<UploadResult> {
    this.ensureConnected();

    // Optimize the image
    const { buffer: optimizedBuffer, contentType } = await this.optimizeImage(
      buffer,
      options.imageOptions || { maxWidth: 800, maxHeight: 800, quality: 80, format: 'webp' },
    );

    // Update filename to use .webp extension if converted
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const optimizedName = `${baseName}.webp`;

    const key = this.buildFilePath(optimizedName, options);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: optimizedBuffer,
          ContentType: contentType,
          Metadata: options.metadata,
        }),
      );

      const url = `${this.endpoint}/${this.bucket}/${key}`;
      this.logger.log(`Optimized image uploaded: ${key}`);

      return {
        key,
        url,
        filename: key.split('/').pop(),
        size: optimizedBuffer.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload optimized image: ${error.message}`);
      throw new Error(`Failed to upload optimized image: ${error.message}`);
    }
  }

  /**
   * Upload profile image with optimization
   * Path: {institutionName}/profile/{rollNumber}_profile.webp
   */
  async uploadProfileImage(
    buffer: Buffer,
    originalName: string,
    institutionName: string,
    rollNumber: string,
    options: ImageOptimizationOptions = {},
  ): Promise<UploadResult> {
    this.ensureConnected();

    // Profile images should be smaller - optimize for avatars
    const profileOptions: ImageOptimizationOptions = {
      maxWidth: options.maxWidth || 400,
      maxHeight: options.maxHeight || 400,
      quality: options.quality || 85,
      format: options.format || 'webp',
    };

    const { buffer: optimizedBuffer, contentType } = await this.optimizeImage(
      buffer,
      profileOptions,
    );

    const sanitizedInstitution = this.sanitizeFolderName(institutionName);
    const sanitizedRollNumber = this.sanitizeRollNumber(rollNumber);
    const key = `${sanitizedInstitution}/profile/${sanitizedRollNumber}_profile.webp`;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: optimizedBuffer,
          ContentType: contentType,
          Metadata: {
            rollNumber: sanitizedRollNumber,
            institutionName: sanitizedInstitution,
            type: 'profile',
          },
        }),
      );

      const url = `${this.endpoint}/${this.bucket}/${key}`;
      this.logger.log(`Profile image uploaded: ${key}`);

      return {
        key,
        url,
        filename: `${sanitizedRollNumber}_profile.webp`,
        size: optimizedBuffer.length,
        contentType,
      };
    } catch (error) {
      this.logger.error(`Failed to upload profile image: ${error.message}`);
      throw new Error(`Failed to upload profile image: ${error.message}`);
    }
  }
}
