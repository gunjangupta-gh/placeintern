import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

interface ParsedArgs {
  fromDate: string;
  dryRun: boolean;
  confirm: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const currentYear = new Date().getFullYear();
  const defaultFromDate = `${currentYear}-04-01`;

  let fromDate = defaultFromDate;
  const fromDateArg = args.find((arg) => arg.startsWith('--from='));
  if (fromDateArg) {
    fromDate = fromDateArg.split('=')[1]?.trim() || defaultFromDate;
  }

  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const confirm = args.includes('--confirm') || args.includes('--yes');

  return { fromDate, dryRun, confirm };
}

function toUtcStartOfDay(dateString: string): Date {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }
  return date;
}

async function main() {
  const { fromDate, dryRun, confirm } = parseArgs();

  const fromDateUtc = toUtcStartOfDay(fromDate);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('='.repeat(80));
    console.log('DELETE TRAINING APPLICATIONS FROM START DATE');
    console.log('='.repeat(80));
    console.log(`From Date (inclusive): ${fromDateUtc.toISOString()}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    const trainings = await prisma.training.findMany({
      where: {
        startDate: {
          gte: fromDateUtc,
        },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    if (!trainings.length) {
      console.log('No trainings found on/after the given date. Nothing to delete.');
      return;
    }

    const trainingIds = trainings.map((training) => training.id);

    const applicationCount = await prisma.trainingApplication.count({
      where: {
        trainingId: {
          in: trainingIds,
        },
      },
    });

    console.log(`Trainings matched: ${trainings.length}`);
    console.log(`Applications matched for deletion: ${applicationCount}`);
    console.log('');

    const preview = trainings.slice(0, 20);
    console.log('Matched Trainings (first 20):');
    preview.forEach((training, index) => {
      console.log(
        `${index + 1}. ${training.title} | ${training.startDate.toISOString().slice(0, 10)} | ${training.id}`,
      );
    });

    if (trainings.length > preview.length) {
      console.log(`... and ${trainings.length - preview.length} more training records`);
    }

    console.log('');

    if (dryRun) {
      console.log('DRY RUN completed. No data was deleted.');
      return;
    }

    if (!confirm) {
      console.log('Safety stop: live deletion requires --confirm (or --yes).');
      console.log('Example: npm run db:delete-training-applications -- --from=2026-04-01 --confirm');
      return;
    }

    const deleteResult = await prisma.trainingApplication.deleteMany({
      where: {
        trainingId: {
          in: trainingIds,
        },
      },
    });

    console.log(`Deleted applications: ${deleteResult.count}`);
    console.log('Completed successfully.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
