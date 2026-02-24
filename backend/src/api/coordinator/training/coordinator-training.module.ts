import { Module } from '@nestjs/common';
import { CoordinatorApplicationController } from './coordinator-application.controller';
import { CoordinatorLessonPlanController } from './coordinator-lesson-plan.controller';
import { CoordinatorTestResponsesController } from './coordinator-test-responses.controller';
import { CoordinatorRecommendationController } from './coordinator-recommendation.controller';
import { CoordinatorReminderController } from './coordinator-reminder.controller';
import { CoordinatorReportsController } from './coordinator-reports.controller';
import { CoordinatorReminderService } from './coordinator-reminder.service';
import { TrainingModule } from '../../../domain/training/training.module';
import { FeedbackModule } from '../../../domain/feedback/feedback.module';
import { NotificationModule } from '../../../infrastructure/notification/notification.module';
import { AuditModule } from '../../../infrastructure/audit/audit.module';
import { MailModule } from '../../../infrastructure/mail/mail.module';

@Module({
  imports: [
    TrainingModule,
    FeedbackModule,
    NotificationModule,
    AuditModule,
    MailModule,
  ],
  controllers: [
    CoordinatorApplicationController,
    CoordinatorLessonPlanController,
    CoordinatorTestResponsesController,
    CoordinatorRecommendationController,
    CoordinatorReminderController,
    CoordinatorReportsController,
  ],
  providers: [CoordinatorReminderService],
  exports: [CoordinatorReminderService],
})
export class CoordinatorTrainingModule {}
