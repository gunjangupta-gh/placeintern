/**
 * Recalculate Actual Counters Script
 *
 * This script recalculates the actual counter fields on InternshipApplication
 * based on existing database records:
 * - submittedReportsCount: Count of SUBMITTED/UNDER_REVIEW/APPROVED monthly reports (non-deleted)
 * - completedVisitsCount: Count of COMPLETED faculty visits (non-deleted)
 *
 * These criteria match the compliance dashboard calculations.
 *
 * Use this script after:
 * - Migrating data from another database
 * - Data integrity issues
 * - Manual database changes
 *
 * Run with: npx ts-node prisma/migrations/recalculate-actual-counters.ts
 */

import { PrismaClient, MonthlyReportStatus, VisitLogStatus } from '../../src/generated/prisma/client';
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
  console.log('Starting FAST recalculation of actual counters...\n');

  const startTime = Date.now();

  // Get all internship applications
  const applications = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      studentId: true,
    },
  });

  console.log(`Found ${applications.length} active internship applications\n`);

  // Get all reports and visits counts in bulk (FAST - single query each)
  console.log('Fetching all reports and visits data in bulk...');
  const [allReports, allVisits] = await Promise.all([
    prisma.monthlyReport.groupBy({
      by: ['applicationId'],
      where: {
        status: { in: [MonthlyReportStatus.SUBMITTED, MonthlyReportStatus.UNDER_REVIEW, MonthlyReportStatus.APPROVED] },
        isDeleted: false,
      },
      _count: {
        id: true,
      },
    }),
    prisma.facultyVisitLog.groupBy({
      by: ['applicationId'],
      where: {
        status: VisitLogStatus.COMPLETED,
        isDeleted: false,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  // Create lookup maps for instant access
  const reportsMap = new Map(allReports.map(r => [r.applicationId, r._count.id]));
  const visitsMap = new Map(allVisits.map(v => [v.applicationId, v._count.id]));
  console.log('✓ Bulk data fetched\n');

  let successCount = 0;
  let errorCount = 0;

  // Process in batches with parallel updates
  const BATCH_SIZE = 50;
  const batches: typeof applications[] = [];
  for (let i = 0; i < applications.length; i += BATCH_SIZE) {
    batches.push(applications.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${batches.length} batches of ${BATCH_SIZE} applications...\n`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Update all in parallel
    const updates = await Promise.allSettled(
      batch.map(async (app) => {
        // Get counts from maps (instant lookup, no database query)
        const submittedReportsCount = reportsMap.get(app.id) || 0;
        const completedVisitsCount = visitsMap.get(app.id) || 0;

        // Update the application
        await prisma.internshipApplication.update({
          where: { id: app.id },
          data: {
            submittedReportsCount,
            completedVisitsCount,
          },
        });

        return { id: app.id, submittedReportsCount, completedVisitsCount };
      })
    );

    // Count results
    for (const result of updates) {
      if (result.status === 'fulfilled') {
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Progress: ${successCount}/${applications.length} processed...`);
        }
      } else {
        errorCount++;
        console.error(`Error:`, result.reason);
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=== Recalculation Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total processed: ${applications.length}`);
  console.log(`Duration: ${duration} seconds`);
  console.log(`Speed: ${(applications.length / parseFloat(duration)).toFixed(0)} records/second`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
