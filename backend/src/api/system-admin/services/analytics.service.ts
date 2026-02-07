import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { Role, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';

export interface LoginAnalytics {
  totalLogins: number;
  uniqueUsers: number;
  failedLogins: number;
  avgSessionDuration: number;
  loginsByHour: { hour: number; count: number }[];
  loginsByDay: { day: string; count: number }[];
  loginsByRole: { role: string; count: number }[];
  topLocations: { location: string; count: number }[];
  suspiciousActivities: SuspiciousActivity[];
}

export interface SuspiciousActivity {
  id: string;
  userId: string;
  userName: string;
  type: 'multiple_failed_logins' | 'unusual_location' | 'unusual_time' | 'rapid_requests';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemTrends {
  userGrowth: { date: string; count: number; change: number }[];
  sessionTrends: { date: string; count: number }[];
  storageGrowth: { date: string; size: number }[];
  activityTrends: { date: string; actions: number }[];
}

export interface DashboardSummary {
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    totalInstitutions: number;
    activeInstitutions: number;
    totalStudents: number;
    totalInternships: number;
    activeInternships: number;
    pendingApplications: number;
  };
  health: {
    systemStatus: 'healthy' | 'degraded' | 'unhealthy';
    servicesUp: number;
    servicesDown: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  activity: {
    loginsToday: number;
    actionsToday: number;
    errorsToday: number;
    alertsToday: number;
  };
  recentAlerts: {
    id: string;
    type: string;
    message: string;
    severity: string;
    timestamp: Date;
  }[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get comprehensive login analytics
   */
  async getLoginAnalytics(days: number = 30): Promise<LoginAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      // Get login events from audit logs
      const loginEvents = await this.prisma.auditLog.findMany({
        where: {
          action: { in: ['USER_LOGIN', 'FAILED_LOGIN'] },
          timestamp: { gte: startDate },
        },
        orderBy: { timestamp: 'desc' },
      });

      const successfulLogins = loginEvents.filter(e => e.action === 'USER_LOGIN');
      const failedLogins = loginEvents.filter(e => e.action === 'FAILED_LOGIN');

      // Unique users who logged in
      const uniqueUserIds = new Set(successfulLogins.map(e => e.userId).filter(Boolean));

      // Logins by hour
      const loginsByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
      successfulLogins.forEach(login => {
        const hour = new Date(login.timestamp).getHours();
        loginsByHour[hour].count++;
      });

      // Logins by day
      const loginsByDayMap = new Map<string, number>();
      successfulLogins.forEach(login => {
        const day = new Date(login.timestamp).toISOString().split('T')[0];
        loginsByDayMap.set(day, (loginsByDayMap.get(day) || 0) + 1);
      });
      const loginsByDay = Array.from(loginsByDayMap.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day));

      // Logins by role
      const roleCountMap = new Map<string, number>();
      successfulLogins.forEach(login => {
        const role = login.userRole || 'UNKNOWN';
        roleCountMap.set(role, (roleCountMap.get(role) || 0) + 1);
      });
      const loginsByRole = Array.from(roleCountMap.entries())
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count);

      // Detect suspicious activities
      const suspiciousActivities = await this.detectSuspiciousActivities(days);

      // Calculate average session duration from sessions
      const sessions = await this.prisma.userSession.findMany({
        where: {
          createdAt: { gte: startDate },
          invalidatedAt: { not: null },
        },
        select: {
          createdAt: true,
          invalidatedAt: true,
        },
      });

      let totalDuration = 0;
      sessions.forEach(session => {
        if (session.invalidatedAt) {
          totalDuration += session.invalidatedAt.getTime() - session.createdAt.getTime();
        }
      });
      const avgSessionDuration = sessions.length > 0
        ? Math.round(totalDuration / sessions.length / 60000) // in minutes
        : 0;

      return {
        totalLogins: successfulLogins.length,
        uniqueUsers: uniqueUserIds.size,
        failedLogins: failedLogins.length,
        avgSessionDuration,
        loginsByHour,
        loginsByDay,
        loginsByRole,
        topLocations: [], // Would need IP geolocation service
        suspiciousActivities,
      };
    } catch (error) {
      this.logger.error('Failed to get login analytics', error);
      throw error;
    }
  }

  /**
   * Detect suspicious activities
   */
  async detectSuspiciousActivities(days: number = 7): Promise<SuspiciousActivity[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const activities: SuspiciousActivity[] = [];

    try {
      // Find users with multiple failed logins
      const failedLogins = await this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          action: 'FAILED_LOGIN',
          timestamp: { gte: startDate },
          userId: { not: null },
        },
        _count: { userId: true },
        having: {
          userId: { _count: { gte: 5 } },
        },
      });

      for (const failed of failedLogins) {
        if (failed.userId) {
          const user = await this.prisma.user.findUnique({
            where: { id: failed.userId },
            select: { name: true, email: true },
          });

          activities.push({
            id: `failed-${failed.userId}`,
            userId: failed.userId,
            userName: user?.name || 'Unknown',
            type: 'multiple_failed_logins',
            description: `${failed._count.userId} failed login attempts in the last ${days} days`,
            severity: failed._count.userId >= 10 ? 'high' : 'medium',
            timestamp: new Date(),
            metadata: { failedAttempts: failed._count.userId },
          });
        }
      }

      // Find logins at unusual hours (2 AM - 5 AM local time)
      const unusualTimeLogins = await this.prisma.auditLog.findMany({
        where: {
          action: 'USER_LOGIN',
          timestamp: { gte: startDate },
          userId: { not: null },
        },
        select: {
          userId: true,
          userName: true,
          timestamp: true,
        },
      });

      const unusualHourLogins = unusualTimeLogins.filter(login => {
        const hour = new Date(login.timestamp).getHours();
        return hour >= 2 && hour <= 5;
      });

      // Group by user
      const unusualByUser = new Map<string, { count: number; userName: string }>();
      unusualHourLogins.forEach(login => {
        if (login.userId) {
          const existing = unusualByUser.get(login.userId);
          if (existing) {
            existing.count++;
          } else {
            unusualByUser.set(login.userId, { count: 1, userName: login.userName || 'Unknown' });
          }
        }
      });

      unusualByUser.forEach((data, userId) => {
        if (data.count >= 3) {
          activities.push({
            id: `unusual-time-${userId}`,
            userId,
            userName: data.userName,
            type: 'unusual_time',
            description: `${data.count} logins during unusual hours (2-5 AM)`,
            severity: 'low',
            timestamp: new Date(),
            metadata: { loginCount: data.count },
          });
        }
      });

      return activities.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
    } catch (error) {
      this.logger.error('Failed to detect suspicious activities', error);
      return [];
    }
  }

  /**
   * Get system trends over time
   */
  async getSystemTrends(days: number = 30): Promise<SystemTrends> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      // User growth trend
      const userGrowth: { date: string; count: number; change: number }[] = [];
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(23, 59, 59, 999);

        const count = await this.prisma.user.count({
          where: { createdAt: { lte: date } },
        });

        const previousCount = userGrowth.length > 0
          ? userGrowth[userGrowth.length - 1].count
          : count;

        userGrowth.push({
          date: date.toISOString().split('T')[0],
          count,
          change: count - previousCount,
        });
      }

      // Session trends
      const sessionTrends: { date: string; count: number }[] = [];
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await this.prisma.userSession.count({
          where: {
            createdAt: {
              gte: new Date(date.setHours(0, 0, 0, 0)),
              lt: new Date(nextDate.setHours(0, 0, 0, 0)),
            },
          },
        });

        sessionTrends.push({
          date: date.toISOString().split('T')[0],
          count,
        });
      }

      // Activity trends (from audit logs)
      const activityTrends: { date: string; actions: number }[] = [];
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = await this.prisma.auditLog.count({
          where: {
            timestamp: {
              gte: new Date(date.setHours(0, 0, 0, 0)),
              lt: new Date(nextDate.setHours(0, 0, 0, 0)),
            },
          },
        });

        activityTrends.push({
          date: date.toISOString().split('T')[0],
          actions: count,
        });
      }

      return {
        userGrowth,
        sessionTrends,
        storageGrowth: [], // Would need storage tracking
        activityTrends,
      };
    } catch (error) {
      this.logger.error('Failed to get system trends', error);
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard summary
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    try {
      // User statistics
      const [
        totalUsers,
        activeUsers,
        newUsersToday,
        newUsersThisWeek,
        totalInstitutions,
        activeInstitutions,
        totalStudents,
        pendingApplications,
      ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { active: true } }),
        this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        this.prisma.institution.count(),
        this.prisma.institution.count({ where: { isActive: true } }),
        this.prisma.student.count(),
        this.prisma.internshipApplication.count({ where: { status: 'UNDER_REVIEW' } }).catch(() => 0),
      ]);

      // Industry-posted internships removed - only self-identified internships supported
      const totalInternships = 0;
      const activeInternships = 0;

      // Activity statistics
      const [loginsToday, actionsToday, errorsToday] = await Promise.all([
        this.prisma.auditLog.count({
          where: {
            action: 'USER_LOGIN',
            timestamp: { gte: todayStart },
          },
        }),
        this.prisma.auditLog.count({
          where: { timestamp: { gte: todayStart } },
        }),
        this.prisma.auditLog.count({
          where: {
            severity: 'CRITICAL',
            timestamp: { gte: todayStart },
          },
        }),
      ]);

      // Recent critical alerts
      const recentAlerts = await this.prisma.auditLog.findMany({
        where: {
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          description: true,
          severity: true,
          timestamp: true,
        },
      });

      return {
        overview: {
          totalUsers,
          activeUsers,
          newUsersToday,
          newUsersThisWeek,
          totalInstitutions,
          activeInstitutions,
          totalStudents,
          totalInternships,
          activeInternships,
          pendingApplications,
        },
        health: {
          systemStatus: 'healthy', // Would be computed from metrics
          servicesUp: 4,
          servicesDown: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
        },
        activity: {
          loginsToday,
          actionsToday,
          errorsToday,
          alertsToday: recentAlerts.filter(a =>
            new Date(a.timestamp) >= todayStart
          ).length,
        },
        recentAlerts: recentAlerts.map(alert => ({
          id: alert.id,
          type: alert.action,
          message: alert.description || `${alert.action} event`,
          severity: alert.severity,
          timestamp: alert.timestamp,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard summary', error);
      throw error;
    }
  }

  /**
   * Get user activity heatmap data
   */
  async getUserActivityHeatmap(userId?: string): Promise<{ day: number; hour: number; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    try {
      const whereClause: any = { timestamp: { gte: startDate } };
      if (userId) {
        whereClause.userId = userId;
      }

      const activities = await this.prisma.auditLog.findMany({
        where: whereClause,
        select: { timestamp: true },
      });

      // Create heatmap data
      const heatmap: Map<string, number> = new Map();

      activities.forEach(activity => {
        const date = new Date(activity.timestamp);
        const day = date.getDay(); // 0-6
        const hour = date.getHours(); // 0-23
        const key = `${day}-${hour}`;
        heatmap.set(key, (heatmap.get(key) || 0) + 1);
      });

      const result: { day: number; hour: number; count: number }[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          result.push({
            day,
            hour,
            count: heatmap.get(`${day}-${hour}`) || 0,
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get activity heatmap', error);
      return [];
    }
  }
}
