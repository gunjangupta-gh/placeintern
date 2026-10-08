/**
 * Generates an Excel workbook of the students doing their internship at a given
 * company (default: "Deltron"), with student details, faculty mentor, company HR
 * details and monthly report links.
 *
 * READ-ONLY: this script never writes to the database.
 *
 * Sheets:
 *   1. "Interns"          - one row per internship (student, college, mentor, HR, report counts)
 *   2. "Monthly Reports"  - one row per monthly report with a clickable link to the file
 *
 * How the interns are picked:
 *   - InternshipApplication.companyName contains the company name (case-insensitive)
 *   - All phases and statuses are included by default; use --phase / --active-only to narrow.
 *     Soft-deleted monthly reports are ignored.
 *
 * Mentor: InternshipApplication.mentorId, else the student's MentorAssignment (active first,
 *         then most recent), else the self-identified facultyMentor* fields. HR: InternshipApplication.hr* fields.
 *
 * Usage:
 *   ts-node scripts/generate-company-interns-report.ts --dry-run
 *   ts-node scripts/generate-company-interns-report.ts
 *   ts-node scripts/generate-company-interns-report.ts --company=Deltron --output=./reports/deltron.xlsx
 *
 * Options:
 *   --dry-run, -d            Run the queries and print a summary, but do NOT write the Excel file
 *   --company=<name>         Company name to match (default "Deltron", partial/case-insensitive)
 *   --institution-id=<uuid>  Limit to one institution
 *   --active-only            Only students whose user account is active
 *   --phase=<PHASE>          Only applications in this InternshipPhase (e.g. ONGOING)
 *   --output=<path>          Output file (default reports/company-interns-<company>-<timestamp>.xlsx)
 *   --no-download            Do not download files; the link columns then show the stored file reference
 *
 * File access: the file server is private, so instead of links that need permission the script
 * downloads each monthly report (and joining letter) using MINIO_ROOT_USER / MINIO_ROOT_PASSWORD /
 * MINIO_ENDPOINT / MINIO_BUCKET from .env, saves them next to the Excel in "<excel name>_files/"
 * (College / Roll_Name / Month), and the Excel links point to those local copies via relative paths.
 * Keep the .xlsx and its _files folder together (zip them to share).
 */

import 'dotenv/config';
import * as path from 'path';
import { promises as fs, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';

interface ParsedArgs {
  dryRun: boolean;
  company: string;
  institutionId: string | null;
  activeOnly: boolean;
  phase: string | null;
  outputPath: string | null;
  download: boolean;
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
    company: getArgValue(args, 'company') || 'Deltron',
    institutionId: getArgValue(args, 'institution-id'),
    activeOnly: args.includes('--active-only'),
    phase: getArgValue(args, 'phase'),
    outputPath: output ? path.resolve(output) : null,
    download: !args.includes('--no-download'),
  };
}

const DEFAULT_BUCKET = 'placeintern-uploads';

/** Turns a stored value (raw key, full/malformed URL, /bucket/key path) into a bucket object key. */
function toObjectKey(input: string, bucket: string): string {
  let value = input.trim();
  if (/%[0-9A-Fa-f]{2}/.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep as is */
    }
  }
  value = value.replace(/^https:\/(?!\/)/i, 'https://').replace(/^http:\/(?!\/)/i, 'http://');
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      /* keep as is */
    }
  }
  value = value.replace(/^\/+/, '');
  const marker = value.indexOf(`${bucket}/`);
  if (marker >= 0) value = value.slice(marker + bucket.length + 1);
  return value;
}

function createS3(): { client: S3Client; bucket: string } {
  const accessKeyId = process.env.MINIO_ROOT_USER;
  const secretAccessKey = process.env.MINIO_ROOT_PASSWORD;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('MINIO_ROOT_USER and MINIO_ROOT_PASSWORD must be set in .env to download files (or pass --no-download).');
  }
  const client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || 'https://files.placeintern.com',
    region: process.env.MINIO_REGION || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return { client, bucket: process.env.MINIO_BUCKET || DEFAULT_BUCKET };
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

