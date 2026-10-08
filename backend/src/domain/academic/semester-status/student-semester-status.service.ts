import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import {
  AuditAction,
  AuditCategory,
  AuditSeverity,
  Role,
  SemesterResultStatus,
} from '../../../generated/prisma/client';
import { getAcademicStartYear } from '../../../common/utils/academic-progress.util';

export const MAX_SEMESTER = 6;

export interface SetSemesterStatusInput {
  status: SemesterResultStatus;
  backlogCount?: number;
  remarks?: string;
}

export interface SemesterStatusActor {
  userId: string;
  role: Role;
  institutionId?: string | null;
}

/** How far along the result lifecycle a status is; moving to a lower rank is a "correction". */
const STATUS_RANK: Record<SemesterResultStatus, number> = {
  PENDING: 0,
  APPEARED: 1,
  FAILED: 2,
  PASSED: 3,
};

const STATUS_LABEL: Record<SemesterResultStatus, string> = {
  PENDING: 'Pending',
  APPEARED: 'Appeared',
  PASSED: 'Passed',
  FAILED: 'Failed',
};

/**
 * Semester-wise result status for a student (see PLAN-semester-wise-clearance.md).
 *
 * This service owns the rules only. Callers (principal / faculty services) are responsible for
 * authorising access to the student first: principal = same institution, faculty = assigned mentor.
 */
