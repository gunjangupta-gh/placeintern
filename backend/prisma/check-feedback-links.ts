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
  console.log('=== Checking Feedback Form Links ===\n');

  // Get feedback form
  const feedbackForm = await prisma.feedbackForm.findFirst({
    where: {
      title: 'Faculty Training Feedback',
      purpose: 'TRAINING',
    },
    select: { id: true, title: true },
  });

  if (!feedbackForm) {
    console.error('❌ Feedback form not found!');
    return;
  }

  console.log(`✓ Feedback Form: "${feedbackForm.title}"`);
  console.log(`  ID: ${feedbackForm.id}\n`);

  // Get all trainings
  const totalTrainings = await prisma.training.count();
  const trainingsWithForm = await prisma.training.count({
    where: { feedbackFormId: feedbackForm.id },
  });
  const trainingsWithoutForm = await prisma.training.count({
    where: { feedbackFormId: null },
  });

  console.log('=== Training Statistics ===');
  console.log(`Total trainings: ${totalTrainings}`);
  console.log(`With feedback form: ${trainingsWithForm}`);
  console.log(`Without feedback form: ${trainingsWithoutForm}\n`);

  // Show some examples
  const examples = await prisma.training.findMany({
    take: 5,
    select: {
      id: true,
      title: true,
      feedbackFormId: true,
      feedbackForm: {
        select: { title: true },
      },
    },
  });

  console.log('=== Sample Trainings ===');
  examples.forEach((training, i) => {
    console.log(`${i + 1}. ${training.title}`);
    console.log(`   Feedback Form: ${training.feedbackForm?.title || '❌ Not linked'}`);
  });

  console.log('\n=== Check Complete ===\n');
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
