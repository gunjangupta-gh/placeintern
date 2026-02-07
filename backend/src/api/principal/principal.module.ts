import { Module } from '@nestjs/common';
import { PrincipalController } from './principal.controller';
import { PrincipalService } from './principal.service';
import { PrismaModule } from '../../core/database/prisma.module';
import { UserModule } from '../../domain/user/user.module';
import { MentorModule } from '../../domain/mentor/mentor.module';
import { AcademicModule } from '../../domain/academic/academic.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { FileStorageModule } from '../../infrastructure/file-storage/file-storage.module';
import { InternshipModule } from '../../domain/internship/internship.module';

@Module({
  imports: [PrismaModule, UserModule, MentorModule, AcademicModule, AuditModule, FileStorageModule, InternshipModule],
  controllers: [PrincipalController],
  providers: [PrincipalService],
  exports: [PrincipalService],
})
export class PrincipalModule {}
