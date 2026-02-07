import { Module } from '@nestjs/common';
import { BulkUserModule } from './bulk-user/bulk-user.module';
import { BulkStudentModule } from './bulk-student/bulk-student.module';
import { BulkInstitutionModule } from './bulk-institution/bulk-institution.module';
import { TemplateController } from './templates/template.controller';
import { BulkValidationService } from './shared/bulk-validation.service';
import { BulkProcessor } from './shared/bulk.processor';
import { BulkJobService } from './shared/bulk-job.service';
import { BulkQueueService } from './shared/bulk-queue.service';
import { BulkJobController } from './shared/bulk-job.controller';
import { PrismaModule } from '../core/database/prisma.module';
import { BulkSelfInternshipService } from './bulk-self-internship/bulk-self-internship.service';
import { BulkSelfInternshipController } from './bulk-self-internship/bulk-self-internship.controller';
import { AuditModule } from '../infrastructure/audit/audit.module';
import { QueueModule } from '../core/queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    BulkUserModule,
    BulkStudentModule,
    BulkInstitutionModule,
    // Import QueueModule which exports BullModule with bulk-operations queue
    // This ensures consistent configuration with hash tag prefix for Redis Cluster
    QueueModule,
  ],
  controllers: [TemplateController, BulkJobController, BulkSelfInternshipController],
  providers: [
    BulkValidationService,
    BulkJobService,
    BulkQueueService,
    BulkSelfInternshipService,
    BulkProcessor,
  ],
  exports: [
    BulkUserModule,
    BulkStudentModule,
    BulkInstitutionModule,
    BulkValidationService,
    BulkJobService,
    BulkQueueService,
    BulkSelfInternshipService,
  ],
})
export class BulkModule {}
