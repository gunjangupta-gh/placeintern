import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from './core/database/prisma.module';
import { AuthModule } from './core/auth/auth.module';
import { CacheModule } from './core/cache/cache.module';
import { QueueModule } from './core/queue/queue.module';

// Security
import { AllExceptionsFilter } from './core/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './core/common/interceptors/logging.interceptor';
import { SecurityInterceptor } from './core/common/interceptors/security.interceptor';
import { CustomThrottleGuard } from './core/common/guards/throttle.guard';
import { THROTTLE_PRESETS } from './core/config/throttle.config';

// API modules
import { StateModule } from './api/state/state.module';
import { PrincipalModule } from './api/principal/principal.module';
import { FacultyModule } from './api/faculty/faculty.module';
import { StudentPortalModule } from './api/student-portal/student-portal.module';
import { SharedModule } from './api/shared/shared.module';
import { SystemAdminModule } from './api/system-admin/system-admin.module';

// Infrastructure modules
import { MailModule } from './infrastructure/mail/mail.module';
import { WebSocketModule } from './infrastructure/websocket/websocket.module';
import { NotificationModule } from './infrastructure/notification/notification.module';
import { FileStorageModule } from './infrastructure/file-storage/file-storage.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { HealthModule } from './infrastructure/health/health.module';

// Domain modules
import { ReportModule } from './domain/report/report.module';
import { AcademicModule } from './domain/academic/academic.module';
import { SupportModule } from './domain/support/support.module';
import { MentorModule } from './domain/mentor/mentor.module';

// Bulk Operations
import { BulkModule } from './bulk/bulk.module';

@Module({
  imports: [
    // ===== GLOBAL CONFIGURATION =====
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),

    // ===== RATE LIMITING (THROTTLING) =====
    ThrottlerModule.forRoot([
      {
        ttl: THROTTLE_PRESETS.default.ttl,
        limit: THROTTLE_PRESETS.default.limit,
      },
    ]),

    // ===== CORE MODULES =====
    PrismaModule,
    AuthModule,
    CacheModule,
    QueueModule,

    // ===== INFRASTRUCTURE MODULES =====
    WebSocketModule,
    MailModule,
    NotificationModule,
    FileStorageModule,
    AuditModule,
    HealthModule,

    // ===== API MODULES (Role-based) =====
    StateModule,
    PrincipalModule,
    FacultyModule,
    StudentPortalModule,
    SharedModule,
    SystemAdminModule,

    // ===== DOMAIN MODULES =====
    ReportModule,
    AcademicModule,
    SupportModule,
    MentorModule,

    // ===== BULK OPERATIONS =====
    BulkModule,
  ],
  controllers: [],
  providers: [
    // ===== GLOBAL GUARDS =====
    {
      provide: APP_GUARD,
      useClass: CustomThrottleGuard,
    },

    // ===== GLOBAL FILTERS =====
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // ===== GLOBAL INTERCEPTORS =====
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityInterceptor,
    },
  ],
})
export class AppModule {}
