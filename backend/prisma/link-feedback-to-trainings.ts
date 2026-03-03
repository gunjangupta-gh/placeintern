import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('=== Linking Feedback Form to All Trainings ===\n');

  // Find the Faculty Training Feedback Form
  const feedbackForm = await prisma.feedbackForm.findFirst({
    where: {
      title: 'Faculty Training Feedback',
      purpose: 'TRAINING',
    },
    select: { id: true, title: true },
  });

  if (!feedbackForm) {
    console.error('❌ Faculty Training Feedback Form not found!');
    console.error('Please run: npm run seed:faculty-training-feedback');
    process.exit(1);
  }

  console.log(`✓ Found Feedback Form: "${feedbackForm.title}"`);
  console.log(`  ID: ${feedbackForm.id}\n`);

  // Get all trainings without feedback form
  const trainingsWithoutForm = await prisma.training.findMany({
    where: {
      feedbackFormId: null,
    },
    select: { id: true, title: true },
  });

  console.log(`Found ${trainingsWithoutForm.length} trainings without feedback form\n`);

  if (trainingsWithoutForm.length === 0) {
    console.log('✓ All trainings already have feedback forms linked!');
    return;
  }

  // Update all trainings
  let updated = 0;
  let failed = 0;

  for (const training of trainingsWithoutForm) {
    try {
      await prisma.training.update({
        where: { id: training.id },
        data: { feedbackFormId: feedbackForm.id },
      });
      console.log(`✓ Linked: ${training.title}`);
      updated++;
    } catch (error) {
      console.error(`✗ Failed to link: ${training.title}`);
      console.error(`  Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✓ Successfully linked: ${updated} trainings`);
  if (failed > 0) {
    console.log(`✗ Failed to link: ${failed} trainings`);
  }
  console.log('================\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
