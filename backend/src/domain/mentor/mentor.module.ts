import { Module } from '@nestjs/common';
import { MentorService } from './mentor.service';
import { AuditModule } from '../../infrastructure/audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [
    MentorService,
  ],
  exports: [
    MentorService,
  ],
})
export class MentorModule {}
