/**
 * Sets the internship type of existing self-identified internships from their stipend,
 * for students of batch 2024-2027 ONLY (change with --batch=NAME):
 *   stipend mentioned (amount above 0)  -> WITH_STIPEND   (stipend kept, normalised to plain digits)
 *   no stipend / 0 / "No" / blank       -> WITHOUT_STIPEND (stipend cleared)
 *
 * PAID_BY_STUDENT can't be inferred from old data, so it is never set here.
 * By default only internships with NO type yet are touched; --overwrite re-evaluates every
 * self-identified internship (it will not turn a PAID_BY_STUDENT row into anything else
 * unless --include-paid-by-student is also given).
 *
 * Usage:
 *   ts-node prisma/seed-internship-type.ts --dry-run
 *   ts-node prisma/seed-internship-type.ts --dry-run --verbose
 *   ts-node prisma/seed-internship-type.ts
 *   ts-node prisma/seed-internship-type.ts --overwrite
 *   ts-node prisma/seed-internship-type.ts --batch=2025-2028
 */

import { PrismaClient, InternshipCompensationType } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { parseMonthlyStipend } from '../src/api/internship-opportunity/stipend.util';
import 'dotenv/config';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const DEFAULT_BATCH_NAME = '2024-2027';
const batchArg = args.find((a) => a.startsWith('--batch='));
const BATCH_NAME = batchArg ? batchArg.split('=')[1] : DEFAULT_BATCH_NAME;
const OVERWRITE = args.includes('--overwrite');
const INCLUDE_PAID = args.includes('--include-paid-by-student');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

  try {
    console.log('='.repeat(70));
    console.log(`INTERNSHIP TYPE SEED${DRY_RUN ? ' (DRY RUN - nothing is written)' : ''}`);
    console.log('='.repeat(70));

    const batch = await prisma.batch.findUnique({ where: { name: BATCH_NAME }, select: { id: true } });
    if (!batch) {
      console.log(`No batch found with name "${BATCH_NAME}". Nothing to do.`);
      return;
    }
    console.log(`Batch: ${BATCH_NAME}`);

    // Read ALL self-identified internships of the batch so the summary shows the full picture,
    // including rows that already have a type (e.g. set by the migration backfill)
    const where: any = { isSelfIdentified: true, student: { batchId: batch.id } };

    const apps = await prisma.internshipApplication.findMany({
      where,
      select: { id: true, companyName: true, stipend: true, internshipType: true },
    });
    console.log(`Self-identified internships to evaluate (batch ${BATCH_NAME}): ${apps.length}`);

    let withStipend = 0;
    let withoutStipend = 0;
    let unchanged = 0;
    const keptType: Record<string, number> = {};
    let needsReview = 0;
    let failed = 0;

    for (const app of apps) {
      // Already typed: keep it (unless --overwrite; PAID_BY_STUDENT is only re-evaluated with --include-paid-by-student)
      if (app.internshipType && (!OVERWRITE || (app.internshipType === InternshipCompensationType.PAID_BY_STUDENT && !INCLUDE_PAID))) {
        keptType[app.internshipType] = (keptType[app.internshipType] || 0) + 1;
        continue;
      }
      const amount = parseMonthlyStipend(app.stipend);
      // A stipend IS mentioned but cannot be turned into a monthly amount (per day / week / hour rate,
      // or text like "as per norms" with a number): do not guess, leave it for the mentor.
      if (!amount && /[1-9]/.test(app.stipend ?? '')) {
        needsReview++;
        console.log(`REVIEW ${app.id} | ${app.companyName ?? '-'} | stipend=${JSON.stringify(app.stipend)} - left unchanged`);
        continue;
      }
      const type = amount ? InternshipCompensationType.WITH_STIPEND : InternshipCompensationType.WITHOUT_STIPEND;
      const stipend = amount ? String(amount) : null;

      if (app.internshipType === type && app.stipend === stipend) {
        unchanged++;
        keptType[type] = (keptType[type] || 0) + 1;
        continue;
      }
      if (VERBOSE) {
        console.log(`${app.id} | ${app.companyName ?? '-'} | stipend=${JSON.stringify(app.stipend)} -> ${type}${stipend ? ` (${stipend})` : ''}`);
      }
      if (!DRY_RUN) {
        try {
          await prisma.internshipApplication.update({
            where: { id: app.id },
            data: { internshipType: type, stipend, studentFeeAmount: null },
          });
        } catch (err) {
          failed++;
          console.error(`Failed to update ${app.id}:`, (err as Error).message);
          continue; // a failed write is not counted as set
        }
      }
      if (type === InternshipCompensationType.WITH_STIPEND) withStipend++;
      else withoutStipend++;
    }

    console.log('-'.repeat(70));
    console.log(`${DRY_RUN ? 'Would set' : 'Set'} WITH_STIPEND:    ${withStipend}`);
    console.log(`${DRY_RUN ? 'Would set' : 'Set'} WITHOUT_STIPEND: ${withoutStipend}`);
    const kept = (t: string) => keptType[t] || 0;
    console.log(`Already had a type (kept): WITH_STIPEND ${kept('WITH_STIPEND')}, WITHOUT_STIPEND ${kept('WITHOUT_STIPEND')}, PAID_BY_STUDENT ${kept('PAID_BY_STUDENT')}`);
    console.log('-'.repeat(70));
    console.log(`Final totals ${DRY_RUN ? '(if applied)' : ''} for batch ${BATCH_NAME}:`);
    console.log(`  WITH_STIPEND:    ${kept('WITH_STIPEND') + withStipend}`);
    console.log(`  WITHOUT_STIPEND: ${kept('WITHOUT_STIPEND') + withoutStipend}`);
    console.log(`  PAID_BY_STUDENT: ${kept('PAID_BY_STUDENT')}`);
    if (needsReview) console.log(`Needs manual review:  ${needsReview} (stipend mentioned but not a monthly amount; left unchanged)`);
    if (failed) console.log(`Failed:               ${failed}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
