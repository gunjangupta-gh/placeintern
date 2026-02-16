import { Module } from '@nestjs/common';
import { TrainingService } from './training.service';
import { TrainingApplicationService } from './training-application.service';
import { TrainingAttendanceService } from './training-attendance.service';
import { LessonPlanService } from './lesson-plan.service';
import { TrainingCertificateService } from './training-certificate.service';
import { TrainingRecommendationService } from './training-recommendation.service';
import { TestFormService } from './test-form.service';
import { TestResponseService } from './test-response.service';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { NotificationModule } from '../../infrastructure/notification/notification.module';

@Module({
  imports: [AuditModule, NotificationModule],
  providers: [
    TrainingService,
    TrainingApplicationService,
    TrainingAttendanceService,
    LessonPlanService,
    TrainingCertificateService,
    TrainingRecommendationService,
    TestFormService,
    TestResponseService,
  ],
  exports: [
    TrainingService,
    TrainingApplicationService,
    TrainingAttendanceService,
    LessonPlanService,
    TrainingCertificateService,
    TrainingRecommendationService,
    TestFormService,
    TestResponseService,
  ],
})
export class TrainingModule {}
