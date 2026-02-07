import { Module } from '@nestjs/common';
import { InternshipApplicationService } from './application/internship-application.service';
import { SelfIdentifiedService } from './self-identified/self-identified.service';
import { InternshipPostingService } from './posting/internship-posting.service';
import { ExpectedCycleService } from './expected-cycle/expected-cycle.service';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { SystemAdminModule } from '../../api/system-admin/system-admin.module';

@Module({
  imports: [AuditModule, SystemAdminModule],
  providers: [
    InternshipApplicationService,
    SelfIdentifiedService,
    InternshipPostingService,
    ExpectedCycleService,
  ],
  exports: [
    InternshipApplicationService,
    SelfIdentifiedService,
    InternshipPostingService,
    ExpectedCycleService,
  ],
})
export class InternshipModule {}
