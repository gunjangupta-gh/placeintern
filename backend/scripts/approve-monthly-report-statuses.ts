import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  MonthlyReportStatus,
} from '../src/generated/prisma/client';

const SHOULD_APPLY = process.argv.includes('--apply');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const whereClause = {
      status: {
        in: [MonthlyReportStatus.DRAFT, MonthlyReportStatus.SUBMITTED],
      },
      isDeleted: false,
    };

    const [draftCount, submittedCount, totalCount] = await Promise.all([
      prisma.monthlyReport.count({
        where: { ...whereClause, status: MonthlyReportStatus.DRAFT },
      }),
      prisma.monthlyReport.count({
        where: { ...whereClause, status: MonthlyReportStatus.SUBMITTED },
      }),
      prisma.monthlyReport.count({ where: whereClause }),
    ]);

    console.log('Monthly report status update preview:');
    console.log(`- DRAFT records: ${draftCount}`);
    console.log(`- SUBMITTED records: ${submittedCount}`);
    console.log(`- Total to update: ${totalCount}`);

    if (!SHOULD_APPLY) {
      console.log('Dry run mode: no changes made.');
      console.log('Run with --apply to execute the update.');
      return;
    }

    const now = new Date();

    const result = await prisma.monthlyReport.updateMany({
      where: whereClause,
      data: {
        status: MonthlyReportStatus.APPROVED,
        isApproved: true,
        approvedAt: now,
      },
    });

    console.log(`Successfully updated ${result.count} monthly reports to APPROVED.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to update monthly report statuses:', error);
  process.exit(1);
});
