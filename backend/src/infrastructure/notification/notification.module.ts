import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationSenderService } from './notification-sender.service';
import { NotificationProcessor } from './notification.processor';
import { PrismaModule } from '../../core/database/prisma.module';
import { MailModule } from '../mail/mail.module';
import { QueueModule } from '../../core/queue/queue.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    MailModule,
    QueueModule,
    forwardRef(() => WebSocketModule),
  ],
  providers: [
    NotificationService,
    NotificationSchedulerService,
    NotificationSenderService,
    NotificationProcessor,
  ],
  exports: [
    NotificationService,
    NotificationSchedulerService,
    NotificationSenderService,
  ],
})
export class NotificationModule {}
