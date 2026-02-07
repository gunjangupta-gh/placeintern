import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { CacheModule } from '../../core/cache/cache.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';

@Module({
  imports: [CacheModule, AuditModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
