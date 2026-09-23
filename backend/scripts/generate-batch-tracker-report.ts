/**
 * Generates the college-wise "Sem Intern Tracker" Excel report for a batch
 * (default: the 2023-26 batch, whose students, internships, mentor assignments,
 * monthly reports and faculty visit logs have all been deactivated).
 *
 * Output format mirrors "Sem Intern_2025-26 Tracker.xlsx" (one row per college):
 *   College Name | Total Students | Total Faculty Mentor |
 *   Total Expected Faculty Visit | Total Faculty Visit Completed | Total Faculty Visit Complaince % |
 *   Total Expect M.R | Total M.R Submitted | Total M.R Submission %
 *
 * READ-ONLY: this script never writes to the database.
 *
 * How the batch students are picked:
 *   - Student.batch.name matches the batch (e.g. "2023-26", "2023-2026", "2023 - 26"), OR
 *   - Student has no batch AND Student.admissionYear === start year (disable with --no-admission-year-fallback)
 *   - By default only INACTIVE users (User.active = false) are included; use --include-active to include all.
 *
 * How the numbers are computed (per college):
 *   - Total Students            : batch students of that college
 *   - Total Faculty Mentor      : distinct mentors from MentorAssignment (any isActive) + InternshipApplication.mentorId
 *   - Expected Faculty Visit    : SUM(InternshipApplication.totalExpectedVisits)   (same counter the principal dashboard uses)
 *   - Faculty Visit Completed   : COUNT(FacultyVisitLog status=COMPLETED, isDeleted=false)
 *   - Expected M.R              : SUM(InternshipApplication.totalExpectedReports)
 *   - M.R Submitted             : COUNT(MonthlyReport status in SUBMITTED/UNDER_REVIEW/APPROVED, isDeleted=false)
 *   - %                         : completed / expected (blank when expected = 0)
 *   Internship `isActive` is intentionally ignored, because the batch data has been deactivated.
 *
 * Usage:
 *   ts-node scripts/generate-batch-tracker-report.ts --dry-run
 *   ts-node scripts/generate-batch-tracker-report.ts --dry-run --verbose
 *   ts-node scripts/generate-batch-tracker-report.ts
 *   ts-node scripts/generate-batch-tracker-report.ts --batch=2023-26 --output=./reports/tracker.xlsx
 *
 * Options:
 *   --dry-run, -d                    Run all queries and print the summary, but do NOT write the Excel file
 *   --verbose, -v                    Print per-college and per-student details and data-quality warnings
 *   --batch=YYYY-YY                  Batch to report on (default 2023-26; 2023-2026 also accepted)
 *   --institution-id=<uuid>          Limit to one institution
 *   --include-active                 Include students whose user account is still active
 *   --no-admission-year-fallback     Do not pick up batch-less students by admissionYear
 *   --no-total                       Do not append the TOTAL row
 *   --template=<path>                Template workbook (default ../Sem Intern_2025-26 Tracker.xlsx)
 *   --output=<path>                  Output file (default reports/sem-intern-tracker-<batch>-<timestamp>.xlsx)
 */

import 'dotenv/config';
import * as path from 'path';
import { promises as fs, existsSync } from 'fs';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';

const CHUNK_SIZE = 500;
const SUBMITTED_REPORT_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] as const;
const DEFAULT_TEMPLATE = path.join(__dirname, '..', '..', 'Sem Intern_2025-26 Tracker.xlsx');

const HEADERS = [
  'College Name',
  'Total Students',
  'Total Faculty Mentor',
  'Total Expected Faculty Visit ',
  'Total Faculty Visit Completed',
  'Total Faculty Visit Complaince %',
  'Total Expect M.R',
  'Total M.R Submitted',
  'Total M.R Submission %',
];

// Column widths taken from the template (col A widened for college names)
const COLUMN_WIDTHS = [45, 11.5, 16, 21.75, 24.5, 25.5, 13.63, 16, 19];

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  startYear: number;
  endYear: number;
  batchLabel: string;
  institutionId: string | null;
  includeActive: boolean;
  admissionYearFallback: boolean;
  includeTotal: boolean;
  templatePath: string;
  outputPath: string | null;
}

interface CollegeRow {
  collegeName: string;
  totalStudents: number;
  totalMentors: number;
  expectedVisits: number;
  completedVisits: number;
  expectedReports: number;
  submittedReports: number;
}

