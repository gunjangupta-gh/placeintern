import { Module, forwardRef } from '@nestjs/common';
import { BulkInstitutionController } from './bulk-institution.controller';
import { BulkInstitutionService } from './bulk-institution.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { InstitutionModule } from '../../domain/institution/institution.module';
import { BulkModule } from '../bulk.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    InstitutionModule,
    forwardRef(() => BulkModule), // For BulkQueueService
  ],
  controllers: [BulkInstitutionController],
  providers: [BulkInstitutionService],
  exports: [BulkInstitutionService],
})
export class BulkInstitutionModule {}
