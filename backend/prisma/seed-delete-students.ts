/**
 * Permanently deletes all STUDENT-role Users (and everything that cascades from
 * them: Student, Document, InternshipApplication, MentorAssignment,
 * MonthlyReport, Grievance, PrincipalFeedbackStudent, StudentPlacementInterest,
 * UserSession, PasswordHistory, Notification, TrainingApplication/Attendance,
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
 *   ts-node prisma/seed-delete-students.ts               # dry run
 *   ts-node prisma/seed-delete-students.ts --verbose      # dry run, list every match
 *   ts-node prisma/seed-delete-students.ts --confirm      # actually delete
 */

import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const CHUNK_SIZE = 500;

interface ParsedArgs {
  confirm: boolean;
  verbose: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  return {
    confirm: args.includes('--confirm'),
    verbose: args.includes('--verbose') || args.includes('-v'),
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
  const { confirm, verbose } = parseArgs();

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
    console.log(`Scope: ALL institutions`);
    console.log('');

    const targetUsers = await prisma.user.findMany({
      where: { role: Role.STUDENT },
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
