import { Module } from '@nestjs/common';
import { PrincipalController } from './principal.controller';
import { PrincipalService } from './principal.service';
import { PrincipalVisitLogsController } from './principal-visit-logs.controller';
import { PrincipalVisitLogsService } from './principal-visit-logs.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { UserModule } from '../../domain/user/user.module';
import { MentorModule } from '../../domain/mentor/mentor.module';
import { AcademicModule } from '../../domain/academic/academic.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { InternshipModule } from '../../domain/internship/internship.module';

// Training module
import { PrincipalTrainingModule } from './training/principal-training.module';
import { AuditService } from '../../infrastructure/audit/audit.service';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    MentorModule,
    AcademicModule,
    AuditModule,
    FileStorageModule,
    InternshipModule,
    // Training sub-module
    PrincipalTrainingModule,
  ],
  controllers: [PrincipalController, PrincipalVisitLogsController],
  providers: [PrincipalService, PrincipalVisitLogsService],
  exports: [PrincipalService, PrincipalVisitLogsService],
})
export class PrincipalModule {}
