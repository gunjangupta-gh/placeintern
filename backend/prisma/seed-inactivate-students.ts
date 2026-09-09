/**
 * Deactivates existing Student-role Users so that dashboards, reports, and the
 * State-Directorate chatbot show freshly bulk-uploaded student data cleanly,
 * without old/dummy seed data mixed in.
 *
 * Most student-facing queries in the codebase filter on `user.active` (directly
 * or via `student.user.active`). InternshipApplication and MentorAssignment also
 * carry their OWN independent `isActive` flag that several queries filter on
 * instead of/in addition to the user's active status. So this script cascades
 * the deactivation across all three:
 *   - User.active                    -> false
 *   - MentorAssignment.isActive      -> false (for that student's assignments)
 *   - InternshipApplication.isActive -> false (for that student's applications)
 *
 * Note: a handful of dashboards/reports/chatbot tools do not filter by active
 * status at all today (e.g. System-Admin dashboard's "Total Students" tile,
 * several State-Directorate chatbot tools). This script cannot fix those - they
 * need a code change, not a data change. See the audit notes shared alongside
 * this script for the full list.
 *
 * Usage:
 *   ts-node prisma/seed-deactivate-students.ts --dry-run
 *   ts-node prisma/seed-deactivate-students.ts --dry-run --verbose
 *   ts-node prisma/seed-deactivate-students.ts
 *   ts-node prisma/seed-deactivate-students.ts --institution-id=<uuid>
 */

import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import 'dotenv/config';

const DEACTIVATION_REASON = 'Deactivated by seed-deactivate-students.ts (student marked inactive)';
const DEACTIVATED_BY_TAG = 'SEED_SCRIPT:seed-deactivate-students';
const CHUNK_SIZE = 500;

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  institutionId: string | null;
}

interface ReportRow {
  userId: string;
  studentId: string;
  name: string;
  rollNumber: string;
  institutionId: string;
  activeMentorAssignments: number;
  activeInternshipApplications: number;
  status: 'WOULD_DEACTIVATE' | 'DEACTIVATED' | 'FAILED';
  reason: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const institutionArg = args.find((a) => a.startsWith('--institution-id='));
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    institutionId: institutionArg ? institutionArg.split('=')[1] : null,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getTimestampLabel(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

async function writeExcelReport(rows: ReportRow[], dryRun: boolean): Promise<string> {
  const reportDir = path.join(__dirname, '..', 'reports');
  await fs.mkdir(reportDir, { recursive: true });

  const now = new Date();
  const fileName = `deactivate-students-${dryRun ? 'dry-run' : 'applied'}-${getTimestampLabel(now)}.xlsx`;
  const outputPath = path.join(reportDir, fileName);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Students');

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      generatedAt: now.toISOString(),
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      totalStudents: rows.length,
      deactivated: rows.filter((r) => r.status === 'DEACTIVATED').length,
      wouldDeactivate: rows.filter((r) => r.status === 'WOULD_DEACTIVATE').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
      totalActiveMentorAssignments: rows.reduce((sum, r) => sum + r.activeMentorAssignments, 0),
      totalActiveInternshipApplications: rows.reduce((sum, r) => sum + r.activeInternshipApplications, 0),
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

async function main() {
  const { dryRun, verbose, institutionId } = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('DEACTIVATE STUDENTS SEED SCRIPT');
    console.log('='.repeat(80));
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Verbose: ${verbose ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Institution filter: ${institutionId || 'ALL institutions'}`);
    console.log('');

    const targetUsers = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        active: true,
        ...(institutionId ? { institutionId } : {}),
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        institutionId: true,
        Student: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Matched active STUDENT users: ${targetUsers.length}`);

    if (targetUsers.length === 0) {
      console.log('No active students matched. Nothing to do.');
      return;
    }

    const studentIds = targetUsers.map((u) => u.Student?.id).filter((id): id is string => !!id);

    // Per-student active counts, for the report (and sanity-checking scope before a live run)
    const [mentorAssignmentCounts, internshipApplicationCounts] = await Promise.all([
      prisma.mentorAssignment.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, isActive: true },
        _count: { id: true },
      }),
      prisma.internshipApplication.groupBy({
        by: ['studentId'],
        where: { studentId: { in: studentIds }, isActive: true },
        _count: { id: true },
      }),
    ]);

    const mentorCountMap = new Map(mentorAssignmentCounts.map((m) => [m.studentId, m._count.id]));
    const internshipCountMap = new Map(internshipApplicationCounts.map((i) => [i.studentId, i._count.id]));

    const rows: ReportRow[] = targetUsers.map((u) => ({
      userId: u.id,
      studentId: u.Student?.id || '',
      name: u.name,
      rollNumber: u.rollNumber || '',
      institutionId: u.institutionId || '',
      activeMentorAssignments: u.Student ? mentorCountMap.get(u.Student.id) || 0 : 0,
      activeInternshipApplications: u.Student ? internshipCountMap.get(u.Student.id) || 0 : 0,
      status: dryRun ? 'WOULD_DEACTIVATE' : 'DEACTIVATED',
      reason: '',
    }));

    const totalMentorAssignments = rows.reduce((sum, r) => sum + r.activeMentorAssignments, 0);
    const totalInternshipApplications = rows.reduce((sum, r) => sum + r.activeInternshipApplications, 0);

    console.log('');
    console.log(`Students to deactivate:                 ${rows.length}`);
    console.log(`  -> active mentor assignments affected: ${totalMentorAssignments}`);
    console.log(`  -> active internship applications:     ${totalInternshipApplications}`);
    console.log('');

    const preview = verbose ? rows : rows.slice(0, 10);
    preview.forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.userId} | ${r.name} | roll=${r.rollNumber || 'n/a'} | mentorAssignments=${r.activeMentorAssignments} | internshipApplications=${r.activeInternshipApplications}`,
      );
    });
    if (!verbose && rows.length > preview.length) {
      console.log(`... and ${rows.length - preview.length} more`);
    }

    if (dryRun) {
      console.log('');
      console.log('DRY RUN: no database changes were made.');
      const reportPath = await writeExcelReport(rows, true);
      console.log(`Excel report: ${reportPath}`);
      return;
    }

    console.log('');
    console.log('Applying updates...');
    const startedAt = Date.now();

    const userIdChunks = chunk(targetUsers.map((u) => u.id), CHUNK_SIZE);
    const studentIdChunks = chunk(studentIds, CHUNK_SIZE);

    for (const idsChunk of userIdChunks) {
      await prisma.user.updateMany({
        where: { id: { in: idsChunk } },
        data: { active: false },
      });
    }

    for (const idsChunk of studentIdChunks) {
      await prisma.mentorAssignment.updateMany({
        where: { studentId: { in: idsChunk }, isActive: true },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: DEACTIVATED_BY_TAG,
          deactivationReason: DEACTIVATION_REASON,
        },
      });

      await prisma.internshipApplication.updateMany({
        where: { studentId: { in: idsChunk }, isActive: true },
        data: { isActive: false },
      });
    }

    const durationMs = Date.now() - startedAt;
    console.log('');
    console.log('Completed.');
    console.log(`Deactivated users:                 ${rows.length}`);
    console.log(`Deactivated mentor assignments:    ${totalMentorAssignments}`);
    console.log(`Deactivated internship applications: ${totalInternshipApplications}`);
    console.log(`Duration: ${durationMs}ms`);

    const reportPath = await writeExcelReport(rows, false);
    console.log(`Excel report: ${reportPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
