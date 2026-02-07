import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { Prisma, Role, AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../../core/auth/services/auth.service';

@Injectable()
export class StatePrincipalService {
  private readonly logger = new Logger(StatePrincipalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get list of principals with filters
   * STATE can view both active and inactive principals using the active parameter
   */
  async getPrincipals(params: {
    institutionId?: string;
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
  }) {
    const { institutionId, page = 1, limit = 10, search, active } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { role: 'PRINCIPAL' };

    if (institutionId) {
      where.institutionId = institutionId;
    }

    // Filter by active status if specified (STATE can view inactive principals)
    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [principals, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          Institution: {
            select: { id: true, name: true, code: true, city: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: principals,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new principal account
   */
  async createPrincipal(data: {
    name: string;
    email: string;
    password: string;
    institutionId: string;
    phoneNo?: string;
    designation?: string;
  }, createdBy?: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException(`User with email ${data.email} already exists`);
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const principal = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: 'PRINCIPAL',
        active: true,
        hasChangedDefaultPassword: false,
      },
      include: { Institution: true },
    });

    // Audit principal creation
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'User',
      entityId: principal.id,
      userId: createdBy || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Principal account created: ${data.name} for ${institution.name}`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: data.institutionId,
      newValues: {
        userId: principal.id,
        name: data.name,
        email: data.email,
        role: Role.PRINCIPAL,
        institutionId: data.institutionId,
      },
    }).catch(() => {});

    // Remove password from response
    const { password: _, ...principalWithoutPassword } = principal;

    await this.cache.invalidateByTags(['state', 'principals']);
    return principalWithoutPassword;
  }

  /**
   * Get principal by ID
   */
  async getPrincipalById(id: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
      include: {
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    if (!principal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    return principal;
  }

  /**
   * Update principal by ID
   */
  async updatePrincipal(id: string, data: {
    name?: string;
    email?: string;
    phoneNo?: string;
    phone?: string;
    institutionId?: string;
    isActive?: boolean;
    active?: boolean;
    dob?: string;
    dateOfBirth?: string;
    designation?: string;
  }, updatedBy?: string) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    if (data.institutionId) {
      const institution = await this.prisma.institution.findUnique({
        where: { id: data.institutionId },
      });

      if (!institution) {
        throw new NotFoundException(`Institution with ID ${data.institutionId} not found`);
      }
    }

    // Check if email is being changed and if it's already in use
    if (data.email && data.email !== existingPrincipal.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException(`Email ${data.email} is already in use`);
      }
    }

    // Map frontend field names to Prisma field names
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.phoneNo || data.phone) updateData.phoneNo = data.phoneNo || data.phone;
    if (data.institutionId) updateData.institutionId = data.institutionId;
    if (data.designation) updateData.designation = data.designation;
    if (data.dob || data.dateOfBirth) updateData.dob = data.dob || data.dateOfBirth;
    if (typeof data.active === 'boolean') updateData.active = data.active;
    if (typeof data.isActive === 'boolean') updateData.active = data.isActive;

    const updatedPrincipal = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    // Audit principal update
    this.auditService.log({
      action: AuditAction.USER_PROFILE_UPDATE,
      entityType: 'User',
      entityId: id,
      userId: updatedBy || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Principal account updated: ${existingPrincipal.name}`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      institutionId: existingPrincipal.institutionId || undefined,
      oldValues: {
        name: existingPrincipal.name,
        email: existingPrincipal.email,
        active: existingPrincipal.active,
      },
      newValues: updateData,
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'principals']);
    return updatedPrincipal;
  }

  /**
   * Deactivate principal by ID (soft delete)
   */
  async deletePrincipal(id: string, deletedBy?: string) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    // Check if already deactivated
    if (existingPrincipal.active === false) {
      throw new BadRequestException('Principal is already deactivated');
    }

    // Soft delete - deactivate the principal
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });

    // Audit principal deactivation
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'User',
      entityId: id,
      userId: deletedBy || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Principal account deactivated: ${existingPrincipal.name}`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: existingPrincipal.institutionId || undefined,
      oldValues: {
        userId: id,
        name: existingPrincipal.name,
        email: existingPrincipal.email,
        role: Role.PRINCIPAL,
        wasActive: true,
      },
      newValues: {
        active: false,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'principals']);
    return { success: true, message: 'Principal deactivated successfully' };
  }

  /**
   * Toggle principal status (activate/deactivate)
   */
  async togglePrincipalStatus(id: string, toggledBy?: string) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    const currentStatus = existingPrincipal.active;
    const newStatus = !currentStatus;

    // Update principal status
    await this.prisma.user.update({
      where: { id },
      data: { active: newStatus },
    });

    // Audit principal status toggle
    this.auditService.log({
      action: newStatus ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION,
      entityType: 'User',
      entityId: id,
      userId: toggledBy || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Principal account ${newStatus ? 'activated' : 'deactivated'}: ${existingPrincipal.name}`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: existingPrincipal.institutionId || undefined,
      oldValues: { active: currentStatus },
      newValues: { active: newStatus },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'principals']);

    return {
      success: true,
      active: newStatus,
      message: `Principal ${newStatus ? 'activated' : 'deactivated'} successfully`,
    };
  }

  /**
   * Reset principal password
   */
  async resetPrincipalPassword(id: string, resetBy?: string) {
    const existingPrincipal = await this.prisma.user.findUnique({
      where: { id, role: 'PRINCIPAL' },
    });

    if (!existingPrincipal) {
      throw new NotFoundException(`Principal with ID ${id} not found`);
    }

    // Generate a new random password
    const newPassword = this.generateRandomPassword();

    this.logger.log(`Resetting password for principal: ${existingPrincipal.email}`);
    this.logger.log(`New password (plain): ${newPassword}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    this.logger.log(`New password (hashed): ${hashedPassword}`);

    // Update the user's password
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password updated in database for user: ${updatedUser.email}`);

    // Audit password reset
    this.auditService.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: id,
      userId: resetBy || 'SYSTEM',
      userRole: Role.STATE_DIRECTORATE,
      description: `Password reset for principal: ${existingPrincipal.name}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.HIGH,
      institutionId: existingPrincipal.institutionId || undefined,
      newValues: {
        userId: id,
        passwordReset: true,
      },
    }).catch(() => {});

    await this.cache.invalidateByTags(['state', 'principals']);

    return {
      success: true,
      message: 'Password reset successfully',
      newPassword, // Return the plain password so it can be shared with the user
    };
  }

  /**
   * Generate a random password
   */
  private generateRandomPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special char

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}
