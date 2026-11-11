import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import { AuditAction, AuditCategory, AuditSeverity, Role } from '../../generated/prisma/client';

export const MAX_MENTOR_ROWS = 2000;
const MENTOR_ROLES = [Role.TEACHER, Role.FACULTY_COORDINATOR];

export interface MentorRow {
  rowNumber: number;
  rollNumber?: string;
  mentorEmail?: string;
  notes?: string;
}

export type MentorRowStatus = 'ASSIGN' | 'REASSIGN' | 'UNCHANGED' | 'ERROR';

export interface MentorRowResult {
  row: number;
  rollNumber?: string;
  studentName?: string;
  mentorEmail?: string;
  mentorName?: string;
  currentMentor?: string | null;
  status: MentorRowStatus;
  error?: string;
}

export interface BulkMentorResult {
  dryRun: boolean;
  total: number;
  willAssign: number; // new + reassign (applied when dryRun is false)
  newAssignments: number;
  reassignments: number;
  unchanged: number;
  failed: number;
  rows: MentorRowResult[];
}

/** Academic year label, July to June (same rule as the manual assignment screen). */
export function currentAcademicYear(now = new Date()): string {
  const y = now.getFullYear();
  return now.getMonth() >= 6 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

@Injectable()
export class BulkMentorService {
  private readonly logger = new Logger(BulkMentorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  private clean(v: unknown): string | undefined {
    if (v === null || v === undefined) return undefined;
    // exceljs may hand back rich text / hyperlink objects
    const raw = typeof v === 'object' ? (v as any).text ?? (v as any).result ?? String(v) : v;
    const s = String(raw).trim();
    return s === '' ? undefined : s;
  }

  async parseFile(buffer: Buffer): Promise<MentorRow[]> {
    let rows: Record<string, any>[];
    try {
      const { workbook } = await ExcelUtils.read(buffer);
      rows = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });
    } catch (e: any) {
      this.logger.warn(`Mentor upload could not be read: ${e?.message}`);
      throw new BadRequestException('Could not read the file. Please upload the Excel template (.xlsx) or a CSV.');
    }
    return rows
      .map((r, i) => ({
        rowNumber: i + 2, // row 1 is the header
        rollNumber: this.clean(r['Roll Number'] ?? r['Roll No'] ?? r['rollNumber']),
        mentorEmail: this.clean(r['Mentor Email'] ?? r['mentorEmail'] ?? r['Faculty Email'])?.toLowerCase(),
        notes: this.clean(r['Notes'] ?? r['notes']),
      }))
      // fully blank lines are ignored
      .filter((r) => r.rollNumber || r.mentorEmail || r.notes);
  }

  /**
   * Check every row against the principal's institution; with dryRun=false also apply the valid ones.
   * Valid rows are applied even when others fail, and the result says exactly which rows were skipped.
   */
  async process(
    principalId: string,
    institutionId: string,
    rows: MentorRow[],
    dryRun: boolean,
    academicYear = currentAcademicYear(),
  ): Promise<BulkMentorResult> {
    if (rows.length === 0) throw new BadRequestException('No rows found in the file');
    if (rows.length > MAX_MENTOR_ROWS) throw new BadRequestException(`Maximum ${MAX_MENTOR_ROWS} rows can be uploaded at once`);

    const rolls = [...new Set(rows.map((r) => r.rollNumber).filter((x): x is string => !!x))];
    const emails = [...new Set(rows.map((r) => r.mentorEmail).filter((x): x is string => !!x))];

    const [students, mentors] = await Promise.all([
      this.prisma.student.findMany({
        where: { institutionId, user: { rollNumber: { in: rolls }, active: true } },
        select: {
          id: true,
          user: { select: { name: true, rollNumber: true } },
          mentorAssignments: {
            where: { isActive: true },
            select: { mentorId: true, mentor: { select: { name: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.user.findMany({
        where: { institutionId, role: { in: MENTOR_ROLES }, active: true, email: { in: emails, mode: 'insensitive' } },
        select: { id: true, name: true, email: true },
      }),
    ]);
    const studentByRoll = new Map(students.map((s) => [String(s.user?.rollNumber).toLowerCase(), s]));
    const mentorByEmail = new Map(mentors.map((m) => [String(m.email).toLowerCase(), m]));

    const seen = new Set<string>();
    const results: MentorRowResult[] = [];
    const toApply: { studentId: string; mentorId: string; notes?: string }[] = [];

    for (const r of rows) {
      const base: MentorRowResult = { row: r.rowNumber, rollNumber: r.rollNumber, mentorEmail: r.mentorEmail, status: 'ERROR' };
      const fail = (error: string) => results.push({ ...base, error });

      if (!r.rollNumber) { fail('Roll Number is required'); continue; }
      if (!r.mentorEmail) { fail('Mentor Email is required'); continue; }
      const key = r.rollNumber.toLowerCase();
      if (seen.has(key)) { fail('This roll number appears more than once in the file'); continue; }
      seen.add(key);

      const student = studentByRoll.get(key);
      if (!student) { fail('Student not found in your institution (or is inactive)'); continue; }
      const mentor = mentorByEmail.get(r.mentorEmail);
      if (!mentor) { fail('Mentor not found in your institution (must be an active teacher / faculty coordinator)'); continue; }

      const current = student.mentorAssignments[0];
      const info = { ...base, studentName: student.user?.name, mentorName: mentor.name, currentMentor: current?.mentor?.name ?? null };
      if (current?.mentorId === mentor.id) {
        results.push({ ...info, status: 'UNCHANGED' });
        continue;
      }
      results.push({ ...info, status: current ? 'REASSIGN' : 'ASSIGN' });
      toApply.push({ studentId: student.id, mentorId: mentor.id, notes: r.notes });
    }

    const count = (s: MentorRowStatus) => results.filter((x) => x.status === s).length;
    const summary: BulkMentorResult = {
      dryRun,
      total: rows.length,
      willAssign: toApply.length,
      newAssignments: count('ASSIGN'),
      reassignments: count('REASSIGN'),
      unchanged: count('UNCHANGED'),
      failed: count('ERROR'),
      rows: results,
    };
    if (dryRun || toApply.length === 0) return summary;

    const now = new Date();
    const studentIds = toApply.map((a) => a.studentId);
    // One transaction: the old active assignments are closed and the new ones created together
    await this.prisma.$transaction(async (tx) => {
      await tx.mentorAssignment.updateMany({
        where: { studentId: { in: studentIds }, isActive: true },
        data: { isActive: false, deactivatedAt: now, deactivatedBy: principalId, deactivationReason: 'Reassigned by bulk upload' },
      });
      await tx.mentorAssignment.createMany({
        data: toApply.map((a) => ({
          studentId: a.studentId,
          mentorId: a.mentorId,
          assignedBy: principalId,
          academicYear,
          assignmentReason: a.notes ?? 'Bulk assignment (Excel upload)',
          isActive: true,
        })),
      });
    }, { timeout: 60000 });

    const principal = await this.prisma.user.findUnique({ where: { id: principalId }, select: { name: true, role: true } });
    this.audit
      .log({
        action: AuditAction.MENTOR_ASSIGN,
        entityType: 'MentorAssignment',
        entityId: institutionId,
        userId: principalId,
        userName: principal?.name,
        userRole: principal?.role ?? Role.PRINCIPAL,
        description: `Bulk mentor assignment: ${toApply.length} student(s) (${summary.newAssignments} new, ${summary.reassignments} reassigned)`,
        category: AuditCategory.ADMINISTRATIVE,
        severity: AuditSeverity.MEDIUM,
        institutionId,
        newValues: { academicYear, assigned: toApply.length, failed: summary.failed, unchanged: summary.unchanged },
      })
      .catch(() => undefined);

    await this.cache
      .invalidateByTags(['mentors', 'principal', `institution:${institutionId}`, ...studentIds.map((id) => `student:${id}`)])
      .catch(() => undefined);

    return summary;
  }

  /** Template pre-filled with the institution's active students and a reference list of its mentors. */
  async getTemplate(institutionId: string): Promise<Buffer> {
    if (!institutionId) throw new NotFoundException('Institution not found');
    const [students, mentors] = await Promise.all([
      this.prisma.student.findMany({
        where: { institutionId, user: { active: true } },
        take: MAX_MENTOR_ROWS * 5,
        select: {
          user: { select: { name: true, rollNumber: true } },
          branch: { select: { name: true } },
          currentYear: true,
          mentorAssignments: { where: { isActive: true }, select: { mentor: { select: { name: true } } }, take: 1 },
        },
      }),
      this.prisma.user.findMany({
        where: { institutionId, role: { in: MENTOR_ROLES }, active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, designation: true },
      }),
    ]);

    const rows = students
      .sort((a, b) => String(a.user?.rollNumber ?? '').localeCompare(String(b.user?.rollNumber ?? ''), undefined, { numeric: true }))
      .map((s) => ({
        'Roll Number': s.user?.rollNumber ?? '',
        'Mentor Email': '',
        Notes: '',
        'Student Name (reference only)': s.user?.name ?? '',
        'Branch (reference only)': s.branch?.name ?? '',
        'Year (reference only)': s.currentYear ?? '',
        'Current Mentor (reference only)': s.mentorAssignments[0]?.mentor?.name ?? '',
      }));

    const loads = await this.prisma.mentorAssignment.groupBy({
      by: ['mentorId'],
      where: { isActive: true, mentorId: { in: mentors.map((m) => m.id) } },
      _count: { _all: true },
    });
    const loadOf = new Map(loads.map((l) => [l.mentorId, l._count._all]));
    const mentorRows = mentors.map((m) => ({
      Name: m.name,
      'Mentor Email': m.email,
      Designation: m.designation ?? '',
      'Current Mentees': loadOf.get(m.id) ?? 0,
    }));

    const instructions = [
      { Step: 1, Instruction: 'Sheet "Mentor Assignments" lists your active students. Fill the "Mentor Email" column for the students you want to assign.' },
      { Step: 2, Instruction: 'Copy the mentor email exactly from the "Mentors" sheet. Only active teachers / faculty coordinators of your institution are accepted.' },
      { Step: 3, Instruction: 'Rows with an empty Mentor Email are ignored. You can delete rows you do not want to change.' },
      { Step: 4, Instruction: 'Only "Roll Number", "Mentor Email" and "Notes" are read. Columns marked "reference only" are ignored.' },
      { Step: 5, Instruction: 'A student who already has a mentor is moved to the new mentor (the old assignment is closed). Same mentor again = no change.' },
      { Step: 6, Instruction: `Upload the file in Mentor Assignment > Bulk Assign. You see a check of every row before anything is saved. Maximum ${MAX_MENTOR_ROWS} rows per upload.` },
    ];

    return ExcelUtils.createFromJson([
      { name: 'Mentor Assignments', data: rows.length ? rows : [{ 'Roll Number': '', 'Mentor Email': '', Notes: '' }] },
      { name: 'Mentors', data: mentorRows.length ? mentorRows : [{ Name: '', 'Mentor Email': '', Designation: '', 'Current Mentees': 0 }] },
      { name: 'Instructions', data: instructions },
    ]);
  }
}
