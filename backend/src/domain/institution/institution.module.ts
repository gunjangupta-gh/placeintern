import { Module } from '@nestjs/common';
import { InstitutionService } from './institution.service';
import { CacheModule } from '../../core/cache/cache.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';

@Module({
  imports: [CacheModule, AuditModule],
  providers: [InstitutionService],
  exports: [InstitutionService],
})
export class InstitutionModule {}
