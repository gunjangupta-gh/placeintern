import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { TokenBlacklistService } from '../../../core/auth/services/token-blacklist.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import {
  AuditAction,
  AuditCategory,
  AuditSeverity,
  Role,
  Prisma,
} from '../../../generated/prisma/client';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  BulkUserActionDto,
} from '../dto/user-management.dto';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from '../../../core/auth/services/auth.service';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly wsService: WebSocketService,
  ) {}

  async getUsers(query: UserQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      institutionId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNo: { contains: search } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (institutionId) {
      where.institutionId = institutionId;
    }

    if (isActive !== undefined) {
      where.active = isActive;
    }

    const [users, total, roleStats] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          institutionId: true,
          phoneNo: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          Institution: {
            select: { name: true, code: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
    ]);

    // Transform role stats to object
    const roleStatsMap = roleStats.reduce((acc, stat) => {
      if (stat.role) {
        acc[stat.role] = stat._count.role;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      users: users.map((user) => ({
        ...user,
        institutionName: user.Institution?.name,
        institutionCode: user.Institution?.code,
        Institution: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      roleStats: roleStatsMap,
    };
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        institutionId: true,
        phoneNo: true,
        designation: true,
        branchName: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        hasChangedDefaultPassword: true,
        Institution: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createUser(dto: CreateUserDto, adminUserId: string, adminRole: Role) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Generate random password if not provided
    const password = dto.password || this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        phoneNo: dto.phoneNo,
        institutionId: dto.institutionId,
        branchName: dto.branchName,
        designation: dto.designation,
        active: true,
        hasChangedDefaultPassword: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        institutionId: true,
        createdAt: true,
      },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'User',
      entityId: user.id,
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      description: `User created by admin: ${user.email} (${user.role})`,
      newValues: { email: user.email, role: user.role },
    });

    return {
      user,
      temporaryPassword: dto.password ? undefined : password,
      message: 'User created successfully',
    };
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    adminUserId: string,
    adminRole: Role,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { Student: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    // Build student update data for synced fields (if user is a student)
    // Note: User.active is the source of truth, no need to sync to Student
    const studentUpdateData: any = {};
    if (existingUser.Student) {
      if (dto.name) studentUpdateData.name = dto.name;
      if (dto.email) studentUpdateData.email = dto.email;
      if (dto.phoneNo !== undefined) studentUpdateData.contact = dto.phoneNo; // User.phoneNo -> Student.contact
    }

    // Use transaction to sync User and Student records
    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.email && { email: dto.email }),
          ...(dto.role && { role: dto.role }),
          ...(dto.phoneNo !== undefined && { phoneNo: dto.phoneNo }),
          ...(dto.institutionId !== undefined && { institutionId: dto.institutionId }),
          ...(dto.active !== undefined && { active: dto.active }),
          ...(dto.branchName !== undefined && { branchName: dto.branchName }),
          ...(dto.designation !== undefined && { designation: dto.designation }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          institutionId: true,
          createdAt: true,
        },
      }),
      // Sync to Student record if user is a student and there are fields to sync
      ...(existingUser.Student && Object.keys(studentUpdateData).length > 0
        ? [this.prisma.student.update({
            where: { userId },
            data: studentUpdateData,
          })]
        : []),
    ]);

    // If user was deactivated, invalidate all tokens
    if (dto.active === false && existingUser.active === true) {
      await this.tokenBlacklistService.invalidateUserTokens(userId);
    }

    // Audit log
    await this.auditService.log({
      action: dto.active === false ? AuditAction.USER_DEACTIVATION : AuditAction.USER_ACTIVATION,
      entityType: 'User',
      entityId: userId,
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      description: `User ${dto.active === false ? 'deactivated' : 'activated'} by admin: ${updatedUser.email}`,
      oldValues: {
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        active: existingUser.active,
      },
      newValues: dto,
      changedFields: Object.keys(dto),
    });

    return { user: updatedUser, message: 'User updated successfully' };
  }

  async deleteUser(
    userId: string,
    permanent: boolean,
    adminUserId: string,
    adminRole: Role,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent self-deletion
    if (userId === adminUserId) {
      throw new BadRequestException('Cannot delete your own account');
    }

    // Invalidate all tokens
    await this.tokenBlacklistService.invalidateUserTokens(userId);

    if (permanent) {
      // Hard delete - delete notifications first (required relation without cascade)
      await this.prisma.notification.deleteMany({ where: { userId } });
      await this.prisma.user.delete({
        where: { id: userId },
      });
    } else {
      // Soft delete - deactivate user (User.active is the source of truth)
      // Note: Mentor assignments are permanently deactivated - new assignments must be created when user is reactivated
      await this.prisma.$transaction([
        // If this user is a mentor, deactivate active mentor assignments (irreversible)
        this.prisma.mentorAssignment.updateMany({
          where: { mentorId: userId, isActive: true },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivationReason: 'Faculty mentor deactivated',
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { active: false },
        }),
      ]);
    }

    // Audit log
    await this.auditService.log({
      action: permanent ? AuditAction.USER_DELETION : AuditAction.USER_DEACTIVATION,
      entityType: 'User',
      entityId: userId,
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.USER_MANAGEMENT,
      severity: permanent ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      description: `User ${permanent ? 'permanently deleted' : 'deactivated'}: ${user.email}`,
      oldValues: { 
        email: user.email, 
        role: user.role,
        name: user.name,
        active: user.active,
        institutionId: user.institutionId,
      },
      newValues: {
        permanent,
        deletedAt: new Date().toISOString(),
      },
    });

    return {
      success: true,
      permanent,
      message: permanent ? 'User permanently deleted' : 'User deactivated',
    };
  }

  async bulkAction(
    dto: BulkUserActionDto,
    adminUserId: string,
    adminRole: Role,
  ) {
    const { action, userIds } = dto;
    const results = { processed: 0, failed: 0, errors: [] as any[] };

    // Prevent actions on own account
    const filteredUserIds = userIds.filter((id) => id !== adminUserId);
    const total = filteredUserIds.length;
    const operationId = `bulk-${action}-${Date.now()}`;

    // Emit initial progress
    this.wsService.sendBulkOperationProgress({
      operationId,
      type: action,
      progress: 0,
      total,
      completed: 0,
    });

    for (let i = 0; i < filteredUserIds.length; i++) {
      const userId = filteredUserIds[i];
      try {
        switch (action) {
          case 'activate':
            await this.prisma.user.update({
              where: { id: userId },
              data: { active: true },
            });
            break;
          case 'deactivate':
            await this.prisma.$transaction([
              // If this user is a mentor, deactivate active mentor assignments (irreversible)
              this.prisma.mentorAssignment.updateMany({
                where: { mentorId: userId, isActive: true },
                data: {
                  isActive: false,
                  deactivatedAt: new Date(),
                  deactivationReason: 'Faculty mentor deactivated',
                },
              }),
              this.prisma.user.update({
                where: { id: userId },
                data: { active: false },
              }),
            ]);
            await this.tokenBlacklistService.invalidateUserTokens(userId);
            break;
          case 'delete':
            await this.prisma.$transaction([
              // If this user is a mentor, deactivate active mentor assignments (irreversible)
              this.prisma.mentorAssignment.updateMany({
                where: { mentorId: userId, isActive: true },
                data: {
                  isActive: false,
                  deactivatedAt: new Date(),
                  deactivationReason: 'Faculty mentor deactivated',
                },
              }),
              this.prisma.user.update({
                where: { id: userId },
                data: { active: false },
              }),
            ]);
            await this.tokenBlacklistService.invalidateUserTokens(userId);
            break;
          case 'resetPassword':
            const newPassword = this.generateRandomPassword();
            const hashedPwd = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
            await this.prisma.user.update({
              where: { id: userId },
              data: {
                password: hashedPwd,
                hasChangedDefaultPassword: false,
              },
            });
            await this.tokenBlacklistService.invalidateUserTokens(userId);
            break;
        }
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({ userId, error: error.message });
      }

      // Emit progress update every 5 users or on last user
      if ((i + 1) % 5 === 0 || i === filteredUserIds.length - 1) {
        this.wsService.sendBulkOperationProgress({
          operationId,
          type: action,
          progress: Math.round(((i + 1) / total) * 100),
          total,
          completed: i + 1,
        });
      }
    }

    // Audit log
    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'User',
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      description: `Bulk ${action} on ${results.processed} users`,
      newValues: { action, userCount: results.processed, failed: results.failed },
    });

    return results;
  }

  async resetPassword(
    userId: string,
    adminUserId: string,
    adminRole: Role,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newPassword = this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        hasChangedDefaultPassword: false,
        passwordChangedAt: new Date(),
      },
    });

    // Invalidate all existing tokens
    await this.tokenBlacklistService.invalidateUserTokens(userId);

    // Audit log
    await this.auditService.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: userId,
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      description: `Password reset by admin for user: ${user.email}`,
    });

    return {
      success: true,
      temporaryPassword: newPassword,
      message: 'Password reset successfully. User must change password on next login.',
    };
  }

  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
