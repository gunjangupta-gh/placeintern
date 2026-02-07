import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from './token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { AccountLockoutService } from './account-lockout.service';
import { MfaService } from './mfa.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { User, AuditAction, AuditCategory, AuditSeverity, Role } from '../../../generated/prisma/client';

// SECURITY: Bcrypt salt rounds for password hashing
export const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private tokenBlacklistService: TokenBlacklistService,
    private accountLockoutService: AccountLockoutService,
    private mfaService: MfaService,
    private auditService: AuditService,
    private mailService: MailService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<any> {
    // Check if account is locked before proceeding
    const lockoutStatus = await this.accountLockoutService.isAccountLockedByEmail(email);
    if (lockoutStatus.isLocked) {
      this.logger.warn(`Login attempt on locked account: ${email}`);
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        description: `Login attempt on locked account: ${email}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        ipAddress,
        userAgent,
        newValues: { email, reason: 'account_locked', lockedUntil: lockoutStatus.lockedUntil },
      }).catch(() => {});
      // Security: Don't reveal exact lockout duration to prevent timing attacks
      throw new ForbiddenException(
        'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        Institution: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Note: mfaEnabled field is already included in the user object

    if (!user) {
      this.logger.warn(`User not found with email: ${email}`);
      // Log failed login attempt - user not found
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        description: `Failed login attempt - user not found: ${email}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.MEDIUM,
        ipAddress,
        userAgent,
        newValues: { email, reason: 'user_not_found' },
      }).catch(() => {}); // Non-blocking
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.active) {
      this.logger.warn(`Inactive account attempted login: ${email}`);
      // Log failed login attempt - inactive account
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        description: `Failed login attempt - account inactive: ${email}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        institutionId: user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: { email, reason: 'account_inactive' },
      }).catch(() => {}); // Non-blocking
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user: ${email}`);
      // Record failed attempt for account lockout
      const newLockoutStatus = await this.accountLockoutService.recordFailedAttempt(user.id);
      // Log failed login attempt - invalid password
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        description: `Failed login attempt - invalid password: ${email}`,
        category: AuditCategory.SECURITY,
        severity: newLockoutStatus.isLocked ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        institutionId: user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: {
          email,
          reason: 'invalid_password',
          remainingAttempts: newLockoutStatus.remainingAttempts,
          accountLocked: newLockoutStatus.isLocked,
        },
      }).catch(() => {}); // Non-blocking

      if (newLockoutStatus.isLocked) {
        // Security: Don't reveal exact lockout duration
        throw new ForbiddenException(
          'Too many failed attempts. Account is temporarily locked. Please try again later.',
        );
      }

      // Security: Don't reveal remaining attempts to prevent brute force guidance
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    await this.accountLockoutService.resetFailedAttempts(user.id);

    // Update login tracking (non-blocking - don't fail login if this fails)
    this.updateLoginTracking(user.id).catch((err) => {
      this.logger.warn(`Failed to update login tracking for user ${user.id}: ${err.message}`);
    });

    // Flatten institution data for easier frontend access
    const { password: _, Institution, ...result } = user;
    return {
      ...result,
      institutionName: Institution?.name || null,
      institutionCode: Institution?.code || null,
    };
  }

  /**
   * Validate student by roll number
   */
  async validateStudentByRollNumber(rollNumber: string, password: string, ipAddress?: string, userAgent?: string): Promise<any> {
    // Find student by roll number (rollNumber is now on User model)
    const student = await this.prisma.student.findFirst({
      where: { user: { rollNumber } },
      include: {
        user: {
          include: {
            Institution: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!student || !student.user) {
      this.logger.warn(`Student not found with roll number: ${rollNumber}`);
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        description: `Failed student login attempt - roll number not found: ${rollNumber}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.MEDIUM,
        ipAddress,
        userAgent,
        newValues: { rollNumber, reason: 'student_not_found' },
      }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = student.user;

    if (!user.active) {
      this.logger.warn(`Inactive student account attempted login: ${rollNumber}`);
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        description: `Failed student login attempt - account inactive: ${rollNumber}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        institutionId: user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: { rollNumber, reason: 'account_inactive' },
      }).catch(() => {});
      throw new UnauthorizedException('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for student: ${rollNumber}`);
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        description: `Failed student login attempt - invalid password: ${rollNumber}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.MEDIUM,
        institutionId: user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: { rollNumber, reason: 'invalid_password' },
      }).catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update login tracking
    this.updateLoginTracking(user.id).catch((err) => {
      this.logger.warn(`Failed to update login tracking for student ${user.id}: ${err.message}`);
    });

    // Flatten institution data
    const { password: _, Institution, ...result } = user;
    return {
      ...result,
      institutionName: Institution?.name || null,
      institutionCode: Institution?.code || null,
      rollNumber: student.user?.rollNumber,
    };
  }

  /**
   * Login user and return tokens
   * If MFA is enabled, returns mfaRequired: true instead of tokens
   */
  async login(user: any, ipAddress?: string, userAgent?: string) {
    // Check if user has MFA enabled
    if (user.mfaEnabled) {
      this.logger.log(`MFA required for user ${user.email}`);
      return {
        mfaRequired: true,
        userId: user.id,
        message: 'MFA verification required',
      };
    }

    return this.completeLogin(user, ipAddress, userAgent);
  }

  /**
   * Complete login after MFA verification
   */
  async loginWithMfa(
    userId: string,
    mfaCode: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Verify MFA code
    const isValid = await this.mfaService.verifyMfaCode(userId, mfaCode);

    if (!isValid) {
      this.logger.warn(`Invalid MFA code for user ${userId}`);
      this.auditService.log({
        action: AuditAction.FAILED_LOGIN,
        entityType: 'User',
        entityId: userId,
        userId: userId,
        description: `Failed MFA verification attempt`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        ipAddress,
        userAgent,
        newValues: { reason: 'invalid_mfa_code' },
      }).catch(() => {});
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Get full user data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        Institution: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Flatten user data
    const { password: _, Institution, ...userData } = user;
    const flattenedUser = {
      ...userData,
      institutionName: Institution?.name || null,
      institutionCode: Institution?.code || null,
    };

    return this.completeLogin(flattenedUser, ipAddress, userAgent);
  }

  /**
   * Complete login - issue tokens and create session
   * Called after password validation (and MFA if enabled)
   */
  private async completeLogin(user: any, ipAddress?: string, userAgent?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.role ? [user.role] : [],
    };

    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken(payload);

    // Create session record for admin tracking (non-blocking)
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days (matches refresh token)
    this.createUserSession(
      user.id,
      refreshToken,
      sessionExpiresAt,
      ipAddress,
      userAgent,
    ).catch((err) => {
      this.logger.warn(`Failed to create session for user ${user.id}: ${err.message}`);
    });

    // Log successful login
    this.auditService.log({
      action: AuditAction.USER_LOGIN,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role || Role.STUDENT,
      description: `User logged in successfully: ${user.email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.LOW,
      institutionId: user.institutionId || undefined,
      ipAddress,
      userAgent,
      newValues: {
        email: user.email,
        role: user.role,
        loginCount: user.loginCount,
        mfaUsed: user.mfaEnabled || false,
      },
    }).catch(() => {}); // Non-blocking

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
      needsPasswordChange: !user.hasChangedDefaultPassword,
    };
  }

  /**
   * Create a user session record for admin tracking
   */
  private async createUserSession(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const refreshTokenHash = this.hashToken(refreshToken);
    const deviceInfo = this.parseUserAgent(userAgent);

    return this.prisma.userSession.create({
      data: {
        userId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        deviceInfo,
        expiresAt,
        refreshTokenHash,
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * Hash a token for storage (security - don't store raw tokens)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Parse user agent to extract device info
   */
  private parseUserAgent(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';

    // Simple parsing for common patterns
    if (userAgent.includes('Mobile')) {
      if (userAgent.includes('Android')) return 'Android Mobile';
      if (userAgent.includes('iPhone')) return 'iPhone';
      if (userAgent.includes('iPad')) return 'iPad';
      return 'Mobile Device';
    }

    if (userAgent.includes('Windows')) return 'Windows Desktop';
    if (userAgent.includes('Mac OS')) return 'Mac Desktop';
    if (userAgent.includes('Linux')) return 'Linux Desktop';

    return 'Desktop Browser';
  }

  /**
   * Register new user
   */
  async register(userData: {
    email: string;
    password: string;
    name: string;
    phoneNo?: string;
    role?: any;
  }, ipAddress?: string, userAgent?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        phoneNo: userData.phoneNo,
        role: userData.role || 'STUDENT',
        active: true,
        loginCount: 0,
        hasChangedDefaultPassword: true,
      },
    });

    // Log user registration
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      description: `New user registered: ${user.email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.MEDIUM,
      ipAddress,
      userAgent,
      newValues: {
        email: user.email,
        name: user.name,
        role: user.role,
      },
    }).catch(() => {}); // Non-blocking

    const { password: _, ...result } = user;
    return this.login(result, ipAddress, userAgent);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.tokenService.verifyToken(refreshToken, true);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.active) {
        throw new UnauthorizedException('Account is inactive');
      }

      const { password: _, ...userWithoutPassword } = user;
      return this.login(userWithoutPassword);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Send password reset email (generates reset token)
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Security: Don't reveal if user exists
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = this.tokenService.generateAccessToken(
      { email, sub: user.id, type: 'reset' },
      '1h',
    );

    // Store reset token and expiry in database
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: expiryDate,
      },
    });

    // Send password reset email
    await this.mailService.sendPasswordResetEmail(user, resetToken);

    this.logger.log(`Password reset email queued for: ${email}`);

    return {
      message: 'If the email exists, a password reset link has been sent',
      // Return token in development for testing
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPassword: string) {
    // Verify the token
    let payload: any;
    try {
      payload = this.tokenService.verifyToken(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (payload.type !== 'reset') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find user with matching reset token
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        resetPasswordToken: token,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid reset token');
    }

    // Check if token has expired
    if (!user.resetPasswordExpiry || user.resetPasswordExpiry < new Date()) {
      throw new UnauthorizedException('Reset token has expired');
    }

    // Hash new password and update user
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        passwordChangedAt: new Date(),
        hasChangedDefaultPassword: true,
      },
    });

    // Log password reset
    this.auditService.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      description: `Password reset via token for: ${user.email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.HIGH,
      institutionId: user.institutionId || undefined,
    }).catch(() => {}); // Non-blocking

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      // Log failed password change attempt
      this.auditService.log({
        action: AuditAction.PASSWORD_CHANGE,
        entityType: 'User',
        entityId: userId,
        userId: userId,
        userName: user.name,
        userRole: user.role,
        description: `Failed password change attempt - invalid current password: ${user.email}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.MEDIUM,
        institutionId: user.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: { success: false, reason: 'invalid_current_password' },
      }).catch(() => {}); // Non-blocking
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is same as old
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        hasChangedDefaultPassword: true,
      },
    });

    // Log successful password change
    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGE,
      entityType: 'User',
      entityId: userId,
      userId: userId,
      userName: user.name,
      userRole: user.role,
      description: `Password changed successfully: ${user.email}`,
      category: AuditCategory.AUTHENTICATION,
      severity: AuditSeverity.MEDIUM,
      institutionId: user.institutionId || undefined,
      ipAddress,
      userAgent,
    }).catch(() => {}); // Non-blocking

    return { message: 'Password changed successfully' };
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNo: true,
        rollNumber: true,
        dob: true,
        branchName: true,
        designation: true,
        role: true,
        active: true,
        lastLoginAt: true,
        loginCount: true,
        hasChangedDefaultPassword: true,
        mfaEnabled: true,
        createdAt: true,
        institutionId: true,
        consent: true,
        consentAt: true,
        Institution: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get user's own unmasked contact details.
   * Used for revealing masked data in the user's own profile.
   */
  async getOwnUnmaskedContact(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        dob: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return with _unmasked flag to bypass security interceptor masking
    return {
      _unmasked: true,
      userId: user.id,
      name: user.name,
      email: user.email,
      phoneNo: user.phoneNo,
      dob: user.dob,
    };
  }

  /**
   * Update user profile
   * Syncs common fields to Student record if user is a student
   */
  async updateUserProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      phoneNo?: string;
      designation?: string;
      branchName?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { Student: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing email
    if (data.email && data.email !== user.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailExists) {
        throw new BadRequestException('Email already exists');
      }
    }

    // Build student update data for synced fields (if user is a student)
    const studentUpdateData: any = {};
    if (user.Student) {
      if (data.name) studentUpdateData.name = data.name;
      if (data.email) studentUpdateData.email = data.email;
      if (data.phoneNo !== undefined) studentUpdateData.contact = data.phoneNo; // User.phoneNo -> Student.contact
    }

    // Use transaction to sync User and Student records
    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.email && { email: data.email }),
          ...(data.phoneNo !== undefined && { phoneNo: data.phoneNo }),
          ...(data.designation !== undefined && { designation: data.designation }),
          ...(data.branchName !== undefined && { branchName: data.branchName }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phoneNo: true,
          rollNumber: true,
          dob: true,
          branchName: true,
          designation: true,
          role: true,
          active: true,
          lastLoginAt: true,
          loginCount: true,
          hasChangedDefaultPassword: true,
          createdAt: true,
          institutionId: true,
          Institution: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      // Sync to Student record if user is a student and there are fields to sync
      ...(user.Student && Object.keys(studentUpdateData).length > 0
        ? [this.prisma.student.update({
            where: { userId },
            data: studentUpdateData,
          })]
        : []),
    ]);

    // Audit log
    this.auditService.log({
      action: AuditAction.USER_PROFILE_UPDATE,
      entityType: 'User',
      entityId: userId,
      userId: userId,
      userName: updatedUser.name,
      userRole: user.role,
      description: `User updated their profile: ${updatedUser.email}`,
      category: AuditCategory.PROFILE_MANAGEMENT,
      severity: AuditSeverity.LOW,
      institutionId: user.institutionId || undefined,
      ipAddress,
      userAgent,
      oldValues: {
        name: user.name,
        email: user.email,
        phoneNo: user.phoneNo,
        designation: user.designation,
        branchName: user.branchName,
      },
      newValues: data,
    }).catch(() => {}); // Non-blocking

    return {
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
    };
  }

  /**
   * Update login tracking information
   */
  private async updateLoginTracking(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true, loginCount: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        previousLoginAt: user?.lastLoginAt || null,
        lastLoginAt: new Date(),
        loginCount: (user?.loginCount || 0) + 1,
      },
    });
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId, active: true },
    });
  }

  /**
   * Logout user - blacklist the current token and invalidate session
   */
  async logout(token: string, userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // Decode token to get expiration
      const decoded = this.tokenService.decodeToken(token);
      if (!decoded || !decoded.exp) {
        throw new BadRequestException('Invalid token');
      }

      const expiresAt = new Date(decoded.exp * 1000);

      // Blacklist the access token
      await this.tokenBlacklistService.blacklistToken(token, expiresAt);

      // Invalidate the session record for this user/device combination
      // We match by userId + IP/userAgent since we don't have the refresh token
      // This finds the most recent active session matching this device
      const sessionToInvalidate = await this.prisma.userSession.findFirst({
        where: {
          userId,
          invalidatedAt: null,
          ...(ipAddress && { ipAddress }),
          ...(userAgent && { userAgent }),
        },
        orderBy: { lastActivityAt: 'desc' },
      });

      if (sessionToInvalidate) {
        await this.prisma.userSession.update({
          where: { id: sessionToInvalidate.id },
          data: { invalidatedAt: new Date() },
        });
      }

      // Get user details for audit
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, role: true, institutionId: true },
      });

      // Log logout
      this.auditService.log({
        action: AuditAction.USER_LOGOUT,
        entityType: 'User',
        entityId: userId,
        userId: userId,
        userName: user?.name,
        userRole: user?.role || Role.STUDENT,
        description: `User logged out: ${user?.email}`,
        category: AuditCategory.AUTHENTICATION,
        severity: AuditSeverity.LOW,
        institutionId: user?.institutionId || undefined,
        ipAddress,
        userAgent,
      }).catch(() => {}); // Non-blocking

      this.logger.log(`User ${userId} logged out successfully`);
    } catch (error) {
      this.logger.error(`Failed to logout user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Extend session - called when user explicitly extends their session
   * Returns new tokens and updates session expiry
   */
  async extendSession(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Use the token service to refresh tokens (includes all security checks)
    const newTokens = await this.tokenService.refreshTokens(refreshToken);

    // Update the session record with new expiry and token hash
    const oldTokenHash = this.hashToken(refreshToken);
    const newTokenHash = this.hashToken(newTokens.refresh_token);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Find and update the session, or create new one if not found
    const existingSession = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash: oldTokenHash,
        invalidatedAt: null,
      },
    });

    if (existingSession) {
      await this.prisma.userSession.update({
        where: { id: existingSession.id },
        data: {
          refreshTokenHash: newTokenHash,
          expiresAt: newExpiresAt,
          lastActivityAt: new Date(),
          ipAddress: ipAddress || existingSession.ipAddress,
          userAgent: userAgent || existingSession.userAgent,
        },
      });
    }

    return newTokens;
  }

  /**
   * Update session activity - called on token refresh to track activity
   */
  async updateSessionActivity(refreshToken: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.userSession.updateMany({
        where: {
          refreshTokenHash: tokenHash,
          invalidatedAt: null,
        },
        data: {
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to update session activity', error);
      // Non-blocking - don't fail the request
    }
  }

  /**
   * Logout from all devices - invalidate all tokens for the user
   */
  async logoutAllDevices(userId: string): Promise<void> {
    try {
      await this.tokenBlacklistService.invalidateUserTokens(userId);

      // Invalidate all session records for this user
      await this.prisma.userSession.updateMany({
        where: {
          userId,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      this.logger.log(`All sessions invalidated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to logout all devices for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Force logout a user (admin action)
   */
  async forceLogout(targetUserId: string, adminUserId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      // Verify target user exists
      const user = await this.prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get admin details for audit
      const admin = await this.prisma.user.findUnique({
        where: { id: adminUserId },
        select: { name: true, email: true, role: true, institutionId: true },
      });

      // Invalidate all tokens for the target user
      await this.tokenBlacklistService.invalidateUserTokens(targetUserId);

      // Invalidate all session records for this user
      await this.prisma.userSession.updateMany({
        where: {
          userId: targetUserId,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      // Log force logout
      this.auditService.log({
        action: AuditAction.USER_LOGOUT,
        entityType: 'User',
        entityId: targetUserId,
        userId: adminUserId,
        userName: admin?.name,
        userRole: admin?.role || Role.SYSTEM_ADMIN,
        description: `Admin forced logout for user: ${user.email} (by ${admin?.email})`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        institutionId: admin?.institutionId || undefined,
        ipAddress,
        userAgent,
        newValues: {
          targetUserId,
          targetEmail: user.email,
          targetRole: user.role,
          initiatedBy: adminUserId,
        },
      }).catch(() => {}); // Non-blocking

      this.logger.log(
        `Admin ${adminUserId} forced logout for user ${targetUserId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to force logout user ${targetUserId} by admin ${adminUserId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Admin reset password - Generate random password and update user
   */
  async adminResetPassword(userId: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        institutionId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.active) {
      throw new BadRequestException('Cannot reset password for inactive user');
    }

    // Get admin details for audit
    let admin = null;
    if (adminUserId) {
      admin = await this.prisma.user.findUnique({
        where: { id: adminUserId },
        select: { name: true, email: true, role: true, institutionId: true },
      });
    }

    // Generate random password (8 characters: letters + numbers)
    const newPassword = this.generateRandomPassword();

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Update user with new password
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
        hasChangedDefaultPassword: false, // User must change on next login
        // Force logout from all devices
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    // Invalidate all existing tokens for this user
    await this.tokenBlacklistService.invalidateUserTokens(userId);

    // Log admin password reset
    this.auditService.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: userId,
      userId: adminUserId || userId,
      userName: admin?.name || user.name,
      userRole: admin?.role || Role.SYSTEM_ADMIN,
      description: `Admin reset password for user: ${user.email}${admin ? ` (by ${admin.email})` : ''}`,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.HIGH,
      institutionId: admin?.institutionId || user.institutionId || undefined,
      ipAddress,
      userAgent,
      newValues: {
        targetUserId: userId,
        targetEmail: user.email,
        targetRole: user.role,
        initiatedBy: adminUserId,
        forcePasswordChange: true,
      },
    }).catch(() => {}); // Non-blocking

    this.logger.log(`Admin reset password for user ${userId}`);

    // Send email notification with new password
    // Note: Sending passwords via email is not ideal, but necessary for admin-initiated resets
    await this.mailService.queueMail({
      to: user.email,
      subject: 'Your Password Has Been Reset',
      template: 'announcement',
      context: {
        name: user.name,
        title: 'Password Reset Notification',
        body: `Your account password has been reset by an administrator.\n\nYour new temporary password is: ${newPassword}\n\nPlease log in and change your password immediately for security purposes.\n\nIf you did not request this change, please contact support immediately.`,
      },
    });

    this.logger.log(`Password reset notification email queued for: ${user.email}`);

    return {
      success: true,
      userId: user.id,
      email: user.email,
      name: user.name,
      // Return password in development for testing
      newPassword: process.env.NODE_ENV === 'development' ? newPassword : undefined,
      message: 'Password reset successfully. User has been notified via email.',
    };
  }

  /**
   * Bulk reset passwords for multiple users
   */
  async bulkResetPasswords(userIds: string[], adminUserId?: string, ipAddress?: string, userAgent?: string) {
    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('No user IDs provided');
    }

    if (userIds.length > 100) {
      throw new BadRequestException('Cannot reset passwords for more than 100 users at once');
    }

    // Get admin details for audit
    let admin = null;
    if (adminUserId) {
      admin = await this.prisma.user.findUnique({
        where: { id: adminUserId },
        select: { name: true, email: true, role: true, institutionId: true },
      });
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const result = await this.adminResetPassword(userId, adminUserId, ipAddress, userAgent);
        results.push({
          userId,
          success: true,
          email: result.email,
          name: result.name,
          newPassword: result.newPassword,
        });
      } catch (error) {
        this.logger.error(`Failed to reset password for user ${userId}`, error);
        errors.push({
          userId,
          success: false,
          error: error.message || 'Failed to reset password',
        });
      }
    }

    // Log bulk operation summary
    this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'User',
      userId: adminUserId,
      userName: admin?.name,
      userRole: admin?.role || Role.SYSTEM_ADMIN,
      description: `Bulk password reset: ${results.length} successful, ${errors.length} failed out of ${userIds.length} users`,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      institutionId: admin?.institutionId || undefined,
      ipAddress,
      userAgent,
      newValues: {
        totalUsers: userIds.length,
        successful: results.length,
        failed: errors.length,
        failedUserIds: errors.map(e => e.userId),
        initiatedBy: adminUserId,
      },
    }).catch(() => {}); // Non-blocking

    return {
      total: userIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  /**
   * Generate cryptographically secure random password
   * Format: 12 characters (uppercase, lowercase, numbers, special chars)
   * Uses crypto.randomInt for secure random number generation
   */
  private generateRandomPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const all = uppercase + lowercase + numbers + special;

    const passwordChars: string[] = [];

    // SECURITY: Use crypto.randomInt for cryptographically secure random selection
    // Ensure at least one of each type for password policy compliance
    passwordChars.push(uppercase[crypto.randomInt(uppercase.length)]);
    passwordChars.push(lowercase[crypto.randomInt(lowercase.length)]);
    passwordChars.push(numbers[crypto.randomInt(numbers.length)]);
    passwordChars.push(special[crypto.randomInt(special.length)]);

    // Fill remaining characters (12 total for stronger passwords)
    for (let i = 4; i < 12; i++) {
      passwordChars.push(all[crypto.randomInt(all.length)]);
    }

    // SECURITY: Fisher-Yates shuffle using crypto.randomInt for unbiased shuffling
    for (let i = passwordChars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    return passwordChars.join('');
  }
}
