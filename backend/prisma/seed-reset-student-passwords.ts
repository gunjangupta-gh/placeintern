/**
 * Regenerates student passwords using the current password format:
 *   first 4 letters of name (lowercase) + "@" + last 4 characters of Roll Number
 *
 * This exists because the format changed (it previously was `name+rollNumber+"@123"`)
 * after a batch of students had already been bulk-uploaded with the old format.
 * Scoped to one Batch (default "2024-2027") so it only touches the students who
 * actually need the new password, not every student in the system.
 *
 * Usage:
 *   ts-node prisma/seed-reset-student-passwords.ts --dry-run
 *   ts-node prisma/seed-reset-student-passwords.ts --dry-run --verbose
 *   ts-node prisma/seed-reset-student-passwords.ts
 *   ts-node prisma/seed-reset-student-passwords.ts --batch=2025-2028
 *   ts-node prisma/seed-reset-student-passwords.ts --include-inactive
 */

import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import 'dotenv/config';

const DEFAULT_BATCH_NAME = '2024-2027';
const BCRYPT_SALT_ROUNDS = 10;

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  batchName: string;
  includeInactive: boolean;
}

interface ReportRow {
  userId: string;
  studentId: string;
  name: string;
  rollNumber: string;
  active: boolean;
  newPassword: string;
  status: 'WOULD_UPDATE' | 'UPDATED' | 'SKIPPED' | 'FAILED';
  reason: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const batchArg = args.find((a) => a.startsWith('--batch='));
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    batchName: batchArg ? batchArg.split('=')[1] : DEFAULT_BATCH_NAME,
    includeInactive: args.includes('--include-inactive'),
  };
}

/** Must match UserService.generateTemporaryPassword exactly */
function generatePassword(name: string, rollNumber: string): string {
  const namePart = name.replace(/\s/g, '').substring(0, 4).toLowerCase();
  const idPart = rollNumber.slice(-4);
  return `${namePart}@${idPart}`;
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

async function writeExcelReport(rows: ReportRow[], batchName: string, dryRun: boolean): Promise<string> {
  const reportDir = path.join(__dirname, '..', 'reports');
  await fs.mkdir(reportDir, { recursive: true });

  const now = new Date();
  const safeBatch = batchName.replace(/[^a-z0-9-]/gi, '_');
  const fileName = `reset-student-passwords-${safeBatch}-${dryRun ? 'dry-run' : 'applied'}-${getTimestampLabel(now)}.xlsx`;
  const outputPath = path.join(reportDir, fileName);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Students');

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      generatedAt: now.toISOString(),
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      batch: batchName,
      totalRows: rows.length,
      updated: rows.filter((r) => r.status === 'UPDATED').length,
      wouldUpdate: rows.filter((r) => r.status === 'WOULD_UPDATE').length,
      skipped: rows.filter((r) => r.status === 'SKIPPED').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

async function main() {
  const { dryRun, verbose, batchName, includeInactive } = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('RESET STUDENT PASSWORDS SEED SCRIPT');
    console.log('='.repeat(80));
    console.log(`Batch: ${batchName}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Verbose: ${verbose ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Include inactive students: ${includeInactive ? 'YES' : 'NO (default)'}`);
    console.log('');

    const batch = await prisma.batch.findUnique({ where: { name: batchName }, select: { id: true, name: true } });
    if (!batch) {
      console.log(`No batch found with name "${batchName}". Nothing to do.`);
      return;
    }

    const students = await prisma.student.findMany({
      where: {
        batchId: batch.id,
        user: {
          role: Role.STUDENT,
          ...(includeInactive ? {} : { active: true }),
        },
      },
      select: {
        id: true,
        user: { select: { id: true, name: true, rollNumber: true, active: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Matched students in batch "${batchName}": ${students.length}`);

    if (students.length === 0) {
      console.log('No students matched. Nothing to do.');
      return;
    }

    const rows: ReportRow[] = [];

    for (const student of students) {
      const user = student.user;
      if (!user?.rollNumber?.trim()) {
        rows.push({
          userId: user?.id || '',
          studentId: student.id,
          name: user?.name || '',
          rollNumber: '',
          active: user?.active ?? false,
          newPassword: '',
          status: 'SKIPPED',
          reason: 'No roll number on record',
        });
        continue;
      }

      const newPassword = generatePassword(user.name, user.rollNumber);
      rows.push({
        userId: user.id,
        studentId: student.id,
        name: user.name,
        rollNumber: user.rollNumber,
        active: user.active,
        newPassword,
        status: dryRun ? 'WOULD_UPDATE' : 'UPDATED',
        reason: '',
      });
    }

    const toApply = rows.filter((r) => r.status === 'WOULD_UPDATE' || r.status === 'UPDATED');
    const skipped = rows.filter((r) => r.status === 'SKIPPED');

    console.log('');
    console.log(`Students to update: ${toApply.length}`);
    console.log(`Students skipped (no roll number): ${skipped.length}`);
    console.log('');

    const preview = verbose ? toApply : toApply.slice(0, 10);
    preview.forEach((r, i) => {
      console.log(`${i + 1}. ${r.userId} | ${r.name} | roll=${r.rollNumber} | newPassword=${r.newPassword}`);
    });
    if (!verbose && toApply.length > preview.length) {
      console.log(`... and ${toApply.length - preview.length} more`);
    }

    if (dryRun) {
      console.log('');
      console.log('DRY RUN: no database changes were made.');
      const reportPath = await writeExcelReport(rows, batchName, true);
      console.log(`Excel report: ${reportPath}`);
      return;
    }

    console.log('');
    console.log('Applying updates...');
    const startedAt = Date.now();
    const failed: ReportRow[] = [];

    for (const row of toApply) {
      try {
        const hashedPassword = await bcrypt.hash(row.newPassword, BCRYPT_SALT_ROUNDS);
        await prisma.user.update({
          where: { id: row.userId },
          data: {
            password: hashedPassword,
            hasChangedDefaultPassword: false,
            passwordChangedAt: new Date(),
          },
        });

        if (verbose) {
          console.log(`Updated: ${row.userId} | ${row.name} | roll=${row.rollNumber}`);
        }
      } catch (error: any) {
        row.status = 'FAILED';
        row.reason = error?.message || 'Unknown error';
        failed.push(row);
        console.error(`Failed: ${row.userId} | ${row.name} | ${row.reason}`);
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log('');
    console.log('Completed.');
    console.log(`Updated: ${toApply.length - failed.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Skipped (no roll number): ${skipped.length}`);
    console.log(`Duration: ${durationMs}ms`);

    const reportPath = await writeExcelReport(rows, batchName, false);
    console.log(`Excel report: ${reportPath}`);

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
