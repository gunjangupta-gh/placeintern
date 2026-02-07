import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportBuilderController } from './report-builder.controller';
import { ReportBuilderService } from './report-builder.service';
import { ReportGeneratorService } from './report-generator.service';
import { ExcelService } from './export/excel.service';
import { PdfService } from './export/pdf.service';
import { CsvService } from './export/csv.service';
import { ReportProcessor } from './report.processor';
import { ReportCleanupScheduler } from './report-cleanup.scheduler';
import { PrismaModule } from '../../../core/database/prisma.module';
import { FileStorageModule } from '../../../infrastructure/file-storage/file-storage.module';
import { QueueModule } from '../../../core/queue/queue.module';
import { AuditService } from '../../../infrastructure/audit/audit.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Import QueueModule which exports BullModule with report-generation queue
    // This ensures consistent configuration with hash tag prefix for Redis Cluster
    QueueModule,
    PrismaModule,
    FileStorageModule,
  ],
  controllers: [ReportBuilderController],
  providers: [
    ReportBuilderService,
    ReportGeneratorService,
    ExcelService,
    PdfService,
    CsvService,
    ReportProcessor,
    ReportCleanupScheduler,
    AuditService,
  ],
  exports: [ReportBuilderService],
})
export class ReportBuilderModule {}
