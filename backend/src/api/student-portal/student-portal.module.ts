import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { ReportModule } from '../../domain/report/report.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { InternshipModule } from '../../domain/internship/internship.module';

@Module({
  imports: [ReportModule, AuditModule, FileStorageModule, InternshipModule],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentPortalModule {}
