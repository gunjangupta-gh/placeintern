import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from './services/mfa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { IsString, Length } from 'class-validator';

/**
 * DTO for MFA verification
 */
class VerifyMfaDto {
  @IsString()
  @Length(6, 8) // TOTP is 6 digits, backup codes are 8 chars
  code: string;
}

/**
 * MFA Controller
 * Handles Multi-Factor Authentication operations
 * All endpoints require authentication
 */
@Controller('auth/mfa')
@UseGuards(JwtAuthGuard)
export class MfaController {
  constructor(private mfaService: MfaService) {}

  /**
   * Get MFA status for current user
   */
  @Get('status')
  async getMfaStatus(@CurrentUser() user: any) {
    return this.mfaService.getMfaStatus(user.userId);
  }

  /**
   * Generate MFA secret (step 1 of enabling MFA)
   * Returns QR code URL for authenticator apps
   */
  @Post('setup')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentUser() user: any) {
    return this.mfaService.generateMfaSecret(user.userId);
  }

  /**
   * Enable MFA after verifying TOTP code (step 2 of enabling MFA)
   * Returns backup codes (shown only once)
   */
  @Post('enable')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async enableMfa(
    @CurrentUser() user: any,
    @Body() body: VerifyMfaDto,
  ) {
    return this.mfaService.enableMfa(user.userId, body.code);
  }

  /**
   * Disable MFA for current user
   */
  @Post('disable')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async disableMfa(@CurrentUser() user: any) {
    return this.mfaService.disableMfa(user.userId);
  }

  /**
   * Verify MFA code (for login flow)
   */
  @Post('verify')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @CurrentUser() user: any,
    @Body() body: VerifyMfaDto,
  ) {
    const isValid = await this.mfaService.verifyMfaCode(user.userId, body.code);
    return { success: isValid };
  }

  /**
   * Regenerate backup codes
   * Returns new backup codes (old ones are invalidated)
   */
  @Post('backup-codes/regenerate')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(@CurrentUser() user: any) {
    const codes = await this.mfaService.regenerateBackupCodes(user.userId);
    return { backupCodes: codes };
  }
}
