import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../generated/prisma/client';

interface AuditLogData {
  action: AuditAction | string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userRole?: Role | string;
  userName?: string;
  description?: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];
  category?: AuditCategory;
  severity?: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
  institutionId?: string;
}

interface AuditFilters {
  userId?: string;
  action?: AuditAction | string;
  entityType?: string;
  entityId?: string;
  category?: AuditCategory;
  startDate?: Date;
  endDate?: Date;
  institutionId?: string;
  page?: number;
  limit?: number;
}

export interface AuditStatistics {
  totalLogs: number;
  actionBreakdown: { action: string; count: number }[];
  entityTypeBreakdown: { entityType: string; count: number }[];
  userActivityBreakdown: { userId: string; userName: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit entry with comprehensive tracking
   */
  async log(data: AuditLogData) {
    try {
      // Determine action - convert string to enum if necessary
      let action: AuditAction;
      if (typeof data.action === 'string') {
        // Try to match to enum, fallback to a generic action
        action = AuditAction[data.action as keyof typeof AuditAction] || AuditAction.SYSTEM_BACKUP;
      } else {
        action = data.action;
      }

      // Determine userRole - convert string to enum if necessary
      let userRole: Role = Role.STUDENT; // Default
      if (data.userRole) {
        if (typeof data.userRole === 'string') {
          userRole = Role[data.userRole as keyof typeof Role] || Role.STUDENT;
        } else {
          userRole = data.userRole;
        }
      }

      // Determine category based on action if not provided
      const category = data.category || this.determineCategory(action);

      return await this.prisma.auditLog.create({
        data: {
          action,
          entityType: data.entityType,
          entityId: data.entityId || null,
          userId: data.userId || null,
          userRole,
          userName: data.userName || null,
          description: data.description || null,
          oldValues: data.oldValues || null,
          newValues: data.newValues || null,
          changedFields: data.changedFields || [],
          category,
          severity: data.severity || AuditSeverity.LOW,
          institutionId: data.institutionId || null,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
      // Don't throw - audit logging should not break application flow
      return null;
    }
  }

  /**
   * Get audit logs with filters and pagination
   */
  async getAuditLogs(filters: AuditFilters = {}): Promise<{
    logs: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const {
        userId,
        action,
        entityType,
        entityId,
        category,
        startDate,
        endDate,
        institutionId,
        page = 1,
        limit = 50,
      } = filters;

      // Build where clause
      const where: any = {};

      if (userId) where.userId = userId;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (category) where.category = category;
      if (institutionId) where.institutionId = institutionId;

      if (action) {
        if (typeof action === 'string') {
          where.action = AuditAction[action as keyof typeof AuditAction] || action;
        } else {
          where.action = action;
        }
      }

      if (startDate && endDate) {
        where.timestamp = {
          gte: startDate,
          lte: endDate,
        };
      } else if (startDate) {
        where.timestamp = { gte: startDate };
      } else if (endDate) {
        where.timestamp = { lte: endDate };
      }

      // Execute query with pagination
      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Failed to get audit logs', error);
      throw error;
    }
  }

  /**
   * Get audit statistics with breakdown by action, entity type, user activity, and category
   */
  async getStatistics(filters?: {
    startDate?: Date;
    endDate?: Date;
    institutionId?: string;
  }): Promise<AuditStatistics> {
    try {
      const where: any = {};

      if (filters?.institutionId) {
        where.institutionId = filters.institutionId;
      }

      if (filters?.startDate && filters?.endDate) {
        where.timestamp = {
          gte: filters.startDate,
          lte: filters.endDate,
        };
      } else if (filters?.startDate) {
        where.timestamp = { gte: filters.startDate };
      } else if (filters?.endDate) {
        where.timestamp = { lte: filters.endDate };
      }

      // Total logs
      const totalLogs = await this.prisma.auditLog.count({ where });

      // Action breakdown
      const actionBreakdown = await this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: {
          action: true,
        },
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
      });

      // Entity type breakdown
      const entityTypeBreakdown = await this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: {
          entityType: true,
        },
        orderBy: {
          _count: {
            entityType: 'desc',
          },
        },
      });

      // Category breakdown
      const categoryBreakdown = await this.prisma.auditLog.groupBy({
        by: ['category'],
        where,
        _count: {
          category: true,
        },
        orderBy: {
          _count: {
            category: 'desc',
          },
        },
      });

      // User activity breakdown (top 10 users)
      const userActivityBreakdown = await this.prisma.auditLog.groupBy({
        by: ['userId', 'userName'],
        where: {
          ...where,
          userId: { not: null },
        },
        _count: {
          userId: true,
        },
        orderBy: {
          _count: {
            userId: 'desc',
          },
        },
        take: 10,
      });

      return {
        totalLogs,
        actionBreakdown: actionBreakdown.map((item) => ({
          action: item.action,
          count: item._count.action,
        })),
        entityTypeBreakdown: entityTypeBreakdown.map((item) => ({
          entityType: item.entityType,
          count: item._count.entityType,
        })),
        categoryBreakdown: categoryBreakdown.map((item) => ({
          category: item.category,
          count: item._count.category,
        })),
        userActivityBreakdown: userActivityBreakdown.map((item) => ({
          userId: item.userId || 'unknown',
          userName: item.userName || 'Unknown User',
          count: item._count.userId,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get audit statistics', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific entity with pagination
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{
    logs: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const { page = 1, limit = 50 } = options;

      const where = {
        entityType,
        entityId,
      };

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        logs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Failed to get entity audit trail', error);
      throw error;
    }
  }

  /**
   * Delete old audit logs (cleanup)
   */
  async deleteOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Deleted ${result.count} old audit logs`);
      return result.count;
    } catch (error) {
      this.logger.error('Failed to delete old audit logs', error);
      throw error;
    }
  }

  /**
   * Determine category based on action
   */
  private determineCategory(action: AuditAction): AuditCategory {
    const actionString = action.toString();

    if (actionString.includes('LOGIN') || actionString.includes('LOGOUT') || actionString.includes('PASSWORD')) {
      return AuditCategory.AUTHENTICATION;
    } else if (actionString.includes('PROFILE') || actionString.includes('DOCUMENT')) {
      return AuditCategory.PROFILE_MANAGEMENT;
    } else if (actionString.includes('INTERNSHIP')) {
      return AuditCategory.INTERNSHIP_WORKFLOW;
    } else if (actionString.includes('APPLICATION')) {
      return AuditCategory.APPLICATION_PROCESS;
    } else if (actionString.includes('FEEDBACK')) {
      return AuditCategory.FEEDBACK_SYSTEM;
    } else if (actionString.includes('REPORT') || actionString.includes('BULK') || actionString.includes('EXPORT')) {
      return AuditCategory.ADMINISTRATIVE;
    } else if (actionString.includes('UNAUTHORIZED') || actionString.includes('FAILED') || actionString.includes('BREACH')) {
      return AuditCategory.SECURITY;
    } else {
      return AuditCategory.ADMINISTRATIVE;
    }
  }
}
