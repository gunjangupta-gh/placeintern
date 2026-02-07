import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { PrismaModule } from '../../core/database/prisma.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { CacheModule } from '../../core/cache/cache.module';
import { WebSocketModule } from '../../infrastructure/websocket/websocket.module';

import { SystemAdminController } from './system-admin.controller';
import {
  MetricsService,
  BackupService,
  BackupSchedulerService,
  UserManagementService,
  SessionService,
  AnalyticsService,
  SystemConfigService,
  HealthMonitorService,
} from './services';
import { AlertService } from './services/alert.service';
import { MetricsGateway } from './gateways/metrics.gateway';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    FileStorageModule,
    forwardRef(() => CacheModule),
    WebSocketModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max for backup files
      },
    }),
  ],
  controllers: [SystemAdminController],
  providers: [
    MetricsService,
    BackupService,
    BackupSchedulerService,
    UserManagementService,
    SessionService,
    AnalyticsService,
    SystemConfigService,
    HealthMonitorService,
    AlertService,
    MetricsGateway,
  ],
  exports: [MetricsService, MetricsGateway, SystemConfigService, AlertService],
})
export class SystemAdminModule {}
