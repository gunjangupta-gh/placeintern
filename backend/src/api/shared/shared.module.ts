import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ReportsController } from './reports.controller';
import { DocumentsController } from './documents.controller';
import { LookupController } from './lookup.controller';
import { SystemAlertsController } from './system-alerts.controller';
import { NotificationsService } from './notifications.service';
import { ReportsService } from './reports.service';
import { DocumentsService } from './documents.service';
import { LookupService } from './lookup.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { ReportBuilderModule } from '../../domain/report/builder/report-builder.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { NotificationModule } from '../../infrastructure/notification/notification.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { SystemAdminModule } from '../system-admin/system-admin.module';

@Module({
  imports: [
    PrismaModule,
    ReportBuilderModule,
    FileStorageModule,
    NotificationModule,
    AuditModule,
    SystemAdminModule, // For AlertService
    // CacheModule is @Global so LruCacheService is available automatically
  ],
  controllers: [
    NotificationsController,
    ReportsController,
    DocumentsController,
    LookupController,
    SystemAlertsController,
  ],
  providers: [
    NotificationsService,
    ReportsService,
    DocumentsService,
    LookupService,
  ],
  exports: [
    NotificationsService,
    ReportsService,
    DocumentsService,
    LookupService,
  ],
})
export class SharedModule {}
