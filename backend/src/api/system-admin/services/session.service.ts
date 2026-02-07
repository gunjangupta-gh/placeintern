import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { TokenBlacklistService } from '../../../core/auth/services/token-blacklist.service';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../../generated/prisma/client';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async getActiveSessions(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    institutionId?: string,
  ) {
    const where: any = {
      invalidatedAt: null,
      expiresAt: { gt: new Date() },
    };

    if (userId) {
      where.userId = userId;
    }

    if (institutionId) {
      where.user = { institutionId };
    }

    const [sessions, total] = await Promise.all([
      this.prisma.userSession.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              institutionId: true,
              Institution: {
                select: { name: true, code: true },
              },
            },
          },
        },
        orderBy: { lastActivityAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userSession.count({ where }),
    ]);

    // Group by role for stats
    const roleGroups = await this.prisma.userSession.groupBy({
      by: ['userId'],
      where,
      _count: true,
    });

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        userEmail: session.user.email,
        userName: session.user.name,
        userRole: session.user.role,
        institutionName: session.user.Institution?.name,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceInfo: session.deviceInfo,
        createdAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      activeUsersCount: roleGroups.length,
    };
  }

  async terminateSession(
    sessionId: string,
    adminUserId: string,
    adminRole: Role,
  ) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { email: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { invalidatedAt: new Date() },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_LOGOUT,
      entityType: 'UserSession',
      entityId: sessionId,
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.MEDIUM,
      description: `Session terminated by admin for user: ${session.user.email}`,
    });

    return {
      success: true,
      message: 'Session terminated successfully',
    };
  }

  async terminateAllSessions(
    options: { exceptCurrent?: boolean; exceptUserId?: string },
    adminUserId: string,
    adminRole: Role,
    currentSessionId?: string,
  ) {
    const where: any = {
      invalidatedAt: null,
      expiresAt: { gt: new Date() },
    };

    if (options.exceptCurrent && currentSessionId) {
      where.id = { not: currentSessionId };
    }

    if (options.exceptUserId) {
      where.userId = { not: options.exceptUserId };
    }

    const result = await this.prisma.userSession.updateMany({
      where,
      data: { invalidatedAt: new Date() },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.BULK_OPERATION,
      entityType: 'UserSession',
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      description: `All sessions terminated (${result.count} sessions)`,
      newValues: { terminated: result.count, options },
    });

    return {
      success: true,
      terminated: result.count,
      message: `${result.count} sessions terminated`,
    };
  }

  async terminateUserSessions(
    targetUserId: string,
    adminUserId: string,
    adminRole: Role,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Invalidate all sessions
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId: targetUserId,
        invalidatedAt: null,
      },
      data: { invalidatedAt: new Date() },
    });

    // Also invalidate tokens via token blacklist
    await this.tokenBlacklistService.invalidateUserTokens(targetUserId);

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_LOGOUT,
      entityType: 'UserSession',
      entityId: targetUserId,
      userId: adminUserId,
      userRole: adminRole,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.HIGH,
      description: `All sessions terminated for user: ${user.email} (${result.count} sessions)`,
    });

    return {
      success: true,
      terminated: result.count,
      message: `${result.count} sessions terminated for user`,
    };
  }

  async getSessionStats() {
    const now = new Date();

    const [totalActive, last24h, last7d] = await Promise.all([
      this.prisma.userSession.count({
        where: {
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.userSession.count({
        where: {
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.userSession.count({
        where: {
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get sessions with user roles for grouping
    const activeSessions = await this.prisma.userSession.findMany({
      where: {
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: { select: { role: true } },
      },
    });

    // Group by role manually since MongoDB doesn't support SQL joins
    const roleCountMap: Record<string, number> = {};
    activeSessions.forEach((session) => {
      const role = session.user?.role || 'UNKNOWN';
      roleCountMap[role] = (roleCountMap[role] || 0) + 1;
    });

    const byRole = Object.entries(roleCountMap).map(([role, count]) => ({
      role,
      count,
    }));

    return {
      totalActive,
      sessionsLast24h: last24h,
      sessionsLast7d: last7d,
      byRole,
    };
  }
}
