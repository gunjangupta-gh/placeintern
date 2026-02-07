import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Role, InstitutionType, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';

export interface CreateInstitutionData {
  name: string;
  code: string;
  type?: InstitutionType;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  pinCode?: string;
  country?: string;
  website?: string;
  establishedYear?: number;
  affiliatedTo?: string;
  recognizedBy?: string;
  naacGrade?: string;
  autonomousStatus?: boolean;
  totalStudentSeats?: number;
  totalStaffSeats?: number;
}

export interface CreatePrincipalData {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  designation?: string;
}

export interface CreateInstitutionResult {
  institution: any;
  principal?: any;
  temporaryPassword?: string;
}

@Injectable()
export class InstitutionService {
  private readonly logger = new Logger(InstitutionService.name);
  private readonly CACHE_TTL = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Map string type to InstitutionType enum
   */
  mapInstitutionType(type?: string): InstitutionType | undefined {
    if (!type) return undefined;

    const typeMapping: Record<string, InstitutionType> = {
      POLYTECHNIC: InstitutionType.POLYTECHNIC,
      ENGINEERING_COLLEGE: InstitutionType.ENGINEERING_COLLEGE,
      ENGINEERING: InstitutionType.ENGINEERING_COLLEGE,
      UNIVERSITY: InstitutionType.UNIVERSITY,
      DEGREE_COLLEGE: InstitutionType.DEGREE_COLLEGE,
      DEGREE: InstitutionType.DEGREE_COLLEGE,
      ITI: InstitutionType.ITI,
      SKILL_CENTER: InstitutionType.SKILL_CENTER,
      SKILL: InstitutionType.SKILL_CENTER,
    };

    return typeMapping[type.toUpperCase()];
  }

  /**
   * Check if institution code already exists
   */
  async codeExists(code: string): Promise<boolean> {
    const institution = await this.prisma.institution.findUnique({
      where: { code },
      select: { id: true },
    });
    return !!institution;
  }