function getArgValue(args: string[], name: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3).trim() : null;
}

function parseBatch(value: string): { startYear: number; endYear: number } {
  const match = value.replace(/\s+/g, '').match(/^(\d{4})[-–/](\d{4}|\d{2})$/);
  if (!match) {
    throw new Error(`Invalid --batch "${value}". Use --batch=2023-26 or --batch=2023-2026.`);
  }
  const startYear = Number(match[1]);
  const endYear = match[2].length === 2 ? Math.floor(startYear / 100) * 100 + Number(match[2]) : Number(match[2]);
  if (endYear <= startYear) {
    throw new Error(`Invalid --batch "${value}": end year must be after start year.`);
  }
  return { startYear, endYear };
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const { startYear, endYear } = parseBatch(getArgValue(args, 'batch') || '2023-26');
  const output = getArgValue(args, 'output');
  return {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    startYear,
    endYear,
    batchLabel: `${startYear}-${String(endYear).slice(-2)}`,
    institutionId: getArgValue(args, 'institution-id'),
    includeActive: args.includes('--include-active'),
    admissionYearFallback: !args.includes('--no-admission-year-fallback'),
    includeTotal: !args.includes('--no-total'),
    templatePath: path.resolve(getArgValue(args, 'template') || DEFAULT_TEMPLATE),
    outputPath: output ? path.resolve(output) : null,
  };
}

