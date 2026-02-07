import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { NotificationService } from '../../../infrastructure/notification/notification.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import {
  GrievanceCategory,
  GrievancePriority,
  GrievanceStatus,
  EscalationLevel,
  Role,
  AuditAction,
  AuditCategory,
  AuditSeverity,
} from '../../../generated/prisma/client';

export interface SubmitGrievanceDto {
  title: string;
  category: GrievanceCategory;
  description: string;
  severity?: GrievancePriority;
  attachments?: string[];
  assignedToId?: string;
  facultySupervisorId?: string;
  actionRequested?: string;
  preferredContactMethod?: string;
}

export interface RespondToGrievanceDto {
  response: string;
  attachments?: string[];
  newStatus?: GrievanceStatus;
}

export interface AssignGrievanceDto {
  assigneeId: string;
  remarks?: string;
}

export interface EscalateGrievanceDto {
  reason: string;
  escalateToId?: string; // Optional - if not provided, auto-determine next level
}

// Escalation chain definition
const ESCALATION_CHAIN: EscalationLevel[] = [
  EscalationLevel.MENTOR,
  EscalationLevel.PRINCIPAL,
  EscalationLevel.STATE_DIRECTORATE,
];

@Injectable()
export class GrievanceService {
  private readonly logger = new Logger(GrievanceService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
  ) {}

  // Helper to get next escalation level
  private getNextEscalationLevel(current: EscalationLevel): EscalationLevel | null {
    const currentIndex = ESCALATION_CHAIN.indexOf(current);
    if (currentIndex === -1 || currentIndex >= ESCALATION_CHAIN.length - 1) {
      return null; // Already at highest level
    }
    return ESCALATION_CHAIN[currentIndex + 1];
  }

  // Helper to get role for escalation level
  private getRoleForEscalationLevel(level: EscalationLevel): Role {
    switch (level) {
      case EscalationLevel.MENTOR:
        return Role.TEACHER;
      case EscalationLevel.PRINCIPAL:
        return Role.PRINCIPAL;
      case EscalationLevel.STATE_DIRECTORATE:
        return Role.STATE_DIRECTORATE;
      default:
        return Role.TEACHER;
    }
  }

  // Get grievance with basic relations (for list views - faster, no data integrity issues)
  private getGrievanceListInclude() {
    return {
      student: {
        include: {
          user: true,
          Institution: true
        }
      },
      assignedTo: true,
      facultySupervisor: true,
    };
  }

