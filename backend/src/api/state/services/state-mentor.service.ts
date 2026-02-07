import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { LruCacheService } from '../../../core/cache/lru-cache.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { LookupService } from '../../shared/lookup.service';
import { Role, AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';

@Injectable()
export class StateMentorService {
  private readonly logger = new Logger(StateMentorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: LruCacheService,
    private readonly auditService: AuditService,
    private readonly lookupService: LookupService,
  ) {}

  /**
   * Get all faculty/mentors from all institutions
   * Used by state admin for cross-institution mentor assignment
   * Cached for 5 minutes to reduce load
   */
  async getAllMentors(params?: { search?: string; institutionId?: string }) {
    // Build cache key based on params
    const cacheKey = `state:mentors:all:${params?.institutionId || 'all'}:${params?.search || ''}`;

    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const [mentors, allAssignments, lookupData] = await Promise.all([
          this.prisma.user.findMany({
            where: {
              role: { in: [Role.TEACHER] },
              active: true,
              ...(params?.institutionId ? { institutionId: params.institutionId } : {}),
              ...(params?.search
                ? {
                    OR: [
                      { name: { contains: params.search, mode: 'insensitive' as const } },
                      { email: { contains: params.search, mode: 'insensitive' as const } },
                    ],
                  }
                : {}),
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              institutionId: true,
            },
            orderBy: [{ name: 'asc' }],
          }),
          // Get all active assignments to count unique students per mentor
          this.prisma.mentorAssignment.findMany({
            where: { isActive: true, student: { user: { active: true } } },
            select: { mentorId: true, studentId: true },
          }),
          // Get all institutions from cached LookupService
          this.lookupService.getInstitutions(),
        ]);
        const institutions = lookupData.institutions;

        // Build unique students per mentor map
        const mentorStudentMap = new Map<string, Set<string>>();
        for (const { mentorId, studentId } of allAssignments) {
          if (!mentorStudentMap.has(mentorId)) {
            mentorStudentMap.set(mentorId, new Set());
          }
          mentorStudentMap.get(mentorId)!.add(studentId);
        }

        // Build institution lookup map
        const institutionMap = new Map(institutions.map(i => [i.id, { name: i.name, code: i.code }]));

        return mentors.map(mentor => {
          const institution = mentor.institutionId ? institutionMap.get(mentor.institutionId) : null;
          return {
            id: mentor.id,
            name: mentor.name,
            email: mentor.email,
            role: mentor.role,
            institutionId: mentor.institutionId,
            institutionName: institution?.name || 'Unknown',
            institutionCode: institution?.code || '',
            activeAssignments: mentorStudentMap.get(mentor.id)?.size || 0,
          };
        });
      },
      { ttl: 5 * 60 * 1000, tags: ['state', 'mentors'] }, // 5 minutes cache
    );
  }

  /**
   * Get faculty/mentors from an institution
   */
  async getInstitutionMentors(institutionId: string) {
    const [mentors, allAssignments, institution] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.TEACHER] },
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          institutionId: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Get all active assignments to count unique students per mentor
      this.prisma.mentorAssignment.findMany({
        where: {
          mentor: { institutionId },
          isActive: true,
          student: { user: { active: true } },
        },
        select: { mentorId: true, studentId: true },
      }),
      // Get institution info
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { id: true, name: true, code: true },
      }),
    ]);

    // Build unique students per mentor map
    const mentorStudentMap = new Map<string, Set<string>>();
    for (const { mentorId, studentId } of allAssignments) {
      if (!mentorStudentMap.has(mentorId)) {
        mentorStudentMap.set(mentorId, new Set());
      }
      mentorStudentMap.get(mentorId)!.add(studentId);
    }

    return mentors.map(mentor => ({
      id: mentor.id,
      name: mentor.name,
      email: mentor.email,
      role: mentor.role,
      institutionId: mentor.institutionId,
      institutionName: institution?.name || 'Unknown',
      institutionCode: institution?.code || '',
      activeAssignments: mentorStudentMap.get(mentor.id)?.size || 0,
    }));
  }

  /**
   * Assign mentor to student (State Directorate override)
   */
  async assignMentorToStudent(studentId: string, mentorId: string, assignedBy: string) {
    // Validate student exists
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, institutionId: true, user: { select: { name: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Validate mentor exists and belongs to same institution
    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { id: true, name: true, institutionId: true, role: true },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    // Note: Cross-institution mentoring is allowed - state admin can assign faculty from one institution
    // to mentor students from another institution (this happens physically in the field)

    // Robust role check: some deployments use different Role enum variants.
    // Accept TEACHER/FACULTY_SUPERVISOR as mentor roles.
    const validMentorRoles = new Set(['TEACHER', 'FACULTY_SUPERVISOR']);
    if (!validMentorRoles.has(String(mentor.role))) {
      throw new BadRequestException('Selected user is not a valid mentor');
    }

    // Deactivate existing assignments
    await this.prisma.mentorAssignment.updateMany({
      where: { studentId, isActive: true },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: assignedBy,
        deactivationReason: 'Reassigned by State Directorate',
      },
    });

    // Create new assignment
    const assignment = await this.prisma.mentorAssignment.create({
      data: {
        studentId,
        mentorId,
        assignedBy,
        academicYear: this.getCurrentAcademicYear(),
        assignmentDate: new Date(),
        assignmentReason: 'Assigned by State Directorate',
        isActive: true,
      },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            institutionId: true,
            Institution: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    // Audit mentor assignment
    this.auditService.log({
      action: AuditAction.MENTOR_ASSIGN,
      entityType: 'MentorAssignment',
      entityId: assignment.id,
      userId: assignedBy,
      userRole: Role.STATE_DIRECTORATE,
      description: `Mentor ${mentor.name} assigned to student ${student.user?.name} by State Directorate`,
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      institutionId: student.institutionId || undefined,
      newValues: {
        assignmentId: assignment.id,
        studentId,
        studentName: student.user?.name,
        mentorId,
        mentorName: mentor.name,
        assignedBy,
      },
    }).catch(() => {});

    // Invalidate cache
    await Promise.all([
      this.cache.mdel(`mentor:assignments:${mentorId}`),
      this.cache.mdel(`mentor:student:${studentId}`),
      this.cache.mdel(`state:institute:${student.institutionId}:students`),
    ]);

    // Check if this is a cross-institution assignment
    const isCrossInstitutionMentor = mentor.institutionId !== student.institutionId;

    return {
      success: true,
      message: `Mentor ${mentor.name} assigned to student ${student.user?.name}`,
      assignment,
      isCrossInstitutionMentor,
    };
  }

  /**
   * Remove mentor from student (State Directorate)
   */
  async removeMentorFromStudent(studentId: string, removedBy: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, institutionId: true, user: { select: { name: true } } },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const result = await this.prisma.mentorAssignment.updateMany({
      where: { studentId, isActive: true },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: removedBy,
        deactivationReason: 'Removed by State Directorate',
      },
    });

    // Invalidate cache
    await this.cache.mdel(`mentor:student:${studentId}`);
    await this.cache.mdel(`state:institute:${student.institutionId}:students`);

    return {
      success: true,
      message: result.count > 0 ? 'Mentor removed successfully' : 'No active mentor assignment found',
      removed: result.count,
    };
  }

  /**
   * Get institution mentor overview with cross-institutional statistics
   * Shows for each institution:
   * - Internal mentoring (their faculty → their students)
   * - Incoming external (other faculty → their students)
   * - Outgoing external (their faculty → other students)
   * @returns Array of institution mentor statistics
   */
  async getInstitutionMentorOverview() {
    try {
      const cacheKey = 'state:institution-mentor-overview';

      return this.cache.getOrSet(
        cacheKey,
        async () => {
          // Get all institutions
          const lookupData = await this.lookupService.getInstitutions();
          const institutions = lookupData.institutions;

          // Get all active assignments with institution info (only active students from active institutions)
          const assignments = await this.prisma.mentorAssignment.findMany({
            where: {
              isActive: true,
              student: {
                user: { active: true },
                Institution: { isActive: true },
              },
            },
            select: {
              id: true,
              mentorId: true,
              studentId: true,
              mentor: {
                select: {
                  id: true,
                  institutionId: true,
                  role: true,
                },
              },
              student: {
                select: {
                  id: true,
                  institutionId: true,
                },
              },
            },
          });

          // Calculate stats for each institution
          const institutionStats = institutions.map(institution => {
            const institutionId = institution.id;

            // Internal: their faculty → their students
            const internalAssignments = assignments.filter(
              a =>
                a.mentor?.institutionId === institutionId &&
                a.student?.institutionId === institutionId
            );

            // Incoming external: other faculty → their students
            const incomingExternalAssignments = assignments.filter(
              a =>
                a.mentor?.institutionId !== institutionId &&
                a.student?.institutionId === institutionId
            );

            // Outgoing external: their faculty → other students
            const outgoingExternalAssignments = assignments.filter(
              a =>
                a.mentor?.institutionId === institutionId &&
                a.student?.institutionId !== institutionId
            );

            // Get unique mentors and students
            const internalMentors = new Set(internalAssignments.map(a => a.mentorId)).size;
            const internalStudents = new Set(internalAssignments.map(a => a.studentId)).size;

            const incomingMentors = new Set(incomingExternalAssignments.map(a => a.mentorId)).size;
            const incomingStudents = new Set(incomingExternalAssignments.map(a => a.studentId))
              .size;

            const outgoingMentors = new Set(outgoingExternalAssignments.map(a => a.mentorId)).size;
            const outgoingStudents = new Set(outgoingExternalAssignments.map(a => a.studentId))
              .size;

            // Get external institutions involved (for outgoing)
            const externalInstitutionsOutgoing = new Set(
              outgoingExternalAssignments
                .map(a => a.student?.institutionId)
                .filter(id => id && id !== institutionId)
            );

            // Get external institutions involved (for incoming)
            const externalInstitutionsIncoming = new Set(
              incomingExternalAssignments
                .map(a => a.mentor?.institutionId)
                .filter(id => id && id !== institutionId)
            );

            return {
              institutionId: institution.id,
              institutionName: institution.name,
              institutionCode: institution.code,
              city: institution.city,
              state: institution.state,
              internal: {
                mentors: internalMentors,
                students: internalStudents,
                assignments: internalAssignments.length,
              },
              incomingExternal: {
                mentors: incomingMentors,
                students: incomingStudents,
                assignments: incomingExternalAssignments.length,
                fromInstitutions: externalInstitutionsIncoming.size,
              },
              outgoingExternal: {
                mentors: outgoingMentors,
                students: outgoingStudents,
                assignments: outgoingExternalAssignments.length,
                toInstitutions: externalInstitutionsOutgoing.size,
              },
              totals: {
                mentors: new Set([
                  ...internalAssignments.map(a => a.mentorId),
                  ...outgoingExternalAssignments.map(a => a.mentorId),
                ]).size,
                students: new Set([
                  ...internalAssignments.map(a => a.studentId),
                  ...incomingExternalAssignments.map(a => a.studentId),
                ]).size,
              },
            };
          });

          // Sort by institution name
          return institutionStats.sort((a, b) => a.institutionName.localeCompare(b.institutionName));
        },
        { ttl: 10 * 60 * 1000, tags: ['state', 'institutions', 'mentors'] }, // 10 minutes cache
      );
    } catch (error) {
      this.logger.error('Error fetching institution mentor overview:', error);
      throw new BadRequestException('Failed to fetch institution mentor overview');
    }
  }

  /**
   * Deactivate student (soft delete) - State Directorate only
   * Preserves all historical data for audit trail
   */
  async deleteStudent(studentId: string, deletedBy: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        institutionId: true,
        user: { select: { id: true, name: true, email: true, active: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Check if already deactivated
    if (student.user?.active === false) {
      throw new BadRequestException('Student is already deactivated');
    }

    // Soft delete - deactivate student and user, remove mentor assignments
    await this.prisma.$transaction(async (tx) => {
      // Delete/deactivate mentor assignments (these can be reassigned)
      await tx.mentorAssignment.deleteMany({
        where: { studentId },
      });

      // Deactivate the associated user account if exists
      if (student.user?.id) {
        await tx.user.update({
          where: { id: student.user.id },
          data: { active: false },
        });
      }
    });

    // Audit student deactivation
    this.auditService.log({
      action: AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      userId: deletedBy,
      userRole: Role.STATE_DIRECTORATE,
      description: `Student ${student.user?.name} (${student.user?.email}) deactivated by State Directorate`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: student.institutionId || undefined,
      oldValues: {
        studentId,
        studentName: student.user?.name,
        studentEmail: student.user?.email,
        institutionId: student.institutionId,
        wasActive: true,
      },
      newValues: {
        active: false,
      },
    }).catch(() => {});

    // Invalidate cache
    await Promise.all([
      this.cache.mdel(`student:${studentId}`),
      this.cache.mdel(`state:institute:${student.institutionId}:students`),
      this.cache.mdel(`state:institute:${student.institutionId}:overview`),
    ]);

    return {
      success: true,
      message: `Student ${student.user?.name} has been deactivated successfully`,
    };
  }

  /**
   * Toggle student status (activate/deactivate) - State Directorate only
   * Preserves all historical data for audit trail
   * When deactivating: deactivates mentor assignments and internship applications
   * When activating: reactivates internship applications
   */
  async toggleStudentStatus(studentId: string, toggledBy: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        institutionId: true,
        user: { select: { id: true, name: true, email: true, active: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const currentStatus = student.user?.active ?? true;
    const newStatus = !currentStatus;

    await this.prisma.$transaction(async (tx) => {
      if (!newStatus) {
        // Deactivating: remove mentor assignments and deactivate internship applications
        await tx.mentorAssignment.updateMany({
          where: { studentId },
          data: { isActive: false },
        });

        await tx.internshipApplication.updateMany({
          where: { studentId, isActive: true },
          data: { isActive: false },
        });
      } else {
        // Activating: reactivate mentor assignments and internship applications
        await tx.mentorAssignment.updateMany({
          where: { studentId, isActive: false },
          data: { isActive: true },
        });

        await tx.internshipApplication.updateMany({
          where: { studentId, isActive: false },
          data: { isActive: true },
        });
      }

      // Toggle the user's active status
      if (student.user?.id) {
        await tx.user.update({
          where: { id: student.user.id },
          data: { active: newStatus },
        });
      }
    });

    // Audit student status change
    this.auditService.log({
      action: newStatus ? AuditAction.USER_ACTIVATION : AuditAction.USER_DEACTIVATION,
      entityType: 'Student',
      entityId: studentId,
      userId: toggledBy,
      userRole: Role.STATE_DIRECTORATE,
      description: `Student ${student.user?.name} (${student.user?.email}) ${newStatus ? 'activated' : 'deactivated'} by State Directorate`,
      category: AuditCategory.USER_MANAGEMENT,
      severity: AuditSeverity.HIGH,
      institutionId: student.institutionId || undefined,
      oldValues: {
        studentId,
        studentName: student.user?.name,
        studentEmail: student.user?.email,
        active: currentStatus,
      },
      newValues: {
        active: newStatus,
      },
    }).catch(() => {});

    // Invalidate cache
    await Promise.all([
      this.cache.mdel(`student:${studentId}`),
      this.cache.mdel(`state:institute:${student.institutionId}:students`),
      this.cache.mdel(`state:institute:${student.institutionId}:overview`),
    ]);

    return {
      success: true,
      active: newStatus,
      message: `Student ${student.user?.name} has been ${newStatus ? 'activated' : 'deactivated'} successfully. Mentor assignments and internship applications also ${newStatus ? 'reactivated' : 'deactivated'}.`,
    };
  }

  private getCurrentAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }
}
