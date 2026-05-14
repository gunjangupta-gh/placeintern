import { Module } from '@nestjs/common';
import { BatchService } from './batch/batch.service';
import { SemesterService } from './semester/semester.service';
import { SubjectService } from './subject/subject.service';
import { ResultService } from './result/result.service';
import { StudentProgressScheduler } from './student-progress.scheduler';

@Module({
  providers: [
    BatchService,
    SemesterService,
    SubjectService,
    ResultService,
    StudentProgressScheduler,
  ],
  exports: [
    BatchService,
    SemesterService,
    SubjectService,
    ResultService,
    StudentProgressScheduler,
  ],
})
export class AcademicModule {}
