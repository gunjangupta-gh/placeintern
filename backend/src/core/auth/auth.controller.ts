import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  StudentLoginDto,
  UpdateProfileDto,
  AdminResetPasswordDto,
  BulkResetPasswordDto,
  MfaLoginDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
  ) {}

  /**
   * Login endpoint
   * SECURITY: Rate limited to 5 attempts per minute to prevent brute force attacks
   */
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
      ipAddress,
      userAgent,
    );
    return this.authService.login(user, ipAddress, userAgent);
  }

  /**
   * Student login endpoint - login with roll number
   * SECURITY: Rate limited to 5 attempts per minute to prevent brute force attacks
   */
  @Public()
  @Post('student-login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async studentLogin(
    @Body() studentLoginDto: StudentLoginDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const user = await this.authService.validateStudentByRollNumber(
      studentLoginDto.rollNumber,
      studentLoginDto.password,
      ipAddress,
      userAgent,
    );
    return this.authService.login(user, ipAddress, userAgent);
  }

  /**
   * MFA Login verification endpoint
   * Called after initial login when user has MFA enabled
   * SECURITY: Rate limited to 5 attempts per minute
   */
  @Public()
  @Post('login/mfa')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async loginWithMfa(
    @Body() mfaLoginDto: MfaLoginDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.loginWithMfa(
      mfaLoginDto.userId,
      mfaLoginDto.code,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Register endpoint
   * SECURITY: Rate limited to 3 attempts per minute to prevent mass registration
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  /**
   * Refresh token endpoint
   * SECURITY: Rate limited to 30 requests per minute
   */
  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const tokens = await this.tokenService.refreshTokens(refreshTokenDto.refresh_token);

    // Update session activity (non-blocking) - tracks that user is still active
    this.authService.updateSessionActivity(refreshTokenDto.refresh_token).catch(() => {});

    return tokens;
  }

  /**
   * Extend session endpoint - explicitly extends the user's session
   * Called when user clicks "Extend Session" in the session expiry modal
   * SECURITY: Rate limited to 10 requests per minute
   */
  @Public()
  @Post('extend-session')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async extendSession(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.extendSession(
      refreshTokenDto.refresh_token,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Forgot password endpoint
   * SECURITY: Rate limited to 3 attempts per minute to prevent abuse
   */
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  /**
   * Reset password endpoint
   * SECURITY: Rate limited to 5 attempts per minute to prevent token guessing
   */
  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }

  /**
   * Change password endpoint (requires authentication)
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.changePassword(
      user.userId,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return this.authService.getUserProfile(user.userId);
  }

  /**
   * Get current user's unmasked contact details (own profile)
   */
  @Get('me/unmasked-contact')
  @UseGuards(JwtAuthGuard)
  async getOwnUnmaskedContact(@CurrentUser() user: any) {
    return this.authService.getOwnUnmaskedContact(user.userId);
  }

  /**
   * Update current user profile
   */
  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.updateUserProfile(
      user.userId,
      updateProfileDto,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Headers('authorization') authorization: string,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    const token = authorization?.replace('Bearer ', '');

    if (token) {
      await this.authService.logout(token, user.userId, ipAddress, userAgent);
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices endpoint
   * Allows users to invalidate all their sessions across all devices
   */
  @Post('logout-all-devices')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAllDevices(@CurrentUser() user: any) {
    await this.authService.logoutAllDevices(user.userId);
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Google OAuth login
   */
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // Initiates the Google OAuth2 login flow
  }

  /**
   * Google OAuth callback
   */
  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req) {
    return this.authService.login(req.user);
  }

  /**
   * Admin reset user password
   * SECURITY: Rate limited to 10 requests per minute to prevent abuse
   */
  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN, Role.PRINCIPAL)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(
    @Body() body: AdminResetPasswordDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.adminResetPassword(body.userId, user.userId, ipAddress, userAgent);
  }

  /**
   * Admin bulk reset passwords
   * SECURITY: Rate limited to 5 requests per minute due to bulk operation nature
   */
  @Post('admin/bulk-reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async bulkResetPasswords(
    @Body() body: BulkResetPasswordDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];
    return this.authService.bulkResetPasswords(body.userIds, user.userId, ipAddress, userAgent);
  }

}
