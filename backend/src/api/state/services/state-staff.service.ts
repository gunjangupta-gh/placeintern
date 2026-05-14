import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { AccountLockoutService } from '../../../core/auth/services/account-lockout.service';
import { Prisma, Role, Designation, AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../../core/auth/services/auth.service';

/**
 * StateStaffService
 * Handles staff management operations for the state directorate
 * Extracted from StateService for better separation of concerns
 */
@Injectable()
export class StateStaffService {
  private readonly logger = new Logger(StateStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
    private readonly accountLockoutService: AccountLockoutService,
  ) {}

  /**
   * Get all staff across institutions with filtering
   */
  async getStaff(params: {
    institutionId?: string;
    role?: string;
    staffType?: string;
    branchName?: string;
    designationEnum?: string;
    search?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      institutionId,
      role,
      staffType,
      branchName,
      designationEnum,
      search,
      active,
      page = 1,
      limit = 10,
    } = params;
    const skip = (page - 1) * limit;

    // Staff roles - TEACHER (excluding PRINCIPAL, STUDENT, STATE_DIRECTORATE, SYSTEM_ADMIN)
    const staffRoles: Role[] = [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF];

    let roleFilter: Prisma.UserWhereInput['role'] = { in: staffRoles };

    if (role) {
      roleFilter = role as Role;
    } else if (staffType === 'teaching') {
      roleFilter = { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] };
    } else if (staffType === 'admin') {
      roleFilter = Role.ADMIN_STAFF;
    }

    const where: Prisma.UserWhereInput = {
      role: roleFilter,
    };

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (branchName) {
      where.branchName = { contains: branchName, mode: 'insensitive' };
    }

    if (designationEnum) {
      where.designationEnum = designationEnum as Designation;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [staff, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNo: true,
          role: true,
          branchName: true,
          designation: true,
          designationEnum: true,
          guestTeacher: true,
          active: true,
          createdAt: true,
          lastLoginAt: true,
          Institution: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: staff,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new staff member
   */
  async createStaff(data: {
    name: string;
    email: string;
    password: string;
    institutionId: string;
    role: string;
    phoneNo?: string;
    branchId?: string;
    branchName?: string;
    designation?: string;
    designationEnum?: string;
  }) {
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

    // Staff capacity validation (warning only - non-blocking)
    let warningText: string | undefined;

    // Resolve branchId from branchName if not provided directly
    let branchId = data.branchId;
    if (!branchId && data.branchName) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          OR: [
            { name: data.branchName },
            { shortName: data.branchName },
          ],
        },
        select: { id: true },
      });
      branchId = branch?.id;
    }

    if (branchId) {
      // Get current academic year (format: "2024-25")
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth(); // 0-indexed
      // Academic year starts in July, so if before July, use previous year
      const academicStartYear = currentMonth < 6 ? currentYear - 1 : currentYear;
      const academicYear = `${academicStartYear}-${(academicStartYear + 1).toString().slice(-2)}`;

      const capacity = await this.prisma.branchStaffCapacity.findFirst({
        where: {
          institutionId: data.institutionId,
          branchId: branchId,
          isActive: true,
          academicYear,
        },
      });

      if (capacity && capacity.sanctionedPosts > 0) {
        // Count current regular staff (not guest faculty)
        const currentCount = await this.prisma.user.count({
          where: {
            institutionId: data.institutionId,
            branchId: branchId,
            role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF] },
            active: true,
            guestTeacher: { not: true },
          },
        });

        if (currentCount >= capacity.sanctionedPosts) {
          warningText = `Staff capacity exceeded: ${currentCount + 1} filled posts for ${capacity.sanctionedPosts} sanctioned posts in this branch.`;
          this.logger.warn(`Staff capacity exceeded for institution: ${data.institutionId}, branch: ${branchId}`);
        }
      }
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    const staff = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as Role,
        institutionId: data.institutionId,
        phoneNo: data.phoneNo,
        branchId: branchId || null,
        branchName: data.branchName,
        designation: data.designation,
        designationEnum: data.designationEnum ? (data.designationEnum as Designation) : undefined,
        active: true,
        hasChangedDefaultPassword: false,
      },
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    await this.cache.invalidateByTags(['state', 'staff']);

    // Return staff with optional warning
    return {
      ...staffWithoutPassword,
      _warning: warningText,
    };
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(id: string) {
    const staffRoles: Role[] = [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF];

    const staff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        role: true,
        branchName: true,
        designation: true,
        designationEnum: true,
        guestTeacher: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
        institutionId: true,
        Institution: {
          select: { id: true, name: true, code: true, city: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return staff;
  }

  /**
   * Update staff member by ID
   */
  async updateStaff(id: string, data: {
    name?: string;
    email?: string;
    institutionId?: string;
    role?: string;
    phoneNo?: string;
    branchId?: string;
    branchName?: string;
    designation?: string;
    designationEnum?: string;
    isActive?: boolean;
    active?: boolean;
  }) {
    const staffRoles: Role[] = [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
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
    if (data.email && data.email !== existingStaff.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException(`Email ${data.email} is already in use`);
      }
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.institutionId !== undefined) updateData.Institution = { connect: { id: data.institutionId } };
    if (data.role !== undefined) updateData.role = data.role as Role;
    if (data.phoneNo !== undefined) updateData.phoneNo = data.phoneNo;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.designationEnum !== undefined) updateData.designationEnum = data.designationEnum as Designation;
    if (data.isActive !== undefined) updateData.active = data.isActive;
    if (data.active !== undefined) updateData.active = data.active;

    // Handle branch sync: keep branchId and branchName in sync
    if (data.branchId !== undefined) {
      // If branchId is provided, fetch the branch and update both fields
      const branch = await this.prisma.branch.findUnique({
        where: { id: data.branchId },
        select: { id: true, name: true, shortName: true },
      });

      if (!branch) {
        throw new NotFoundException(`Branch with ID ${data.branchId} not found`);
      }

      updateData.branch = { connect: { id: branch.id } };
      updateData.branchName = branch.shortName || branch.name;
    } else if (data.branchName !== undefined) {
      // If only branchName is provided, resolve it to branchId and update both
      const branch = await this.prisma.branch.findFirst({
        where: {
          OR: [
            { name: data.branchName },
            { shortName: data.branchName },
          ],
        },
        select: { id: true, name: true, shortName: true },
      });

      if (branch) {
        updateData.branch = { connect: { id: branch.id } };
        updateData.branchName = branch.shortName || branch.name;
      } else {
        // If branch not found, just update branchName and disconnect branch relation
        updateData.branchName = data.branchName;
        updateData.branch = { disconnect: true };
      }
    }

    const staff = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { Institution: true },
    });

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    await this.cache.invalidateByTags(['state', 'staff']);
    return staffWithoutPassword;
  }

  /**
   * Delete staff member by ID
   */
  async deleteStaff(id: string) {
    const staffRoles: Role[] = [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    if (!existingStaff.active) {
      throw new BadRequestException('Staff member is already deactivated');
    }

    // Soft delete - deactivate user account and any active mentor assignments
    // (prevents active assignments pointing to an inactive mentor)
    await this.prisma.$transaction([
      this.prisma.mentorAssignment.updateMany({
        where: { mentorId: id, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id },
        data: { active: false },
      }),
    ]);

    // Audit logging for staff deactivation
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Staff',
      entityId: id,
      userId: id,
      userName: existingStaff.name,
      userRole: existingStaff.role,
      description: `Staff member deactivated: ${existingStaff.name} (${existingStaff.email})`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: existingStaff.institutionId,
      oldValues: {
        active: true,
        name: existingStaff.name,
        email: existingStaff.email,
        role: existingStaff.role,
      },
      newValues: { active: false },
    }).catch(() => {}); // Non-blocking audit

    await this.cache.invalidateByTags(['state', 'staff']);

    return { success: true, message: 'Staff member deactivated successfully' };
  }

  /**
   * Delete faculty member by ID (FACULTY_SUPERVISOR or TEACHER only)
   * Uses soft delete to preserve mentor assignment history and audit trail
   */
  async deleteFaculty(id: string) {
    const facultyRoles: Role[] = [Role.TEACHER, Role.FACULTY_COORDINATOR];

    const existingFaculty = await this.prisma.user.findUnique({
      where: { id, role: { in: facultyRoles } },
    });

    if (!existingFaculty) {
      throw new NotFoundException(`Faculty member with ID ${id} not found`);
    }

    if (!existingFaculty.active) {
      throw new BadRequestException('Faculty member is already deactivated');
    }

    // Soft delete - deactivate mentor assignments and user account
    await this.prisma.$transaction([
      // Deactivate active mentor assignments (preserve historical data)
      this.prisma.mentorAssignment.updateMany({
        where: { mentorId: id, isActive: true },
        data: { isActive: false, deactivatedAt: new Date() },
      }),
      // Deactivate the user account
      this.prisma.user.update({
        where: { id },
        data: { active: false },
      }),
    ]);

    // Audit logging for faculty deactivation
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Faculty',
      entityId: id,
      userId: id,
      userName: existingFaculty.name,
      userRole: existingFaculty.role,
      description: `Faculty member deactivated: ${existingFaculty.name} (${existingFaculty.email})`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: existingFaculty.institutionId,
      oldValues: {
        active: true,
        name: existingFaculty.name,
        email: existingFaculty.email,
        role: existingFaculty.role,
      },
      newValues: { active: false },
    }).catch(() => {}); // Non-blocking audit

    await this.cache.invalidateByTags(['state', 'staff', 'faculty']);

    return { success: true, message: 'Faculty member deactivated successfully' };
  }

  /**
   * Toggle faculty status (activate/deactivate)
   * Uses soft delete to preserve mentor assignment history and audit trail
   */
  async toggleFacultyStatus(id: string) {
    const facultyRoles: Role[] = [Role.TEACHER];

    const existingFaculty = await this.prisma.user.findUnique({
      where: { id, role: { in: facultyRoles } },
    });

    if (!existingFaculty) {
      throw new NotFoundException(`Faculty member with ID ${id} not found`);
    }

    const currentStatus = existingFaculty.active;
    const newStatus = !currentStatus;

    if (!newStatus) {
      // Deactivating: soft delete mentor assignments (irreversible) and deactivate user
      // Note: Mentor assignments are permanently deactivated - new assignments must be created when user is reactivated
      // Faculty visits by this mentor are preserved for historical records
      await this.prisma.$transaction([
        this.prisma.mentorAssignment.updateMany({
          where: { mentorId: id, isActive: true },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Faculty mentor deactivated',
          },
        }),
        this.prisma.user.update({
          where: { id },
          data: { active: false },
        }),
      ]);
    } else {
      // Activating: only reactivate user - mentor assignments remain deactivated
      // New mentor assignments must be created fresh
      await this.prisma.user.update({
        where: { id },
        data: { active: true },
      });
    }

    await this.cache.invalidateByTags(['state', 'staff', 'faculty']);

    // Audit log the status toggle
    this.auditService.log({
      action: newStatus ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION,
      entityType: 'Faculty',
      entityId: id,
      userId: id,
      userName: existingFaculty.name,
      userRole: existingFaculty.role,
      description: `Faculty member ${newStatus ? 'activated' : 'deactivated'}: ${existingFaculty.name} (${existingFaculty.email})`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: existingFaculty.institutionId,
      oldValues: { active: currentStatus },
      newValues: { active: newStatus },
    }).catch(() => {}); // Non-blocking audit

    return {
      success: true,
      active: newStatus,
      message: `Faculty member ${newStatus ? 'activated' : 'deactivated'} successfully. Mentor assignments also ${newStatus ? 'reactivated' : 'deactivated'}.`,
    };
  }

  /**
   * Reset staff member password
   */
  async resetStaffPassword(id: string) {
    const staffRoles: Role[] = [Role.TEACHER];

    const existingStaff = await this.prisma.user.findUnique({
      where: { id, role: { in: staffRoles } },
    });

    if (!existingStaff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    // Generate a new random password
    const newPassword = this.generateRandomPassword();

    this.logger.log(`Resetting password for staff: ${existingStaff.email}`);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update the user's password
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword, hasChangedDefaultPassword: false },
    });

    await this.cache.invalidateByTags(['state', 'staff']);

    return {
      success: true,
      message: 'Password reset successfully',
      newPassword, // Return the plain password so it can be shared with the user
    };
  }

  /**
   * Get all users for credentials management
   */
  async getUsers(params: {
    role?: string;
    institutionId?: string;
    search?: string;
    active?: boolean;
    locked?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { role, institutionId, search, active, locked, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as Role;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (locked !== undefined) {
      if (locked) {
        where.lockedUntil = { gt: new Date() };
      } else {
        where.OR = [
          { lockedUntil: null },
          { lockedUntil: { lte: new Date() } },
        ];
      }
    }

    if (search) {
      const searchConditions: Prisma.UserWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          institutionId: true,
          lastLoginAt: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          Institution: {
            select: { id: true, name: true },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const now = Date.now();
    const enrichedUsers = users.map((user) => {
      const isLocked = !!user.lockedUntil && user.lockedUntil.getTime() > now;
      const lockoutMinutesRemaining = isLocked
        ? Math.ceil((user.lockedUntil!.getTime() - now) / (1000 * 60))
        : 0;

      return {
        ...user,
        isLocked,
        lockoutMinutesRemaining,
      };
    });

    return {
      data: enrichedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async unlockUserAccount(id: string, unlockedBy?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        institutionId: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const wasLocked = !!existingUser.lockedUntil && existingUser.lockedUntil > new Date();
    await this.accountLockoutService.unlockAccount(id, unlockedBy);

    await this.cache.invalidateByTags(['state', 'staff']);

    await this.auditService.log({
      action: AuditAction.USER_PROFILE_UPDATE,
      entityType: 'User',
      entityId: id,
      userId: unlockedBy,
      userName: existingUser.name,
      userRole: Role.STATE_DIRECTORATE,
      description: `Account lock cleared for user ${existingUser.email}`,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.HIGH,
      institutionId: existingUser.institutionId,
      oldValues: {
        failedLoginAttempts: existingUser.failedLoginAttempts,
        lockedUntil: existingUser.lockedUntil,
      },
      newValues: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }).catch(() => {});

    return {
      success: true,
      message: wasLocked
        ? 'Account unlocked successfully'
        : 'Account lock was already cleared',
      data: {
        userId: id,
        wasLocked,
      },
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
