import { Module, forwardRef } from '@nestjs/common';
import { BulkSelfInternshipController } from './bulk-self-internship.controller';
import { BulkSelfInternshipService } from './bulk-self-internship.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { BulkModule } from '../bulk.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => BulkModule), // Use forwardRef to handle circular dependency
  ],
  controllers: [BulkSelfInternshipController],
  providers: [BulkSelfInternshipService],
  exports: [BulkSelfInternshipService],
})
export class BulkSelfInternshipModule {}
