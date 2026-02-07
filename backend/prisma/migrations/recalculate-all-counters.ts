/**
 * Comprehensive Recalculation Script
 *
 * This script recalculates ALL counter fields on InternshipApplication:
 * 1. Expected counts (totalExpectedReports, totalExpectedVisits) from internship dates
 * 2. Actual counters (submittedReportsCount, completedVisitsCount) from existing records
 *
 * Counter Criteria (matches compliance dashboard):
 * - Reports: SUBMITTED, UNDER_REVIEW, or APPROVED status
 * - Visits: All non-deleted visit logs (isDeleted: false)
 *
 * NEW RULES (Updated):
 * - Visit Rule: First month = any days (always count), last month requires >10 days
 * - Report Rule: SKIP January month only (students join in Jan at various dates), last month requires >10 days
 *
 * Use this script after:
 * - Migrating data from another database
 * - Changing monthly cycle rules
 * - Data integrity issues
 *
 * Run with: npx ts-node prisma/migrations/recalculate-all-counters.ts
 */

import { PrismaClient, MonthlyReportStatus } from '../../src/generated/prisma/client';
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
  console.log('='.repeat(70));
  console.log('COMPREHENSIVE COUNTER RECALCULATION');
  console.log('='.repeat(70));
  console.log('\nThis script will recalculate:');
  console.log('1. Expected counts (from internship dates with NEW RULES)');
  console.log('2. Actual counters (from existing reports and visits)');
  console.log('\nNEW RULES:');
  console.log('- Visits: First month = any days (always count), last month >10 days');
  console.log('- Reports: SKIP January month only (students join in Jan at various dates), last month >10 days\n');
  console.log('='.repeat(70));
  console.log('');

  const startTime = Date.now();

  // Get all internship applications
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

  // Get all reports and visits counts in bulk (FAST - only 2 queries total)
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
        isDeleted: false, // Only count non-deleted visits (all statuses)
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
  let skippedCount = 0;

  const results: Array<{
    id: string;
    expectedReports: number;
    expectedVisits: number;
    actualReports: number;
    actualVisits: number;
  }> = [];

  // Process in batches with parallel updates
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

        // Calculate expected counts using the NEW monthly cycle rules
        const totalExpectedReports = getTotalExpectedReports(startDate, endDate);
        const totalExpectedVisits = getTotalExpectedVisits(startDate, endDate);

        // Get actual counts from maps (instant lookup, no database query)
        const submittedReportsCount = reportsMap.get(app.id) || 0;
        const completedVisitsCount = visitsMap.get(app.id) || 0;

        // Update the application with ALL calculated values
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
          expectedReports: totalExpectedReports,
          expectedVisits: totalExpectedVisits,
          actualReports: submittedReportsCount,
          actualVisits: completedVisitsCount,
        };
      })
    );

    // Process results
    for (const result of updates) {
      if (result.status === 'fulfilled') {
        if (result.value.status === 'skipped') {
          skippedCount++;
        } else {
          results.push({
            id: result.value.id,
            expectedReports: result.value.expectedReports,
            expectedVisits: result.value.expectedVisits,
            actualReports: result.value.actualReports,
            actualVisits: result.value.actualVisits,
          });
          successCount++;
          if (successCount % 100 === 0) {
            console.log(`Progress: ${successCount}/${applications.length} processed...`);
          }
        }
      } else {
        const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`✗ Error:`, errorMessage);
        errorCount++;
      }
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('RECALCULATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Success: ${successCount}`);
  console.log(`Skipped (no dates): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total processed: ${applications.length}`);
  console.log(`Duration: ${duration} seconds`);
  console.log(`Speed: ${(applications.length / parseFloat(duration)).toFixed(0)} records/second`);

  // Show summary statistics
  if (results.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY STATISTICS');
    console.log('='.repeat(70));

    const totalExpectedReports = results.reduce((sum, r) => sum + r.expectedReports, 0);
    const totalExpectedVisits = results.reduce((sum, r) => sum + r.expectedVisits, 0);
    const totalActualReports = results.reduce((sum, r) => sum + r.actualReports, 0);
    const totalActualVisits = results.reduce((sum, r) => sum + r.actualVisits, 0);

    console.log(`Total Expected Reports: ${totalExpectedReports}`);
    console.log(`Total Expected Visits: ${totalExpectedVisits}`);
    console.log(`Total Submitted Reports: ${totalActualReports}`);
    console.log(`Total Completed Visits: ${totalActualVisits}`);

    const reportCompletion = totalExpectedReports > 0
      ? ((totalActualReports / totalExpectedReports) * 100).toFixed(2)
      : '0.00';
    const visitCompletion = totalExpectedVisits > 0
      ? ((totalActualVisits / totalExpectedVisits) * 100).toFixed(2)
      : '0.00';

    console.log(`\nOverall Report Completion: ${reportCompletion}%`);
    console.log(`Overall Visit Completion: ${visitCompletion}%`);

    // Show applications with discrepancies
    const discrepancies = results.filter(
      r => r.actualReports > r.expectedReports || r.actualVisits > r.expectedVisits
    );

    if (discrepancies.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log(`⚠ ATTENTION: ${discrepancies.length} applications have MORE actual than expected:`);
      console.log('='.repeat(70));
      discrepancies.forEach(d => {
        if (d.actualReports > d.expectedReports) {
          console.log(
            `  ${d.id}: Reports ${d.actualReports}/${d.expectedReports} (+${d.actualReports - d.expectedReports})`
          );
        }
        if (d.actualVisits > d.expectedVisits) {
          console.log(
            `  ${d.id}: Visits ${d.actualVisits}/${d.expectedVisits} (+${d.actualVisits - d.expectedVisits})`
          );
        }
      });
    }
  }

  console.log('\n' + '='.repeat(70));
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