/** True when a batch name like "2023-26", "2023-2026", "Batch 2023 - 26" refers to the given years. */
function batchNameMatches(name: string, startYear: number, endYear: number): boolean {
  const match = name.replace(/\s+/g, '').match(/(\d{4})[-–/](\d{4}|\d{2})/);
  if (!match || Number(match[1]) !== startYear) return false;
  return match[2].length === 2 ? Number(match[2]) === endYear % 100 : Number(match[2]) === endYear;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getTimestampLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function ratio(done: number, expected: number): number | null {
  return expected > 0 ? done / expected : null;
}

function formatPercent(value: number | null): string {
  return value === null ? 'N/A' : `${(value * 100).toFixed(2)}%`;
}

async function writeWorkbook(rows: CollegeRow[], total: CollegeRow, opts: ParsedArgs): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet;

  // Reuse the template so header styling is identical; fall back to building it
  if (existsSync(opts.templatePath)) {
    await workbook.xlsx.readFile(opts.templatePath);
    sheet = workbook.worksheets[0];
    if (sheet.rowCount > 1) sheet.spliceRows(2, sheet.rowCount - 1);
  } else {
    console.warn(`Template not found at ${opts.templatePath}; building the sheet from scratch.`);
    sheet = workbook.addWorksheet('Sheet1');
  }
  sheet.name = `Sem Intern ${opts.batchLabel}`;

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

  const addRow = (r: CollegeRow, bold = false) => {
    const row = sheet.addRow([
      r.collegeName,
      r.totalStudents,
      r.totalMentors,
      r.expectedVisits,
      r.completedVisits,
      ratio(r.completedVisits, r.expectedVisits),
      r.expectedReports,
      r.submittedReports,
      ratio(r.submittedReports, r.expectedReports),
    ]);
    row.font = { name: 'Arial', bold };
    row.getCell(6).numFmt = '0.00%';
    row.getCell(9).numFmt = '0.00%';
  };

  rows.forEach((r) => addRow(r));
  if (opts.includeTotal && rows.length > 0) addRow(total, true);

  const outputPath =
    opts.outputPath ??
    path.join(__dirname, '..', 'reports', `sem-intern-tracker-${opts.batchLabel}-${getTimestampLabel(new Date())}.xlsx`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

function sumRows(rows: CollegeRow[], mentorTotal?: number): CollegeRow {
  return rows.reduce<CollegeRow>(
    (acc, r) => ({
      collegeName: 'TOTAL',
      totalStudents: acc.totalStudents + r.totalStudents,
      totalMentors: mentorTotal ?? acc.totalMentors + r.totalMentors,
      expectedVisits: acc.expectedVisits + r.expectedVisits,
      completedVisits: acc.completedVisits + r.completedVisits,
      expectedReports: acc.expectedReports + r.expectedReports,
      submittedReports: acc.submittedReports + r.submittedReports,
    }),
    { collegeName: 'TOTAL', totalStudents: 0, totalMentors: 0, expectedVisits: 0, completedVisits: 0, expectedReports: 0, submittedReports: 0 },
  );
}

async function main() {
  const opts = parseArgs();
  const log = (...msg: unknown[]) => opts.verbose && console.log('[verbose]', ...msg);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('SEM INTERN TRACKER REPORT (read-only)');
    console.log('='.repeat(80));
    console.log(`Mode:               ${opts.dryRun ? 'DRY RUN (no file will be written)' : 'LIVE (Excel file will be written)'}`);
    console.log(`Verbose:            ${opts.verbose ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Batch:              ${opts.startYear}-${opts.endYear}`);
    console.log(`Student status:     ${opts.includeActive ? 'active + inactive' : 'inactive only (User.active = false)'}`);
    console.log(`AdmissionYear fallback: ${opts.admissionYearFallback ? `ON (no batch + admissionYear=${opts.startYear})` : 'OFF'}`);
    console.log(`Institution filter: ${opts.institutionId || 'ALL institutions'}`);
    console.log('');

    // 1. Resolve batch ids by name
    const allBatches = await prisma.batch.findMany({ select: { id: true, name: true } });
    const matchedBatches = allBatches.filter((b) => batchNameMatches(b.name, opts.startYear, opts.endYear));
    console.log(`Matched batches: ${matchedBatches.map((b) => `"${b.name}"`).join(', ') || 'NONE'}`);
    log('All batches in DB:', allBatches.map((b) => b.name).join(', ') || 'none');

    const batchScope: Prisma.StudentWhereInput[] = [];
    if (matchedBatches.length > 0) batchScope.push({ batchId: { in: matchedBatches.map((b) => b.id) } });
    if (opts.admissionYearFallback) batchScope.push({ batchId: null, admissionYear: opts.startYear });
    if (batchScope.length === 0) {
      console.log('No batch matched and admissionYear fallback is disabled. Nothing to report.');
      return;
    }

    // 2. Batch students
    const students = await prisma.student.findMany({
      where: {
        AND: [
          { OR: batchScope },
          { user: { role: 'STUDENT', ...(opts.includeActive ? {} : { active: false }) } },
          ...(opts.institutionId
            ? [{ OR: [{ institutionId: opts.institutionId }, { user: { institutionId: opts.institutionId } }] }]
            : []),
        ],
      },
      select: {
        id: true,
        batchId: true,
        institutionId: true,
        user: {
          select: {
            name: true,
            rollNumber: true,
            active: true,
            institutionId: true,
            Institution: { select: { id: true, name: true, shortName: true, code: true } },
          },
        },
        Institution: { select: { id: true, name: true, shortName: true, code: true } },
        mentorAssignments: { select: { mentorId: true, isActive: true } },
        internshipApplications: {
          select: {
            id: true,
            isActive: true,
            mentorId: true,
            totalExpectedReports: true,
            totalExpectedVisits: true,
            submittedReportsCount: true,
            completedVisitsCount: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const viaBatch = students.filter((s) => s.batchId !== null).length;
    console.log(`Matched students: ${students.length} (via batch: ${viaBatch}, via admissionYear fallback: ${students.length - viaBatch})`);
    if (students.length === 0) {
      console.log('No students matched. Nothing to report.');
      return;
    }
    const stillActive = students.filter((s) => s.user.active).length;
    if (stillActive > 0) log(`WARNING: ${stillActive} matched students still have an active user account.`);

    // 3. Real submitted report / completed visit counts per application
    const applicationIds = students.flatMap((s) => s.internshipApplications.map((a) => a.id));
    const reportCountMap = new Map<string, number>();
    const visitCountMap = new Map<string, number>();

    for (const ids of chunk(applicationIds, CHUNK_SIZE)) {
      const [reports, visits] = await Promise.all([
        prisma.monthlyReport.groupBy({
          by: ['applicationId'],
          where: { applicationId: { in: ids }, isDeleted: false, status: { in: [...SUBMITTED_REPORT_STATUSES] } },
          _count: { id: true },
        }),
        prisma.facultyVisitLog.groupBy({
          by: ['applicationId'],
          where: { applicationId: { in: ids }, isDeleted: false, status: 'COMPLETED' },
          _count: { id: true },
        }),
      ]);
      reports.forEach((r) => reportCountMap.set(r.applicationId, r._count.id));
      visits.forEach((v) => visitCountMap.set(v.applicationId, v._count.id));
    }
    log(`Internship applications: ${applicationIds.length} (queried in ${Math.ceil(applicationIds.length / CHUNK_SIZE) || 0} chunk(s))`);

    // 4. Aggregate per college
    interface Bucket extends Omit<CollegeRow, 'totalMentors'> {
      mentors: Set<string>;
    }
    const buckets = new Map<string, Bucket>();
    const allMentors = new Set<string>();
    let studentsWithoutInstitution = 0;
    let counterMismatches = 0;

    for (const s of students) {
      const inst = s.Institution ?? s.user.Institution;
      if (!inst) studentsWithoutInstitution++;
      const key = inst?.id ?? 'UNKNOWN';
      const collegeName = inst?.name || inst?.shortName || inst?.code || 'Unknown Institution';

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { collegeName, totalStudents: 0, mentors: new Set(), expectedVisits: 0, completedVisits: 0, expectedReports: 0, submittedReports: 0 };
        buckets.set(key, bucket);
      }
      bucket.totalStudents++;

      const studentMentors = new Set<string>();
      s.mentorAssignments.forEach((m) => studentMentors.add(m.mentorId));

      let sExpectedVisits = 0, sCompletedVisits = 0, sExpectedReports = 0, sSubmittedReports = 0;
      for (const app of s.internshipApplications) {
        if (app.mentorId) studentMentors.add(app.mentorId);
        const submitted = reportCountMap.get(app.id) ?? 0;
        const completed = visitCountMap.get(app.id) ?? 0;
        sExpectedVisits += app.totalExpectedVisits;
        sExpectedReports += app.totalExpectedReports;
        sCompletedVisits += completed;
        sSubmittedReports += submitted;

        if (app.submittedReportsCount !== submitted || app.completedVisitsCount !== completed) {
          counterMismatches++;
          log(
            `  counter mismatch app=${app.id} (${s.user.name}): reports counter=${app.submittedReportsCount} actual=${submitted}; visits counter=${app.completedVisitsCount} actual=${completed}`,
          );
        }
      }

      studentMentors.forEach((m) => {
        bucket!.mentors.add(m);
        allMentors.add(m);
      });
      bucket.expectedVisits += sExpectedVisits;
      bucket.completedVisits += sCompletedVisits;
      bucket.expectedReports += sExpectedReports;
      bucket.submittedReports += sSubmittedReports;

      log(
        `  student ${s.user.rollNumber || 'n/a'} | ${s.user.name} | ${collegeName} | active=${s.user.active} | internships=${s.internshipApplications.length} | mentors=${studentMentors.size} | visits ${sCompletedVisits}/${sExpectedVisits} | MR ${sSubmittedReports}/${sExpectedReports}`,
      );
    }

    const rows: CollegeRow[] = [...buckets.values()]
      .map(({ mentors, ...b }) => ({ ...b, totalMentors: mentors.size }))
      .sort((a, b) => a.collegeName.localeCompare(b.collegeName));
    // A mentor can span colleges, so the total uses the global distinct count
    const total = sumRows(rows, allMentors.size);

    // 5. Summary
    console.log('');
    console.table(
      [...rows, total].map((r) => ({
        College: r.collegeName,
        Students: r.totalStudents,
        Mentors: r.totalMentors,
        'Visits (done/expected)': `${r.completedVisits}/${r.expectedVisits}`,
        'Visit %': formatPercent(ratio(r.completedVisits, r.expectedVisits)),
        'MR (submitted/expected)': `${r.submittedReports}/${r.expectedReports}`,
        'MR %': formatPercent(ratio(r.submittedReports, r.expectedReports)),
      })),
    );

    if (studentsWithoutInstitution > 0) {
      console.warn(`WARNING: ${studentsWithoutInstitution} students have no institution and are grouped under "Unknown Institution".`);
    }
    if (counterMismatches > 0) {
      console.warn(
        `NOTE: ${counterMismatches} internship(s) have stored submitted/completed counters that differ from actual records; the report uses actual records.${opts.verbose ? '' : ' Run with --verbose for details.'}`,
      );
    }

    if (opts.dryRun) {
      console.log('');
      console.log('DRY RUN: Excel file was not written. Re-run without --dry-run to generate it.');
      return;
    }

    const outputPath = await writeWorkbook(rows, total, opts);
    console.log('');
    console.log(`Excel report written: ${outputPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
