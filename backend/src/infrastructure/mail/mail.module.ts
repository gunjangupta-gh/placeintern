import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { QueueModule } from '../../core/queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    // Import QueueModule which provides centralized Bull configuration
    // with hash tag prefix for Redis Cluster compatibility
    // The 'mail' queue is registered in QueueModule
    QueueModule,
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