@Injectable()
export class StudentSemesterStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * All semester rows for a student: every semester up to currentSemester (missing ones shown as
   * PENDING without being stored) plus any stored row beyond it (e.g. migrated legacy data).
   */
  async list(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, currentSemester: true, totalBacklogs: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const current = student.currentSemester ?? 0;
    const rows = await this.prisma.studentSemesterStatus.findMany({
      where: { studentId },
      orderBy: { semester: 'asc' },
    });
    const bySemester = new Map(rows.map((r) => [r.semester, r]));

    const semesters: Array<{
      semester: number;
      status: SemesterResultStatus;
      backlogCount: number;
      remarks: string | null;
      academicYear: string | null;
      updatedAt: Date | null;
      editable: boolean;
    }> = [];

    for (let sem = 1; sem <= MAX_SEMESTER; sem++) {
      const row = bySemester.get(sem);
      if (!row && sem > current) continue;
      semesters.push({
        semester: sem,
        status: row?.status ?? SemesterResultStatus.PENDING,
        backlogCount: row?.backlogCount ?? 0,
        remarks: row?.remarks ?? null,
        academicYear: row?.academicYear ?? null,
        updatedAt: row?.updatedAt ?? null,
        editable: sem <= current,
      });
    }

    return {
      studentId,
      currentSemester: student.currentSemester,
      totalBacklogs: student.totalBacklogs ?? 0,
      semesters,
    };
  }

  /** Create or update one semester's status, enforcing the lifecycle rules. */
  async set(studentId: string, semester: number, input: SetSemesterStatusInput, actor: SemesterStatusActor) {
    if (!Number.isInteger(semester) || semester < 1 || semester > MAX_SEMESTER) {
      throw new BadRequestException(`Semester must be a whole number between 1 and ${MAX_SEMESTER}`);
    }
    if (!input?.status || !(input.status in STATUS_RANK)) {
      throw new BadRequestException('A valid status is required');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, currentSemester: true, institutionId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    // 1. No results for semesters the student has not reached yet
    const current = student.currentSemester ?? 0;
    if (semester > current) {
      throw new BadRequestException(
        current
          ? `Semester ${semester} has not started yet (student is in semester ${current})`
          : 'Current semester is not set for this student, so semester status cannot be recorded yet',
      );
    }

    // 2. Backlog consistency
    let backlogCount = input.backlogCount ?? 0;
    if (!Number.isInteger(backlogCount) || backlogCount < 0) {
      throw new BadRequestException('Backlog count must be a whole number, 0 or more');
    }
    if (input.status === SemesterResultStatus.FAILED && backlogCount < 1) {
      throw new BadRequestException('Enter the number of backlogs (at least 1) for a failed semester');
    }
    if (input.status !== SemesterResultStatus.FAILED) {
      backlogCount = 0;
    }

    // 3. Lifecycle: only a principal may move a status backwards (correction), except the normal
    //    re-appear step FAILED -> APPEARED which faculty may also record.
    const existing = await this.prisma.studentSemesterStatus.findUnique({
      where: { studentId_semester: { studentId, semester } },
    });
    const oldStatus = existing?.status ?? SemesterResultStatus.PENDING;
    const isBackward =
      STATUS_RANK[input.status] < STATUS_RANK[oldStatus] &&
      !(oldStatus === SemesterResultStatus.FAILED && input.status === SemesterResultStatus.APPEARED);
    if (isBackward && actor.role !== Role.PRINCIPAL) {
      throw new BadRequestException(
        `Only the principal can change Semester ${semester} from ${STATUS_LABEL[oldStatus]} back to ${STATUS_LABEL[input.status]}`,
      );
    }

    const remarks = input.remarks?.trim() || null;
    const academicYear = existing?.academicYear ?? this.academicYearFor(semester, current);

    await this.prisma.$transaction(async (tx) => {
      await tx.studentSemesterStatus.upsert({
        where: { studentId_semester: { studentId, semester } },
        create: { studentId, semester, academicYear, status: input.status, backlogCount, remarks, updatedBy: actor.userId },
        update: { status: input.status, backlogCount, remarks, updatedBy: actor.userId },
      });

      // Student.totalBacklogs is derived from the per-semester counts
      const agg = await tx.studentSemesterStatus.aggregate({
        where: { studentId },
        _sum: { backlogCount: true },
      });
      await tx.student.update({
        where: { id: studentId },
        data: { totalBacklogs: agg._sum.backlogCount ?? 0 },
      });
    });

    this.auditService
      .log({
        action: AuditAction.STUDENT_PROFILE_UPDATE,
        entityType: 'StudentSemesterStatus',
        entityId: studentId,
        category: AuditCategory.ADMINISTRATIVE,
        severity: isBackward ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        userId: actor.userId,
        userRole: actor.role,
        institutionId: student.institutionId ?? actor.institutionId ?? undefined,
        description: `Semester ${semester} status ${STATUS_LABEL[oldStatus]} -> ${STATUS_LABEL[input.status]}${
          backlogCount ? ` (${backlogCount} backlog${backlogCount > 1 ? 's' : ''})` : ''
        }`,
        oldValues: { semester, status: oldStatus, backlogCount: existing?.backlogCount ?? 0 },
        newValues: { semester, status: input.status, backlogCount, remarks },
      })
      .catch(() => {});

    return this.list(studentId);
  }

  /**
   * Overall clearance may only become CLEARED once every semester before the current one is
   * PASSED. Throws a BadRequestException naming the semesters that are holding it back.
   */
  async assertCanBeCleared(studentId: string): Promise<void> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { currentSemester: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const current = student.currentSemester ?? 0;
    if (current <= 1) return; // nothing earlier to have passed

    const rows = await this.prisma.studentSemesterStatus.findMany({
      where: { studentId, semester: { lt: current } },
      select: { semester: true, status: true },
    });
    const bySemester = new Map(rows.map((r) => [r.semester, r.status]));

    const blocking: string[] = [];
    for (let sem = 1; sem < current; sem++) {
      const status = bySemester.get(sem);
      if (status !== SemesterResultStatus.PASSED) {
        blocking.push(`Semester ${sem} (${status ? STATUS_LABEL[status] : 'not recorded'})`);
      }
    }

    if (blocking.length) {
      throw new BadRequestException(
        `Cannot mark as Cleared: all earlier semesters must be Passed first. Pending: ${blocking.join(', ')}`,
      );
    }
  }

  /** Academic year label (e.g. "2025-26") in which `semester` ran, derived from today's position. */
  private academicYearFor(semester: number, currentSemester: number): string {
    const currentStart = getAcademicStartYear(new Date());
    const yearsAgo = Math.floor((currentSemester - 1) / 2) - Math.floor((semester - 1) / 2);
    const start = currentStart - yearsAgo;
    return `${start}-${String(start + 1).slice(-2)}`;
  }
}
