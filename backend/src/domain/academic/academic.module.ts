import { Module } from '@nestjs/common';
import { BatchService } from './batch/batch.service';
import { SemesterService } from './semester/semester.service';
import { SubjectService } from './subject/subject.service';
import { ResultService } from './result/result.service';
import { StudentProgressScheduler } from './student-progress.scheduler';
import { StudentSemesterStatusService } from './semester-status/student-semester-status.service';

@Module({
  providers: [
    BatchService,
    SemesterService,
    SubjectService,
    ResultService,
    StudentProgressScheduler,
    StudentSemesterStatusService,
  ],
  exports: [
    BatchService,
    SemesterService,
    SubjectService,
    ResultService,
    StudentProgressScheduler,
    StudentSemesterStatusService,
  ],
})
export class AcademicModule {}
