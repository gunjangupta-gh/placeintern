import { Module } from '@nestjs/common';
import { FeedbackFormService } from './feedback-form.service';
import { FeedbackResponseService } from './feedback-response.service';
import { AuditModule } from '../../infrastructure/audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [FeedbackFormService, FeedbackResponseService],
  exports: [FeedbackFormService, FeedbackResponseService],
})
export class FeedbackModule {}
