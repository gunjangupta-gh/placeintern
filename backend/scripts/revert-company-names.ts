/**
 * Restores internship application company names (and company links) from a snapshot made by
 * scripts/export-company-names.ts (sheet "Application Mapping").
 *
 * For each row it sets, on the application with that Application ID:
 *   companyName <- "Original Company Name (exact)"
 *   companyId   <- "Original Company ID" (or null if it was empty, or if that Company no longer exists)
 *
 * Only applications whose current values differ from the snapshot are updated.
 * It does NOT delete Company rows created by the link script; those can stay (inactive/unused is harmless)
 * or be removed manually.
 *
 * Usage:
 *   npx ts-node scripts/revert-company-names.ts --file=./reports/company-names-before-normalization.xlsx --dry-run
 *   npx ts-node scripts/revert-company-names.ts --file=./reports/company-names-before-normalization.xlsx
 *
 * Optional: --company-names-only   restore companyName but leave companyId as it is now
 */

import 'dotenv/config';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

function getArgValue(args: string[], name: string): string | null {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3).trim() : null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('');
  if (typeof v === 'object' && 'text' in v) return String((v as any).text);
  return String(v);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const namesOnly = args.includes('--company-names-only');
  const file = getArgValue(args, 'file');
  if (!file) {
    console.error('Missing --file=<path to the snapshot .xlsx>');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(file));
  const sheet = wb.getWorksheet('Application Mapping');
  if (!sheet) {
    console.error('Sheet "Application Mapping" not found. Was this file made by export-company-names.ts?');
    process.exit(1);
  }

  const snapshot: { id: string; name: string; companyId: string }[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return; // header
    const id = cellText(row.getCell(1).value).trim();
    if (!id) return;
    snapshot.push({
      id,
      name: cellText(row.getCell(8).value), // exact, untrimmed
      companyId: cellText(row.getCell(9).value).trim(),
    });
  });
  console.log(`Snapshot rows: ${snapshot.length}${dryRun ? ' (DRY RUN, no changes)' : ''}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

  try {
    const existingCompanyIds = new Set((await prisma.company.findMany({ select: { id: true } })).map((c) => c.id));
    const current = await prisma.internshipApplication.findMany({
      where: { id: { in: snapshot.map((s) => s.id) } },
      select: { id: true, companyName: true, companyId: true },
    });
    const currentById = new Map(current.map((c) => [c.id, c]));

    let changed = 0;
    let unchanged = 0;
    let missing = 0;
    let droppedLinks = 0;

    for (const s of snapshot) {
      const cur = currentById.get(s.id);
      if (!cur) {
        missing++;
        continue;
      }
      let targetCompanyId: string | null = s.companyId || null;
      if (targetCompanyId && !existingCompanyIds.has(targetCompanyId)) {
        targetCompanyId = null;
        droppedLinks++;
      }

      const nameDiffers = cur.companyName !== s.name;
      const linkDiffers = !namesOnly && (cur.companyId ?? null) !== targetCompanyId;
      if (!nameDiffers && !linkDiffers) {
        unchanged++;
        continue;
      }

      if (nameDiffers) console.log(`  "${cur.companyName}" -> "${s.name}"`);
      changed++;
      if (!dryRun) {
        await prisma.internshipApplication.update({
          where: { id: s.id },
          data: {
            companyName: s.name,
            ...(namesOnly ? {} : { companyId: targetCompanyId }),
          },
        });
      }
    }

    console.log('\nSummary');
    console.log(`  ${dryRun ? 'Would restore' : 'Restored'}: ${changed}`);
    console.log(`  Already matching the snapshot: ${unchanged}`);
    console.log(`  Applications not found (deleted since): ${missing}`);
    console.log(`  Company links set to empty (company no longer exists): ${droppedLinks}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
