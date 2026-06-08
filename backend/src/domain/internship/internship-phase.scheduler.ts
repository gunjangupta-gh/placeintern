import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  InternshipPhase,
  ApplicationStatus,
  AuditAction,
  AuditCategory,
  AuditSeverity,
} from '../../generated/prisma/client';

/**
 * Scheduler for automatically updating internship phases and statuses based on dates.
 *
 * This scheduler handles the following transitions:
 * 1. NOT_STARTED -> ACTIVE: When startDate has passed
 *    - internshipPhase: NOT_STARTED -> ACTIVE
 *    - status: APPROVED/SELECTED -> JOINED
 * 2. ACTIVE -> COMPLETED: When endDate has passed
 *    - internshipPhase: ACTIVE -> COMPLETED
 *    - status: JOINED/APPROVED/SELECTED -> COMPLETED
 *
 * Runs daily at 12:05 AM to process all internships that need updates.
 */
@Injectable()
export class InternshipPhaseScheduler {
  private readonly logger = new Logger(InternshipPhaseScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Daily job to update internship phases and statuses based on dates.
   * Runs at 12:05 AM every day.
   */
  @Cron('0 5 0 * * *')
  async updateInternshipPhases(): Promise<void> {
    this.logger.log('Starting daily internship phase/status update job...');

    try {
      const results = await Promise.all([
        this.activateStartedInternships(),
        this.completeEndedInternships(),
      ]);

      const [activatedCount, completedCount] = results;

      this.logger.log(
        `Internship update complete: ${activatedCount} activated, ${completedCount} completed`,
      );
    } catch (error) {
      this.logger.error('Failed to update internship phases/statuses', error.stack);
    }
  }

  /**
   * Transition internships from NOT_STARTED to ACTIVE when startDate has passed.
   * Updates both internshipPhase (-> ACTIVE) and status (-> JOINED).
   */
  async activateStartedInternships(): Promise<number> {
    const now = new Date();

    try {
      // Find all internships that should be activated
      const internshipsToActivate = await this.prisma.internshipApplication.findMany({
        where: {
          isActive: true,
          internshipPhase: InternshipPhase.NOT_STARTED,
          status: {
            in: [
              ApplicationStatus.APPROVED,
              ApplicationStatus.SELECTED,
            ],
          },
          startDate: {
            not: null,
            lte: now, // Start date has passed
          },
        },
        select: {
          id: true,
          studentId: true,
          companyName: true,
          status: true,
          startDate: true,
          student: {
            select: {
              userId: true,
              institutionId: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (internshipsToActivate.length === 0) {
        this.logger.debug('No internships to activate');
        return 0;
      }

      this.logger.log(`Found ${internshipsToActivate.length} internships to activate`);

      // Update all
      const ids = internshipsToActivate.map((i) => i.id);

      await this.prisma.internshipApplication.updateMany({
        where: { id: { in: ids } },
        data: {
          internshipPhase: InternshipPhase.ACTIVE,
          status: ApplicationStatus.JOINED,
          joiningDate: now,
          updatedAt: now,
        },
      });

      // Log audit entries for each activation
      for (const internship of internshipsToActivate) {
        this.auditService
          .log({
            action: AuditAction.INTERNSHIP_UPDATE,
            entityType: 'InternshipApplication',
            entityId: internship.id,
            userId: null, // System action
            institutionId: internship.student?.institutionId,
            category: AuditCategory.INTERNSHIP_WORKFLOW,
            severity: AuditSeverity.LOW,
            description: `Internship auto-activated: ${internship.companyName || 'Unknown Company'} for ${internship.student?.user?.name || 'Unknown Student'}`,
            oldValues: {
              internshipPhase: InternshipPhase.NOT_STARTED,
              status: internship.status,
            },
            newValues: {
              internshipPhase: InternshipPhase.ACTIVE,
              status: ApplicationStatus.JOINED,
            },
            changedFields: ['internshipPhase', 'status', 'joiningDate'],
          })
          .catch((err) => {
            this.logger.warn(`Failed to log audit for internship ${internship.id}: ${err.message}`);
          });
      }

      this.logger.log(`Successfully activated ${internshipsToActivate.length} internships (phase: ACTIVE, status: JOINED)`);
      return internshipsToActivate.length;
    } catch (error) {
      this.logger.error('Failed to activate internships', error.stack);
      return 0;
    }
  }

  /**
   * Transition internships from ACTIVE to COMPLETED when endDate has passed.
   * Updates both internshipPhase (-> COMPLETED) and status (-> COMPLETED).
   */
  async completeEndedInternships(): Promise<number> {
    const now = new Date();

    try {
      // Find all internships that should be completed
      const internshipsToComplete = await this.prisma.internshipApplication.findMany({
        where: {
          isActive: true,
          internshipPhase: InternshipPhase.ACTIVE,
          status: {
            in: [
              ApplicationStatus.APPROVED,
              ApplicationStatus.JOINED,
              ApplicationStatus.SELECTED,
            ],
          },
          endDate: {
            not: null,
            lt: now, // End date has passed
          },
        },
        select: {
          id: true,
          studentId: true,
          companyName: true,
          status: true,
          startDate: true,
          endDate: true,
          student: {
            select: {
              userId: true,
              institutionId: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (internshipsToComplete.length === 0) {
        this.logger.debug('No internships to complete');
        return 0;
      }

      this.logger.log(`Found ${internshipsToComplete.length} internships to mark as completed`);

      // Update all
      const ids = internshipsToComplete.map((i) => i.id);

      await this.prisma.internshipApplication.updateMany({
        where: { id: { in: ids } },
        data: {
          internshipPhase: InternshipPhase.COMPLETED,
          status: ApplicationStatus.COMPLETED,
          completionDate: now,
          updatedAt: now,
        },
      });

      // Log audit entries for each completion
      for (const internship of internshipsToComplete) {
        this.auditService
          .log({
            action: AuditAction.INTERNSHIP_UPDATE,
            entityType: 'InternshipApplication',
            entityId: internship.id,
            userId: null, // System action
            institutionId: internship.student?.institutionId,
            category: AuditCategory.INTERNSHIP_WORKFLOW,
            severity: AuditSeverity.MEDIUM,
            description: `Internship auto-completed: ${internship.companyName || 'Unknown Company'} for ${internship.student?.user?.name || 'Unknown Student'}`,
            oldValues: {
              internshipPhase: InternshipPhase.ACTIVE,
              status: internship.status,
            },
            newValues: {
              internshipPhase: InternshipPhase.COMPLETED,
              status: ApplicationStatus.COMPLETED,
              completionDate: now,
            },
            changedFields: ['internshipPhase', 'status', 'completionDate'],
          })
          .catch((err) => {
            this.logger.warn(`Failed to log audit for internship ${internship.id}: ${err.message}`);
          });
      }

      this.logger.log(`Successfully completed ${internshipsToComplete.length} internships (phase: COMPLETED, status: COMPLETED)`);
      return internshipsToComplete.length;
    } catch (error) {
      this.logger.error('Failed to complete internships', error.stack);
      return 0;
    }
  }

  /**
   * Manual trigger for testing/admin purposes.
   * Can be called from a controller or CLI.
   */
  async manualUpdate(): Promise<{ activated: number; completed: number }> {
    this.logger.log('Manual internship phase/status update triggered');

    const [activated, completed] = await Promise.all([
      this.activateStartedInternships(),
      this.completeEndedInternships(),
    ]);

    return { activated, completed };
  }
}
