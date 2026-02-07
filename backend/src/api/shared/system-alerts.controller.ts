import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { Role } from '../../generated/prisma/client';
import { AlertService } from '../system-admin/services/alert.service';

@Controller('system-alerts')
@UseGuards(JwtAuthGuard)
export class SystemAlertsController {
  constructor(private readonly alertService: AlertService) {}

  /**
   * Get active alerts for the current user based on their role
   */
  @Get('my-alerts')
  async getMyAlerts(
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.alertService.getActiveAlertsForUser(user.userId, user.role);
  }

  /**
   * Dismiss an alert for the current user
   */
  @Post(':id/dismiss')
  async dismissAlert(
    @Param('id') alertId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.alertService.dismissAlert(alertId, user.userId);
  }
}
