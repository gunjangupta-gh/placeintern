/**
 * Permanently deletes STUDENT-role Users in a given batch (default: "2024-2027")
 * - and everything that cascades from them: Student, Document,
 * InternshipApplication, MentorAssignment, MonthlyReport, Grievance,
 * PrincipalFeedbackStudent, StudentPlacementInterest, UserSession,
 * PasswordHistory, Notification, TrainingApplication/Attendance,
 * FeedbackResponse, TrainingCertificate, TrainingRecommendation,
 * PreTestResponse, PostTestResponse, etc. - see schema.prisma onDelete: Cascade
 * chains rooted at User/Student).
 *
 * This is DESTRUCTIVE and IRREVERSIBLE - there is no soft-delete here, unlike
 * seed-deactivate-students.ts which only flips `active` to false. Use that
 * script instead if you just want students hidden from dashboards/reports.
 *
 * Safety:
 *   - Defaults to a DRY RUN that only reports what would be deleted.
 *   - Requires --confirm to actually delete anything.
 *
 * Usage:
 *   ts-node prisma/seed-delete-students.ts                     # dry run, batch 2024-2027
 *   ts-node prisma/seed-delete-students.ts --verbose            # dry run, list every match
 *   ts-node prisma/seed-delete-students.ts --confirm             # actually delete
 *   ts-node prisma/seed-delete-students.ts --batch="2023-2026"   # target a different batch
 */

import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const CHUNK_SIZE = 500;
const DEFAULT_BATCH = '2024-2027';

interface ParsedArgs {
  confirm: boolean;
  verbose: boolean;
  batch: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const batchArg = args.find((a) => a.startsWith('--batch='));
  return {
    confirm: args.includes('--confirm'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    batch: batchArg ? batchArg.split('=')[1].trim() : DEFAULT_BATCH,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const { confirm, verbose, batch: batchName } = parseArgs();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('DELETE STUDENTS SEED SCRIPT');
    console.log('='.repeat(80));
    console.log(`Mode: ${confirm ? 'LIVE - WILL DELETE' : 'DRY RUN'}`);
    console.log(`Scope: ALL institutions, batch "${batchName}"`);
    console.log('');

    const batch = await prisma.batch.findFirst({ where: { name: batchName }, select: { id: true, name: true } });
    if (!batch) {
      const allBatches = await prisma.batch.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
      throw new Error(`Batch not found: ${batchName}. Available batches: ${allBatches.map((b) => b.name).join(', ')}`);
    }

    const targetUsers = await prisma.user.findMany({
      where: { role: Role.STUDENT, Student: { is: { batchId: batch.id } } },
      select: { id: true, name: true, email: true, rollNumber: true, institutionId: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Matched STUDENT users: ${targetUsers.length}`);

    if (targetUsers.length === 0) {
      console.log('No student users matched. Nothing to do.');
      return;
    }

    const preview = verbose ? targetUsers : targetUsers.slice(0, 10);
    preview.forEach((u, i) => {
      console.log(`${i + 1}. ${u.id} | ${u.name} | ${u.email || 'no-email'} | roll=${u.rollNumber || 'n/a'}`);
    });
    if (!verbose && targetUsers.length > preview.length) {
      console.log(`... and ${targetUsers.length - preview.length} more (use --verbose to list all)`);
    }

    if (!confirm) {
      console.log('');
      console.log('DRY RUN: no database changes were made.');
      console.log('Re-run with --confirm to permanently delete these users and all related records.');
      return;
    }

    console.log('');
    console.log('Deleting...');
    const startedAt = Date.now();

    const idChunks = chunk(targetUsers.map((u) => u.id), CHUNK_SIZE);
    let deletedCount = 0;

    for (const idsChunk of idChunks) {
      const result = await prisma.user.deleteMany({ where: { id: { in: idsChunk } } });
      deletedCount += result.count;
    }

    const durationMs = Date.now() - startedAt;
    console.log('');
    console.log('Completed.');
    console.log(`Deleted users: ${deletedCount}`);
    console.log(`Duration: ${durationMs}ms`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
