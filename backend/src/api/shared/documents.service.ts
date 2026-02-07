import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { FileStorageService } from '../../infrastructure/file-storage/file-storage.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../generated/prisma/client';

interface PaginationParams {
  page?: number;
  limit?: number;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Upload a document for a student
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    metadata: {
      type: string;
      fileName?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Find the student and user associated with this user
      const student = await this.prisma.student.findFirst({
        where: { userId },
        select: {
          id: true,
          user: {
            select: { name: true, role: true, institutionId: true, rollNumber: true },
          },
        },
      });

      if (!student) {
        throw new ForbiddenException('Only students can upload documents');
      }

      // Get institution name for folder structure
      const institution = student.user.institutionId
        ? await this.prisma.institution.findUnique({
            where: { id: student.user.institutionId },
            select: { name: true },
          })
        : null;

      // Upload to MinIO with organized folder structure
      const uploadResult = await this.fileStorageService.uploadStudentDocument(file, {
        institutionName: institution?.name || 'default',
        rollNumber: student.user?.rollNumber || student.id,
        documentType: 'document',
        customName: metadata.type,
      });

      // Save document record to database
      const document = await this.prisma.document.create({
        data: {
          studentId: student.id,
          type: metadata.type as any,
          fileName: metadata.fileName || file.originalname,
          fileUrl: uploadResult.url,
        },
      });

      // Log document upload
      this.auditService.log({
        action: AuditAction.STUDENT_DOCUMENT_UPLOAD,
        entityType: 'Document',
        entityId: document.id,
        userId,
        userName: student.user.name,
        userRole: student.user.role,
        description: `Document uploaded: ${document.fileName} (${metadata.type})`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.MEDIUM,
        institutionId: student.user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: {
          documentId: document.id,
          fileName: document.fileName,
          type: document.type,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      }).catch(() => {}); // Non-blocking

      this.logger.log(`Document uploaded: ${document.id} for student: ${student.id}`);

      return {
        id: document.id,
        url: document.fileUrl,
        filename: document.fileName,
        mimeType: file.mimetype,
        size: file.size,
        type: document.type,
        uploadedAt: document.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to upload document', error.stack);
      throw error;
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string, userId: string) {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          Student: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      if (!document || document.isDeleted) {
        throw new NotFoundException('Document not found');
      }

      // Verify user has access to this document
      if (document.Student.userId !== userId) {
        throw new ForbiddenException('You do not have access to this document');
      }

      return {
        id: document.id,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        type: document.type,
        uploadedAt: document.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get document ${documentId}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string, userId: string, ipAddress?: string, userAgent?: string) {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: {
          Student: {
            select: {
              id: true,
              userId: true,
              user: {
                select: { name: true, role: true, institutionId: true },
              },
            },
          },
        },
      });

      if (!document || document.isDeleted) {
        throw new NotFoundException('Document not found');
      }

      // Verify user has access to this document
      if (document.Student.userId !== userId) {
        throw new ForbiddenException('You do not have access to this document');
      }

      // Store document info for audit before deletion
      const deletedDocInfo = {
        documentId: document.id,
        fileName: document.fileName,
        type: document.type,
        studentId: document.Student.id,
      };

      // Extract key from MinIO URL and delete
      if (document.fileUrl) {
        const key = this.extractKeyFromMinioUrl(document.fileUrl);
        if (key) {
          try {
            await this.fileStorageService.deleteFile(key);
          } catch (error) {
            this.logger.warn(`Failed to delete file from MinIO: ${error.message}`);
          }
        }
      }

      // Soft delete from database (preserve audit trail)
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // Log document deletion
      this.auditService.log({
        action: AuditAction.STUDENT_DOCUMENT_DELETE,
        entityType: 'Document',
        entityId: documentId,
        userId,
        userName: document.Student.user.name,
        userRole: document.Student.user.role,
        description: `Document deleted: ${document.fileName} (${document.type})`,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.HIGH,
        institutionId: document.Student.user.institutionId || undefined,
        ipAddress,
        userAgent,
        oldValues: deletedDocInfo,
      }).catch(() => {}); // Non-blocking

      this.logger.log(`Document deleted: ${documentId}`);

      return {
        success: true,
        message: 'Document deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to delete document ${documentId}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all documents for a user with pagination
   */
  async getUserDocuments(userId: string, pagination?: PaginationParams) {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      // Find the student associated with this user
      const student = await this.prisma.student.findFirst({
        where: { userId },
      });

      if (!student) {
        throw new ForbiddenException('Only students can view documents');
      }

      const [documents, total] = await Promise.all([
        this.prisma.document.findMany({
          where: { studentId: student.id, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            fileName: true,
            fileUrl: true,
            type: true,
            createdAt: true,
          },
        }),
        this.prisma.document.count({
          where: { studentId: student.id, isDeleted: false },
        }),
      ]);

      return {
        data: documents,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get user documents', error.stack);
      throw error;
    }
  }

  /**
   * Get presigned URL for a file
   * Works with both direct MinIO URLs and file keys
   */
  async getPresignedUrl(fileUrlOrKey: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Extract key from URL if it's a full URL
      let key = fileUrlOrKey;
      if (fileUrlOrKey.startsWith('http://') || fileUrlOrKey.startsWith('https://')) {
        key = this.extractKeyFromMinioUrl(fileUrlOrKey);
        if (!key) {
          throw new NotFoundException('Invalid file URL');
        }
      }

      // Generate presigned URL
      const presignedUrl = await this.fileStorageService.getSignedUrl(key, expiresIn);
      return presignedUrl;
    } catch (error) {
      this.logger.error(`Failed to get presigned URL for: ${fileUrlOrKey}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract MinIO key from URL
   * URL format: http://localhost:9000/bucket-name/path/to/file.ext
   */
  extractKeyFromMinioUrl(url: string): string | null {
    try {
      if (!url) return null;

      // Parse URL and extract path after bucket name
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      // First part is bucket name, rest is the key
      if (pathParts.length < 2) {
        return null;
      }

      // Join everything after bucket name
      const key = pathParts.slice(1).join('/');
      return key;
    } catch (error) {
      this.logger.warn('Failed to extract key from MinIO URL', error);
      return null;
    }
  }
}