/** Downloads one object to destPath. Returns null on success, or an error message. */
async function downloadObject(s3: { client: S3Client; bucket: string }, storedValue: string, destPath: string): Promise<string | null> {
  try {
    const key = toObjectKey(storedValue, s3.bucket);
    const res = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await pipeline(res.Body as Readable, createWriteStream(destPath));
    return null;
  } catch (error: any) {
    return error?.name || error?.message || 'download failed';
  }
}

function getTimestampLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const INTERN_COLUMNS: { header: string; width: number }[] = [
  { header: 'S.No', width: 6 },
  { header: 'Student Name', width: 26 },
  { header: 'Roll Number', width: 16 },
  { header: 'Email', width: 30 },
  { header: 'Phone', width: 15 },
  { header: 'Gender', width: 9 },
  { header: 'College', width: 36 },
  { header: 'Branch', width: 22 },
  { header: 'Batch', width: 10 },
  { header: 'Current Year', width: 8 },
  { header: 'Company', width: 28 },
  { header: 'Job Profile', width: 22 },
  { header: 'Internship Status', width: 16 },
  { header: 'Internship Phase', width: 16 },
  { header: 'Start Date', width: 12 },
  { header: 'End Date', width: 12 },
  { header: 'Stipend', width: 12 },
  { header: 'Faculty Mentor', width: 24 },
  { header: 'Mentor Designation', width: 20 },
  { header: 'Mentor Email', width: 28 },
  { header: 'Mentor Phone', width: 15 },
  { header: 'HR Name', width: 24 },
  { header: 'HR Designation', width: 20 },
  { header: 'HR Email', width: 28 },
  { header: 'HR Contact', width: 15 },
  { header: 'Reports Expected', width: 10 },
  { header: 'Reports Submitted', width: 10 },
  { header: 'Joining Letter', width: 16 },
];

const REPORT_COLUMNS: { header: string; width: number }[] = [
  { header: 'Student Name', width: 26 },
  { header: 'Roll Number', width: 16 },
  { header: 'College', width: 36 },
  { header: 'Report Month', width: 18 },
  { header: 'Status', width: 14 },
  { header: 'Submitted On', width: 13 },
  { header: 'Approved', width: 10 },
  { header: 'Report Link', width: 50 },
];

