import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database/prisma.module';
import { CoordinatorTrainingModule } from './training/coordinator-training.module';

@Module({
  imports: [
    PrismaModule,
    // Training sub-module with all coordinator training features
    CoordinatorTrainingModule,
  ],
  controllers: [],
  providers: [],
})
export class CoordinatorModule {}
