import { Module } from '@nestjs/common';
import { FacultyTrainingController } from './faculty-training.controller';
import { FacultyApplicationController } from './faculty-application.controller';
import { FacultyAttendanceController } from './faculty-attendance.controller';
import { FacultyLessonPlanController } from './faculty-lesson-plan.controller';
import { FacultyFeedbackController } from './faculty-feedback.controller';
import { FacultyCertificateController } from './faculty-certificate.controller';
import { TrainingModule } from '../../../domain/training/training.module';
import { FeedbackModule } from '../../../domain/feedback/feedback.module';

@Module({
  imports: [TrainingModule, FeedbackModule],
  controllers: [
    FacultyTrainingController,
    FacultyApplicationController,
    FacultyAttendanceController,
    FacultyLessonPlanController,
    FacultyFeedbackController,
    FacultyCertificateController,
  ],
})
export class FacultyTrainingModule {}