  // Get grievance with all relations including status history (for detail views)
  private getGrievanceDetailInclude() {
    return {
      student: {
        include: {
          user: true,
          Institution: true
        }
      },
      assignedTo: true,
      facultySupervisor: true,
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  /**
   * Submit a new grievance
   */
  async submitGrievance(userId: string, data: SubmitGrievanceDto) {
    try {
      this.logger.log(`Submitting grievance for user ${userId}`);

      const student = await this.prisma.student.findUnique({
        where: { userId },
        include: { user: true, Institution: true }
      });
      if (!student) throw new NotFoundException('Student not found');

      // Auto-assign to student's mentor if no assignedToId provided
      let assignedToId = data.assignedToId;
      let mentorUser: any = null;

      if (!assignedToId) {
        // Find student's active mentor assignment
        const mentorAssignment = await this.prisma.mentorAssignment.findFirst({
          where: {
            studentId: student.id,
            isActive: true,
          },
          include: {
            mentor: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        if (mentorAssignment?.mentor) {
          assignedToId = mentorAssignment.mentor.id;
          mentorUser = mentorAssignment.mentor;
          this.logger.log(`Auto-assigning grievance to mentor ${mentorUser.name} (${assignedToId})`);
        }
      }

      // Create grievance with initial status
      const grievance = await this.prisma.grievance.create({
        data: {
          studentId: student.id,
          title: data.title,
          category: data.category,
          description: data.description,
          severity: data.severity || GrievancePriority.MEDIUM,
          attachments: data.attachments || [],
          status: GrievanceStatus.SUBMITTED,
          escalationLevel: EscalationLevel.MENTOR,
          assignedToId: assignedToId,
          facultySupervisorId: data.facultySupervisorId,
          actionRequested: data.actionRequested,
          preferredContactMethod: data.preferredContactMethod,
        },
        include: this.getGrievanceListInclude(),
      });

      // Create initial status history entry
      await this.prisma.grievanceStatusHistory.create({
        data: {
          grievanceId: grievance.id,
          fromStatus: null,
          toStatus: GrievanceStatus.SUBMITTED,
          changedById: userId,
          escalationLevel: EscalationLevel.MENTOR,
          action: 'SUBMITTED',
          remarks: 'Grievance submitted by student',
        },
      });

      // Notify assigned person (mentor) if exists
      if (assignedToId) {
        const mentorName = mentorUser?.name || 'assigned mentor';
        await this.notificationService.create(
          assignedToId,
          'GRIEVANCE_ASSIGNED',
          'New Grievance Assigned',
          `A new grievance "${data.title}" has been ${mentorUser ? 'auto-' : ''}assigned to you by ${student.user.name}`,
          { grievanceId: grievance.id, studentName: student.user.name }
        );
        // Invalidate faculty cache for assigned mentor
        await this.cache.del(`grievances:faculty:${assignedToId}`);
        this.logger.log(`Notified mentor ${mentorName} about new grievance assignment`);
      }

      // Invalidate cache
      await this.invalidateGrievanceCache(userId, student.institutionId);

      // Audit: Grievance submitted
      this.auditService.log({
        action: AuditAction.GRIEVANCE_SUBMIT,
        entityType: 'Grievance',
        entityId: grievance.id,
        userId: userId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: data.severity === GrievancePriority.URGENT ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        institutionId: student.institutionId,
        description: `Grievance submitted: ${data.title}`,
        newValues: {
          title: data.title,
          category: data.category,
          severity: data.severity || GrievancePriority.MEDIUM,
        },
      }).catch(() => {});

      // Fetch updated grievance with status history
      return await this.prisma.grievance.findUnique({
        where: { id: grievance.id },
        include: this.getGrievanceListInclude(),
      });
    } catch (error) {
      this.logger.error(`Failed to submit grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get grievances by user ID (for students)
   */
  async getGrievancesByUser(userId: string) {
    try {
      this.logger.log(`Fetching grievances for user: ${userId}`);

      // Skip cache temporarily for debugging
      const grievances = await this.prisma.grievance.findMany({
        where: { student: { userId, user: { active: true } } },
        include: this.getGrievanceListInclude(),
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(`Found ${grievances.length} grievances for user ${userId}`);
      return grievances;
    } catch (error) {
      this.logger.error(`Failed to get grievances for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get grievances by student ID
   */
  async getGrievancesByStudentId(studentId: string) {
    try {
      return await this.prisma.grievance.findMany({
        where: { studentId },
        include: this.getGrievanceListInclude(),
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Failed to get grievances for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get grievances by institution ID
   */
  async getGrievancesByInstitution(institutionId: string) {
    try {
      const cacheKey = `grievances:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.grievance.findMany({
            where: {
              student: { institutionId, user: { active: true } },
            },
            include: this.getGrievanceListInclude(),
            orderBy: { createdAt: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get grievances for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all grievances (for STATE_DIRECTORATE users)
   * Can optionally filter by escalation level
   */
  async getAllGrievances(escalationLevel?: EscalationLevel) {
    try {
      // Skip cache for now to ensure fresh data
      const whereClause = escalationLevel
        ? { escalationLevel, student: { user: { active: true } } }
        : { student: { user: { active: true } } };

      this.logger.log(`Fetching all grievances with filter: ${JSON.stringify(whereClause)}`);

      const grievances = await this.prisma.grievance.findMany({
        where: whereClause,
        include: this.getGrievanceListInclude(),
        orderBy: { createdAt: 'desc' },
      });

      this.logger.log(`Found ${grievances.length} grievances`);

      return grievances;
    } catch (error) {
      this.logger.error(`Failed to get all grievances: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get grievances assigned to a faculty member
   */
  async getGrievancesByFaculty(facultyUserId: string) {
    try {
      console.log('[GrievanceService.getGrievancesByFaculty] facultyUserId:', facultyUserId);

      const cacheKey = `grievances:faculty:${facultyUserId}`;

      const result = await this.cache.getOrSet(
        cacheKey,
        async () => {
          console.log('[GrievanceService.getGrievancesByFaculty] Cache miss, querying DB...');
          const grievances = await this.prisma.grievance.findMany({
            where: {
              student: { user: { active: true } },
              OR: [
                { assignedToId: facultyUserId },
                { facultySupervisorId: facultyUserId },
              ],
            },
            include: this.getGrievanceListInclude(),
            orderBy: { createdAt: 'desc' },
          });
          console.log('[GrievanceService.getGrievancesByFaculty] Found grievances:', grievances.length);
          return grievances;
        },
        this.CACHE_TTL,
      );

      console.log('[GrievanceService.getGrievancesByFaculty] Returning grievances:', Array.isArray(result) ? result.length : 'cached');
      return result;
    } catch (error) {
      this.logger.error(`Failed to get grievances for faculty ${facultyUserId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get a single grievance by ID
   */
  async getGrievanceById(id: string) {
    try {
      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: this.getGrievanceDetailInclude(),
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      return grievance;
    } catch (error) {
      this.logger.error(`Failed to get grievance ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Assign grievance to a user
   */
  async assignGrievance(id: string, assignerId: string, data: AssignGrievanceDto) {
    try {
      this.logger.log(`Assigning grievance ${id} to user ${data.assigneeId}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: {
          student: { include: { user: true } },
          assignedTo: true,
        },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      // Validate assignee exists
      const assignee = await this.prisma.user.findUnique({
        where: { id: data.assigneeId },
      });

      if (!assignee) {
        throw new NotFoundException('Assignee not found');
      }

      // Track previous assignee
      const previousAssignees = grievance.previousAssignees || [];
      if (grievance.assignedToId && !previousAssignees.includes(grievance.assignedToId)) {
        previousAssignees.push(grievance.assignedToId);
      }

      // Update grievance
      const updated = await this.prisma.grievance.update({
        where: { id },
        data: {
          assignedToId: data.assigneeId,
          previousAssignees,
          status: GrievanceStatus.UNDER_REVIEW,
        },
        include: this.getGrievanceListInclude(),
      });

      // Create status history entry
      await this.prisma.grievanceStatusHistory.create({
        data: {
          grievanceId: id,
          fromStatus: grievance.status,
          toStatus: GrievanceStatus.UNDER_REVIEW,
          changedById: assignerId,
          action: 'ASSIGNED',
          remarks: data.remarks || `Assigned to ${assignee.name}`,
          escalatedToId: data.assigneeId,
        },
      });

      // Notify the assignee
      await this.notificationService.create(
        data.assigneeId,
        'GRIEVANCE_ASSIGNED',
        'Grievance Assigned to You',
        `Grievance "${grievance.title}" has been assigned to you for review.`,
        { grievanceId: id, title: grievance.title }
      );

      // Notify the student
      await this.notificationService.create(
        grievance.student.userId,
        'GRIEVANCE_UPDATE',
        'Grievance Status Update',
        `Your grievance "${grievance.title}" has been assigned to ${assignee.name} for review.`,
        { grievanceId: id, assigneeName: assignee.name }
      );

      // Invalidate cache
      await this.invalidateGrievanceCache(grievance.student.userId, grievance.student.institutionId);
      await this.cache.del(`grievances:faculty:${data.assigneeId}`);
      if (grievance.assignedToId) {
        await this.cache.del(`grievances:faculty:${grievance.assignedToId}`);
      }

      // Audit: Grievance assigned
      this.auditService.log({
        action: AuditAction.GRIEVANCE_UPDATE,
        entityType: 'Grievance',
        entityId: id,
        userId: assignerId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.MEDIUM,
        institutionId: grievance.student.institutionId,
        description: `Grievance assigned to ${assignee.name}`,
        oldValues: { assignedToId: grievance.assignedToId },
        newValues: { assignedToId: data.assigneeId, assigneeName: assignee.name },
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to assign grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Respond to a grievance
   */
  async respondToGrievance(id: string, responderId: string, data: RespondToGrievanceDto) {
    try {
      this.logger.log(`Responding to grievance ${id} by user ${responderId}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: { student: { include: { user: true } } },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      const responder = await this.prisma.user.findUnique({
        where: { id: responderId },
      });

      const newStatus = data.newStatus || GrievanceStatus.RESOLVED;

      const updated = await this.prisma.grievance.update({
        where: { id },
        data: {
          status: newStatus,
          resolution: data.response,
          addressedDate: new Date(),
          resolvedDate: newStatus === GrievanceStatus.RESOLVED ? new Date() : undefined,
          assignedToId: responderId,
        },
        include: this.getGrievanceListInclude(),
      });

      // Create status history entry
      await this.prisma.grievanceStatusHistory.create({
        data: {
          grievanceId: id,
          fromStatus: grievance.status,
          toStatus: newStatus,
          changedById: responderId,
          action: 'RESPONDED',
          remarks: data.response,
        },
      });

      // Notify the student
      await this.notificationService.create(
        grievance.student.userId,
        'GRIEVANCE_RESPONSE',
        newStatus === GrievanceStatus.RESOLVED ? 'Grievance Resolved' : 'Grievance Update',
        `Your grievance "${grievance.title}" has been ${newStatus === GrievanceStatus.RESOLVED ? 'resolved' : 'updated'} by ${responder?.name || 'staff'}.`,
        { grievanceId: id, status: newStatus, response: data.response }
      );

      // Invalidate cache
      await this.invalidateGrievanceCache(grievance.student.userId, grievance.student.institutionId);

      // Audit: Grievance responded/resolved
      this.auditService.log({
        action: newStatus === GrievanceStatus.RESOLVED ? AuditAction.GRIEVANCE_RESOLVE : AuditAction.GRIEVANCE_UPDATE,
        entityType: 'Grievance',
        entityId: id,
        userId: responderId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: newStatus === GrievanceStatus.RESOLVED ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        institutionId: grievance.student.institutionId,
        description: `Grievance ${newStatus === GrievanceStatus.RESOLVED ? 'resolved' : 'responded to'}: ${grievance.title}`,
        oldValues: { status: grievance.status },
        newValues: { status: newStatus, response: data.response },
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to respond to grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Escalate a grievance to the next level
   */
  async escalateGrievance(id: string, escalatorId: string, data: EscalateGrievanceDto) {
    try {
      this.logger.log(`Escalating grievance ${id}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: {
          student: { include: { user: true, Institution: true } },
          assignedTo: true,
        },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      // Determine next escalation level
      const nextLevel = this.getNextEscalationLevel(grievance.escalationLevel);

      if (!nextLevel) {
        throw new BadRequestException('Grievance is already at the highest escalation level');
      }

      // Find the person to escalate to
      let escalateToId = data.escalateToId;

      if (!escalateToId) {
        // Auto-determine based on escalation level
        const targetRole = this.getRoleForEscalationLevel(nextLevel);

        // Find a user with the target role in the same institution
        const targetUser = await this.prisma.user.findFirst({
          where: {
            role: targetRole,
            institutionId: grievance.student.institutionId,
            active: true,
          },
        });

        if (targetUser) {
          escalateToId = targetUser.id;
        }
      }

      // Track previous assignee
      const previousAssignees = grievance.previousAssignees || [];
      if (grievance.assignedToId && !previousAssignees.includes(grievance.assignedToId)) {
        previousAssignees.push(grievance.assignedToId);
      }

      // Build escalation history entry
      const escalationEntry = {
        fromLevel: grievance.escalationLevel,
        toLevel: nextLevel,
        escalatedById: escalatorId,
        escalatedToId: escalateToId,
        reason: data.reason,
        escalatedAt: new Date().toISOString(),
        previousAssigneeId: grievance.assignedToId,
      };

      // Update grievance
      const updated = await this.prisma.grievance.update({
        where: { id },
        data: {
          status: GrievanceStatus.ESCALATED,
          severity: GrievancePriority.URGENT,
          escalationLevel: nextLevel,
          escalationCount: { increment: 1 },
          escalatedAt: new Date(),
          escalatedById: escalatorId,
          assignedToId: escalateToId,
          previousAssignees,
          escalationHistory: {
            push: escalationEntry,
          },
        },
        include: this.getGrievanceListInclude(),
      });

      // Create status history entry
      await this.prisma.grievanceStatusHistory.create({
        data: {
          grievanceId: id,
          fromStatus: grievance.status,
          toStatus: GrievanceStatus.ESCALATED,
          changedById: escalatorId,
          escalationLevel: nextLevel,
          escalatedToId: escalateToId,
          action: 'ESCALATED',
          remarks: data.reason,
        },
      });

      // Notify the new assignee
      if (escalateToId) {
        const escalator = await this.prisma.user.findUnique({ where: { id: escalatorId } });
        await this.notificationService.create(
          escalateToId,
          'GRIEVANCE_ESCALATED',
          'Grievance Escalated to You',
          `Grievance "${grievance.title}" has been escalated to you for immediate attention. Reason: ${data.reason}`,
          { grievanceId: id, reason: data.reason, escalatedBy: escalator?.name }
        );
      }

      // Notify the student
      await this.notificationService.create(
        grievance.student.userId,
        'GRIEVANCE_ESCALATED',
        'Grievance Escalated',
        `Your grievance "${grievance.title}" has been escalated to a higher authority for faster resolution.`,
        { grievanceId: id, newLevel: nextLevel }
      );

      // Invalidate cache
      await this.invalidateGrievanceCache(grievance.student.userId, grievance.student.institutionId);
      if (escalateToId) {
        await this.cache.del(`grievances:faculty:${escalateToId}`);
      }
      if (grievance.assignedToId) {
        await this.cache.del(`grievances:faculty:${grievance.assignedToId}`);
      }

      // Audit: Grievance escalated
      this.auditService.log({
        action: AuditAction.GRIEVANCE_UPDATE,
        entityType: 'Grievance',
        entityId: id,
        userId: escalatorId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.HIGH,
        institutionId: grievance.student.institutionId,
        description: `Grievance escalated from ${grievance.escalationLevel} to ${nextLevel}`,
        oldValues: { escalationLevel: grievance.escalationLevel, status: grievance.status },
        newValues: { escalationLevel: nextLevel, status: GrievanceStatus.ESCALATED, reason: data.reason },
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to escalate grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update grievance status
   */
  async updateGrievanceStatus(id: string, updaterId: string, status: GrievanceStatus, remarks?: string) {
    try {
      this.logger.log(`Updating grievance ${id} status to ${status}`);

      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: { student: { include: { user: true } } },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      const updateData: any = { status };

      // Set dates based on status
      if (status === GrievanceStatus.RESOLVED) {
        updateData.resolvedDate = new Date();
        updateData.addressedDate = grievance.addressedDate || new Date();
      } else if (status === GrievanceStatus.UNDER_REVIEW || status === GrievanceStatus.IN_PROGRESS) {
        updateData.addressedDate = grievance.addressedDate || new Date();
      }

      const updated = await this.prisma.grievance.update({
        where: { id },
        data: updateData,
        include: this.getGrievanceListInclude(),
      });

      // Create status history entry
      await this.prisma.grievanceStatusHistory.create({
        data: {
          grievanceId: id,
          fromStatus: grievance.status,
          toStatus: status,
          changedById: updaterId,
          action: 'STATUS_CHANGED',
          remarks: remarks || `Status changed to ${status}`,
        },
      });

      // Notify the student
      const updater = await this.prisma.user.findUnique({ where: { id: updaterId } });
      await this.notificationService.create(
        grievance.student.userId,
        'GRIEVANCE_STATUS_UPDATE',
        'Grievance Status Updated',
        `Your grievance "${grievance.title}" status has been updated to ${status.replace(/_/g, ' ')}.`,
        { grievanceId: id, status, updatedBy: updater?.name }
      );

      // Invalidate cache
      await this.invalidateGrievanceCache(grievance.student.userId, grievance.student.institutionId);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update grievance status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Close a grievance
   */
  async closeGrievance(id: string, closerId: string, remarks?: string) {
    return this.updateGrievanceStatus(id, closerId, GrievanceStatus.CLOSED, remarks || 'Grievance closed');
  }

  /**
   * Reject a grievance
   */
  async rejectGrievance(id: string, rejecterId: string, reason: string) {
    try {
      const grievance = await this.prisma.grievance.findUnique({
        where: { id },
        include: { student: { include: { user: true } } },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      const updated = await this.prisma.grievance.update({
        where: { id },
        data: {
          status: GrievanceStatus.REJECTED,
          resolution: reason,
          resolvedDate: new Date(),
        },
        include: this.getGrievanceListInclude(),
      });

      // Create status history entry
      await this.prisma.grievanceStatusHistory.create({
        data: {
          grievanceId: id,
          fromStatus: grievance.status,
          toStatus: GrievanceStatus.REJECTED,
          changedById: rejecterId,
          action: 'REJECTED',
          remarks: reason,
        },
      });

      // Notify the student
      await this.notificationService.create(
        grievance.student.userId,
        'GRIEVANCE_REJECTED',
        'Grievance Rejected',
        `Your grievance "${grievance.title}" has been reviewed and rejected. Reason: ${reason}`,
        { grievanceId: id, reason }
      );

      // Invalidate cache
      await this.invalidateGrievanceCache(grievance.student.userId, grievance.student.institutionId);

      // Audit: Grievance rejected
      this.auditService.log({
        action: AuditAction.GRIEVANCE_UPDATE,
        entityType: 'Grievance',
        entityId: id,
        userId: rejecterId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.MEDIUM,
        institutionId: grievance.student.institutionId,
        description: `Grievance rejected: ${grievance.title}`,
        oldValues: { status: grievance.status },
        newValues: { status: GrievanceStatus.REJECTED, reason },
      }).catch(() => {});

      return updated;
    } catch (error) {
      this.logger.error(`Failed to reject grievance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get assignable users for a grievance (faculty, principal, etc.)
   */
  async getAssignableUsers(institutionId: string) {
    try {
      return await this.prisma.user.findMany({
        where: {
          institutionId,
          active: true,
          role: {
            in: [Role.TEACHER, Role.PRINCIPAL],
          },
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
   * Get grievance statistics
   */
  async getStatistics(institutionId?: string) {
    try {
      const whereClause = institutionId
        ? { student: { institutionId, user: { active: true } } }
        : { student: { user: { active: true } } };

      const [
        total,
        pending,
        submitted,
        underReview,
        inProgress,
        escalated,
        resolved,
        closed,
        rejected,
      ] = await Promise.all([
        this.prisma.grievance.count({ where: whereClause }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.PENDING } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.SUBMITTED } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.UNDER_REVIEW } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.IN_PROGRESS } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.ESCALATED } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.RESOLVED } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.CLOSED } }),
        this.prisma.grievance.count({ where: { ...whereClause, status: GrievanceStatus.REJECTED } }),
      ]);

      // Get severity breakdown
      const [low, medium, high, urgent] = await Promise.all([
        this.prisma.grievance.count({ where: { ...whereClause, severity: GrievancePriority.LOW } }),
        this.prisma.grievance.count({ where: { ...whereClause, severity: GrievancePriority.MEDIUM } }),
        this.prisma.grievance.count({ where: { ...whereClause, severity: GrievancePriority.HIGH } }),
        this.prisma.grievance.count({ where: { ...whereClause, severity: GrievancePriority.URGENT } }),
      ]);

      // Get escalation level breakdown
      const [atMentor, atPrincipal, atStateDirectorate] = await Promise.all([
        this.prisma.grievance.count({ where: { ...whereClause, escalationLevel: EscalationLevel.MENTOR } }),
        this.prisma.grievance.count({ where: { ...whereClause, escalationLevel: EscalationLevel.PRINCIPAL } }),
        this.prisma.grievance.count({ where: { ...whereClause, escalationLevel: EscalationLevel.STATE_DIRECTORATE } }),
      ]);

      // Calculate notSet as total minus those with known escalation levels
      const notSet = total - (atMentor + atPrincipal + atStateDirectorate);

      this.logger.log(`Escalation stats - Mentor: ${atMentor}, Principal: ${atPrincipal}, State: ${atStateDirectorate}, Not Set: ${notSet}`);

      return {
        total,
        byStatus: {
          pending: pending + submitted, // Combine PENDING and SUBMITTED (both are unassigned/new grievances)
          underReview,
          inProgress,
          escalated,
          resolved,
          closed,
          rejected,
        },
        bySeverity: {
          low,
          medium,
          high,
          urgent,
        },
        byEscalationLevel: {
          mentor: atMentor,
          principal: atPrincipal,
          stateDirectorate: atStateDirectorate,
          notSet: notSet, // Grievances without escalation level (legacy data)
        },
        // Summary for quick view
        summary: {
          active: pending + submitted + underReview + inProgress + escalated,
          resolved: resolved + closed,
          rejected,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Migrate existing grievances to have default escalation level
   * This is a one-time migration for legacy data
   */
  async migrateGrievancesEscalationLevel() {
    try {
      // Find grievances that don't have any of the valid escalation levels
      // This catches documents where the field is missing or has an invalid value
      const result = await this.prisma.grievance.updateMany({
        where: {
          NOT: {
            escalationLevel: {
              in: [EscalationLevel.MENTOR, EscalationLevel.PRINCIPAL, EscalationLevel.STATE_DIRECTORATE],
            },
          },
        },
        data: {
          escalationLevel: EscalationLevel.MENTOR,
        },
      });

      this.logger.log(`Migrated ${result.count} grievances to have MENTOR escalation level`);

      // Clear all grievance caches
      await this.cache.del('grievances:all');

      return { migratedCount: result.count };
    } catch (error) {
      this.logger.error(`Failed to migrate grievances: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get escalation chain info for a grievance
   */
  async getEscalationChain(grievanceId: string) {
    try {
      const grievance = await this.prisma.grievance.findUnique({
        where: { id: grievanceId },
        include: {
          student: { include: { Institution: true } },
          statusHistory: {
            where: {
              action: { in: ['SUBMITTED', 'ASSIGNED', 'ESCALATED'] },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!grievance) {
        throw new NotFoundException('Grievance not found');
      }

      // Build escalation chain visualization
      const escalationChain = ESCALATION_CHAIN.map((level, index) => {
        const isCurrentLevel = grievance.escalationLevel === level;
        const isPastLevel = ESCALATION_CHAIN.indexOf(grievance.escalationLevel) > index;

        return {
          level,
          levelNumber: index + 1,
          role: this.getRoleForEscalationLevel(level),
          status: isCurrentLevel ? 'CURRENT' : isPastLevel ? 'COMPLETED' : 'PENDING',
          isCurrentLevel,
          isPastLevel,
        };
      });

      return {
        currentLevel: grievance.escalationLevel,
        currentLevelNumber: ESCALATION_CHAIN.indexOf(grievance.escalationLevel) + 1,
        totalLevels: ESCALATION_CHAIN.length,
        canEscalate: this.getNextEscalationLevel(grievance.escalationLevel) !== null,
        nextLevel: this.getNextEscalationLevel(grievance.escalationLevel),
        escalationChain,
        history: grievance.statusHistory,
        escalationHistory: grievance.escalationHistory,
      };
    } catch (error) {
      this.logger.error(`Failed to get escalation chain: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper to invalidate grievance-related cache
   */
  private async invalidateGrievanceCache(userId?: string, institutionId?: string) {
    if (userId) {
      await this.cache.del(`grievances:user:${userId}`);
    }
    if (institutionId) {
      await this.cache.del(`grievances:institution:${institutionId}`);
    }
  }
}
