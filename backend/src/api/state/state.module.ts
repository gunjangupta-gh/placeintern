import { Module } from '@nestjs/common';
import { StateController } from './state.controller';
import { StateService } from './state.service';

// Import sub-services
import { StateDashboardService } from './services/state-dashboard.service';
import { StateInstitutionService } from './services/state-institution.service';
import { StatePrincipalService } from './services/state-principal.service';
import { StateStaffService } from './services/state-staff.service';
import { StateReportsService } from './services/state-reports.service';
import { StateIndustryService } from './services/state-industry.service';
import { StateMentorService } from './services/state-mentor.service';
import { StateRestoreService } from './services/state-restore.service';
import { StateComplianceService } from './services/state-compliance.service';
import { StateStudentService } from './services/state-student.service';

// Import domain modules for business logic reuse
import { ReportModule } from '../../domain/report/report.module';
import { MentorModule } from '../../domain/mentor/mentor.module';
import { AcademicModule } from '../../domain/academic/academic.module';
import { InstitutionModule } from '../../domain/institution/institution.module';
import { InternshipModule } from '../../domain/internship/internship.module';
import { UserModule } from '../../domain/user/user.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    // Domain modules with business logic services
    ReportModule,
    MentorModule,
    AcademicModule,
    InstitutionModule,
    InternshipModule, // For ExpectedCycleService (counter adjustments)
    UserModule,
    AuditModule,
    FileStorageModule, // For document presigned URLs
    SharedModule, // For LookupService
  ],
  controllers: [StateController],
  providers: [
    // Main facade service
    StateService,
    // Sub-services for specific domains
    StateDashboardService,
    StateInstitutionService,
    StatePrincipalService,
    StateStaffService,
    StateReportsService,
    StateIndustryService,
    StateMentorService,
    StateRestoreService,
    StateComplianceService,
    StateStudentService,
  ],
  exports: [StateService],
})
export class StateModule {}
