import {
  PrismaClient,
  TrainingApplicationStatus,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// Cutoff date - can be customized via environment variable or defaults to March 30, 2026
const DEFAULT_CUTOFF = '2026-03-30T23:59:59.999Z';
const CUTOFF_DATE_ARG = args.find(arg => arg.startsWith('--cutoff='));
const CUTOFF_DATE_STR = CUTOFF_DATE_ARG
  ? CUTOFF_DATE_ARG.split('=')[1]
  : process.env.ATTENDANCE_CUTOFF_DATE || DEFAULT_CUTOFF;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

/**
 * Get all dates between startDate and endDate (inclusive)
 */
function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);

  // Normalize to start of day in UTC
  currentDate.setUTCHours(0, 0, 0, 0);

  const endNormalized = new Date(endDate);
  endNormalized.setUTCHours(0, 0, 0, 0);

  while (currentDate <= endNormalized) {
    dates.push(new Date(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Main function to mark attendance for all past trainings
 */
async function markPastTrainingAttendance() {
  const cutoffDate = new Date(CUTOFF_DATE_STR);

  console.log('='.repeat(70));
  console.log('MARK ATTENDANCE FOR PAST TRAININGS');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Mode: ${DRY_RUN ? '*** DRY RUN (No changes will be made) ***' : 'LIVE'}`);
  console.log(`Verbose: ${VERBOSE ? 'ON' : 'OFF'}`);
  console.log(`Cutoff Date: ${cutoffDate.toDateString()} (Trainings ending before this date)`);
  console.log('');

  // Find all trainings that ended before the cutoff date
  const trainingsBeforeCutoff = await prisma.training.findMany({
    where: {
      endDate: {
        lt: cutoffDate,
      },
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      venue: true,
      city: true,
    },
    orderBy: {
      endDate: 'desc',
    },
  });

  console.log(`Found ${trainingsBeforeCutoff.length} training(s) that ended before ${cutoffDate.toDateString()}`);
  console.log('');

  if (trainingsBeforeCutoff.length === 0) {
    console.log('No trainings found before the cutoff date. Nothing to do.');
    return;
  }

  // Statistics
  let totalTrainingsProcessed = 0;
  let totalApplicationsProcessed = 0;
  let totalAttendanceCreated = 0;
  let totalAttendanceSkipped = 0;

  for (const training of trainingsBeforeCutoff) {
    console.log('-'.repeat(70));
    console.log(`Training: ${training.title}`);
    console.log(`  Period: ${training.startDate.toDateString()} - ${training.endDate.toDateString()}`);
    console.log(`  Location: ${training.venue || training.city || 'Not specified'}`);

    // Find all APPROVED applications for this training
    const approvedApplications = await prisma.trainingApplication.findMany({
      where: {
        trainingId: training.id,
        status: TrainingApplicationStatus.APPROVED,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            institutionId: true,
            Institution: {
              select: {
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
    });

    console.log(`  Approved Applications: ${approvedApplications.length}`);

    if (approvedApplications.length === 0) {
      console.log('  -> No approved applications. Skipping.');
      continue;
    }

    totalTrainingsProcessed++;

    // Generate all training dates
    const trainingDates = getDatesBetween(training.startDate, training.endDate);
    console.log(`  Training Duration: ${trainingDates.length} day(s)`);

    let trainingAttendanceCreated = 0;
    let trainingAttendanceSkipped = 0;

    for (const application of approvedApplications) {
      totalApplicationsProcessed++;
      let userAttendanceCreated = 0;
      let userAttendanceSkipped = 0;

      for (const attendanceDate of trainingDates) {
        // Check if attendance already exists
        const existingAttendance = await prisma.trainingAttendance.findUnique({
          where: {
            userId_trainingId_attendanceDate: {
              userId: application.userId,
              trainingId: training.id,
              attendanceDate: attendanceDate,
            },
          },
        });

        if (existingAttendance) {
          userAttendanceSkipped++;
          trainingAttendanceSkipped++;
          totalAttendanceSkipped++;
          continue;
        }

        if (!DRY_RUN) {
          // Create attendance record
          await prisma.trainingAttendance.create({
            data: {
              userId: application.userId,
              trainingId: training.id,
              attendanceDate: attendanceDate,
              markedAt: new Date(),
              markedById: null, // System-generated (bulk marking)
              latitude: null,
              longitude: null,
              locationAddress: training.venue || training.city || 'Auto-marked for past training',
              ipAddress: null,
              userAgent: 'seed-mark-past-attendance',
            },
          });
        }

        userAttendanceCreated++;
        trainingAttendanceCreated++;
        totalAttendanceCreated++;
      }

      if (VERBOSE) {
        const institution = application.user.Institution?.shortName || application.user.Institution?.name || 'Unknown';
        console.log(`    [${DRY_RUN ? 'DRY' : 'OK'}] ${application.user.name} (${institution})`);
        console.log(`        Created: ${userAttendanceCreated}, Skipped: ${userAttendanceSkipped}`);
      }
    }

    console.log(`  -> Attendance Created: ${trainingAttendanceCreated}, Already Exists: ${trainingAttendanceSkipped}`);
  }

  // Summary
  console.log('');
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Trainings Processed: ${totalTrainingsProcessed}`);
  console.log(`Applications Processed: ${totalApplicationsProcessed}`);
  console.log(`Attendance Records Created: ${totalAttendanceCreated}`);
  console.log(`Attendance Records Skipped (already exist): ${totalAttendanceSkipped}`);
  console.log('');

  if (DRY_RUN) {
    console.log('*** DRY RUN COMPLETE - No changes were made to the database ***');
    console.log('Run without --dry-run flag to apply changes.');
  } else {
    console.log('Attendance marking completed successfully!');
  }

  console.log('');
  console.log('='.repeat(70));
}

// Main execution
async function main() {
  console.log('');
  console.log('Starting seed-mark-past-attendance script...');
  console.log('');

  try {
    await markPastTrainingAttendance();
  } catch (error) {
    console.error('Error during attendance marking:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
