import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ApplicationStatus, InternshipPhase, AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { SystemConfigService } from '../../../api/system-admin/services/system-config.service';
import { ExpectedCycleService } from '../expected-cycle/expected-cycle.service';

export interface SubmitSelfIdentifiedDto {
  companyName: string;
  companyAddress: string;
  companyEmail?: string;
  companyPhone?: string;
  role: string;
  stipend?: number;
  startDate: Date;
  endDate: Date;
  mentorName?: string;
  mentorDesignation?: string;
  description?: string;
  supportingDocuments?: string[];
}

@Injectable()
export class SelfIdentifiedService {
  private readonly logger = new Logger(SelfIdentifiedService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
    private readonly systemConfigService: SystemConfigService,
    private readonly expectedCycleService: ExpectedCycleService,
  ) {}

  async submitSelfIdentified(studentId: string, data: SubmitSelfIdentifiedDto) {
    try {
      this.logger.log(`Submitting self-identified internship for student ${studentId}`);

      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new NotFoundException('Student not found');
      }

      // Check if student already has an approved self-identified internship (active applications only)
      const existingSelfIdentified = await this.prisma.internshipApplication.findFirst({
        where: {
          studentId,
          isSelfIdentified: true,
          isActive: true,
          status: ApplicationStatus.APPROVED,
          internshipPhase: { in: [InternshipPhase.NOT_STARTED, InternshipPhase.ACTIVE] },
        },
      });

      if (existingSelfIdentified) {
        throw new BadRequestException('You already have an approved self-identified internship. Please edit the existing one instead of creating a new application.');
      }

      // Validate internship start date against minimum allowed date
      const minimumStartDateStr = await this.systemConfigService.get<string>('internship.minimumStartDate');
      if (minimumStartDateStr) {
        const minimumStartDate = new Date(minimumStartDateStr);
        const internshipStartDate = new Date(data.startDate);

        if (internshipStartDate < minimumStartDate) {
          const formattedMinDate = minimumStartDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
          throw new BadRequestException(
            `Internship start date cannot be before ${formattedMinDate}. Please select a valid start date.`
          );
        }
      }

      // Auto-approve self-identified internships
      const selfIdentified = await this.prisma.internshipApplication.create({
        data: {
          studentId,
          isSelfIdentified: true,
          companyName: data.companyName,
          companyAddress: data.companyAddress,
          companyEmail: data.companyEmail,
          companyContact: data.companyPhone,
          jobProfile: data.role,
          stipend: data.stipend !== undefined ? String(data.stipend) : null,
          startDate: data.startDate,
          endDate: data.endDate,
          additionalInfo: data.description,
          facultyMentorName: data.mentorName,
          facultyMentorDesignation: data.mentorDesignation,
          status: ApplicationStatus.APPROVED, // Auto-approved
          internshipPhase: InternshipPhase.ACTIVE, // Set internship as active
          reviewedAt: new Date(), // Mark as reviewed
        },
        include: {
          student: {
            include: {
              user: true,
              Institution: true,
            },
          },
        },
      });

      // Calculate expected reports/visits counts based on internship dates
      await this.expectedCycleService.recalculateExpectedCounts(selfIdentified.id);

      // Invalidate cache
      await this.cache.del(`self-identified:student:${studentId}`);

      // Audit: Self-identified internship submitted
      this.auditService.log({
        action: AuditAction.APPLICATION_SUBMIT,
        entityType: 'SelfIdentifiedInternship',
        entityId: selfIdentified.id,
        userId: student.userId,
        institutionId: student.institutionId,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.MEDIUM,
        description: `Self-identified internship submitted: ${data.companyName}`,
        newValues: {
          companyName: data.companyName,
          role: data.role,
          startDate: data.startDate,
          endDate: data.endDate,
          studentId,
        },
      }).catch(() => {});

      return selfIdentified;
    } catch (error) {
      this.logger.error(`Failed to submit self-identified internship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSelfIdentifiedByStudent(studentId: string) {
    try {
      const cacheKey = `self-identified:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.internshipApplication.findMany({
            where: { studentId, isSelfIdentified: true, isActive: true },
            include: {
              mentor: true,
            },
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get self-identified internships for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async approveSelfIdentified(id: string, mentorId: string, remarks?: string) {
    try {
      this.logger.log(`Approving self-identified internship ${id} by mentor ${mentorId}`);

      const selfIdentified = await this.prisma.internshipApplication.findUnique({
        where: { id },
      });

      if (!selfIdentified) {
        throw new NotFoundException('Self-identified internship not found');
      }

      if (!selfIdentified.isSelfIdentified) {
        throw new BadRequestException('Not a self-identified internship');
      }

      if (selfIdentified.status !== ApplicationStatus.APPLIED) {
        throw new BadRequestException('Can only approve pending self-identified internships');
      }

      const approved = await this.prisma.internshipApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.APPROVED,
          mentorId,
          reviewedAt: new Date(),
          reviewRemarks: remarks,
        },
        include: {
          student: {
            include: {
              user: true,
            },
          },
          mentor: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`self-identified:student:${selfIdentified.studentId}`);

      // Audit: Self-identified internship approved
      this.auditService.log({
        action: AuditAction.APPLICATION_APPROVE,
        entityType: 'SelfIdentifiedInternship',
        entityId: id,
        userId: mentorId,
        institutionId: approved.student.institutionId,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.MEDIUM,
        description: `Self-identified internship approved: ${selfIdentified.companyName}`,
        oldValues: { status: selfIdentified.status },
        newValues: { status: ApplicationStatus.APPROVED, mentorId, remarks },
      }).catch(() => {});

      return approved;
    } catch (error) {
      this.logger.error(`Failed to approve self-identified internship: ${error.message}`, error.stack);
      throw error;
    }
  }

  async rejectSelfIdentified(id: string, mentorId: string, reason: string) {
    try {
      this.logger.log(`Rejecting self-identified internship ${id} by mentor ${mentorId}`);

      const selfIdentified = await this.prisma.internshipApplication.findUnique({
        where: { id },
      });

      if (!selfIdentified) {
        throw new NotFoundException('Self-identified internship not found');
      }

      if (!selfIdentified.isSelfIdentified) {
        throw new BadRequestException('Not a self-identified internship');
      }

      if (selfIdentified.status !== ApplicationStatus.APPLIED) {
        throw new BadRequestException('Can only reject pending self-identified internships');
      }

      const rejected = await this.prisma.internshipApplication.update({
        where: { id },
        data: {
          status: ApplicationStatus.REJECTED,
          reviewedAt: new Date(),
          reviewRemarks: reason,
        },
        include: {
          student: {
            include: {
              user: true,
            },
          },
          mentor: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`self-identified:student:${selfIdentified.studentId}`);

      // Audit: Self-identified internship rejected
      this.auditService.log({
        action: AuditAction.APPLICATION_REJECT,
        entityType: 'SelfIdentifiedInternship',
        entityId: id,
        userId: mentorId,
        institutionId: rejected.student.institutionId,
        category: AuditCategory.INTERNSHIP_WORKFLOW,
        severity: AuditSeverity.MEDIUM,
        description: `Self-identified internship rejected: ${selfIdentified.companyName}`,
        oldValues: { status: selfIdentified.status },
        newValues: { status: ApplicationStatus.REJECTED, reason },
      }).catch(() => {});

      return rejected;
    } catch (error) {
      this.logger.error(`Failed to reject self-identified internship: ${error.message}`, error.stack);
      throw error;
    }
  }
}
