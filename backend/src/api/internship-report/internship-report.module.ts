import { Module } from '@nestjs/common';
import { InternshipReportController } from './internship-report.controller';
import { InternshipReportService } from './internship-report.service';

@Module({
  controllers: [InternshipReportController],
  providers: [InternshipReportService],
})
export class InternshipReportModule {}
