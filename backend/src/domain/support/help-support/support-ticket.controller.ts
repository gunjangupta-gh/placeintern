import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupportTicketService } from './support-ticket.service';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import {
  CreateTicketDto,
  RespondTicketDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  ResolveTicketDto,
  CloseTicketDto,
} from './dto';
import { SupportCategory, SupportTicketStatus, SupportTicketPriority } from '../../../generated/prisma/client';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportTicketController {
  constructor(private readonly ticketService: SupportTicketService) {}

  /**
   * Create a new support ticket
   * Access: All authenticated users
   */
  @Post()
  async createTicket(@Body() data: CreateTicketDto, @Request() req: any) {
    return this.ticketService.createTicket(req.user.userId, data);
  }

  /**
   * Get my tickets
   * Access: All authenticated users
   */
  @Get('my-tickets')
  async getMyTickets(@Request() req: any) {
    return this.ticketService.getMyTickets(req.user.userId);
  }

  /**
   * Get all tickets (with optional filtering)
   * Access: STATE_DIRECTORATE only
   */
  @Get()
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async getAllTickets(@Query() query: any) {
    const filters: any = {};

    if (query.status && Object.values(SupportTicketStatus).includes(query.status)) {
      filters.status = query.status;
    }
    if (query.category && Object.values(SupportCategory).includes(query.category)) {
      filters.category = query.category;
    }
    if (query.priority && Object.values(SupportTicketPriority).includes(query.priority)) {
      filters.priority = query.priority;
    }
    if (query.assignedToId) {
      filters.assignedToId = query.assignedToId;
    }
    if (query.fromDate) {
      filters.fromDate = new Date(query.fromDate);
    }
    if (query.toDate) {
      filters.toDate = new Date(query.toDate);
    }

    return this.ticketService.getAllTickets(Object.keys(filters).length > 0 ? filters : undefined);
  }

  /**
   * Get ticket statistics
   * Access: STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Get('statistics')
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async getStatistics() {
    return this.ticketService.getStatistics();
  }

  /**
   * Get assignable users for ticket assignment
   * Access: STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Get('assignable-users')
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async getAssignableUsers() {
    return this.ticketService.getAssignableUsers();
  }

  /**
   * Get a single ticket by ID
   * Access: Owner or STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Get(':id')
  async getTicketById(@Param('id') id: string, @Request() req: any) {
    const ticket = await this.ticketService.getTicketById(id);

    // Check access
    const isOwner = ticket.submittedById === req.user.userId;
    const isAssigned = ticket.assignedToId === req.user.userId;
    const isAdmin = ['STATE_DIRECTORATE', 'SYSTEM_ADMIN'].includes(req.user.role);

    if (!isOwner && !isAssigned && !isAdmin) {
      throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);
    }

    return ticket;
  }

  /**
   * Respond to a ticket
   * Access: Owner or STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Post(':id/respond')
  async respondToTicket(
    @Param('id') id: string,
    @Body() data: RespondTicketDto,
    @Request() req: any,
  ) {
    const ticket = await this.ticketService.getTicketById(id);

    // Check access
    const isOwner = ticket.submittedById === req.user.userId;
    const isAssigned = ticket.assignedToId === req.user.userId;
    const isAdmin = ['STATE_DIRECTORATE', 'SYSTEM_ADMIN'].includes(req.user.role);

    if (!isOwner && !isAssigned && !isAdmin) {
      throw new HttpException('Unauthorized', HttpStatus.FORBIDDEN);
    }

    // Only admin can post internal notes
    if (data.isInternal && !isAdmin) {
      throw new HttpException('Only administrators can post internal notes', HttpStatus.FORBIDDEN);
    }

    return this.ticketService.respondToTicket(id, req.user.userId, data);
  }

  /**
   * Assign ticket to a user
   * Access: STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Patch(':id/assign')
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async assignTicket(
    @Param('id') id: string,
    @Body() data: AssignTicketDto,
    @Request() req: any,
  ) {
    return this.ticketService.assignTicket(id, req.user.userId, data);
  }

  /**
   * Update ticket status
   * Access: STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Patch(':id/status')
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() data: UpdateTicketStatusDto,
    @Request() req: any,
  ) {
    return this.ticketService.updateTicketStatus(id, req.user.userId, data);
  }

  /**
   * Resolve a ticket
   * Access: STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Patch(':id/resolve')
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async resolveTicket(
    @Param('id') id: string,
    @Body() data: ResolveTicketDto,
    @Request() req: any,
  ) {
    if (!data.resolution) {
      throw new HttpException('Resolution is required', HttpStatus.BAD_REQUEST);
    }
    return this.ticketService.resolveTicket(id, req.user.userId, data);
  }

  /**
   * Close a ticket
   * Access: STATE_DIRECTORATE or SYSTEM_ADMIN
   */
  @Patch(':id/close')
  @Roles('STATE_DIRECTORATE', 'SYSTEM_ADMIN')
  async closeTicket(
    @Param('id') id: string,
    @Body() data: CloseTicketDto,
    @Request() req: any,
  ) {
    return this.ticketService.closeTicket(id, req.user.userId, data);
  }
}
