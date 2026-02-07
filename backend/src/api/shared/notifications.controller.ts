import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_PRESETS } from '../../core/config/throttle.config';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Role } from '../../generated/prisma/client';
import {
  SendNotificationDto,
  SendStudentReminderDto,
  SendInstitutionAnnouncementDto,
  SendSystemAnnouncementDto,
} from './dto';

@Controller('shared/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============ GET Routes (specific paths BEFORE parameterized) ============

  @Throttle({ default: THROTTLE_PRESETS.list })
  @Get()
  async getNotifications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getNotifications(req.user.userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Throttle({ default: THROTTLE_PRESETS.lightweight })
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Get('settings')
  async getNotificationSettings(@Request() req) {
    return this.notificationsService.getNotificationSettings(req.user.userId);
  }

  // Parameterized GET route MUST come AFTER specific GET routes
  @Get(':id')
  async getNotificationById(@Param('id') id: string, @Request() req) {
    return this.notificationsService.getNotificationById(req.user.userId, id);
  }

  // ============ PUT Routes (specific paths BEFORE parameterized) ============

  @Put('read-all')
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @Put('mark-read')
  async markMultipleAsRead(@Request() req, @Body() body: { ids: string[] }) {
    return this.notificationsService.markMultipleAsRead(req.user.userId, body.ids);
  }

  @Put('settings')
  async updateNotificationSettings(@Request() req, @Body() settings: any) {
    return this.notificationsService.updateNotificationSettings(
      req.user.userId,
      settings,
    );
  }

  // Parameterized PUT route MUST come AFTER specific PUT routes
  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(req.user.userId, id);
  }

  // ============ DELETE Routes (specific paths BEFORE parameterized) ============

  @Delete('clear-all')
  async clearAllNotifications(@Request() req) {
    return this.notificationsService.clearAllNotifications(req.user.userId);
  }

  @Delete('clear-read')
  async clearReadNotifications(@Request() req) {
    return this.notificationsService.clearReadNotifications(req.user.userId);
  }

  // Parameterized DELETE route MUST come AFTER specific DELETE routes
  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req) {
    return this.notificationsService.deleteNotification(req.user.userId, id);
  }

  // ============ POST Routes ============

  @Post('delete-multiple')
  async deleteMultipleNotifications(@Request() req, @Body() body: { ids: string[] }) {
    return this.notificationsService.deleteMultipleNotifications(req.user.userId, body.ids);
  }

  // ============ NOTIFICATION SENDING ENDPOINTS ============

  /**
   * Generic send notification endpoint
   * Supports: user, users, role, institution, broadcast targets
   */
  @Post('send')
  @UseGuards(RolesGuard)
  @Roles(
    Role.PRINCIPAL,
    Role.STATE_DIRECTORATE,
    Role.SYSTEM_ADMIN,
    Role.TEACHER,
    Role.TEACHER,
  )
  async sendNotification(@Request() req, @Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(
      {
        userId: req.user.userId,
        role: req.user.role,
        institutionId: req.user.institutionId,
      },
      dto,
    );
  }

  /**
   * Faculty: Send reminder to assigned students
   */
  @Post('send/student-reminder')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.TEACHER)
  async sendStudentReminder(@Request() req, @Body() dto: SendStudentReminderDto) {
    return this.notificationsService.sendStudentReminder(
      {
        userId: req.user.userId,
        role: req.user.role,
        institutionId: req.user.institutionId,
      },
      dto,
    );
  }

  /**
   * Principal: Send announcement to institution
   */
  @Post('send/institution-announcement')
  @UseGuards(RolesGuard)
  @Roles(Role.PRINCIPAL)
  async sendInstitutionAnnouncement(@Request() req, @Body() dto: SendInstitutionAnnouncementDto) {
    return this.notificationsService.sendInstitutionAnnouncement(
      {
        userId: req.user.userId,
        role: req.user.role,
        institutionId: req.user.institutionId,
      },
      dto,
    );
  }

  /**
   * State/Admin: Send system-wide announcement
   */
  @Post('send/system-announcement')
  @UseGuards(RolesGuard)
  @Roles(Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN)
  async sendSystemAnnouncement(@Request() req, @Body() dto: SendSystemAnnouncementDto) {
    return this.notificationsService.sendSystemAnnouncement(
      {
        userId: req.user.userId,
        role: req.user.role,
        institutionId: req.user.institutionId,
      },
      dto,
    );
  }
}
