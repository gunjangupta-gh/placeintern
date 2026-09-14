import { Module } from '@nestjs/common';
import { InternshipReportController } from './internship-report.controller';
import { InternshipReportService } from './internship-report.service';
import { InternshipReportBulkService } from './internship-report-bulk.service';

@Module({
  controllers: [InternshipReportController],
  providers: [InternshipReportService, InternshipReportBulkService],
})
export class InternshipReportModule {}
