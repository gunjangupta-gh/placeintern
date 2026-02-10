import { Module } from '@nestjs/common';
import { PrincipalTrainingController } from './principal-training.controller';
import { PrincipalApplicationController } from './principal-application.controller';
import { PrincipalLessonPlanController } from './principal-lesson-plan.controller';
import { PrincipalReportsController } from './principal-reports.controller';
import { TrainingModule } from '../../../domain/training/training.module';
import { FeedbackModule } from '../../../domain/feedback/feedback.module';

@Module({
  imports: [TrainingModule, FeedbackModule],
  controllers: [
    PrincipalApplicationController,
    PrincipalLessonPlanController,
    PrincipalReportsController,
    PrincipalTrainingController,
  ],
})
export class PrincipalTrainingModule {}
