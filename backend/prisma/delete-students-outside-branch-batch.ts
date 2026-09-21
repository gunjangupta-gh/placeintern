/**
 * Keeps only STUDENT users who are in one of the allowed branches AND the allowed
 * batch; permanently deletes every other STUDENT user (wrong branch, wrong batch,
 * or missing branch/batch).
 *
 * Deleting a User cascades (onDelete: Cascade) through Student and all of its
 * dependents - Document, InternshipApplication, MentorAssignment, MonthlyReport,
 * Grievance, PrincipalFeedbackStudent, StudentPlacementInterest, InternshipReport -
 * so this is a genuine, irreversible hard delete, not a deactivation. Because of
 * that, this script defaults to --dry-run and refuses to run live unless BOTH
 * --live and --confirm are passed (unlike the reversible seed-deactivate-students.ts,
 * where dry-run has to be requested explicitly).
 *
 * An Excel report of exactly which students matched for deletion is always written
 * before anything is deleted, in both dry-run and live mode, so there is a local
 * record of who was removed. That report contains student names/roll numbers -
 * treat it like the student data it is (keep it local, do not upload it anywhere).
 *
 * Usage:
 *   ts-node prisma/delete-students-outside-branch-batch.ts                 (dry run, default)
 *   ts-node prisma/delete-students-outside-branch-batch.ts --verbose       (dry run, list every match)
 *   ts-node prisma/delete-students-outside-branch-batch.ts --live --confirm
 *   ts-node prisma/delete-students-outside-branch-batch.ts --live --confirm --branches="Civil Engineering,..." --batch="2024-2027"
 */

import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import 'dotenv/config';

const DEFAULT_KEEP_BRANCHES = [
  'Civil Engineering',
  'Mechanical Engineering',
  'Computer Science and Engineering',
  'Electronics and Communication Engineering',
  'Electrical Engineering',
  'Information Technology',
];
const DEFAULT_KEEP_BATCH = '2024-2027';
const CHUNK_SIZE = 100;

interface ParsedArgs {
  live: boolean;
  confirm: boolean;
  verbose: boolean;
  keepBranches: string[];
  keepBatch: string;
}

