/**
 * Generates a single-sheet Excel report of faculty training enrollments.
 *
 * Output (one row per faculty x training enrollment):
 *   S.No | Faculty Name | Phone | Email | Course (Branch) | College Name | Training Name | Completed (Yes/No)
 *   | Total Hours Completed (Staff) | 40 Hrs Completed (Yes/No)
 *
 * READ-ONLY: this script never writes to the database.
 *
 * Definitions:
 *   - Faculty   : active users with role TEACHER or FACULTY_COORDINATOR (same set as the state dashboard)
 *   - Enrolled  : TrainingApplication with status APPROVED and isActive = true
 *                 (use --include-pending to also list SUBMITTED / PENDING rows; they never affect hours)
 *   - Completed : "Yes" when the training has ended (end date before today)
 *                 AND the faculty marked attendance at least once (TrainingAttendance), else "No"
 *   - 40 Hrs    : per STAFF (same value on each of their rows). Mirrors getDashboardStats() in
 *                 training.service.ts (state dashboard "Completion & Hours" card):
 *                   hours  = sum over the staff's APPROVED, ended trainings with >= 1 attendance day of
 *                            min(attendedDays, trainingDays) * (Training.duration ?? trainingDays * 8) / trainingDays
 *                   "Yes"  = staff has at least one ended training with FULL attendance AND hours >= 40
 *                 Staff with no fully-attended ended training are in neither dashboard bucket => "No".
 *                 Hours always use ALL of the staff's trainings; --institution-id / --training-id only
 *                 filter which rows are written.
 *
 * Contains faculty phone/email: run locally and keep the output file internal.
 *
 * Usage:
 *   ts-node scripts/generate-faculty-training-report.ts --dry-run
 *   ts-node scripts/generate-faculty-training-report.ts --dry-run --verbose
 *   ts-node scripts/generate-faculty-training-report.ts
 *   ts-node scripts/generate-faculty-training-report.ts --institution-id=<uuid> --training-id=<uuid> --output=./reports/x.xlsx
 *
 * Options:
 *   --dry-run, -d            Print counts only (no personal data), do NOT write the Excel file
 *   --verbose, -v            Print data-quality warnings (counts per missing field)
 *   --institution-id=<uuid>  Limit to one college
 *   --training-id=<uuid>     Limit to one training
 *   --include-pending        Also include SUBMITTED / PENDING applications
 *   --output=<path>          Output file (default reports/faculty-training-<timestamp>.xlsx)
 */

import 'dotenv/config';
import * as path from 'path';
import { promises as fs } from 'fs';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const HEADERS = [
  'S.No',
  'Faculty ID',
  'Faculty Name',
  'Phone',
  'Email',
  'Course (Branch)',
  'College Name',
  'Training Name',
  'Completed (Yes/No)',
  'Total Hours Completed (Staff)',
  '40 Hrs Completed (Yes/No)',
];

const REQUIRED_HOURS = 40;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const COLUMN_WIDTHS = [7, 38, 28, 16, 34, 28, 45, 40, 18, 22, 22];

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  institutionId: string | null;
  trainingId: string | null;
  includePending: boolean;
  outputPath: string | null;
}

interface ReportRow {
  userId: string;
  name: string;
  phone: string;
  email: string;
  branch: string;
  college: string;
  training: string;
  completed: boolean;
  staffHours: number;
  has40Hours: boolean;
}

function getArgValue(args: string[], name: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3).trim() : null;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const output = getArgValue(args, 'output');
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    institutionId: getArgValue(args, 'institution-id'),
    trainingId: getArgValue(args, 'training-id'),
    includePending: args.includes('--include-pending'),
    outputPath: output ? path.resolve(output) : null,
  };
}

function getTimestampLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function writeWorkbook(rows: ReportRow[], opts: ParsedArgs): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Faculty Training Details');

  const headerRow = sheet.getRow(1);
  HEADERS.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = header;
    cell.font = { name: 'Arial', bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  headerRow.commit();
  COLUMN_WIDTHS.forEach((width, i) => (sheet.getColumn(i + 1).width = width));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  rows.forEach((r, i) => {
    const row = sheet.addRow([
      i + 1,
      r.userId,
      r.name,
      r.phone,
      r.email,
      r.branch,
      r.college,
      r.training,
      r.completed ? 'Yes' : 'No',
      Number(r.staffHours.toFixed(2)),
      r.has40Hours ? 'Yes' : 'No',
    ]);
    row.font = { name: 'Arial' };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(4).numFmt = '@'; // keep phone numbers as text
    row.getCell(9).alignment = { horizontal: 'center' };
    row.getCell(10).alignment = { horizontal: 'center' };
    row.getCell(11).alignment = { horizontal: 'center' };
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  const outputPath =
    opts.outputPath ||
    path.join(__dirname, '..', 'reports', `faculty-training-${getTimestampLabel(new Date())}.xlsx`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = toDateOnly(new Date());
    const rowStatuses = opts.includePending ? ['APPROVED', 'SUBMITTED', 'PENDING'] : ['APPROVED'];

    // Same faculty set as the state dashboard (getDashboardStats): active TEACHER / FACULTY_COORDINATOR.
    // Applications are NOT filtered by --institution-id / --training-id here, so each staff member's
    // hours always cover all their trainings; those filters only narrow the rows written to Excel.
    const allApplications = await prisma.trainingApplication.findMany({
      where: {
        isActive: true,
        user: { role: { in: ['TEACHER', 'FACULTY_COORDINATOR'] }, active: true },
      },
      select: {
        userId: true,
        trainingId: true,
        status: true,
        training: { select: { title: true, startDate: true, endDate: true, duration: true } },
        user: {
          select: {
            name: true,
            phoneNo: true,
            email: true,
            institutionId: true,
            branchName: true,
            branch: { select: { name: true } },
            Institution: { select: { name: true } },
          },
        },
      },
    });

    // Attendance days per userId:trainingId
    const attendance = await prisma.trainingAttendance.groupBy({
      by: ['userId', 'trainingId'],
      _count: { _all: true },
    });
    const attendedDaysMap = new Map(attendance.map((a) => [`${a.userId}:${a.trainingId}`, a._count._all]));

    // Dashboard logic (training.service.ts): APPROVED applications only; for each ENDED training with
    // >= 1 attendance day add min(attendedDays, trainingDays) * hoursPerDay. A staff member is counted
    // in the >=40 / <40 split ONLY if they have at least one ended training with FULL attendance.
    const staffHoursMap = new Map<string, number>();
    const staffWithFullAttendance = new Set<string>();
    for (const a of allApplications) {
      if (a.status !== 'APPROVED') continue;
      const trainingEnd = toDateOnly(a.training.endDate);
      if (trainingEnd >= today) continue;

      const attendedDays = attendedDaysMap.get(`${a.userId}:${a.trainingId}`) || 0;
      const trainingDays = Math.max(
        Math.ceil((trainingEnd.getTime() - toDateOnly(a.training.startDate).getTime()) / MS_PER_DAY) + 1,
        1,
      );
      if (attendedDays > 0) {
        const totalHours = a.training.duration ?? trainingDays * 8;
        const hours = (Math.min(attendedDays, trainingDays) * totalHours) / trainingDays;
        staffHoursMap.set(a.userId, (staffHoursMap.get(a.userId) || 0) + hours);
      }
      if (attendedDays >= trainingDays) staffWithFullAttendance.add(a.userId);
    }
    const has40Hours = (userId: string) =>
      staffWithFullAttendance.has(userId) && (staffHoursMap.get(userId) || 0) >= REQUIRED_HOURS;

    const applications = allApplications.filter(
      (a) =>
        rowStatuses.includes(a.status) &&
        (!opts.trainingId || a.trainingId === opts.trainingId) &&
        (!opts.institutionId || a.user.institutionId === opts.institutionId),
    );

    const rows: ReportRow[] = applications.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      phone: a.user.phoneNo ?? '',
      email: a.user.email ?? '',
      branch: a.user.branch?.name ?? a.user.branchName ?? '',
      college: a.user.Institution?.name ?? '',
      training: a.training.title,
      completed: toDateOnly(a.training.endDate) < today && (attendedDaysMap.get(`${a.userId}:${a.trainingId}`) || 0) > 0,
      staffHours: staffHoursMap.get(a.userId) || 0,
      has40Hours: has40Hours(a.userId),
    }));

    rows.sort(
      (a, b) =>
        a.college.localeCompare(b.college) ||
        a.name.localeCompare(b.name) ||
        a.training.localeCompare(b.training),
    );

    const completedCount = rows.filter((r) => r.completed).length;
    const reportStaff = [...new Set(applications.map((a) => a.userId))];
    console.log(`Enrollments: ${rows.length}`);
    console.log(`Distinct faculty: ${reportStaff.length}`);
    console.log(`Completed: ${completedCount}  Not completed: ${rows.length - completedCount}`);

    // Matches the state dashboard "Completion & Hours" card (all faculty, unfiltered by college/training)
    const dashboardStaff = [...staffWithFullAttendance];
    const dashboardAtLeast40 = dashboardStaff.filter(has40Hours).length;
    console.log('State dashboard "Completion & Hours" equivalent (all faculty):');
    console.log(`  Completed >= ${REQUIRED_HOURS} Hours: ${dashboardAtLeast40}`);
    console.log(`  Completed <  ${REQUIRED_HOURS} Hours: ${dashboardStaff.length - dashboardAtLeast40}`);
    console.log(`In this report: staff >= ${REQUIRED_HOURS} hrs: ${reportStaff.filter(has40Hours).length}`);

    if (opts.verbose) {
      const missing = (label: string, fn: (r: ReportRow) => string) =>
        console.log(`  Missing ${label}: ${rows.filter((r) => !fn(r)).length}`);
      console.log('Data-quality warnings:');
      missing('phone', (r) => r.phone);
      missing('email', (r) => r.email);
      missing('branch', (r) => r.branch);
      missing('college', (r) => r.college);
    }

    if (opts.dryRun) {
      console.log('Dry run: Excel file not written.');
      return;
    }

    const outputPath = await writeWorkbook(rows, opts);
    console.log(`Report written to ${outputPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to generate faculty training report:', error);
  process.exit(1);
});
