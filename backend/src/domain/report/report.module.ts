import { Module } from '@nestjs/common';
import { MonthlyReportService } from './monthly/monthly-report.service';
import { FacultyVisitService } from './faculty-visit/faculty-visit.service';
import { StateReportService } from './state/state-report.service';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { InternshipModule } from '../internship/internship.module';

@Module({
  imports: [AuditModule, InternshipModule],
  providers: [
    MonthlyReportService,
    FacultyVisitService,
    StateReportService,
  ],
  exports: [
    MonthlyReportService,
    FacultyVisitService,
    StateReportService,
  ],
})
export class ReportModule {}
