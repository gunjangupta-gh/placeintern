-- Migration: Add observationsAboutIndustry and isPresent columns
-- Run this manually to avoid data loss

-- Step 1: Add observationsAboutIndustry column to principal_feedbacks (if not exists)
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

-- Step 2: Copy data from feedbackSharedWithStudent to observationsAboutIndustry (if old column exists)
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

-- Step 3: Drop the old feedbackSharedWithStudent column (optional - uncomment if you want to remove it)
-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_name = 'principal_feedbacks'
--     AND column_name = 'feedbackSharedWithStudent'
--   ) THEN
--     ALTER TABLE public.principal_feedbacks
--     DROP COLUMN "feedbackSharedWithStudent";
--   END IF;
-- END $$;

-- Step 4: Add isPresent column to principal_feedback_students (if not exists)
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

-- Verify the changes
SELECT 'principal_feedbacks columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'principal_feedbacks'
ORDER BY ordinal_position;

SELECT 'principal_feedback_students columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'principal_feedback_students'
ORDER BY ordinal_position;
