/**
 * Exports ALL internship opportunities (as published by the State Directorate) with every detail
 * to one Excel workbook.
 *
 * READ-ONLY: this script never writes to the database.
 *
 * Sheets:
 *   1. "Opportunities"     - one row per opportunity: company details, schedule, seats, stipend,
 *                            industry contact, source institution / POC, status, application counts
 *   2. "Branch Positions"  - one row per opportunity + branch: seats, approved, max applications, stipend
 *   3. "Summary"           - counts by status
 *
 * Soft-deleted opportunities are included by default (flagged in the "Deleted" column).
 *
 * Usage:
 *   ts-node scripts/export-internship-opportunities.ts --dry-run
 *   ts-node scripts/export-internship-opportunities.ts
 *   ts-node scripts/export-internship-opportunities.ts --status=OPEN --exclude-deleted --output=./reports/open.xlsx
 *
 * Options:
 *   --dry-run, -d      Run the queries and print a summary, but do NOT write the Excel file
 *   --status=<STATUS>  Only DRAFT | OPEN | CLOSED | FILLED
 *   --exclude-deleted  Skip soft-deleted opportunities (default: included)
 *   --output=<path>    Output file (default reports/internship-opportunities-<timestamp>.xlsx)
 *
 * NOTE: the output contains industry contact and faculty POC personal data (director-only fields).
 * Store and share it per organisational data-protection policy.
 */

import 'dotenv/config';
import * as path from 'path';
import { promises as fs } from 'fs';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';

const STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'FILLED'];

function getArgValue(args: string[], name: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3).trim() : null;
}

function getTimestampLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function fmtDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

function fmtDateTime(d: Date | null | undefined): string {
  return d ? d.toISOString().replace('T', ' ').slice(0, 19) : '';
}

interface Column {
  header: string;
  width: number;
}

function writeSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Column[],
  rows: (string | number)[][],
) {
  const sheet = workbook.addWorksheet(name);
  const headerRow = sheet.getRow(1);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getColumn(i + 1).width = c.width;
  });
  headerRow.height = 32;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  for (const r of rows) {
    const row = sheet.addRow(r);
    row.font = { name: 'Arial' };
    row.alignment = { vertical: 'top', wrapText: true };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const excludeDeleted = args.includes('--exclude-deleted');
  const status = getArgValue(args, 'status')?.toUpperCase() ?? null;
  const output = getArgValue(args, 'output');

  if (status && !STATUSES.includes(status)) {
    throw new Error(`Invalid --status "${status}". Use one of: ${STATUSES.join(', ')}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set (check backend/.env)');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const where: Prisma.InternshipOpportunityWhereInput = {};
    if (status) where.status = status as any;
    if (excludeDeleted) where.isDeleted = false;

    const opportunities = await prisma.internshipOpportunity.findMany({
      where,
      include: {
        company: true,
        branches: {
          include: { branch: { select: { name: true, shortName: true, code: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    console.log(`Found ${opportunities.length} internship opportunities.`);

    // Application counts per opportunity and status
    const ids = opportunities.map((o) => o.id);
    const appCounts = ids.length
      ? await prisma.internshipApplication.groupBy({
          by: ['opportunityId', 'status'],
          where: { opportunityId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const appsByOpp = new Map<string, Record<string, number>>();
    const appStatuses = new Set<string>();
    for (const a of appCounts) {
      if (!a.opportunityId) continue;
      const m = appsByOpp.get(a.opportunityId) ?? {};
      m[a.status] = a._count._all;
      appsByOpp.set(a.opportunityId, m);
      appStatuses.add(a.status);
    }
    const appStatusList = [...appStatuses].sort();

    // ---- Sheet 1: Opportunities
    const oppColumns: Column[] = [
      { header: 'S.No', width: 6 },
      { header: 'Opportunity ID', width: 38 },
      { header: 'Title', width: 30 },
      { header: 'Description', width: 50 },
      { header: 'Status', width: 10 },
      { header: 'Deleted', width: 9 },
      { header: 'Deleted At', width: 18 },
      { header: 'Company', width: 28 },
      { header: 'Company Display Name', width: 24 },
      { header: 'Company Industry Sector', width: 20 },
      { header: 'Company Address', width: 34 },
      { header: 'Company City', width: 16 },
      { header: 'Company State', width: 16 },
      { header: 'Company Pin Code', width: 10 },
      { header: 'Company Contact', width: 16 },
      { header: 'Company Email', width: 28 },
      { header: 'Company Website', width: 28 },
      { header: 'District', width: 16 },
      { header: 'Total Positions', width: 10 },
      { header: 'Approved Count', width: 10 },
      { header: 'Remaining Positions', width: 10 },
      { header: 'Eligible Years', width: 12 },
      { header: 'Duration (Months)', width: 10 },
      { header: 'Stipend', width: 14 },
      { header: 'Start Date', width: 12 },
      { header: 'Application Deadline', width: 12 },
      { header: 'Branches', width: 36 },
      { header: 'Industry Contact Name', width: 22 },
      { header: 'Industry Contact Phone', width: 16 },
      { header: 'Industry Contact Email', width: 28 },
      { header: 'Source Institution', width: 30 },
      { header: 'POC Name', width: 22 },
      { header: 'POC Phone', width: 16 },
      { header: 'Total Applications', width: 11 },
      ...appStatusList.map((s) => ({ header: `Applications: ${s}`, width: 12 })),
      { header: 'Import Batch ID', width: 38 },
      { header: 'Created By (User ID)', width: 38 },
      { header: 'Created At', width: 18 },
      { header: 'Updated At', width: 18 },
    ];

    const oppRows = opportunities.map((o, i) => {
      const apps = appsByOpp.get(o.id) ?? {};
      const total = Object.values(apps).reduce((s, n) => s + n, 0);
      const branchNames = o.branches
        .map((b) => b.branch.shortName || b.branch.name)
        .sort()
        .join(', ');
      return [
        i + 1,
        o.id,
        o.title,
        o.description ?? '',
        o.status,
        o.isDeleted ? 'Yes' : 'No',
        fmtDateTime(o.deletedAt),
        o.company.name,
        o.company.displayName ?? '',
        o.company.industrySector ?? '',
        o.company.address ?? '',
        o.company.city ?? '',
        o.company.state ?? '',
        o.company.pinCode ?? '',
        o.company.contact ?? '',
        o.company.email ?? '',
        o.company.website ?? '',
        o.district ?? '',
        o.positions,
        o.approvedCount,
        Math.max(o.positions - o.approvedCount, 0),
        o.eligibleYears.length ? [...o.eligibleYears].sort().join(', ') : 'All',
        o.durationMonths,
        o.stipend ?? '',
        fmtDate(o.startDate),
        fmtDate(o.applicationDeadline),
        branchNames,
        o.contactName ?? '',
        o.contactPhone ?? '',
        o.contactEmail ?? '',
        o.institutionName ?? '',
        o.pocName ?? '',
        o.pocPhone ?? '',
        total,
        ...appStatusList.map((s) => apps[s] ?? 0),
        o.importBatchId ?? '',
        o.createdById,
        fmtDateTime(o.createdAt),
        fmtDateTime(o.updatedAt),
      ];
    });

    // ---- Sheet 2: Branch positions
    const branchColumns: Column[] = [
      { header: 'S.No', width: 6 },
      { header: 'Opportunity ID', width: 38 },
      { header: 'Title', width: 30 },
      { header: 'Company', width: 28 },
      { header: 'Status', width: 10 },
      { header: 'Branch', width: 28 },
      { header: 'Branch Code', width: 12 },
      { header: 'Positions', width: 10 },
      { header: 'Approved Count', width: 10 },
      { header: 'Remaining', width: 10 },
      { header: 'Max Applications', width: 12 },
      { header: 'Branch Stipend', width: 14 },
      { header: 'Effective Stipend', width: 14 },
    ];
    const branchRows: (string | number)[][] = [];
    for (const o of opportunities) {
      for (const b of [...o.branches].sort((x, y) => x.branch.name.localeCompare(y.branch.name))) {
        branchRows.push([
          branchRows.length + 1,
          o.id,
          o.title,
          o.company.name,
          o.status,
          b.branch.name,
          b.branch.code,
          b.positions,
          b.approvedCount,
          Math.max(b.positions - b.approvedCount, 0),
          b.maxApplications ?? b.positions,
          b.stipend ?? '',
          b.stipend ?? o.stipend ?? '',
        ]);
      }
    }

    // ---- Sheet 3: Summary
    const summaryRows: (string | number)[][] = STATUSES.map((s) => {
      const list = opportunities.filter((o) => o.status === s);
      return [
        s,
        list.length,
        list.reduce((n, o) => n + o.positions, 0),
        list.reduce((n, o) => n + o.approvedCount, 0),
      ];
    });
    summaryRows.push([
      'TOTAL',
      opportunities.length,
      opportunities.reduce((n, o) => n + o.positions, 0),
      opportunities.reduce((n, o) => n + o.approvedCount, 0),
    ]);

    console.log('\nStatus     Opportunities  Positions  Approved');
    for (const r of summaryRows) {
      console.log(`${String(r[0]).padEnd(10)} ${String(r[1]).padStart(13)} ${String(r[2]).padStart(10)} ${String(r[3]).padStart(9)}`);
    }

    if (dryRun) {
      console.log('\nDry run: no file written.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    writeSheet(workbook, 'Opportunities', oppColumns, oppRows);
    writeSheet(workbook, 'Branch Positions', branchColumns, branchRows);
    writeSheet(
      workbook,
      'Summary',
      [
        { header: 'Status', width: 14 },
        { header: 'Opportunities', width: 14 },
        { header: 'Total Positions', width: 14 },
        { header: 'Approved Count', width: 14 },
      ],
      summaryRows,
    );

    const outPath = output
      ? path.resolve(output)
      : path.resolve(__dirname, '..', 'reports', `internship-opportunities-${getTimestampLabel(new Date())}.xlsx`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await workbook.xlsx.writeFile(outPath);
    console.log(`\nSaved: ${outPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
