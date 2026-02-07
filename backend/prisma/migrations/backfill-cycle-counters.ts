/**
 * Backfill Migration Script: Expected Cycle Counters
 *
 * This script populates the new counter fields on InternshipApplication
 * based on the updated monthly-cycle rules:
 * - Visit Rule: First month = any days (always count), last month requires >10 days
 * - Report Rule: SKIP January month only (students join in Jan at various dates), last month requires >10 days
 * - totalExpectedReports: Calculated from internship dates using getTotalExpectedReports()
 * - totalExpectedVisits: Calculated from internship dates using getTotalExpectedVisits()
 * - submittedReportsCount: Count of existing SUBMITTED/UNDER_REVIEW/APPROVED monthly reports
 * - completedVisitsCount: Count of existing COMPLETED (non-deleted) faculty visits
 * - expectedCountsLastCalculated: Set to current timestamp
 *
 * Run with: npx ts-node prisma/migrations/backfill-cycle-counters.ts
 */

import { PrismaClient, MonthlyReportStatus, VisitLogStatus } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getTotalExpectedReports, getTotalExpectedVisits } from '../../src/common/utils/monthly-cycle.util';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('Starting FAST backfill of cycle counters...\n');

  const startTime = Date.now();

  // Get all internship applications with dates
  const applications = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      joiningDate: true,
      completionDate: true,
      studentId: true,
    },
  });

  console.log(`Found ${applications.length} active internship applications\n`);

  // Get all reports and visits counts in bulk (FAST)
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

  // Create lookup maps for fast access
  const reportsMap = new Map(allReports.map(r => [r.applicationId, r._count.id]));
  const visitsMap = new Map(allVisits.map(v => [v.applicationId, v._count.id]));
  console.log('✓ Bulk data fetched\n');

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process in batches for better performance
  const BATCH_SIZE = 50;
  const batches: typeof applications[] = [];
  for (let i = 0; i < applications.length; i += BATCH_SIZE) {
    batches.push(applications.slice(i, i + BATCH_SIZE));
  }

  console.log(`Processing ${batches.length} batches of ${BATCH_SIZE} applications...\n`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // Process batch in parallel
    const updates = await Promise.allSettled(
      batch.map(async (app) => {
        // Use startDate/endDate, fallback to joiningDate/completionDate
        const startDate = app.startDate || app.joiningDate;
        const endDate = app.endDate || app.completionDate;

        if (!startDate || !endDate) {
          return { status: 'skipped', id: app.id };
        }

        // Calculate expected counts
        const totalExpectedReports = getTotalExpectedReports(startDate, endDate);
        const totalExpectedVisits = getTotalExpectedVisits(startDate, endDate);

        // Get actual counts from maps (instant lookup)
        const submittedReportsCount = reportsMap.get(app.id) || 0;
        const completedVisitsCount = visitsMap.get(app.id) || 0;

        // Update the application
        await prisma.internshipApplication.update({
          where: { id: app.id },
          data: {
            totalExpectedReports,
            totalExpectedVisits,
            submittedReportsCount,
            completedVisitsCount,
            expectedCountsLastCalculated: new Date(),
          },
        });

        return {
          status: 'success',
          id: app.id,
          totalExpectedReports,
          totalExpectedVisits,
          submittedReportsCount,
          completedVisitsCount,
        };
      })
    );

    // Count results
    for (const result of updates) {
      if (result.status === 'fulfilled') {
        if (result.value.status === 'skipped') {
          skippedCount++;
        } else {
          successCount++;
          if (successCount % 100 === 0) {
            console.log(`Progress: ${successCount}/${applications.length} processed...`);
          }
        }
      } else {
        errorCount++;
        console.error(`Error:`, result.reason);
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=== Backfill Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Skipped (no dates): ${skippedCount}`);
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
