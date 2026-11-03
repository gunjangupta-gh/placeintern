/**
 * Exports every student (active AND inactive) of every college, with their internship details
 * (company, stipend, dates, status) and mentor details, as one Excel workbook organised batch-wise.
 *
 * READ-ONLY: this script never writes to the database.
 *
 * Sheets:
 *   1. "All Batches"   - every row, sorted by batch, college, student name
 *   2. "<batch name>"  - one sheet per batch (e.g. "2023-26"), same columns
 *   3. "Summary"       - batch x college counts (students, active, with internship)
 *
 * Rows: one row per student + internship. A student with several internships gets several rows;
 *       a student with no internship still gets one row (internship columns blank).
 *       Students without a batch go to the "No Batch" sheet.
 *
 * Mentor: InternshipApplication.mentorId, else the student's MentorAssignment (active first,
 *         then most recent), else the self-identified facultyMentor* fields.
 *
 * Active and inactive records are BOTH included: no isActive filter is applied to internship
 * applications or mentor assignments. "Internship Active" / "Mentor Assignment Active" show the flag,
 * and "All Mentor Assignments" lists every assignment of the student as "Name (Active|Inactive)".
 *
 * Usage:
 *   ts-node scripts/export-batch-wise-student-internships.ts --dry-run
 *   ts-node scripts/export-batch-wise-student-internships.ts
 *   ts-node scripts/export-batch-wise-student-internships.ts --batch=2023-26 --output=./reports/batch-2023-26.xlsx
 *
 * Options:
 *   --dry-run, -d            Run the queries and print a summary, but do NOT write the Excel file
 *   --batch=<name>           Only batches whose name contains this text (e.g. 2023-26)
 *   --institution-id=<uuid>  Limit to one institution
 *   --active-only            Only students whose user account is active (default: active + inactive)
 *   --output=<path>          Output file (default reports/batch-wise-student-internships-<timestamp>.xlsx)
 *
 * NOTE: the output contains student personal data. Store and share it per organisational data-protection policy.
 */

import 'dotenv/config';
import * as path from 'path';
import { promises as fs } from 'fs';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';

const NO_BATCH = 'No Batch';

interface ParsedArgs {
  dryRun: boolean;
  batch: string | null;
  institutionId: string | null;
  activeOnly: boolean;
  outputPath: string | null;
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
    batch: getArgValue(args, 'batch'),
    institutionId: getArgValue(args, 'institution-id'),
    activeOnly: args.includes('--active-only'),
    outputPath: output ? path.resolve(output) : null,
  };
}

function getTimestampLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

const COLUMNS: { header: string; width: number }[] = [
  { header: 'S.No', width: 6 },
  { header: 'Batch', width: 10 },
  { header: 'College', width: 36 },
  { header: 'Branch', width: 22 },
  { header: 'Student Name', width: 26 },
  { header: 'Roll Number', width: 16 },
  { header: 'Email', width: 30 },
  { header: 'Phone', width: 15 },
  { header: 'Gender', width: 9 },
  { header: 'Admission Year', width: 10 },
  { header: 'Current Year', width: 8 },
  { header: 'Student Active', width: 10 },
  { header: 'Company', width: 28 },
  { header: 'Job Profile', width: 22 },
  { header: 'Self Identified', width: 10 },
  { header: 'Internship Status', width: 16 },
  { header: 'Internship Phase', width: 16 },
  { header: 'Internship Active', width: 10 },
  { header: 'Start Date', width: 12 },
  { header: 'End Date', width: 12 },
  { header: 'Duration', width: 12 },
  { header: 'Stipend', width: 12 },
  { header: 'Mentor Name', width: 24 },
  { header: 'Mentor Designation', width: 20 },
  { header: 'Mentor Email', width: 28 },
  { header: 'Mentor Phone', width: 15 },
  { header: 'Mentor Assignment Active', width: 12 },
  { header: 'All Mentor Assignments', width: 40 },
  { header: 'Reports Expected', width: 10 },
  { header: 'Reports Submitted', width: 10 },
];

function styleHeader(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getColumn(i + 1).width = c.width;
  });
  headerRow.height = 32;
  headerRow.commit();
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
}

