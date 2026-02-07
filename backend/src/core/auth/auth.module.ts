import { Module, Global } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { AccountLockoutService } from './services/account-lockout.service';
import { MfaService } from './services/mfa.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaService } from '../database/prisma.service';
import { LruCacheService } from '../cache/lru-cache.service';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { MailModule } from '../../infrastructure/mail/mail.module';

@Global()
@Module({
  imports: [
    AuditModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // Cast to satisfy JwtSignOptions typing (StringValue | number)
          expiresIn: configService.get<string>('JWT_EXPIRATION', '30m') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController, MfaController],
  providers: (() => {
    // Use a generic provider array type to allow conditionally pushing classes
    const baseProviders: Array<any> = [
      PrismaService,
      LruCacheService,
      AuthService,
      TokenService,
      TokenBlacklistService,
      AccountLockoutService,
      MfaService,
      PasswordPolicyService,
      JwtStrategy,
      JwtAuthGuard,
      OptionalJwtAuthGuard,
      RolesGuard,
    ];

    // Register GoogleStrategy only if OAuth credentials are configured
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      baseProviders.push(GoogleStrategy);
    } else {
      // eslint-disable-next-line no-console
      console.warn('Google OAuth not configured: skipping GoogleStrategy registration');
    }

    return baseProviders;
  })(),
  exports: [
    AuthService,
    TokenService,
    TokenBlacklistService,
    AccountLockoutService,
    MfaService,
    PasswordPolicyService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
