/**
 * Script to manually run the internship phase update scheduler.
 * This will catch up all existing internships that need phase transitions.
 *
 * Updates both:
 * - internshipPhase (NOT_STARTED -> ACTIVE -> COMPLETED)
 * - status (ApplicationStatus: APPROVED/SELECTED -> JOINED -> COMPLETED)
 *
 * Usage: npx ts-node scripts/run-internship-phase-update.ts
 */

import { PrismaClient, InternshipPhase, ApplicationStatus } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('='.repeat(70));
  console.log('Internship Phase & Status Update - Manual Catch-Up');
  console.log('='.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');

  const now = new Date();

  // ============================================================
  // Step 1: Activate internships where startDate has passed
  // Updates: internshipPhase -> ACTIVE, status -> JOINED
  // ============================================================
  console.log('Step 1: Activating internships where startDate has passed...');
  console.log('-'.repeat(70));

  const internshipsToActivate = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
      internshipPhase: InternshipPhase.NOT_STARTED,
      status: {
        in: [
          ApplicationStatus.APPROVED,
          ApplicationStatus.SELECTED,
        ],
      },
      startDate: {
        not: null,
        lte: now,
      },
    },
    select: {
      id: true,
      companyName: true,
      status: true,
      internshipPhase: true,
      startDate: true,
      endDate: true,
      student: {
        select: {
          user: { select: { name: true, rollNumber: true } },
        },
      },
    },
  });

  console.log(`Found ${internshipsToActivate.length} internships to activate`);
  console.log('  - internshipPhase: NOT_STARTED -> ACTIVE');
  console.log('  - status: APPROVED/SELECTED -> JOINED');

  if (internshipsToActivate.length > 0) {
    // Show first 10 for preview
    console.log('\nSample of internships to activate:');
    internshipsToActivate.slice(0, 10).forEach((i, idx) => {
      console.log(
        `  ${idx + 1}. ${i.student?.user?.name || 'Unknown'} (${i.student?.user?.rollNumber || 'N/A'}) - ${i.companyName || 'Unknown Company'}`
      );
      console.log(
        `      Status: ${i.status} -> JOINED | Phase: ${i.internshipPhase} -> ACTIVE | Start: ${i.startDate?.toLocaleDateString()}`
      );
    });
    if (internshipsToActivate.length > 10) {
      console.log(`  ... and ${internshipsToActivate.length - 10} more`);
    }

    // Update all
    const activateResult = await prisma.internshipApplication.updateMany({
      where: { id: { in: internshipsToActivate.map((i) => i.id) } },
      data: {
        internshipPhase: InternshipPhase.ACTIVE,
        status: ApplicationStatus.JOINED,
        joiningDate: now,
        updatedAt: now,
      },
    });

    console.log(`\n✓ Activated ${activateResult.count} internships (phase: ACTIVE, status: JOINED)`);
  }

  console.log('');

  // ============================================================
  // Step 2: Complete internships where endDate has passed
  // Updates: internshipPhase -> COMPLETED, status -> COMPLETED
  // ============================================================
  console.log('Step 2: Completing internships where endDate has passed...');
  console.log('-'.repeat(70));

  const internshipsToComplete = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
      internshipPhase: InternshipPhase.ACTIVE,
      status: {
        in: [
          ApplicationStatus.APPROVED,
          ApplicationStatus.JOINED,
          ApplicationStatus.SELECTED,
        ],
      },
      endDate: {
        not: null,
        lt: now,
      },
    },
    select: {
      id: true,
      companyName: true,
      status: true,
      internshipPhase: true,
      startDate: true,
      endDate: true,
      student: {
        select: {
          user: { select: { name: true, rollNumber: true } },
        },
      },
    },
  });

  console.log(`Found ${internshipsToComplete.length} internships to complete`);
  console.log('  - internshipPhase: ACTIVE -> COMPLETED');
  console.log('  - status: APPROVED/JOINED/SELECTED -> COMPLETED');

  if (internshipsToComplete.length > 0) {
    // Show first 10 for preview
    console.log('\nSample of internships to complete:');
    internshipsToComplete.slice(0, 10).forEach((i, idx) => {
      console.log(
        `  ${idx + 1}. ${i.student?.user?.name || 'Unknown'} (${i.student?.user?.rollNumber || 'N/A'}) - ${i.companyName || 'Unknown Company'}`
      );
      console.log(
        `      Status: ${i.status} -> COMPLETED | Phase: ${i.internshipPhase} -> COMPLETED | End: ${i.endDate?.toLocaleDateString()}`
      );
    });
    if (internshipsToComplete.length > 10) {
      console.log(`  ... and ${internshipsToComplete.length - 10} more`);
    }

    // Update all
    const completeResult = await prisma.internshipApplication.updateMany({
      where: { id: { in: internshipsToComplete.map((i) => i.id) } },
      data: {
        internshipPhase: InternshipPhase.COMPLETED,
        status: ApplicationStatus.COMPLETED,
        completionDate: now,
        updatedAt: now,
      },
    });

    console.log(`\n✓ Completed ${completeResult.count} internships (phase: COMPLETED, status: COMPLETED)`);
  }

  console.log('');

  // ============================================================
  // Step 3: Fix inconsistent states - ACTIVE phase but wrong status
  // ============================================================
  console.log('Step 3: Fixing inconsistent states (ACTIVE phase but status not JOINED)...');
  console.log('-'.repeat(70));

  const inconsistentActive = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
      internshipPhase: InternshipPhase.ACTIVE,
      status: {
        in: [ApplicationStatus.APPROVED, ApplicationStatus.SELECTED],
      },
      endDate: {
        gte: now, // Not yet ended
      },
    },
    select: {
      id: true,
      companyName: true,
      status: true,
      internshipPhase: true,
      student: {
        select: {
          user: { select: { name: true, rollNumber: true } },
        },
      },
    },
  });

  console.log(`Found ${inconsistentActive.length} internships with inconsistent state`);
  console.log('  - status: APPROVED/SELECTED -> JOINED (phase already ACTIVE)');

  if (inconsistentActive.length > 0) {
    console.log('\nSample of inconsistent internships:');
    inconsistentActive.slice(0, 10).forEach((i, idx) => {
      console.log(
        `  ${idx + 1}. ${i.student?.user?.name || 'Unknown'} (${i.student?.user?.rollNumber || 'N/A'}) - ${i.companyName || 'Unknown Company'}`
      );
      console.log(`      Status: ${i.status} -> JOINED | Phase: ${i.internshipPhase} (unchanged)`);
    });
    if (inconsistentActive.length > 10) {
      console.log(`  ... and ${inconsistentActive.length - 10} more`);
    }

    const fixResult = await prisma.internshipApplication.updateMany({
      where: { id: { in: inconsistentActive.map((i) => i.id) } },
      data: {
        status: ApplicationStatus.JOINED,
        updatedAt: now,
      },
    });

    console.log(`\n✓ Fixed ${fixResult.count} internships (status: JOINED)`);
  }

  console.log('');

  // ============================================================
  // Step 4: Fix inconsistent states - COMPLETED phase but wrong status
  // ============================================================
  console.log('Step 4: Fixing inconsistent states (COMPLETED phase but status not COMPLETED)...');
  console.log('-'.repeat(70));

  const inconsistentCompleted = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
      internshipPhase: InternshipPhase.COMPLETED,
      status: {
        notIn: [ApplicationStatus.COMPLETED, ApplicationStatus.WITHDRAWN],
      },
    },
    select: {
      id: true,
      companyName: true,
      status: true,
      internshipPhase: true,
      endDate: true,
      student: {
        select: {
          user: { select: { name: true, rollNumber: true } },
        },
      },
    },
  });

  console.log(`Found ${inconsistentCompleted.length} internships with inconsistent state`);
  console.log('  - status: * -> COMPLETED (phase already COMPLETED)');

  if (inconsistentCompleted.length > 0) {
    console.log('\nSample of inconsistent internships:');
    inconsistentCompleted.slice(0, 10).forEach((i, idx) => {
      console.log(
        `  ${idx + 1}. ${i.student?.user?.name || 'Unknown'} (${i.student?.user?.rollNumber || 'N/A'}) - ${i.companyName || 'Unknown Company'}`
      );
      console.log(`      Status: ${i.status} -> COMPLETED | Phase: ${i.internshipPhase} (unchanged) | End: ${i.endDate?.toLocaleDateString() || 'N/A'}`);
    });
    if (inconsistentCompleted.length > 10) {
      console.log(`  ... and ${inconsistentCompleted.length - 10} more`);
    }

    const fixCompletedResult = await prisma.internshipApplication.updateMany({
      where: { id: { in: inconsistentCompleted.map((i) => i.id) } },
      data: {
        status: ApplicationStatus.COMPLETED,
        updatedAt: now,
      },
    });

    console.log(`\n✓ Fixed ${fixCompletedResult.count} internships (status: COMPLETED)`);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('Summary:');
  console.log(`  - Activated (NOT_STARTED -> ACTIVE, status -> JOINED): ${internshipsToActivate.length}`);
  console.log(`  - Completed (ACTIVE -> COMPLETED, status -> COMPLETED): ${internshipsToComplete.length}`);
  console.log(`  - Fixed ACTIVE phase (status -> JOINED): ${inconsistentActive.length}`);
  console.log(`  - Fixed COMPLETED phase (status -> COMPLETED): ${inconsistentCompleted.length}`);
  console.log(`  - Total updated: ${internshipsToActivate.length + internshipsToComplete.length + inconsistentActive.length + inconsistentCompleted.length}`);
  console.log(`Finished at: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
}

main()
  .catch((e) => {
    console.error('Error running internship phase update:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
