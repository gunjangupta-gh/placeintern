import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import { Role, AlertType, AlertPriority } from '../../../generated/prisma/client';

export interface CreateAlertDto {
  title: string;
  message: string;
  type?: AlertType;
  priority?: AlertPriority;
  targetRoles: Role[];
  startDate?: Date;
  endDate?: Date;
  isDismissible?: boolean;
}

export interface UpdateAlertDto {
  title?: string;
  message?: string;
  type?: AlertType;
  priority?: AlertPriority;
  targetRoles?: Role[];
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  isDismissible?: boolean;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly webSocketService: WebSocketService,
  ) {}

  /**
   * Create a new system alert
   */
  async createAlert(dto: CreateAlertDto, userId: string, userRole: Role) {
    this.logger.log(`Creating new alert: ${dto.title}`);

    const alert = await this.prisma.systemAlert.create({
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type || AlertType.INFO,
        priority: dto.priority || AlertPriority.NORMAL,
        targetRoles: dto.targetRoles,
        startDate: dto.startDate || new Date(),
        endDate: dto.endDate,
        isDismissible: dto.isDismissible ?? true,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      userRole,
      action: 'CREATE_SYSTEM_ALERT',
      entityType: 'SystemAlert',
      entityId: alert.id,
      newValues: { title: alert.title, targetRoles: alert.targetRoles },
    });

    // Notify targeted users via WebSocket
    this.notifyUsersOfNewAlert(alert);

    return alert;
  }

  /**
   * Get all alerts (for admin)
   */
  async getAllAlerts(options?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    type?: AlertType;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }
    if (options?.type) {
      where.type = options.type;
    }

    const [alerts, total] = await Promise.all([
      this.prisma.systemAlert.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { dismissedBy: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.systemAlert.count({ where }),
    ]);

    return {
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get active alerts for a specific user based on their role
   */
  async getActiveAlertsForUser(userId: string, userRole: Role) {
    const now = new Date();

    // Get alerts that:
    // 1. Are active
    // 2. Target the user's role
    // 3. Are within the date range (if specified)
    // 4. Haven't been dismissed by this user
    const alerts = await this.prisma.systemAlert.findMany({
      where: {
        isActive: true,
        targetRoles: { has: userRole },
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
        NOT: {
          dismissedBy: {
            some: { userId },
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return alerts;
  }

  /**
   * Get alert by ID
   */
  async getAlertById(id: string) {
    const alert = await this.prisma.systemAlert.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        dismissedBy: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { dismissedAt: 'desc' },
          take: 100,
        },
        _count: {
          select: { dismissedBy: true },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return alert;
  }

  /**
   * Update an alert
   */
  async updateAlert(id: string, dto: UpdateAlertDto, userId: string, userRole: Role) {
    const existingAlert = await this.prisma.systemAlert.findUnique({
      where: { id },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    const alert = await this.prisma.systemAlert.update({
      where: { id },
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type,
        priority: dto.priority,
        targetRoles: dto.targetRoles,
        isActive: dto.isActive,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isDismissible: dto.isDismissible,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      userRole,
      action: 'UPDATE_SYSTEM_ALERT',
      entityType: 'SystemAlert',
      entityId: alert.id,
      oldValues: { title: existingAlert.title, isActive: existingAlert.isActive },
      newValues: { title: alert.title, isActive: alert.isActive },
    });

    // If alert was reactivated, notify users again
    if (dto.isActive === true && !existingAlert.isActive) {
      this.notifyUsersOfNewAlert(alert);
    }

    return alert;
  }

  /**
   * Delete an alert
   */
  async deleteAlert(id: string, userId: string, userRole: Role) {
    const alert = await this.prisma.systemAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    await this.prisma.systemAlert.delete({
      where: { id },
    });

    // Audit log
    await this.auditService.log({
      userId,
      userRole,
      action: 'DELETE_SYSTEM_ALERT',
      entityType: 'SystemAlert',
      entityId: id,
      oldValues: { title: alert.title },
    });

    return { success: true, message: 'Alert deleted successfully' };
  }

  /**
   * Dismiss an alert for a user
   */
  async dismissAlert(alertId: string, userId: string) {
    const alert = await this.prisma.systemAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} not found`);
    }

    if (!alert.isDismissible) {
      throw new ForbiddenException('This alert cannot be dismissed');
    }

    // Check if already dismissed
    const existing = await this.prisma.systemAlertDismissal.findUnique({
      where: {
        alertId_userId: { alertId, userId },
      },
    });

    if (existing) {
      return { success: true, message: 'Alert already dismissed' };
    }

    await this.prisma.systemAlertDismissal.create({
      data: {
        alertId,
        userId,
      },
    });

    return { success: true, message: 'Alert dismissed successfully' };
  }

  /**
   * Get alert statistics
   */
  async getAlertStats() {
    const now = new Date();

    const [total, active, byType, byPriority] = await Promise.all([
      this.prisma.systemAlert.count(),
      this.prisma.systemAlert.count({
        where: {
          isActive: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      }),
      this.prisma.systemAlert.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      this.prisma.systemAlert.groupBy({
        by: ['priority'],
        where: { isActive: true },
        _count: { id: true },
      }),
    ]);

    return {
      total,
      active,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      byPriority: byPriority.reduce((acc, item) => {
        acc[item.priority] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Notify users of a new alert via WebSocket
   */
  private notifyUsersOfNewAlert(alert: any) {
    // Broadcast to all targeted roles
    for (const role of alert.targetRoles) {
      this.webSocketService.broadcast(`system-alert:${role.toLowerCase()}`, {
        type: 'NEW_ALERT',
        alert: {
          id: alert.id,
          title: alert.title,
          message: alert.message,
          type: alert.type,
          priority: alert.priority,
          isDismissible: alert.isDismissible,
          createdAt: alert.createdAt,
        },
      });
    }

    // Also broadcast to admin channel
    this.webSocketService.broadcast('system-alert:admin', {
      type: 'ALERT_CREATED',
      alert,
    });
  }
}
