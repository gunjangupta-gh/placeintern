import { Module } from '@nestjs/common';
import { BatchService } from './batch/batch.service';
import { SemesterService } from './semester/semester.service';
import { SubjectService } from './subject/subject.service';
import { ResultService } from './result/result.service';

@Module({
  providers: [
    BatchService,
    SemesterService,
    SubjectService,
    ResultService,
  ],
  exports: [
    BatchService,
    SemesterService,
    SubjectService,
    ResultService,
  ],
})
export class AcademicModule {}
