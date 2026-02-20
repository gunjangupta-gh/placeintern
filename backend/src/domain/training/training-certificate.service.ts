import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma } from '../../generated/prisma/client';
import { CertificateFilterDto, RevokeCertificateDto } from './dto';
import { randomUUID } from 'crypto';

@Injectable()
export class TrainingCertificateService {
  private readonly logger = new Logger(TrainingCertificateService.name);

  private getTrainingDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate certificate number
   */
  private generateCertificateNumber(): string {
    const year = new Date().getFullYear();
    const random = randomUUID().split('-')[0].toUpperCase();
    return `CERT-${year}-${random}`;
  }

  /**
   * Issue certificate (State only)
   */
  async issue(trainingId: string, userId: string, issuerId: string) {
    try {
      this.logger.log(`Issuing certificate for user ${userId} training ${trainingId}`);

      // Verify training exists
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      // Verify user has approved application
      const application = await this.prisma.trainingApplication.findUnique({
        where: { userId_trainingId: { userId, trainingId } },
      });

      if (!application || application.status !== 'APPROVED') {
        throw new BadRequestException('User does not have an approved application');
      }

      // Check attendance completeness
      const attendanceCount = await this.prisma.trainingAttendance.count({
        where: { userId, trainingId },
      });

      const trainingDays = this.getTrainingDays(training.startDate, training.endDate);

      if (attendanceCount < trainingDays) {
        throw new BadRequestException(
          `Incomplete attendance: ${attendanceCount}/${trainingDays} days marked. Full attendance is required.`
        );
      }

      // Check if certificate already exists
      const existing = await this.prisma.trainingCertificate.findUnique({
        where: { userId_trainingId: { userId, trainingId } },
      });

      if (existing) {
        throw new BadRequestException('Certificate already issued for this user');
      }

      const certificate = await this.prisma.trainingCertificate.create({
        data: {
          certificateNumber: this.generateCertificateNumber(),
          userId,
          trainingId,
          issuedById: issuerId,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          training: { select: { id: true, title: true, startDate: true, endDate: true } },
          issuedBy: { select: { id: true, name: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.CERTIFICATE_ISSUE,
        entityType: 'TrainingCertificate',
        entityId: certificate.id,
        userId: issuerId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.MEDIUM,
        description: `Certificate issued for "${training.title}" to user ${userId}`,
      }).catch(() => {});

      return certificate;
    } catch (error) {
      this.logger.error(`Failed to issue certificate: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Bulk issue certificates (State only)
   */
  async bulkIssue(trainingId: string, userIds: string[], issuerId: string) {
    try {
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      const trainingDays = this.getTrainingDays(training.startDate, training.endDate);

      // Get users with approved applications and complete attendance
      const [applications, attendance, existingCerts] = await Promise.all([
        this.prisma.trainingApplication.findMany({
          where: { trainingId, userId: { in: userIds }, status: 'APPROVED' },
        }),
        this.prisma.trainingAttendance.groupBy({
          by: ['userId'],
          where: { trainingId, userId: { in: userIds } },
          _count: { _all: true },
        }),
        this.prisma.trainingCertificate.findMany({
          where: { trainingId, userId: { in: userIds } },
        }),
      ]);

      const approvedUserIds = new Set(applications.map((a) => a.userId));
      const completeAttendanceUserIds = new Set(
        attendance
          .filter((a) => a._count._all >= trainingDays)
          .map((a) => a.userId)
      );
      const existingCertUserIds = new Set(existingCerts.map((c) => c.userId));

      // Filter eligible users
      const eligibleUserIds = userIds.filter(
        (id) =>
          approvedUserIds.has(id) &&
          completeAttendanceUserIds.has(id) &&
          !existingCertUserIds.has(id)
      );

      if (eligibleUserIds.length === 0) {
        return {
          success: true,
          message: 'No eligible users for certificate issuance',
          issued: 0,
          skipped: userIds.length,
          details: {
            notApproved: userIds.filter((id) => !approvedUserIds.has(id)).length,
            incompleteAttendance: userIds.filter((id) => !completeAttendanceUserIds.has(id)).length,
            alreadyIssued: existingCertUserIds.size,
          },
        };
      }

      // Create certificates
      const certificates = await Promise.all(
        eligibleUserIds.map((userId) =>
          this.prisma.trainingCertificate.create({
            data: {
              certificateNumber: this.generateCertificateNumber(),
              userId,
              trainingId,
              issuedById: issuerId,
            },
          })
        )
      );

      return {
        success: true,
        message: `${certificates.length} certificates issued`,
        issued: certificates.length,
        skipped: userIds.length - certificates.length,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk issue certificates: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's certificates (Faculty)
   */
  async getMyCertificates(userId: string) {
    try {
      const certificates = await this.prisma.trainingCertificate.findMany({
        where: { userId, isValid: true },
        include: {
          training: {
            select: {
              id: true,
              title: true,
              description: true,
              startDate: true,
              endDate: true,
              duration: true,
              providedBy: true,
              trainerName: true,
            },
          },
          issuedBy: { select: { id: true, name: true } },
        },
        orderBy: { issuedAt: 'desc' },
      });

      return certificates;
    } catch (error) {
      this.logger.error(`Failed to get certificates: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get certificates by training (State)
   */
  async getByTraining(trainingId: string, filters: CertificateFilterDto) {
    try {
      const { search, isValid, page = 1, limit = 20 } = filters;

      const where: Prisma.TrainingCertificateWhereInput = {
        trainingId,
        ...(isValid !== undefined ? { isValid } : {}),
        ...(search
          ? {
              OR: [
                { certificateNumber: { contains: search, mode: 'insensitive' } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [certificates, total] = await Promise.all([
        this.prisma.trainingCertificate.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                branchName: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              },
            },
            issuedBy: { select: { id: true, name: true } },
          },
          orderBy: { issuedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.trainingCertificate.count({ where }),
      ]);

      return {
        data: certificates,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`Failed to get certificates: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify certificate
   */
  async verify(certificateNumber: string) {
    try {
      const certificate = await this.prisma.trainingCertificate.findUnique({
        where: { certificateNumber },
        include: {
          user: { select: { id: true, name: true } },
          training: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              duration: true,
              providedBy: true,
            },
          },
          issuedBy: { select: { id: true, name: true } },
        },
      });

      if (!certificate) {
        return {
          valid: false,
          message: 'Certificate not found',
        };
      }

      if (!certificate.isValid) {
        return {
          valid: false,
          message: 'Certificate has been revoked',
          revokedAt: certificate.revokedAt,
          revokedReason: certificate.revokedReason,
        };
      }

      return {
        valid: true,
        certificate: {
          certificateNumber: certificate.certificateNumber,
          recipientName: certificate.user.name,
          trainingTitle: certificate.training.title,
          trainingDuration: certificate.training.duration,
          providedBy: certificate.training.providedBy,
          trainingDates: {
            start: certificate.training.startDate,
            end: certificate.training.endDate,
          },
          issuedAt: certificate.issuedAt,
          issuedBy: certificate.issuedBy?.name,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to verify certificate: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Revoke certificate (State only)
   */
  async revoke(certificateId: string, dto: RevokeCertificateDto, revokerId: string) {
    try {
      const certificate = await this.prisma.trainingCertificate.findUnique({
        where: { id: certificateId },
        include: { user: { select: { id: true, name: true } }, training: { select: { title: true } } },
      });

      if (!certificate) {
        throw new NotFoundException('Certificate not found');
      }

      if (!certificate.isValid) {
        throw new BadRequestException('Certificate is already revoked');
      }

      const updated = await this.prisma.trainingCertificate.update({
        where: { id: certificateId },
        data: {
          isValid: false,
          revokedAt: new Date(),
          revokedReason: dto.reason,
        },
      });

      this.auditService.log({
        action: AuditAction.CERTIFICATE_DOWNLOAD, // Using available action
        entityType: 'TrainingCertificate',
        entityId: certificateId,
        userId: revokerId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.HIGH,
        description: `Certificate ${certificate.certificateNumber} revoked: ${dto.reason}`,
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to revoke certificate: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Track download
   */
  async trackDownload(certificateId: string, userId: string) {
    try {
      const certificate = await this.prisma.trainingCertificate.findUnique({
        where: { id: certificateId },
      });

      if (!certificate) {
        throw new NotFoundException('Certificate not found');
      }

      if (certificate.userId !== userId) {
        throw new BadRequestException('You can only download your own certificate');
      }

      await this.prisma.trainingCertificate.update({
        where: { id: certificateId },
        data: { downloadCount: { increment: 1 } },
      });

      this.auditService.log({
        action: AuditAction.CERTIFICATE_DOWNLOAD,
        entityType: 'TrainingCertificate',
        entityId: certificateId,
        userId,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        description: `Certificate ${certificate.certificateNumber} downloaded`,
      }).catch(() => {});

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to track download: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get certificate by ID
   */
  async getById(id: string) {
    const certificate = await this.prisma.trainingCertificate.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            branchName: true,
            Institution: { select: { id: true, name: true } },
          },
        },
        training: {
          select: {
            id: true,
            title: true,
            description: true,
            startDate: true,
            endDate: true,
            duration: true,
            providedBy: true,
            trainerName: true,
          },
        },
        issuedBy: { select: { id: true, name: true } },
      },
    });

    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    return certificate;
  }

  /**
   * Get certificates by user (Faculty)
   */
  async getByUser(userId: string) {
    return this.prisma.trainingCertificate.findMany({
      where: { userId, isValid: true },
      include: {
        training: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            providedBy: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Get certificate by ID for user (validates ownership)
   */
  async getByIdForUser(id: string, userId: string) {
    const certificate = await this.getById(id);
    if (certificate.user.id !== userId) {
      throw new ForbiddenException('You do not have access to this certificate');
    }
    return certificate;
  }

  /**
   * Generate PDF for certificate (Faculty)
   */
  async generatePdf(id: string, userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const certificate = await this.getByIdForUser(id, userId);

    // Update download count
    await this.prisma.trainingCertificate.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    // Generate simple certificate content as placeholder
    // In production, use a PDF library like pdfkit or puppeteer
    const content = `
Training Certificate

This is to certify that
${certificate.user.name}

has successfully completed the training
${certificate.training.title}

Certificate Number: ${certificate.certificateNumber}
Issued Date: ${new Date(certificate.issuedAt).toLocaleDateString()}
    `;

    const buffer = Buffer.from(content, 'utf-8');
    const filename = `certificate-${certificate.certificateNumber}.pdf`;

    return { buffer, filename };
  }

  /**
   * Get certificate by training for user (Faculty)
   */
  async getByTrainingForUser(trainingId: string, userId: string) {
    const certificate = await this.prisma.trainingCertificate.findUnique({
      where: { userId_trainingId: { userId, trainingId } },
      include: {
        training: { select: { id: true, title: true } },
      },
    });

    if (!certificate) {
      return { hasCertificate: false };
    }

    return {
      hasCertificate: true,
      certificate,
    };
  }

  /**
   * Get certificates by institution (Principal)
   */
  async getByInstitution(institutionId: string) {
    return this.prisma.trainingCertificate.findMany({
      where: {
        user: { institutionId },
        isValid: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true, branchName: true } },
        training: { select: { id: true, title: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
