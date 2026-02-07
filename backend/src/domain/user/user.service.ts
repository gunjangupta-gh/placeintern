import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Role, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';

export interface CreateStudentData {
  name: string;
  email: string;
  phoneNo?: string;
  rollNumber?: string;
  admissionNumber?: string;
  batchId: string;
  branchId?: string;
  branchName?: string;
  semesterId?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  parentName?: string;
  parentContact?: string;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  currentSemester?: number;
}

export interface CreateStaffData {
  name: string;
  email: string;
  phoneNo?: string;
  designation?: string;
  role: Role;
  departmentId?: string;
}

export interface CreateUserResult {
  user: any;
  student?: any;
  temporaryPassword: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly CACHE_TTL = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate a temporary password for new users
   * Format: first 4 chars of name + last 4 chars of identifier + @123
   */
  generateTemporaryPassword(name: string, identifier: string): string {
    const namePart = name.replace(/\s/g, '').substring(0, 4).toLowerCase();
    const idPart = identifier.slice(-4);
    return `${namePart}${idPart}@123`;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@#$%';
    const all = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < 10; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Check if email already exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Check if enrollment/admission number already exists (only active students)
   */
  async enrollmentExists(enrollmentNumber: string): Promise<boolean> {
    const student = await this.prisma.student.findFirst({
      where: { admissionNumber: enrollmentNumber, user: { active: true } },
      select: { id: true },
    });
    return !!student;
  }

  /**
   * Validate batch belongs to institution
   */
  async validateBatch(
    batchId: string,
    institutionId?: string,
  ): Promise<boolean> {
    // Batches are globally accessible - only check if batch exists and is active
    const batch = await this.prisma.batch.findFirst({
      where: { id: batchId, isActive: true },
      select: { id: true },
    });
    return !!batch;
  }

  /**
   * Create a student with associated user account
   * This is the shared business logic used by both principal.service and bulk-student.service
   */
  async createStudent(
    institutionId: string,
    data: CreateStudentData,
    options?: { password?: string; skipValidation?: boolean },
  ): Promise<CreateUserResult> {
    this.logger.log(`Creating student: ${data.email} for institution: ${institutionId}`);

    // Validation (unless skipped for bulk operations with pre-validation)
    if (!options?.skipValidation) {
      // Check email uniqueness
      if (await this.emailExists(data.email)) {
        throw new BadRequestException(`User with email ${data.email} already exists`);
      }

      // Check admission number uniqueness (if provided)
      if (data.admissionNumber && await this.enrollmentExists(data.admissionNumber)) {
        throw new BadRequestException(
          `Student with admission number ${data.admissionNumber} already exists`,
        );
      }

      // Validate batch exists and is active
      if (!(await this.validateBatch(data.batchId))) {
        throw new BadRequestException('Invalid or inactive batch');
      }
    }

    // Generate password
    const temporaryPassword =
      options?.password ||
      this.generateTemporaryPassword(data.name, data.admissionNumber || data.rollNumber || data.email);
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

    // Create user and student in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user account
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          password: hashedPassword,
          role: Role.STUDENT,
          phoneNo: data.phoneNo,
          dob: data.dateOfBirth,
          rollNumber: data.rollNumber,
          institutionId,
          active: true,
          hasChangedDefaultPassword: false,
        },
      });

      // Create student profile
      const student = await tx.student.create({
        data: {
          userId: user.id,
          admissionNumber: data.admissionNumber,
          address: data.address,
          gender: data.gender,
          parentName: data.parentName,
          parentContact: data.parentContact,
          tenthper: data.tenthPercentage,
          twelthper: data.twelfthPercentage,
          currentSemester: data.currentSemester,
          batchId: data.batchId,
          branchId: data.branchId,
          institutionId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
          batch: true,
          branch: true,
        },
      });

      return { user, student };
    });

    // Invalidate cache
    await this.cache.del(`students:${institutionId}`);

    this.logger.log(`Student created successfully: ${result.student.id}`);

    // Audit: Student created
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Student',
      entityId: result.student.id,
      userId: result.user.id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId,
      description: `Student created: ${data.name} (${data.admissionNumber || data.rollNumber})`,
      newValues: {
        name: data.name,
        email: data.email,
        admissionNumber: data.admissionNumber,
        rollNumber: data.rollNumber,
        batchId: data.batchId,
      },
    }).catch(() => {});

    return {
      user: result.user,
      student: result.student,
      temporaryPassword,
    };
  }

  /**
   * Create a staff member (teacher, faculty supervisor, etc.)
   */
  async createStaff(
    institutionId: string,
    data: CreateStaffData,
  ): Promise<CreateUserResult> {
    this.logger.log(`Creating staff: ${data.email} for institution: ${institutionId}`);

    // Check email uniqueness
    if (await this.emailExists(data.email)) {
      throw new BadRequestException(`User with email ${data.email} already exists`);
    }

    // Generate password
    const temporaryPassword = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: data.role,
        phoneNo: data.phoneNo,
        designation: data.designation,
        institutionId,
        active: true,
        hasChangedDefaultPassword: false,
      },
    });

    // Invalidate cache
    await this.cache.del(`staff:${institutionId}`);

    this.logger.log(`Staff created successfully: ${user.id}`);

    // Audit: Staff created
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'Staff',
      entityId: user.id,
      userId: user.id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      institutionId,
      description: `Staff created: ${data.name} (${data.role})`,
      newValues: {
        name: data.name,
        email: data.email,
        role: data.role,
        designation: data.designation,
      },
    }).catch(() => {});

    return {
      user,
      temporaryPassword,
    };
  }

  /**
   * Bulk check for existing emails
   * Returns set of emails that already exist
   */
  async findExistingEmails(emails: string[]): Promise<Set<string>> {
    const normalizedEmails = emails.map((e) => e.toLowerCase());
    const existing = await this.prisma.user.findMany({
      where: { email: { in: normalizedEmails } },
      select: { email: true },
    });
    return new Set(existing.map((u) => u.email.toLowerCase()));
  }

  /**
   * Bulk check for existing enrollment numbers
   * Returns set of enrollment numbers that already exist
   */
  async findExistingEnrollments(enrollments: string[]): Promise<Set<string>> {
    const existing = await this.prisma.student.findMany({
      where: { admissionNumber: { in: enrollments } },
      select: { admissionNumber: true },
    });
    return new Set(existing.map((s) => s.admissionNumber).filter(Boolean) as string[]);
  }

  /**
   * Get batch map (globally accessible - all batches)
   */
  async getBatchMap(institutionId?: string): Promise<Map<string, string>> {
    // Batches are globally accessible - no institution filter
    const batches = await this.prisma.batch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    // Normalize batch names: trim whitespace and lowercase
    return new Map(batches.map((b) => [b.name.trim().toLowerCase(), b.id]));
  }

  /**
   * Get branch map
   */
  async getBranchMap(): Promise<Map<string, string>> {
    const branches = await this.prisma.branch.findMany({
      select: { id: true, name: true },
    });
    // Normalize branch names: trim whitespace and lowercase
    return new Map(branches.map((b) => [b.name.trim().toLowerCase(), b.id]));
  }

  /**
   * Update student
   */
  async updateStudent(
    studentId: string,
    institutionId: string,
    data: Partial<CreateStudentData>,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, user: { active: true } },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Update user fields (name, phoneNo, rollNumber are on User)
    if (student.userId && (data.name || data.phoneNo || data.rollNumber)) {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.phoneNo && { phoneNo: data.phoneNo }),
          ...(data.rollNumber && { rollNumber: data.rollNumber }),
        },
      });
    }

    // Update student-specific fields
    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: {
        address: data.address,
        gender: data.gender,
        currentSemester: data.currentSemester,
      },
      include: {
        user: true,
        batch: true,
        branch: true,
      },
    });

    await this.cache.del(`student:${studentId}`);
    await this.cache.del(`students:${institutionId}`);

    // Audit: Student updated
    this.auditService.log({
      action: AuditAction.USER_PROFILE_UPDATE,
      entityType: 'Student',
      entityId: studentId,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId,
      description: `Student updated: ${updated.user?.name}`,
      changedFields: Object.keys(data).filter(k => data[k] !== undefined),
      newValues: data,
    }).catch(() => {});

    return updated;
  }

  /**
   * Soft delete student
   */
  async deleteStudent(studentId: string, institutionId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, user: { active: true } },
      include: { user: { select: { name: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found or already deleted');
    }

    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id: studentId },
        data: { user: { update: { active: false } } },
      }),
      this.prisma.user.update({
        where: { id: student.userId },
        data: { active: false },
      }),
    ]);

    await this.cache.del(`student:${studentId}`);
    await this.cache.del(`students:${institutionId}`);

    // Audit: Student deleted
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      institutionId,
      description: `Student deactivated: ${student.user?.name || studentId}`,
      oldValues: { active: true },
      newValues: { active: false },
    }).catch(() => {});

    return { success: true, message: 'Student deleted successfully' };
  }
}