/** Excel sheet names: max 31 chars, none of \ / ? * [ ] : */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    candidate = `${base.slice(0, 28)}-${i}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('BATCH-WISE STUDENT INTERNSHIP EXPORT (read-only)');
    console.log('='.repeat(80));
    console.log(`Mode:               ${opts.dryRun ? 'DRY RUN (no file will be written)' : 'LIVE (Excel file will be written)'}`);
    console.log(`Institution filter: ${opts.institutionId || 'ALL institutions'}`);
    console.log(`Batch filter:       ${opts.batch || 'ALL batches'}`);
    console.log(`Student status:     ${opts.activeOnly ? 'active only' : 'active + inactive'}`);
    console.log('');

    const where: Prisma.StudentWhereInput = {
      ...(opts.activeOnly ? { user: { active: true } } : {}),
      ...(opts.batch ? { batch: { name: { contains: opts.batch, mode: 'insensitive' } } } : {}),
      ...(opts.institutionId
        ? { OR: [{ institutionId: opts.institutionId }, { user: { institutionId: opts.institutionId } }] }
        : {}),
    };

    const students = await prisma.student.findMany({
      where,
      select: {
        gender: true,
        currentYear: true,
        admissionYear: true,
        batch: { select: { name: true } },
        branch: { select: { name: true } },
        Institution: { select: { name: true, shortName: true } },
        mentorAssignments: {
          orderBy: [{ isActive: 'desc' }, { assignmentDate: 'desc' }],
          select: { isActive: true, mentor: { select: { name: true, designation: true, email: true, phoneNo: true } } },
        },
        internshipApplications: {
          orderBy: { applicationDate: 'asc' },
          select: {
            status: true,
            internshipPhase: true,
            isActive: true,
            isSelfIdentified: true,
            companyName: true,
            jobProfile: true,
            startDate: true,
            endDate: true,
            joiningDate: true,
            completionDate: true,
            internshipDuration: true,
            stipend: true,
            totalExpectedReports: true,
            facultyMentorName: true,
            facultyMentorDesignation: true,
            facultyMentorEmail: true,
            facultyMentorContact: true,
            mentor: { select: { name: true, designation: true, email: true, phoneNo: true } },
            monthlyReports: { where: { isDeleted: false }, select: { status: true } },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            phoneNo: true,
            rollNumber: true,
            branchName: true,
            active: true,
            Institution: { select: { name: true, shortName: true } },
          },
        },
      },
    });

    type Row = { batch: string; college: string; student: string; values: (string | number)[] };
    const rows: Row[] = [];

    for (const s of students) {
      const u = s.user;
      const inst = s.Institution ?? u.Institution;
      const college = inst?.name || inst?.shortName || 'Unknown Institution';
      const batch = s.batch?.name || NO_BATCH;
      const assignedMentor = s.mentorAssignments[0]?.mentor ?? null;
      const assignedActive = s.mentorAssignments[0] ? (s.mentorAssignments[0].isActive ? 'Yes' : 'No') : '';
      const allAssignments = s.mentorAssignments.map((x) => `${x.mentor.name} (${x.isActive ? 'Active' : 'Inactive'})`).join('; ');

      const apps = s.internshipApplications.length > 0 ? s.internshipApplications : [null];
      for (const a of apps) {
        const m = a?.mentor ?? assignedMentor;
        rows.push({
          batch,
          college,
          student: u.name,
          values: [
            0,
            batch,
            college,
            s.branch?.name ?? u.branchName ?? '',
            u.name,
            u.rollNumber ?? '',
            u.email ?? '',
            u.phoneNo ?? '',
            s.gender ?? '',
            s.admissionYear ?? '',
            s.currentYear ?? '',
            u.active ? 'Yes' : 'No',
            a?.companyName ?? '',
            a?.jobProfile ?? '',
            a ? (a.isSelfIdentified ? 'Yes' : 'No') : '',
            a?.status ?? '',
            a?.internshipPhase ?? '',
            a ? (a.isActive ? 'Yes' : 'No') : '',
            fmtDate(a?.startDate ?? a?.joiningDate),
            fmtDate(a?.endDate ?? a?.completionDate),
            a?.internshipDuration ?? '',
            a?.stipend ?? '',
            m?.name ?? a?.facultyMentorName ?? '',
            m?.designation ?? a?.facultyMentorDesignation ?? '',
            m?.email ?? a?.facultyMentorEmail ?? '',
            m?.phoneNo ?? a?.facultyMentorContact ?? '',
            a?.mentor ? (a.mentor.name === assignedMentor?.name ? assignedActive : '') : assignedActive,
            allAssignments,
            a?.totalExpectedReports ?? '',
            a ? a.monthlyReports.filter((r) => r.status !== 'DRAFT').length : '',
          ],
        });
      }
    }

    rows.sort(
      (a, b) =>
        (a.batch === NO_BATCH ? 1 : 0) - (b.batch === NO_BATCH ? 1 : 0) ||
        a.batch.localeCompare(b.batch) ||
        a.college.localeCompare(b.college) ||
        a.student.localeCompare(b.student),
    );

    const batches = [...new Set(rows.map((r) => r.batch))];
    const colleges = new Set(rows.map((r) => r.college));
    const withInternship = rows.filter((r) => r.values[12] !== '' || r.values[15] !== '').length;
    const allApps = students.flatMap((s) => s.internshipApplications);
    const allAssigns = students.flatMap((s) => s.mentorAssignments);
    console.log(`Internships:        ${allApps.length} (${allApps.filter((a) => a.isActive).length} active, ${allApps.filter((a) => !a.isActive).length} inactive)`);
    console.log(`Mentor assignments: ${allAssigns.length} (${allAssigns.filter((a) => a.isActive).length} active, ${allAssigns.filter((a) => !a.isActive).length} inactive)`);
    const inactive = students.filter((s) => !s.user.active).length;
    console.log(`Students:           ${students.length} (${inactive} inactive)`);
    console.log(`Colleges:           ${colleges.size}`);
    console.log(`Batches:            ${batches.join(', ') || 'none'}`);
    console.log(`Rows (student x internship): ${rows.length}, of which with an internship: ${withInternship}`);
    for (const b of batches) {
      console.log(`  ${b.padEnd(12)} ${rows.filter((r) => r.batch === b).length} rows`);
    }

    if (rows.length === 0) {
      console.log('Nothing to export.');
      return;
    }
    if (opts.dryRun) {
      console.log('\nDRY RUN: Excel file was not written. Re-run without --dry-run to generate it.');
      return;
    }

    const outputPath =
      opts.outputPath ?? path.join(__dirname, '..', 'reports', `batch-wise-student-internships-${getTimestampLabel(new Date())}.xlsx`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const usedNames = new Set<string>();
    const fill = (sheet: ExcelJS.Worksheet, sheetRows: Row[]) => {
      styleHeader(sheet);
      sheetRows.forEach((r, i) => {
        r.values[0] = i + 1;
        sheet.addRow(r.values).font = { name: 'Arial' };
      });
    };

    fill(workbook.addWorksheet(sheetName('All Batches', usedNames)), rows);
    for (const b of batches) {
      fill(
        workbook.addWorksheet(sheetName(b, usedNames)),
        rows.filter((r) => r.batch === b),
      );
    }

    // Summary: batch x college, counted per student (not per internship row)
    const summary = workbook.addWorksheet(sheetName('Summary', usedNames));
    const summaryHeaders = ['Batch', 'College', 'Total Students', 'Active Students', 'Inactive Students', 'Students With Internship'];
    summary.addRow(summaryHeaders).font = { name: 'Arial', bold: true };
    summaryHeaders.forEach((_, i) => (summary.getColumn(i + 1).width = i === 1 ? 40 : 16));
    const groups = new Map<string, { batch: string; college: string; total: number; active: number; withInternship: number }>();
    for (const s of students) {
      const inst = s.Institution ?? s.user.Institution;
      const college = inst?.name || inst?.shortName || 'Unknown Institution';
      const batch = s.batch?.name || NO_BATCH;
      const g = groups.get(`${batch}|${college}`) ?? { batch, college, total: 0, active: 0, withInternship: 0 };
      g.total++;
      if (s.user.active) g.active++;
      if (s.internshipApplications.length > 0) g.withInternship++;
      groups.set(`${batch}|${college}`, g);
    }
    [...groups.values()]
      .sort((a, b) => (a.batch === NO_BATCH ? 1 : 0) - (b.batch === NO_BATCH ? 1 : 0) || a.batch.localeCompare(b.batch) || a.college.localeCompare(b.college))
      .forEach((g) => {
        summary.addRow([g.batch, g.college, g.total, g.active, g.total - g.active, g.withInternship]).font = { name: 'Arial' };
      });
    summary.views = [{ state: 'frozen', ySplit: 1 }];

    await workbook.xlsx.writeFile(outputPath);
    console.log(`\nExcel written: ${outputPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Export failed:', error);
  process.exit(1);
});
