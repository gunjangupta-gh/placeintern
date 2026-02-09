import { Module } from '@nestjs/common';
import { StateTrainingController } from './state-training.controller';
import { StateFeedbackFormController } from './state-feedback-form.controller';
import { StateTrainingReportsController } from './state-training-reports.controller';
import { TrainingModule } from '../../../domain/training/training.module';
import { FeedbackModule } from '../../../domain/feedback/feedback.module';
import { AuditService } from '../../../infrastructure/audit/audit.service';

@Module({
  imports: [TrainingModule, FeedbackModule],
  controllers: [
    StateTrainingController,
    StateFeedbackFormController,
    StateTrainingReportsController,
  ],
  providers: [
    AuditService
  ],
})
export class StateTrainingModule {}
