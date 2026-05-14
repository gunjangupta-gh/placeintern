import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { Role, BackupStatus } from '../../generated/prisma/client';
import * as fs from 'fs';

import { MetricsService } from './services/metrics.service';
import { BackupService } from './services/backup.service';
import { BackupSchedulerService } from './services/backup-scheduler.service';
import { UserManagementService } from './services/user-management.service';
import { SessionService } from './services/session.service';
import { AnalyticsService } from './services/analytics.service';
import { SystemConfigService, ConfigCategory } from './services/system-config.service';
import { HealthMonitorService } from './services/health-monitor.service';
import { CacheService } from '../../core/cache/cache.service';
import { AlertService, CreateAlertDto, UpdateAlertDto } from './services/alert.service';
import { AlertType } from '../../generated/prisma/client';

import {
  CreateBackupDto,
  RestoreBackupDto,
  UpdateBackupStatusDto,
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  BulkUserActionDto,
} from './dto';

@Controller('system-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN)
export class SystemAdminController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly backupService: BackupService,
    private readonly backupSchedulerService: BackupSchedulerService,
    private readonly userManagementService: UserManagementService,
    private readonly sessionService: SessionService,
    private readonly analyticsService: AnalyticsService,
    private readonly systemConfigService: SystemConfigService,
    private readonly healthMonitorService: HealthMonitorService,
    private readonly cacheService: CacheService,
    private readonly alertService: AlertService,
  ) {}

  // ==========================================
  // HEALTH & METRICS
  // ==========================================

  @Get('health/detailed')
  async getDetailedHealth() {
    return this.metricsService.getDetailedHealth();
  }

  @Get('metrics/realtime')
  async getRealtimeMetrics() {
    return this.metricsService.getRealtimeMetrics();
  }

  @Get('health/report')
  async getHealthReport() {
    return this.healthMonitorService.performHealthCheck();
  }

  @Get('health/quick')
  async getQuickStatus() {
    return this.healthMonitorService.getQuickStatus();
  }

  @Get('health/alerts')
  async getAlertHistory(@Query('limit') limit?: number) {
    return this.healthMonitorService.getAlertHistory(limit ? Number(limit) : 50);
  }

  @Get('health/uptime')
  async getUptimeStats() {
    return this.healthMonitorService.getUptimeStats();
  }

  @Get('health/metrics')
  async getSystemMetrics() {
    return this.healthMonitorService.getSystemMetrics();
  }

  @Get('health/thresholds')
  async getThresholds() {
    return this.healthMonitorService.getThresholds();
  }

  // ==========================================
  // CACHE MANAGEMENT
  // ==========================================

  @Post('cache/clear')
  async clearAllCache(@Body() body?: { refreshConfigCache?: boolean }) {
    await this.cacheService.clear();

    if (body?.refreshConfigCache) {
      await this.systemConfigService.refreshCache();
    }

    return {
      success: true,
      message: 'Cache cleared successfully',
      refreshedConfigCache: !!body?.refreshConfigCache,
      cacheStats: this.cacheService.getStats(),
    };
  }

  @Put('health/thresholds')
  async updateThresholds(@Body() thresholds: Record<string, any>) {
    this.healthMonitorService.updateThresholds(thresholds);
    return { success: true, message: 'Thresholds updated' };
  }

  @Get('health/service/:name')
  async getServiceDetails(@Param('name') name: string) {
    return this.healthMonitorService.getServiceDetails(name);
  }

  // ==========================================
  // BACKUP MANAGEMENT
  // ==========================================

  @Post('backup/create')
  async createBackup(
    @Body() dto: CreateBackupDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    // Run backup in background - don't await
    // Progress will be sent via WebSocket
    this.backupService.createBackup(dto, user.userId, user.role)
      .catch(error => {
        // Error is already handled in the service with WebSocket notification
        console.error('Background backup error:', error.message);
      });

    return {
      success: true,
      message: 'Backup initiated. Progress will be sent via WebSocket.',
    };
  }

  @Get('backup/list')
  async listBackups(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.backupService.listBackups(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      status as BackupStatus,
    );
  }

  @Get('backup/download/:id')
  async getBackupDownloadUrl(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.backupService.getBackupDownloadUrl(id);

    // If it's a MinIO signed URL, redirect to it
    if (result.url) {
      return { url: result.url, expiresIn: result.expiresIn };
    }

    // If it's a local file, stream it
    if (result.localPath) {
      const file = fs.createReadStream(result.localPath);
      res.set({
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      });
      return new StreamableFile(file);
    }
  }

  @Post('backup/restore/:id')
  async restoreBackup(
    @Param('id') id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    if (!dto.confirmRestore || dto.confirmationText !== 'RESTORE') {
      return { error: 'Please confirm the restore operation by setting confirmRestore=true and confirmationText="RESTORE"' };
    }

    // Run restore in background - don't await
    // Progress will be sent via WebSocket
    this.backupService.restoreBackup(id, user.userId, user.role, dto.dropExisting ?? true)
      .catch(error => {
        // Error is already handled in the service with WebSocket notification
        console.error('Background restore error:', error.message);
      });

    return {
      success: true,
      message: 'Restore initiated. Progress will be sent via WebSocket.',
      backupId: id,
    };
  }

  @Post('backup/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBackup(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.uploadBackup(file, user.userId, user.role);
  }

  @Delete('backup/:id')
  async deleteBackup(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.deleteBackup(id, user.userId, user.role);
  }

  @Get('backup/:id/details')
  async getBackupDetails(@Param('id') id: string) {
    return this.backupService.getBackupById(id);
  }

  @Put('backup/:id/status')
  async updateBackupStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBackupStatusDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.updateBackupStatus(id, dto.status, user.userId, user.role);
  }

  @Post('backup/cleanup-stale')
  async cleanupStaleBackups(
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupService.cleanupStaleBackups(user.userId, user.role);
  }

  // ==========================================
  // BACKUP SCHEDULES
  // ==========================================

  @Get('backup/schedules')
  async listBackupSchedules() {
    return this.backupSchedulerService.listSchedules();
  }

  @Get('backup/schedules/status')
  async getScheduleStatus() {
    return this.backupSchedulerService.getScheduleStatus();
  }

  @Post('backup/schedules')
  async createBackupSchedule(
    @Body() body: { name: string; cronExpression: string; storageType: string; retentionDays: number },
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupSchedulerService.createSchedule(
      body.name,
      body.cronExpression,
      body.storageType as any,
      body.retentionDays,
      user.userId,
      user.role,
    );
  }

  @Put('backup/schedules/:id')
  async updateBackupSchedule(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; cronExpression: string; storageType: string; retentionDays: number; isActive: boolean }>,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupSchedulerService.updateSchedule(id, body as any, user.userId, user.role);
  }

  @Delete('backup/schedules/:id')
  async deleteBackupSchedule(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupSchedulerService.deleteSchedule(id, user.userId, user.role);
  }

  @Post('backup/schedules/:id/trigger')
  async triggerBackupSchedule(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.backupSchedulerService.triggerNow(id, user.userId, user.role);
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  @Get('users')
  async getUsers(@Query() query: UserQueryDto) {
    return this.userManagementService.getUsers(query);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.userManagementService.getUserById(id);
  }

  @Post('users')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.createUser(dto, user.userId, user.role);
  }

  @Put('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.updateUser(id, dto, user.userId, user.role);
  }

  @Delete('users/:id')
  async deleteUser(
    @Param('id') id: string,
    @Query('permanent') permanent: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.deleteUser(
      id,
      permanent === 'true',
      user.userId,
      user.role,
    );
  }

  @Post('users/bulk')
  async bulkUserAction(
    @Body() dto: BulkUserActionDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.bulkAction(dto, user.userId, user.role);
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.userManagementService.resetPassword(id, user.userId, user.role);
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  @Get('sessions')
  async getActiveSessions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('userId') userId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.sessionService.getActiveSessions(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
      userId,
      institutionId,
    );
  }

  @Get('sessions/stats')
  async getSessionStats() {
    return this.sessionService.getSessionStats();
  }

  @Delete('sessions/:id')
  async terminateSession(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.sessionService.terminateSession(id, user.userId, user.role);
  }

  @Post('sessions/terminate-all')
  async terminateAllSessions(
    @Body() options: { exceptCurrent?: boolean; exceptUserId?: string },
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.sessionService.terminateAllSessions(options, user.userId, user.role);
  }

  @Post('sessions/terminate-user/:userId')
  async terminateUserSessions(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.sessionService.terminateUserSessions(
      targetUserId,
      user.userId,
      user.role,
    );
  }

  // ==========================================
  // ANALYTICS & INSIGHTS
  // ==========================================

  @Get('analytics/dashboard')
  async getDashboardSummary() {
    return this.analyticsService.getDashboardSummary();
  }

  @Get('analytics/login')
  async getLoginAnalytics(@Query('days') days?: number) {
    return this.analyticsService.getLoginAnalytics(days ? Number(days) : 30);
  }

  @Get('analytics/suspicious-activities')
  async getSuspiciousActivities(@Query('days') days?: number) {
    return this.analyticsService.detectSuspiciousActivities(days ? Number(days) : 7);
  }

  @Get('analytics/trends')
  async getSystemTrends(@Query('days') days?: number) {
    return this.analyticsService.getSystemTrends(days ? Number(days) : 30);
  }

  @Get('analytics/activity-heatmap')
  async getUserActivityHeatmap(@Query('userId') userId?: string) {
    return this.analyticsService.getUserActivityHeatmap(userId);
  }

  // ==========================================
  // SYSTEM CONFIGURATION
  // ==========================================

  @Get('config')
  async getAllConfigs() {
    return this.systemConfigService.getAllGrouped();
  }

  @Get('config/category/:category')
  async getConfigsByCategory(@Param('category') category: ConfigCategory) {
    return this.systemConfigService.getByCategory(category);
  }

  @Get('config/:key')
  async getConfig(@Param('key') key: string) {
    return this.systemConfigService.get(key);
  }

  @Put('config/:key')
  async setConfig(
    @Param('key') key: string,
    @Body() body: { value: any },
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.systemConfigService.set(key, body.value, user.userId, user.role);
  }

  @Put('config')
  async bulkUpdateConfigs(
    @Body() body: { updates: { key: string; value: any }[] },
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.systemConfigService.bulkUpdate(body.updates, user.userId, user.role);
  }

  @Post('config/:key/reset')
  async resetConfig(
    @Param('key') key: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.systemConfigService.resetToDefault(key, user.userId, user.role);
  }

  @Post('config/reset-all')
  async resetAllConfigs(
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.systemConfigService.resetAllToDefaults(user.userId, user.role);
  }

  @Get('config/export')
  async exportConfigs() {
    return this.systemConfigService.exportConfigs();
  }

  @Post('config/import')
  async importConfigs(
    @Body() data: { configs: { key: string; value: any; category: string }[] },
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.systemConfigService.importConfigs(data, user.userId, user.role);
  }

  @Get('config/feature/:feature')
  async isFeatureEnabled(@Param('feature') feature: string) {
    const enabled = await this.systemConfigService.isFeatureEnabled(feature);
    return { feature, enabled };
  }

  @Get('config/maintenance-mode')
  async isMaintenanceMode() {
    const enabled = await this.systemConfigService.isMaintenanceMode();
    return { maintenanceMode: enabled };
  }

  // ==========================================
  // SYSTEM ALERTS (User-facing announcements)
  // ==========================================

  @Get('alerts')
  async getAlerts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isActive') isActive?: string,
    @Query('type') type?: string,
  ) {
    return this.alertService.getAllAlerts({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      type: type as AlertType,
    });
  }

  @Get('alerts/stats')
  async getAlertStats() {
    return this.alertService.getAlertStats();
  }

  @Get('alerts/:id')
  async getAlertById(@Param('id') id: string) {
    return this.alertService.getAlertById(id);
  }

  @Post('alerts')
  async createAlert(
    @Body() dto: CreateAlertDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.alertService.createAlert(dto, user.userId, user.role);
  }

  @Put('alerts/:id')
  async updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAlertDto,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.alertService.updateAlert(id, dto, user.userId, user.role);
  }

  @Delete('alerts/:id')
  async deleteAlert(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: Role },
  ) {
    return this.alertService.deleteAlert(id, user.userId, user.role);
  }
}