function styleHeader(sheet: ExcelJS.Worksheet, columns: { header: string; width: number }[]) {
  const headerRow = sheet.getRow(1);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getColumn(i + 1).width = c.width;
  });
  headerRow.height = 32;
  headerRow.commit();
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function linkCell(cell: ExcelJS.Cell, url: string | null | undefined, label = 'Open') {
  if (!url) return;
  cell.value = { text: label, hyperlink: url };
  cell.font = { name: 'Arial', color: { argb: 'FF0563C1' }, underline: true };
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
    console.log(`COMPANY INTERNS REPORT - "${opts.company}" (read-only)`);
    console.log('='.repeat(80));
    console.log(`Mode:               ${opts.dryRun ? 'DRY RUN (no file will be written)' : 'LIVE (Excel file will be written)'}`);
    console.log(`Institution filter: ${opts.institutionId || 'ALL institutions'}`);
    console.log(`Student status:     ${opts.activeOnly ? 'active only' : 'active + inactive'}`);
    console.log(`Phase filter:       ${opts.phase || 'ANY'}`);
    console.log('');

    const where: Prisma.InternshipApplicationWhereInput = {
      companyName: { contains: opts.company, mode: 'insensitive' },
      ...(opts.phase ? { internshipPhase: opts.phase as any } : {}),
      student: {
        ...(opts.activeOnly ? { user: { active: true } } : {}),
        ...(opts.institutionId
          ? { OR: [{ institutionId: opts.institutionId }, { user: { institutionId: opts.institutionId } }] }
          : {}),
      },
    };

    const applications = await prisma.internshipApplication.findMany({
      where,
      select: {
        id: true,
        status: true,
        internshipPhase: true,
        companyName: true,
        jobProfile: true,
        startDate: true,
        endDate: true,
        joiningDate: true,
        completionDate: true,
        stipend: true,
        joiningLetterUrl: true,
        totalExpectedReports: true,
        hrName: true,
        hrDesignation: true,
        hrEmail: true,
        hrContact: true,
        facultyMentorName: true,
        facultyMentorDesignation: true,
        facultyMentorEmail: true,
        facultyMentorContact: true,
        mentor: { select: { name: true, designation: true, email: true, phoneNo: true } },
        monthlyReports: {
          where: { isDeleted: false },
          orderBy: [{ reportYear: 'asc' }, { reportMonth: 'asc' }],
          select: {
            reportMonth: true,
            reportYear: true,
            monthName: true,
            status: true,
            submittedAt: true,
            isApproved: true,
            reportFileUrl: true,
          },
        },
        student: {
          select: {
            gender: true,
            currentYear: true,
            admissionYear: true,
            batch: { select: { name: true } },
            mentorAssignments: {
              orderBy: [{ isActive: 'desc' }, { assignmentDate: 'desc' }],
              take: 1,
              select: { mentor: { select: { name: true, designation: true, email: true, phoneNo: true } } },
            },
            Institution: { select: { name: true, shortName: true } },
            branch: { select: { name: true } },
            user: {
              select: {
                name: true,
                email: true,
                phoneNo: true,
                rollNumber: true,
                branchName: true,
                Institution: { select: { name: true, shortName: true } },
              },
            },
          },
        },
      },
    });

    applications.sort((a, b) => {
      const ca = collegeOf(a.student) ;
      const cb = collegeOf(b.student);
      return ca.localeCompare(cb) || a.student.user.name.localeCompare(b.student.user.name);
    });

    console.log(`Matched internships: ${applications.length}`);
    const companyNames = [...new Set(applications.map((a) => a.companyName))];
    console.log(`Company name variants matched: ${companyNames.map((n) => `"${n}"`).join(', ') || 'none'}`);
    if (applications.length === 0) {
      console.log('Nothing to report.');
      return;
    }

    const totalReports = applications.reduce((n, a) => n + a.monthlyReports.length, 0);
    const missingMentor = applications.filter(
      (a) => !a.mentor && !a.student.mentorAssignments[0] && !a.facultyMentorName,
    ).length;
    const missingHr = applications.filter((a) => !a.hrName && !a.hrEmail && !a.hrContact).length;
    console.log(`Monthly reports:    ${totalReports}`);
    if (missingMentor > 0) console.warn(`NOTE: ${missingMentor} internship(s) have no mentor recorded.`);
    if (missingHr > 0) console.warn(`NOTE: ${missingHr} internship(s) have no HR details recorded.`);

    if (opts.dryRun) {
      console.log('\nDRY RUN: Excel file was not written. Re-run without --dry-run to generate it.');
      return;
    }

    const safeCompany = opts.company.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const outputPath =
      opts.outputPath ??
      path.join(__dirname, '..', 'reports', `company-interns-${safeCompany}-${getTimestampLabel(new Date())}.xlsx`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const filesDirName = `${path.basename(outputPath, path.extname(outputPath))}_files`;
    const filesDir = path.join(path.dirname(outputPath), filesDirName);
    const s3 = opts.download ? createS3() : null;
    let downloaded = 0;
    let failed = 0;

    /** Downloads a stored file and puts a link to the local copy in the cell (or the failure reason). */
    const attachFile = async (cell: ExcelJS.Cell, stored: string | null, folder: string, baseName: string, label: string) => {
      if (!stored) return;
      if (!s3) {
        linkCell(cell, stored, stored);
        return;
      }
      const ext = path.extname(toObjectKey(stored, s3.bucket)) || '';
      const relPath = [filesDirName, safeName(folder.split('/')[0]), safeName(folder.split('/')[1]), `${safeName(baseName)}${ext}`];
      const error = await downloadObject(s3, stored, path.join(path.dirname(outputPath), ...relPath));
      if (error) {
        failed++;
        cell.value = `Download failed: ${error}`;
        cell.font = { name: 'Arial', color: { argb: 'FFC00000' } };
      } else {
        downloaded++;
        linkCell(cell, relPath.join('/'), label);
      }
    };

    const workbook = new ExcelJS.Workbook();
    const internSheet = workbook.addWorksheet('Interns');
    const reportSheet = workbook.addWorksheet('Monthly Reports');
    styleHeader(internSheet, INTERN_COLUMNS);
    styleHeader(reportSheet, REPORT_COLUMNS);

    for (const [index, a] of applications.entries()) {
      const s = a.student;
      const u = s.user;
      const college = collegeOf(s);

      // Mentor priority: application mentor -> student's mentor assignment (active first) -> self-entered details
      const m = a.mentor ?? s.mentorAssignments[0]?.mentor ?? null;
      const submitted = a.monthlyReports.filter((r) => r.status !== 'DRAFT').length;
      const row = internSheet.addRow([
        index + 1,
        u.name,
        u.rollNumber ?? '',
        u.email ?? '',
        u.phoneNo ?? '',
        s.gender ?? '',
        college,
        s.branch?.name ?? u.branchName ?? '',
        s.batch?.name ?? '',
        s.currentYear ?? '',
        a.companyName ?? '',
        a.jobProfile ?? '',
        a.status,
        a.internshipPhase,
        fmtDate(a.startDate ?? a.joiningDate),
        fmtDate(a.endDate ?? a.completionDate),
        a.stipend ?? '',
        m?.name ?? a.facultyMentorName ?? '',
        m?.designation ?? a.facultyMentorDesignation ?? '',
        m?.email ?? a.facultyMentorEmail ?? '',
        m?.phoneNo ?? a.facultyMentorContact ?? '',
        a.hrName ?? '',
        a.hrDesignation ?? '',
        a.hrEmail ?? '',
        a.hrContact ?? '',
        a.totalExpectedReports,
        submitted,
        '',
      ]);
      row.font = { name: 'Arial' };
      const studentFolder = `${college}/${u.rollNumber || a.id.slice(0, 8)}_${u.name}`;
      await attachFile(row.getCell(INTERN_COLUMNS.length), a.joiningLetterUrl, studentFolder, 'joining-letter', 'Open');

      for (const r of a.monthlyReports) {
        const monthLabel = `${r.monthName || MONTH_NAMES[r.reportMonth - 1]} ${r.reportYear}`;
        const rrow = reportSheet.addRow([
          u.name,
          u.rollNumber ?? '',
          college,
          monthLabel,
          r.status,
          fmtDate(r.submittedAt),
          r.isApproved ? 'Yes' : 'No',
          '',
        ]);
        rrow.font = { name: 'Arial' };
        await attachFile(
          rrow.getCell(REPORT_COLUMNS.length),
          r.reportFileUrl,
          studentFolder,
          `${r.reportYear}-${String(r.reportMonth).padStart(2, '0')}_${r.monthName || MONTH_NAMES[r.reportMonth - 1]}`,
          'Open report',
        );
      }
      if (s3 && (index + 1) % 10 === 0) console.log(`  processed ${index + 1}/${applications.length} internships...`);
    }

    await workbook.xlsx.writeFile(outputPath);
    console.log(`\nExcel report written: ${outputPath}`);
    if (s3) {
      console.log(`Files downloaded:   ${downloaded} (failed: ${failed}) -> ${filesDir}`);
      console.log('Keep the .xlsx and the _files folder together; links are relative to the Excel file.');
      if (failed > 0) console.warn('NOTE: failed downloads are marked in the sheet. Check the key/bucket and MinIO credentials.');
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function collegeOf(s: {
  Institution: { name: string; shortName: string | null } | null;
  user: { Institution: { name: string; shortName: string | null } | null };
}): string {
  const inst = s.Institution ?? s.user.Institution;
  return inst?.name || inst?.shortName || 'Unknown Institution';
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
