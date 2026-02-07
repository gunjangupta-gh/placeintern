import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN)
  async getLogs(@Query() query: any, @Req() req: any) {
    const filters = {
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 50,
    };
    return this.auditService.getAuditLogs(filters);
  }

  @Get('statistics')
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN)
  async getStatistics(@Query() query: any) {
    return this.auditService.getStatistics({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      institutionId: query.institutionId,
    });
  }

  @Get('entity-trail')
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN)
  async getEntityTrail(@Query('entityType') entityType: string, @Query('entityId') entityId: string) {
    return this.auditService.getEntityAuditTrail(entityType, entityId);
  }
}
