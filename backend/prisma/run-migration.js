const { PrismaClient } = require('../src/generated/prisma');

async function runMigration() {
  const prisma = new PrismaClient();

  console.log('Starting migration...');

  try {
    // Step 1: Add observationsAboutIndustry column if it doesn't exist
    console.log('Adding observationsAboutIndustry column...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'principal_feedbacks'
          AND column_name = 'observationsAboutIndustry'
        ) THEN
          ALTER TABLE public.principal_feedbacks
          ADD COLUMN "observationsAboutIndustry" text;
        END IF;
      END $$;
    `);
    console.log('✓ observationsAboutIndustry column added/exists');

    // Step 2: Copy data from feedbackSharedWithStudent if it exists
    console.log('Copying data from feedbackSharedWithStudent (if exists)...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'principal_feedbacks'
          AND column_name = 'feedbackSharedWithStudent'
        ) THEN
          UPDATE public.principal_feedbacks
          SET "observationsAboutIndustry" = "feedbackSharedWithStudent"
          WHERE "observationsAboutIndustry" IS NULL
          AND "feedbackSharedWithStudent" IS NOT NULL;
        END IF;
      END $$;
    `);
    console.log('✓ Data copied (if applicable)');

    // Step 3: Add isPresent column to principal_feedback_students if it doesn't exist
    console.log('Adding isPresent column to principal_feedback_students...');
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'principal_feedback_students'
          AND column_name = 'isPresent'
        ) THEN
          ALTER TABLE public.principal_feedback_students
          ADD COLUMN "isPresent" boolean NOT NULL DEFAULT true;
        END IF;
      END $$;
    `);
    console.log('✓ isPresent column added/exists');

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
