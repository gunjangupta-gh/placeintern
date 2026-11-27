/**
 * Exports every company name exactly as it is stored (NO normalization) to an Excel workbook,
 * so the raw data can be kept as a snapshot and compared later (e.g. before / after normalization).
 *
 * READ-ONLY: this script never writes to the database.
 * The "Application Mapping" sheet links applications to students by id and roll number, so treat the
 * file as student data: store it securely and do not share or upload it outside the organisation.
 *
 * Sheets:
 *   1. "Application Company Names" - one row per distinct companyName string on internship
 *                                    applications, spelled exactly as stored (case, spaces, symbols
 *                                    all preserved), with application counts and link status
 *   2. "Company Table"             - the master Company records (name, display name, aliases, status)
 *   3. "Application Mapping"       - one row per application: application id, student id, roll number,
 *                                    institution, and the ORIGINAL companyName / companyId. This is the
 *                                    revert snapshot used by scripts/revert-company-names.ts
 *                                    (no student name, email or phone is included)
 *   4. "Summary"                   - totals
 *
 * Usage:
 *   npx ts-node scripts/export-company-names.ts
 *   npx ts-node scripts/export-company-names.ts --output=./reports/company-names-before.xlsx
 *   npx ts-node scripts/export-company-names.ts --dry-run      (counts only, no file written)
 *
 * Default output: reports/company-names-<timestamp>.xlsx (the /reports folder is git-ignored)
 */

import 'dotenv/config';
import * as path from 'path';
import { promises as fs } from 'fs';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

function getArgValue(args: string[], name: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3).trim() : null;
}

function timestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Make leading/trailing spaces visible in the sheet, e.g. " Abc " -> "[ Abc ]" is NOT done; we flag instead. */
function hasEdgeSpaces(s: string): boolean {
  return s !== s.trim();
}

function addSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: { header: string; width: number }[],
  rows: (string | number)[][],
) {
  const sheet = wb.addWorksheet(name);
  const header = sheet.getRow(1);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    sheet.getColumn(i + 1).width = c.width;
  });
  rows.forEach((r, ri) => {
    const row = sheet.getRow(ri + 2);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      // Force plain text for strings so nothing starting with "=" or "+" is treated as a formula
      cell.value = typeof v === 'string' ? { richText: [{ text: v }] } : v;
      cell.font = { name: 'Arial' };
    });
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const output = getArgValue(args, 'output');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

  try {
    // Exact strings as stored; groupBy is case- and whitespace-sensitive so every variant stays separate
    const grouped = await prisma.internshipApplication.groupBy({
      by: ['companyName', 'companyId'],
      where: { companyName: { not: null } },
      _count: { _all: true },
    });

    const companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });
    const companyById = new Map(companies.map((c) => [c.id, c]));

    // Self-identified count per exact string
    const selfGrouped = await prisma.internshipApplication.groupBy({
      by: ['companyName'],
      where: { companyName: { not: null }, isSelfIdentified: true },
      _count: { _all: true },
    });
    const selfCount = new Map(selfGrouped.map((g) => [g.companyName as string, g._count._all]));

    // Merge rows that share the same exact string (they may differ only by companyId)
    const byName = new Map<string, { total: number; ids: Set<string> }>();
    for (const g of grouped) {
      const name = g.companyName as string;
      const entry = byName.get(name) ?? { total: 0, ids: new Set<string>() };
      entry.total += g._count._all;
      if (g.companyId) entry.ids.add(g.companyId);
      byName.set(name, entry);
    }

    const rows = [...byName.entries()]
      .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
      .map(([name, v]) => {
        const linked = [...v.ids].map((id) => companyById.get(id)?.name).filter(Boolean) as string[];
        return [
          name, // exactly as stored
          v.total,
          selfCount.get(name) ?? 0,
          name.length,
          hasEdgeSpaces(name) ? 'Yes' : '',
          linked.length ? 'Yes' : 'No',
          linked.join(' | '),
        ];
      });

    const companyAppCounts = new Map<string, number>();
    for (const g of grouped) {
      if (g.companyId) companyAppCounts.set(g.companyId, (companyAppCounts.get(g.companyId) ?? 0) + g._count._all);
    }
    const companyRows = companies.map((c) => [
      c.name,
      c.displayName ?? '',
      c.alias.join(' | '),
      c.isActive ? 'Active' : 'Inactive',
      c.city ?? '',
      c.state ?? '',
      c.industrySector ?? '',
      companyAppCounts.get(c.id) ?? 0,
    ]);

    // Revert snapshot: which student's application had which exact company name / id
    const apps = await prisma.internshipApplication.findMany({
      where: { companyName: { not: null } },
      select: {
        id: true,
        companyName: true,
        companyId: true,
        isSelfIdentified: true,
        status: true,
        student: { select: { id: true, institutionId: true, user: { select: { rollNumber: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const institutions = await prisma.institution.findMany({ select: { id: true, code: true, name: true } });
    const instById = new Map(institutions.map((i) => [i.id, i]));
    const mappingRows = apps.map((a) => {
      const inst = a.student?.institutionId ? instById.get(a.student.institutionId) : undefined;
      return [
        a.id,
        a.student?.id ?? '',
        a.student?.user?.rollNumber ?? '',
        inst?.code ?? '',
        inst?.name ?? '',
        a.isSelfIdentified ? 'Yes' : 'No',
        String(a.status ?? ''),
        a.companyName as string, // exact, as stored
        a.companyId ?? '',
      ];
    });

    const totalApps = rows.reduce((s, r) => s + (r[1] as number), 0);
    console.log(`Distinct company names on applications: ${rows.length}`);
    console.log(`Applications with a company name:       ${totalApps}`);
    console.log(`Rows in Company table:                  ${companies.length}`);
    console.log(`Application rows in revert mapping:     ${mappingRows.length}`);

    if (dryRun) {
      console.log('\nDRY RUN: no file written.');
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PlaceIntern';
    wb.created = new Date();

    addSheet(
      wb,
      'Application Company Names',
      [
        { header: 'Company Name (exact, as stored)', width: 60 },
        { header: 'Applications', width: 14 },
        { header: 'Self-Identified', width: 16 },
        { header: 'Name Length', width: 12 },
        { header: 'Leading/Trailing Spaces', width: 22 },
        { header: 'Linked To Company Table', width: 22 },
        { header: 'Linked Company Name', width: 50 },
      ],
      rows,
    );
    addSheet(
      wb,
      'Company Table',
      [
        { header: 'Name', width: 50 },
        { header: 'Display Name', width: 30 },
        { header: 'Aliases', width: 60 },
        { header: 'Status', width: 12 },
        { header: 'City', width: 18 },
        { header: 'State', width: 18 },
        { header: 'Industry Sector', width: 22 },
        { header: 'Applications Linked', width: 20 },
      ],
      companyRows,
    );
    addSheet(
      wb,
      'Application Mapping',
      [
        { header: 'Application ID', width: 40 },
        { header: 'Student ID', width: 40 },
        { header: 'Roll Number', width: 18 },
        { header: 'Institution Code', width: 18 },
        { header: 'Institution Name', width: 40 },
        { header: 'Self-Identified', width: 16 },
        { header: 'Status', width: 14 },
        { header: 'Original Company Name (exact)', width: 60 },
        { header: 'Original Company ID', width: 40 },
      ],
      mappingRows,
    );
    addSheet(
      wb,
      'Summary',
      [
        { header: 'Metric', width: 45 },
        { header: 'Value', width: 20 },
      ],
      [
        ['Exported at', new Date().toISOString().replace('T', ' ').slice(0, 19)],
        ['Distinct company names on applications', rows.length],
        ['Applications with a company name', totalApps],
        ['Rows in Company table', companies.length],
        ['Names not linked to Company table', rows.filter((r) => r[5] === 'No').length],
      ],
    );

    const outPath = output
      ? path.resolve(output)
      : path.resolve('reports', `company-names-${timestamp(new Date())}.xlsx`);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await wb.xlsx.writeFile(outPath);
    console.log(`\nSaved: ${outPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
