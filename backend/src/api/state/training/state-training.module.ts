import { Module } from '@nestjs/common';
import { StateTrainingController } from './state-training.controller';
import { StateFeedbackFormController } from './state-feedback-form.controller';
import { StateTrainingReportsController } from './state-training-reports.controller';
import { TrainingModule } from '../../../domain/training/training.module';
import { FeedbackModule } from '../../../domain/feedback/feedback.module';

@Module({
  imports: [TrainingModule, FeedbackModule],
  controllers: [
    StateTrainingController,
    StateFeedbackFormController,
    StateTrainingReportsController,
  ],
})
export class StateTrainingModule {}
