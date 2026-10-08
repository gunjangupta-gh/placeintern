/**
 * Backfills Student.currentYear / currentSemester from admissionYear for active
 * students whose stored values are missing or stale (e.g. bulk-uploaded after the
 * last 1 July / 1 January scheduler run).
 *
 * Uses the same formula as the scheduler (src/common/utils/academic-progress.util.ts).
 * Only students with an admissionYear are touched; nothing else is modified.
 *
 * Usage:
 *   ts-node scripts/backfill-student-progress.ts            (report only, no writes)
 *   ts-node scripts/backfill-student-progress.ts --apply    (write the changes)
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { calculateStudentProgress } from '../src/common/utils/academic-progress.util';

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const now = new Date();
    const students = await prisma.student.findMany({
      where: { admissionYear: { not: null }, user: { active: true } },
      select: { id: true, admissionYear: true, currentYear: true, currentSemester: true },
    });

    let toUpdate = 0;
    let unchanged = 0;
    let outOfRange = 0;
    let missingBefore = 0;
    const changes: Array<{ id: string; currentYear: number; currentSemester: number }> = [];

    for (const s of students) {
      const progress = calculateStudentProgress(s.admissionYear, now);
      if (!progress) {
        outOfRange++;
        continue;
      }
      if (s.currentYear === progress.currentYear && s.currentSemester === progress.currentSemester) {
        unchanged++;
        continue;
      }
      if (s.currentYear === null) missingBefore++;
      toUpdate++;
      changes.push({ id: s.id, ...progress });
    }

    console.log(`Active students with admissionYear: ${students.length}`);
    console.log(`  already correct:                  ${unchanged}`);
    console.log(`  to update:                        ${toUpdate} (of which currentYear was empty: ${missingBefore})`);
    console.log(`  outside course range (skipped):   ${outOfRange}`);

    if (!apply) {
      console.log('\nDry run - no changes written. Re-run with --apply to update.');
      return;
    }

    let done = 0;
    for (const c of changes) {
      await prisma.student.update({
        where: { id: c.id },
        data: { currentYear: c.currentYear, currentSemester: c.currentSemester },
      });
      done++;
    }
    console.log(`\nUpdated ${done} students.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
