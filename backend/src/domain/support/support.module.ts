import { Module } from '@nestjs/common';
import { GrievanceService } from './grievance/grievance.service';
import { GrievanceController } from './grievance/grievance.controller';
import { NoticeService } from './notice/notice.service';
import { CalendarService } from './calendar/calendar.service';
import { NotificationModule } from '../../infrastructure/notification/notification.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
// Help & Support
import { SupportTicketService } from './help-support/support-ticket.service';
import { SupportTicketController } from './help-support/support-ticket.controller';
import { FAQService } from './help-support/faq.service';
import { FAQController } from './help-support/faq.controller';

@Module({
  imports: [NotificationModule, AuditModule],
  controllers: [
    GrievanceController,
    SupportTicketController,
    FAQController,
  ],
  providers: [
    GrievanceService,
    NoticeService,
    CalendarService,
    SupportTicketService,
    FAQService,
  ],
  exports: [
    GrievanceService,
    NoticeService,
    CalendarService,
    SupportTicketService,
    FAQService,
  ],
})
export class SupportModule {}
