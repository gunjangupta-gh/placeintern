import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRetentionService } from './audit-retention.service';
import { AuditController } from './audit.controller';
import { PrismaService } from '../../core/database/prisma.service';

@Module({
  controllers: [AuditController],
  providers: [PrismaService, AuditService, AuditInterceptor, AuditRetentionService],
  exports: [AuditService, AuditInterceptor, AuditRetentionService],
})
export class AuditModule {}
