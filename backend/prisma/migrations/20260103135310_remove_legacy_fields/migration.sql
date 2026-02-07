-- =============================================
-- MIGRATION: Remove Legacy Fields and Add InternshipPhase
-- Description: This migration removes deprecated fields (hasJoined, reviewedBy, internshipStatus)
--              and introduces a new InternshipPhase enum for better internship lifecycle tracking
-- =============================================

-- Step 1: Create InternshipPhase enum
-- =============================================
-- Define the new enum type for tracking internship phases
CREATE TYPE "InternshipPhase" AS ENUM ('NOT_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED');

-- Step 2: Add new internshipPhase field with default value
-- =============================================
-- Add the new column with a default value to ensure all existing records have a valid phase
ALTER TABLE "internship_applications"
ADD COLUMN "internshipPhase" "InternshipPhase" NOT NULL DEFAULT 'NOT_STARTED';

-- Ensure isActive exists (older schemas may not have it)
ALTER TABLE "internship_applications"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Step 3: Data Migration - Map old internshipStatus to new internshipPhase
-- =============================================
-- Migrate existing data from internshipStatus to internshipPhase
-- This ensures no data is lost during the transition

-- Update based on internshipStatus field
UPDATE "internship_applications"
SET "internshipPhase" = CASE
  -- Map ONGOING and IN_PROGRESS to ACTIVE
  WHEN "internshipStatus" IN ('ONGOING', 'IN_PROGRESS') THEN 'ACTIVE'::"InternshipPhase"

  -- Map COMPLETED status
  WHEN "internshipStatus" = 'COMPLETED' THEN 'COMPLETED'::"InternshipPhase"

  -- Map CANCELLED or TERMINATED to TERMINATED
  WHEN "internshipStatus" IN ('CANCELLED', 'TERMINATED') THEN 'TERMINATED'::"InternshipPhase"

  -- If startDate exists and is in the past, consider it ACTIVE
  WHEN "startDate" IS NOT NULL AND "startDate" <= NOW() AND "endDate" IS NULL THEN 'ACTIVE'::"InternshipPhase"

  -- If endDate exists and is in the past, consider it COMPLETED
  WHEN "endDate" IS NOT NULL AND "endDate" <= NOW() THEN 'COMPLETED'::"InternshipPhase"

  -- Default to NOT_STARTED for any other cases
  ELSE 'NOT_STARTED'::"InternshipPhase"
END
WHERE "internshipStatus" IS NOT NULL;

-- Step 4: Handle JOINED status applications
-- =============================================
-- For applications with status JOINED but no clear internshipPhase, set to ACTIVE
UPDATE "internship_applications"
SET "internshipPhase" = 'ACTIVE'::"InternshipPhase"
WHERE "status" = 'JOINED'
  AND "internshipPhase" = 'NOT_STARTED'
  AND ("internshipStatus" IS NULL OR "internshipStatus" = '');

-- Step 5: Handle applications with joiningDate but no clear phase
-- =============================================
-- If student has joined (joiningDate exists) but phase is still NOT_STARTED, set to ACTIVE
UPDATE "internship_applications"
SET "internshipPhase" = 'ACTIVE'::"InternshipPhase"
WHERE "joiningDate" IS NOT NULL
  AND "internshipPhase" = 'NOT_STARTED';

-- Step 6: Handle completed applications
-- =============================================
-- If completionDate exists, set phase to COMPLETED
UPDATE "internship_applications"
SET "internshipPhase" = 'COMPLETED'::"InternshipPhase"
WHERE "completionDate" IS NOT NULL;

-- Step 7: Validation check (optional, for debugging)
-- =============================================
-- This comment documents the expected distribution after migration
-- You can uncomment and run these queries separately to verify:
-- SELECT "internshipPhase", COUNT(*) as count
-- FROM "InternshipApplication"
-- GROUP BY "internshipPhase";

-- Step 8: Drop old deprecated fields
-- =============================================
-- Remove hasJoined field if it exists
-- Using IF EXISTS to prevent errors if the column was already removed
ALTER TABLE "internship_applications"
DROP COLUMN IF EXISTS "hasJoined";

-- Remove reviewedBy field from InternshipApplication
-- Note: reviewedBy might be used in other tables, we only remove from InternshipApplication
ALTER TABLE "internship_applications"
DROP COLUMN IF EXISTS "reviewedBy";

-- Remove internshipStatus field (replaced by internshipPhase)
ALTER TABLE "internship_applications"
DROP COLUMN IF EXISTS "internshipStatus";

-- Step 9: Create performance indexes
-- =============================================
-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS "InternshipApplication_internshipPhase_idx"
ON "internship_applications"("internshipPhase");

-- Add composite index for filtering active applications
CREATE INDEX IF NOT EXISTS "InternshipApplication_internshipPhase_isActive_idx"
ON "internship_applications"("internshipPhase", "isActive");

-- Add composite index for student-phase queries
CREATE INDEX IF NOT EXISTS "InternshipApplication_studentId_internshipPhase_idx"
ON "internship_applications"("studentId", "internshipPhase");

-- Add composite index for status-phase queries (common filtering pattern)
CREATE INDEX IF NOT EXISTS "InternshipApplication_status_internshipPhase_idx"
ON "internship_applications"("status", "internshipPhase");

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- Summary:
-- 1. Created InternshipPhase enum with 4 states
-- 2. Added internshipPhase column with default NOT_STARTED
-- 3. Migrated all existing data from old fields to new field
-- 4. Dropped deprecated columns (hasJoined, reviewedBy, internshipStatus)
-- 5. Created performance indexes for common query patterns
--
-- Rollback Strategy (if needed):
-- This migration is NOT backward compatible by design.
-- If rollback is required, you'll need to:
-- 1. Re-add the dropped columns
-- 2. Migrate data back from internshipPhase
-- 3. Drop the InternshipPhase enum and column
-- =============================================
