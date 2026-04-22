import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import * as fs from 'fs/promises';
import * as path from 'path';
import 'dotenv/config';

const TARGET_ROLE = Role.ADMIN_STAFF;
const TARGET_PASSWORD = 'Pass@1234';
const BCRYPT_SALT_ROUNDS = 10;

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
}

interface ReportRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  hasChangedDefaultPasswordBefore: boolean;
  updatedPassword: string;
  status: 'WOULD_UPDATE' | 'UPDATED' | 'FAILED';
  reason: string;
  updatedAt: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
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
  const fileName = `admin-staff-password-${dryRun ? 'dry-run' : 'updated'}-${getTimestampLabel(now)}.xlsx`;
  const outputPath = path.join(reportDir, fileName);

  const workbook = XLSX.utils.book_new();

  const dataSheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, dataSheet, 'Password Update Report');

  const summarySheet = XLSX.utils.json_to_sheet([
    {
      generatedAt: now.toISOString(),
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      targetRole: TARGET_ROLE,
      targetPassword: TARGET_PASSWORD,
      totalRows: rows.length,
      updated: rows.filter((r) => r.status === 'UPDATED').length,
      wouldUpdate: rows.filter((r) => r.status === 'WOULD_UPDATE').length,
      failed: rows.filter((r) => r.status === 'FAILED').length,
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  XLSX.writeFile(workbook, outputPath);
  return outputPath;
}

async function main() {
  const { dryRun, verbose } = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('RESET ADMIN_STAFF PASSWORD SCRIPT');
    console.log('='.repeat(80));
    console.log(`Role: ${TARGET_ROLE}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Verbose: ${verbose ? 'ENABLED' : 'DISABLED'}`);
    console.log('');

    const users = await prisma.user.findMany({
      where: { role: TARGET_ROLE },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        hasChangedDefaultPassword: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Matched users with role ${TARGET_ROLE}: ${users.length}`);

    if (users.length === 0) {
      console.log('No users matched. Nothing to do.');
      return;
    }

    if (dryRun) {
      console.log('');
      console.log('DRY RUN preview: no database changes will be made.');

      const dryRunRows: ReportRow[] = users.map((user) => ({
        userId: user.id,
        name: user.name,
        email: user.email || '',
        role: TARGET_ROLE,
        active: user.active,
        hasChangedDefaultPasswordBefore: !!user.hasChangedDefaultPassword,
        updatedPassword: TARGET_PASSWORD,
        status: 'WOULD_UPDATE',
        reason: '',
        updatedAt: '',
      }));

      const previewUsers = verbose ? users : users.slice(0, 10);
      previewUsers.forEach((user, index) => {
        console.log(
          `${index + 1}. ${user.id} | ${user.name} | ${user.email || 'no-email'} | active=${user.active}`,
        );
      });

      if (!verbose && users.length > previewUsers.length) {
        console.log(`... and ${users.length - previewUsers.length} more users`);
      }

      console.log('');
      console.log(`Would update ${users.length} user(s):`);
      console.log(`- password => bcrypt hash of "${TARGET_PASSWORD}"`);
      console.log('- hasChangedDefaultPassword => false');
      console.log('- passwordChangedAt => current timestamp');

      const reportPath = await writeExcelReport(dryRunRows, true);
      console.log(`Excel report: ${reportPath}`);
      return;
    }

    console.log('');
    console.log('Applying updates...');

    const startedAt = Date.now();
    let updatedCount = 0;
    const reportRows: ReportRow[] = [];
    const failed: Array<{ userId: string; reason: string }> = [];

    for (const user of users) {
      try {
        const hashedPassword = await bcrypt.hash(TARGET_PASSWORD, BCRYPT_SALT_ROUNDS);

        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            hasChangedDefaultPassword: false,
            passwordChangedAt: new Date(),
          },
        });

        updatedCount += 1;
        reportRows.push({
          userId: user.id,
          name: user.name,
          email: user.email || '',
          role: TARGET_ROLE,
          active: user.active,
          hasChangedDefaultPasswordBefore: !!user.hasChangedDefaultPassword,
          updatedPassword: TARGET_PASSWORD,
          status: 'UPDATED',
          reason: '',
          updatedAt: new Date().toISOString(),
        });

        if (verbose) {
          console.log(`Updated: ${user.id} | ${user.name} | ${user.email || 'no-email'}`);
        }
      } catch (error: any) {
        const reason = error?.message || 'Unknown error';
        failed.push({ userId: user.id, reason });
        reportRows.push({
          userId: user.id,
          name: user.name,
          email: user.email || '',
          role: TARGET_ROLE,
          active: user.active,
          hasChangedDefaultPasswordBefore: !!user.hasChangedDefaultPassword,
          updatedPassword: TARGET_PASSWORD,
          status: 'FAILED',
          reason,
          updatedAt: new Date().toISOString(),
        });

        if (verbose) {
          console.error(`Failed: ${user.id} | ${user.name} | ${reason}`);
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log('');
    console.log('Completed.');
    console.log(`Updated users: ${updatedCount}`);
    console.log(`Failed users: ${failed.length}`);
    console.log(`Duration: ${durationMs}ms`);

    const reportPath = await writeExcelReport(reportRows, false);
    console.log(`Excel report: ${reportPath}`);

    if (failed.length > 0) {
      console.log('');
      console.log('Failure details:');
      failed.forEach((item, index) => {
        console.log(`${index + 1}. ${item.userId} | ${item.reason}`);
      });

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
