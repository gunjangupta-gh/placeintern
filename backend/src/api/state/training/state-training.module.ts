import { Module } from '@nestjs/common';
import { StateTrainingController } from './state-training.controller';
import { StateFeedbackFormController } from './state-feedback-form.controller';
import { StateTestFormController } from './state-test-form.controller';
import { StateTrainingReportsController } from './state-training-reports.controller';
import { StateRecommendationController } from './state-recommendation.controller';
import { TrainingModule } from '../../../domain/training/training.module';
import { FeedbackModule } from '../../../domain/feedback/feedback.module';
import { AuditService } from '../../../infrastructure/audit/audit.service';

@Module({
  imports: [TrainingModule, FeedbackModule],
  // IMPORTANT: Order matters! More specific routes (reports) must come before parameterized routes
  controllers: [
    StateTrainingReportsController, // /state/training/reports/* - must be first
    StateFeedbackFormController,
    StateTestFormController, // /state/test-forms/*
    StateRecommendationController, // /state/training/recommendations/*
    StateTrainingController, // /state/training/:id - parameterized routes last
  ],
  providers: [
    AuditService
  ],
})
export class StateTrainingModule {}