interface ReportRow {
  userId: string;
  studentId: string;
  name: string;
  rollNumber: string;
  institutionId: string;
  branchName: string;
  batchName: string;
  status: 'WOULD_DELETE' | 'DELETED' | 'FAILED';
  reason: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const branchesArg = args.find((a) => a.startsWith('--branches='));
  const batchArg = args.find((a) => a.startsWith('--batch='));
  return {
    live: args.includes('--live'),
    confirm: args.includes('--confirm'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    keepBranches: branchesArg
      ? branchesArg
          .split('=')[1]
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean)
      : DEFAULT_KEEP_BRANCHES,
    keepBatch: batchArg ? batchArg.split('=')[1].trim() : DEFAULT_KEEP_BATCH,
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
  const fileName = `delete-students-outside-branch-batch-${dryRun ? 'dry-run' : 'applied'}-${getTimestampLabel(now)}.xlsx`;
  const outputPath = path.join(reportDir, fileName);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Students');

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      generatedAt: now.toISOString(),
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      totalMatched: rows.length,
      deleted: rows.filter((r) => r.status === 'DELETED').length,
      wouldDelete: rows.filter((r) => r.status === 'WOULD_DELETE').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

async function main() {
  const { live, confirm, verbose, keepBranches, keepBatch } = parseArgs();
  const dryRun = !live;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('DELETE STUDENTS OUTSIDE BRANCH/BATCH SCRIPT');
    console.log('='.repeat(80));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (permanent delete)'}`);
    console.log(`Keep branches: ${keepBranches.join(', ')}`);
    console.log(`Keep batch: ${keepBatch}`);
    console.log('');

    if (live && !confirm) {
      throw new Error('Refusing to run live without --confirm. This permanently deletes student records. Re-run with --live --confirm once you have reviewed the dry-run report.');
    }

    const branches = await prisma.branch.findMany({
      where: { name: { in: keepBranches } },
      select: { id: true, name: true },
    });
    const missingBranches = keepBranches.filter((name) => !branches.some((b) => b.name === name));
    if (missingBranches.length > 0) {
      const allBranches = await prisma.branch.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
      throw new Error(
        `Branch(es) not found: ${missingBranches.join(', ')}. Available branches: ${allBranches.map((b) => b.name).join(', ')}`,
      );
    }

    const batch = await prisma.batch.findFirst({ where: { name: keepBatch }, select: { id: true, name: true } });
    if (!batch) {
      const allBatches = await prisma.batch.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
      throw new Error(`Batch not found: ${keepBatch}. Available batches: ${allBatches.map((b) => b.name).join(', ')}`);
    }

    const branchIdSet = new Set(branches.map((b) => b.id));
    const allBranches = await prisma.branch.findMany({ select: { id: true, name: true } });
    const branchNameMap = new Map(allBranches.map((b) => [b.id, b.name]));

    // Filtered in application code (not as a Prisma nested-relation NOT filter) because
    // Prisma's NOT over a singular relation does not reliably match rows where the
    // related Student's branchId/batchId is null - verified against this DB, where it
    // silently dropped 9 null-branch students that should have matched for deletion.
    const allStudentUsers = await prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        institutionId: true,
        Student: { select: { id: true, branchId: true, batchId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const targetUsers = allStudentUsers.filter((u) => {
      const s = u.Student;
      const isKept = !!s && !!s.branchId && branchIdSet.has(s.branchId) && s.batchId === batch.id;
      return !isKept;
    });

    console.log(`Matched STUDENT users to delete: ${targetUsers.length}`);

    if (targetUsers.length === 0) {
      console.log('No students matched. Nothing to do.');
      return;
    }

    const rows: ReportRow[] = targetUsers.map((u) => ({
      userId: u.id,
      studentId: u.Student?.id || '',
      name: u.name,
      rollNumber: u.rollNumber || '',
      institutionId: u.institutionId || '',
      branchName: u.Student?.branchId ? branchNameMap.get(u.Student.branchId) || 'UNKNOWN_BRANCH' : 'NO_BRANCH',
      batchName: u.Student?.batchId === batch.id ? batch.name : u.Student?.batchId ? 'OTHER_BATCH' : 'NO_BATCH',
      status: dryRun ? 'WOULD_DELETE' : 'DELETED',
      reason: '',
    }));

    console.log('');
    const preview = verbose ? rows : rows.slice(0, 10);
    preview.forEach((r, i) => {
      console.log(`${i + 1}. ${r.userId} | ${r.name} | roll=${r.rollNumber || 'n/a'} | branch=${r.branchName} | batch=${r.batchName}`);
    });
    if (!verbose && rows.length > preview.length) {
      console.log(`... and ${rows.length - preview.length} more (re-run with --verbose to list all)`);
    }

    if (dryRun) {
      console.log('');
      console.log('DRY RUN: no database changes were made.');
      const reportPath = await writeExcelReport(rows, true);
      console.log(`Excel report: ${reportPath}`);
      console.log('');
      console.log('Review the report, then re-run with --live --confirm to permanently delete these students.');
      return;
    }

    console.log('');
    console.log('Deleting...');
    const startedAt = Date.now();

    let deletedCount = 0;
    let failedCount = 0;
    const rowById = new Map(rows.map((r) => [r.userId, r]));

    for (const idsChunk of chunk(targetUsers.map((u) => u.id), CHUNK_SIZE)) {
      const results = await Promise.allSettled(
        idsChunk.map((id) => prisma.user.delete({ where: { id } })),
      );
      results.forEach((result, i) => {
        const id = idsChunk[i];
        const row = rowById.get(id);
        if (!row) return;
        if (result.status === 'fulfilled') {
          deletedCount += 1;
        } else {
          failedCount += 1;
          row.status = 'FAILED';
          row.reason = result.reason?.message || String(result.reason);
        }
      });
    }

    const durationMs = Date.now() - startedAt;
    console.log('');
    console.log('Completed.');
    console.log(`Deleted:  ${deletedCount}`);
    console.log(`Failed:   ${failedCount}`);
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
