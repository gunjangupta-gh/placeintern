import { Module, forwardRef } from '@nestjs/common';
import { InternshipApplicationService } from './application/internship-application.service';
import { SelfIdentifiedService } from './self-identified/self-identified.service';
import { InternshipPostingService } from './posting/internship-posting.service';
import { ExpectedCycleService } from './expected-cycle/expected-cycle.service';
import { InternshipPhaseScheduler } from './internship-phase.scheduler';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { SystemAdminModule } from '../../api/system-admin/system-admin.module';

@Module({
  imports: [AuditModule, forwardRef(() => SystemAdminModule)],
  providers: [
    InternshipApplicationService,
    SelfIdentifiedService,
    InternshipPostingService,
    ExpectedCycleService,
    InternshipPhaseScheduler,
  ],
  exports: [
    InternshipApplicationService,
    SelfIdentifiedService,
    InternshipPostingService,
    ExpectedCycleService,
    InternshipPhaseScheduler,
  ],
})
export class InternshipModule {}