  /**
   * Check if email already exists (for principal)
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    return !!user;
  }

  /**
   * Generate a secure default password
   */
  generateDefaultPassword(): string {
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
   * Create an institution with optional principal user
   * This is the shared business logic used by state.service and bulk-institution.service
   */
  async createInstitution(
    data: CreateInstitutionData,
    principalData?: CreatePrincipalData,
    options?: { skipValidation?: boolean },
  ): Promise<CreateInstitutionResult> {
    this.logger.log(`Creating institution: ${data.code}`);

    // Validation (unless skipped for bulk operations with pre-validation)
    if (!options?.skipValidation) {
      if (data.code && (await this.codeExists(data.code))) {
        throw new BadRequestException(`Institution with code ${data.code} already exists`);
      }

      if (principalData?.email && (await this.emailExists(principalData.email))) {
        throw new BadRequestException(`User with email ${principalData.email} already exists`);
      }
    }

    // Create institution
    const institution = await this.prisma.institution.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        contactEmail: data.email,
        contactPhone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state || 'Punjab',
        district: data.district,
        pinCode: data.pinCode,
        country: data.country || 'India',
        website: data.website,
        establishedYear: data.establishedYear,
        affiliatedTo: data.affiliatedTo,
        recognizedBy: data.recognizedBy,
        naacGrade: data.naacGrade,
        autonomousStatus: data.autonomousStatus ?? false,
        totalStudentSeats: data.totalStudentSeats,
        totalStaffSeats: data.totalStaffSeats,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            users: true,
            Student: true,
          },
        },
      },
    });

    let principal;
    let temporaryPassword;

    // Create principal user if data provided
    if (principalData?.name && principalData?.email) {
      temporaryPassword = principalData.password || this.generateDefaultPassword();
      const hashedPassword = await bcrypt.hash(temporaryPassword, BCRYPT_SALT_ROUNDS);

      principal = await this.prisma.user.create({
        data: {
          name: principalData.name,
          email: principalData.email.toLowerCase(),
          password: hashedPassword,
          role: Role.PRINCIPAL,
          phoneNo: principalData.phone,
          designation: principalData.designation || 'Principal',
          institutionId: institution.id,
          active: true,
          hasChangedDefaultPassword: false,
        },
      });

      this.logger.log(`Principal created for institution ${data.code}: ${principal.email}`);
    }

    // Invalidate cache
    await this.cache.del('institutions');
    await this.cache.del('state:dashboard:stats');

    this.logger.log(`Institution created successfully: ${institution.id}`);

    // Audit: Institution created
    this.auditService.log({
      action: AuditAction.INSTITUTION_CREATE,
      entityType: 'Institution',
      entityId: institution.id,
      institutionId: institution.id,
      userId: principal?.id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      description: `Institution created: ${data.name} (${data.code})`,
      newValues: {
        name: data.name,
        code: data.code,
        type: data.type,
        email: data.email,
        principalCreated: !!principal,
      },
    }).catch(() => {});

    return {
      institution,
      principal,
      temporaryPassword,
    };
  }

  /**
   * Update an institution
   */
  async updateInstitution(id: string, data: Partial<CreateInstitutionData>) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    const updated = await this.prisma.institution.update({
      where: { id },
      data: {
        name: data.name,
        shortName: undefined,
        type: data.type,
        contactEmail: data.email,
        contactPhone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        district: data.district,
        pinCode: data.pinCode,
        country: data.country,
        website: data.website,
        establishedYear: data.establishedYear,
        affiliatedTo: data.affiliatedTo,
        recognizedBy: data.recognizedBy,
        naacGrade: data.naacGrade,
        autonomousStatus: data.autonomousStatus,
        totalStudentSeats: data.totalStudentSeats,
        totalStaffSeats: data.totalStaffSeats,
      },
      include: {
        _count: {
          select: {
            users: true,
            Student: true,
          },
        },
      },
    });

    await this.cache.del(`institution:${id}`);
    await this.cache.del('institutions');

    // Audit: Institution updated
    this.auditService.log({
      action: AuditAction.INSTITUTION_UPDATE,
      entityType: 'Institution',
      entityId: id,
      institutionId: id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      description: `Institution updated: ${updated.name}`,
      changedFields: Object.keys(data).filter(k => data[k] !== undefined),
      newValues: data,
    }).catch(() => {});

    return updated;
  }

  /**
   * Delete an institution (soft delete)
   */
  async deleteInstitution(id: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    await this.prisma.institution.update({
      where: { id },
      data: { isActive: false },
    });

    await this.cache.del(`institution:${id}`);
    await this.cache.del('institutions');

    // Audit: Institution deleted
    this.auditService.log({
      action: AuditAction.INSTITUTION_DELETE,
      entityType: 'Institution',
      entityId: id,
      institutionId: id,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.CRITICAL,
      description: `Institution deactivated: ${institution.name} (${institution.code})`,
      oldValues: { isActive: true },
      newValues: { isActive: false },
    }).catch(() => {});

    return { success: true, message: 'Institution deleted successfully' };
  }

  /**
   * Get institution by ID
   */
  async getById(id: string) {
    const cacheKey = `institution:${id}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            Student: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    await this.cache.set(cacheKey, institution, this.CACHE_TTL);
    return institution;
  }

  /**
   * Bulk check for existing institution codes
   */
  async findExistingCodes(codes: string[]): Promise<Set<string>> {
    const existing = await this.prisma.institution.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    return new Set(existing.map((i) => i.code).filter(Boolean) as string[]);
  }

  /**
   * Bulk check for existing emails
   */
  async findExistingEmails(emails: string[]): Promise<Set<string>> {
    const normalizedEmails = emails.map((e) => e.toLowerCase());
    const existing = await this.prisma.user.findMany({
      where: { email: { in: normalizedEmails } },
      select: { email: true },
    });
    return new Set(existing.map((u) => u.email.toLowerCase()));
  }
}
