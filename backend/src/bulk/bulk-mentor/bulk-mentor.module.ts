import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { BulkMentorController } from './bulk-mentor.controller';
import { BulkMentorService } from './bulk-mentor.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BulkMentorController],
  providers: [BulkMentorService],
  exports: [BulkMentorService],
})
export class BulkMentorModule {}
