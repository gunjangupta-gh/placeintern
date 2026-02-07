import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NotificationService } from '../../../infrastructure/notification/notification.service';
import {
  SupportCategory,
  SupportTicketStatus,
  SupportTicketPriority,
  Role,
} from '../../../generated/prisma/client';
import {
  CreateTicketDto,
  RespondTicketDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  ResolveTicketDto,
  CloseTicketDto,
} from './dto';

@Injectable()
export class SupportTicketService {
  private readonly logger = new Logger(SupportTicketService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Generate unique ticket number: SUP-YYYYMMDD-XXXX
   */
  private async generateTicketNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Count tickets created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const todayCount = await this.prisma.supportTicket.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequenceNumber = String(todayCount + 1).padStart(4, '0');
    return `SUP-${dateStr}-${sequenceNumber}`;
  }

  /** Default limit for responses to prevent memory issues on tickets with many responses */
  private readonly DEFAULT_RESPONSE_LIMIT = 20;

  /**
   * Get ticket with all relations
   * Responses are paginated to last 20 by default to prevent memory overflow
   * @param responseLimit - Optional limit for responses (default: 20)
   */
  private getTicketInclude(responseLimit?: number) {
    const limit = responseLimit ?? this.DEFAULT_RESPONSE_LIMIT;
    return {
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      institution: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      responses: {
        include: {
          responder: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' as const },
        take: limit,  // Limit to prevent memory overflow on tickets with many responses
      },
    };
  }

  /**
   * Create a new support ticket
   */
  async createTicket(userId: string, data: CreateTicketDto) {
    try {
      this.logger.log(`Creating support ticket for user ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { Institution: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const ticketNumber = await this.generateTicketNumber();

      const ticket = await this.prisma.supportTicket.create({
        data: {
          ticketNumber,
          submittedById: userId,
          submitterRole: user.role,
          submitterName: user.name,
          submitterEmail: user.email,
          subject: data.subject,
          description: data.description,
          category: data.category,
          priority: data.priority || SupportTicketPriority.MEDIUM,
          attachments: data.attachments || [],
          status: SupportTicketStatus.OPEN,
          institutionId: user.institutionId,
          statusHistory: [
            {
              status: SupportTicketStatus.OPEN,
              changedBy: userId,
              changedByName: user.name,
              changedAt: new Date().toISOString(),
              action: 'CREATED',
            },
          ],
        },
        include: this.getTicketInclude(),
      });

      // Notify STATE_DIRECTORATE users about new ticket
      const stateUsers = await this.prisma.user.findMany({
        where: {
          role: Role.STATE_DIRECTORATE,
          active: true,
        },
        select: { id: true },
      });

      for (const stateUser of stateUsers) {
        await this.notificationService.create(
          stateUser.id,
          'SUPPORT_TICKET_NEW',
          'New Support Ticket',
          `New support ticket "${data.subject}" submitted by ${user.name}`,
          { ticketId: ticket.id, ticketNumber, category: data.category }
        );
      }

      // Invalidate cache
      await this.invalidateTicketCache(userId);

      return ticket;
    } catch (error) {
      this.logger.error(`Failed to create support ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get tickets by user (their own tickets)
   */
  async getMyTickets(userId: string) {
    try {
      const cacheKey = `support-tickets:user:${userId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.supportTicket.findMany({
            where: { submittedById: userId },
            include: this.getTicketInclude(),
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get tickets for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all tickets (for STATE_DIRECTORATE)
   */
  async getAllTickets(filters?: {
    status?: SupportTicketStatus;
    category?: SupportCategory;
    priority?: SupportTicketPriority;
    assignedToId?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    try {
      const whereClause: any = {};

      if (filters?.status) {
        whereClause.status = filters.status;
      }
      if (filters?.category) {
        whereClause.category = filters.category;
      }
      if (filters?.priority) {
        whereClause.priority = filters.priority;
      }
      if (filters?.assignedToId) {
        whereClause.assignedToId = filters.assignedToId;
      }
      if (filters?.fromDate || filters?.toDate) {
        whereClause.createdAt = {};
        if (filters.fromDate) {
          whereClause.createdAt.gte = filters.fromDate;
        }
        if (filters.toDate) {
          whereClause.createdAt.lte = filters.toDate;
        }
      }

      return await this.prisma.supportTicket.findMany({
        where: whereClause,
        include: this.getTicketInclude(),
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get all tickets: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(id: string) {
    try {
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id },
        include: this.getTicketInclude(),
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      return ticket;
    } catch (error) {
      this.logger.error(`Failed to get ticket ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Respond to a ticket
   */
  async respondToTicket(ticketId: string, responderId: string, data: RespondTicketDto) {
    try {
      this.logger.log(`Responding to ticket ${ticketId} by user ${responderId}`);

      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { submittedBy: true },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      const responder = await this.prisma.user.findUnique({
        where: { id: responderId },
      });

      if (!responder) {
        throw new NotFoundException('Responder not found');
      }

      // Create response
      const response = await this.prisma.supportResponse.create({
        data: {
          ticketId,
          responderId,
          responderRole: responder.role,
          responderName: responder.name,
          message: data.message,
          attachments: data.attachments || [],
          isInternal: data.isInternal || false,
        },
        include: {
          responder: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      // Update ticket metadata
      const isFromSubmitter = responderId === ticket.submittedById;
      const newStatus = isFromSubmitter
        ? SupportTicketStatus.OPEN
        : ticket.status === SupportTicketStatus.OPEN
          ? SupportTicketStatus.IN_PROGRESS
          : ticket.status;

      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          lastResponseAt: new Date(),
          lastResponseById: responderId,
          responseCount: { increment: 1 },
          status: newStatus,
        },
      });

      // Notify appropriately
      if (!data.isInternal) {
        if (isFromSubmitter) {
          // Notify assigned user or all STATE_DIRECTORATE users
          if (ticket.assignedToId) {
            await this.notificationService.create(
              ticket.assignedToId,
              'SUPPORT_TICKET_RESPONSE',
              'Ticket Updated',
              `${responder.name} replied to ticket "${ticket.subject}"`,
              { ticketId, ticketNumber: ticket.ticketNumber }
            );
          }
        } else {
          // Notify submitter
          await this.notificationService.create(
            ticket.submittedById,
            'SUPPORT_TICKET_RESPONSE',
            'Ticket Response',
            `Your support ticket "${ticket.subject}" has received a response`,
            { ticketId, ticketNumber: ticket.ticketNumber }
          );
        }
      }

      // Invalidate cache
      await this.invalidateTicketCache(ticket.submittedById);

      return response;
    } catch (error) {
      this.logger.error(`Failed to respond to ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign ticket to a user
   */
  async assignTicket(ticketId: string, assignerId: string, data: AssignTicketDto) {
    try {
      this.logger.log(`Assigning ticket ${ticketId} to user ${data.assigneeId}`);

      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { submittedBy: true },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      const assignee = await this.prisma.user.findUnique({
        where: { id: data.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }

      const assigner = await this.prisma.user.findUnique({
        where: { id: assignerId },
      });

      // Update ticket
      const updated = await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          assignedToId: data.assigneeId,
          assignedAt: new Date(),
          assignedBy: assignerId,
          status: SupportTicketStatus.ASSIGNED,
          statusHistory: {
            push: {
              status: SupportTicketStatus.ASSIGNED,
              changedBy: assignerId,
              changedByName: assigner?.name,
              changedAt: new Date().toISOString(),
              action: 'ASSIGNED',
              remarks: data.remarks || `Assigned to ${assignee.name}`,
            },
          },
        },
        include: this.getTicketInclude(),
      });

      // Notify assignee
      await this.notificationService.create(
        data.assigneeId,
        'SUPPORT_TICKET_ASSIGNED',
        'Ticket Assigned',
        `Support ticket "${ticket.subject}" has been assigned to you`,
        { ticketId, ticketNumber: ticket.ticketNumber }
      );

      // Invalidate cache
      await this.invalidateTicketCache(ticket.submittedById);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to assign ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(ticketId: string, updaterId: string, data: UpdateTicketStatusDto) {
    try {
      this.logger.log(`Updating ticket ${ticketId} status to ${data.status}`);

      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { submittedBy: true },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      const updater = await this.prisma.user.findUnique({
        where: { id: updaterId },
      });

      const updated = await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: data.status,
          statusHistory: {
            push: {
              status: data.status,
              changedBy: updaterId,
              changedByName: updater?.name,
              changedAt: new Date().toISOString(),
              action: 'STATUS_CHANGED',
              remarks: data.remarks,
            },
          },
        },
        include: this.getTicketInclude(),
      });

      // Notify submitter
      await this.notificationService.create(
        ticket.submittedById,
        'SUPPORT_TICKET_RESPONSE',
        'Ticket Status Updated',
        `Your support ticket "${ticket.subject}" status has been updated to ${data.status.replace(/_/g, ' ')}`,
        { ticketId, ticketNumber: ticket.ticketNumber, status: data.status }
      );

      // Invalidate cache
      await this.invalidateTicketCache(ticket.submittedById);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update ticket status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Resolve a ticket
   */
  async resolveTicket(ticketId: string, resolverId: string, data: ResolveTicketDto) {
    try {
      this.logger.log(`Resolving ticket ${ticketId}`);

      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { submittedBy: true },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      const resolver = await this.prisma.user.findUnique({
        where: { id: resolverId },
      });

      const updated = await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.RESOLVED,
          resolution: data.resolution,
          resolvedAt: new Date(),
          resolvedById: resolverId,
          statusHistory: {
            push: {
              status: SupportTicketStatus.RESOLVED,
              changedBy: resolverId,
              changedByName: resolver?.name,
              changedAt: new Date().toISOString(),
              action: 'RESOLVED',
              remarks: data.remarks || data.resolution,
            },
          },
        },
        include: this.getTicketInclude(),
      });

      // Notify submitter
      await this.notificationService.create(
        ticket.submittedById,
        'SUPPORT_TICKET_RESOLVED',
        'Ticket Resolved',
        `Your support ticket "${ticket.subject}" has been resolved`,
        { ticketId, ticketNumber: ticket.ticketNumber, resolution: data.resolution }
      );

      // Invalidate cache
      await this.invalidateTicketCache(ticket.submittedById);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to resolve ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Close a ticket
   */
  async closeTicket(ticketId: string, closerId: string, data: CloseTicketDto) {
    try {
      this.logger.log(`Closing ticket ${ticketId}`);

      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { submittedBy: true },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      const closer = await this.prisma.user.findUnique({
        where: { id: closerId },
      });

      const updated = await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.CLOSED,
          closedAt: new Date(),
          closedById: closerId,
          closureRemarks: data.closureRemarks,
          statusHistory: {
            push: {
              status: SupportTicketStatus.CLOSED,
              changedBy: closerId,
              changedByName: closer?.name,
              changedAt: new Date().toISOString(),
              action: 'CLOSED',
              remarks: data.closureRemarks,
            },
          },
        },
        include: this.getTicketInclude(),
      });

      // Invalidate cache
      await this.invalidateTicketCache(ticket.submittedById);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to close ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get ticket statistics
   * OPTIMIZED: Uses groupBy aggregations instead of multiple count queries
   */
  async getStatistics() {
    try {
      // Use groupBy to get status counts in a single query
      const statusCounts = await this.prisma.supportTicket.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      // Use groupBy to get priority counts in a single query
      const priorityCounts = await this.prisma.supportTicket.groupBy({
        by: ['priority'],
        _count: { priority: true },
      });

      // Use groupBy to get category counts in a single query
      const categoryCounts = await this.prisma.supportTicket.groupBy({
        by: ['category'],
        _count: { category: true },
      });

      // Get recent tickets (last 7 days) and unassigned in parallel
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [recentCount, unassigned] = await Promise.all([
        this.prisma.supportTicket.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        this.prisma.supportTicket.count({
          where: {
            assignedToId: null,
            status: { in: [SupportTicketStatus.OPEN] },
          },
        }),
      ]);

      // Build status map
      const statusMap = new Map(
        statusCounts.map(s => [s.status, s._count.status])
      );

      // Build priority map
      const priorityMap = new Map(
        priorityCounts.map(p => [p.priority, p._count.priority])
      );

      // Build category map
      const categoryMap = new Map(
        categoryCounts.map(c => [c.category, c._count.category])
      );

      // Extract values with defaults
      const open = statusMap.get(SupportTicketStatus.OPEN) || 0;
      const assigned = statusMap.get(SupportTicketStatus.ASSIGNED) || 0;
      const inProgress = statusMap.get(SupportTicketStatus.IN_PROGRESS) || 0;
      const pendingUser = statusMap.get(SupportTicketStatus.PENDING_USER) || 0;
      const resolved = statusMap.get(SupportTicketStatus.RESOLVED) || 0;
      const closed = statusMap.get(SupportTicketStatus.CLOSED) || 0;
      const total = open + assigned + inProgress + pendingUser + resolved + closed;

      return {
        total,
        byStatus: {
          open,
          assigned,
          inProgress,
          pendingUser,
          resolved,
          closed,
        },
        byPriority: {
          low: priorityMap.get(SupportTicketPriority.LOW) || 0,
          medium: priorityMap.get(SupportTicketPriority.MEDIUM) || 0,
          high: priorityMap.get(SupportTicketPriority.HIGH) || 0,
          urgent: priorityMap.get(SupportTicketPriority.URGENT) || 0,
        },
        byCategory: Object.values(SupportCategory).reduce((acc, category) => {
          acc[category] = categoryMap.get(category) || 0;
          return acc;
        }, {} as Record<string, number>),
        summary: {
          active: open + assigned + inProgress + pendingUser,
          resolved: resolved + closed,
          unassigned,
          recentWeek: recentCount,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get assignable users (STATE_DIRECTORATE users)
   */
  async getAssignableUsers() {
    try {
      return await this.prisma.user.findMany({
        where: {
          role: Role.STATE_DIRECTORATE,
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get assignable users: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper to invalidate ticket cache
   */
  private async invalidateTicketCache(userId?: string) {
    if (userId) {
      await this.cache.del(`support-tickets:user:${userId}`);
    }
    await this.cache.del('support-tickets:all');
  }
}
