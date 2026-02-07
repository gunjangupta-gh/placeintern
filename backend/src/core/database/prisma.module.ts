import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaCacheService } from './prisma-cache.service';

@Global()
@Module({
  providers: [PrismaService, PrismaCacheService],
  exports: [PrismaService, PrismaCacheService],
})
export class PrismaModule {}
