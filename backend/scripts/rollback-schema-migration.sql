-- Rollback Script for Schema Migration
-- Run this ONLY if migration fails and you need to restore old schema

BEGIN;

-- Re-add deprecated fields
ALTER TABLE "InternshipApplication" ADD COLUMN IF NOT EXISTS "hasJoined" BOOLEAN;
ALTER TABLE "InternshipApplication" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "InternshipApplication" ADD COLUMN IF NOT EXISTS "internshipStatus" TEXT;

-- Restore data from new field to old fields
UPDATE "InternshipApplication"
SET "internshipStatus" = CASE
  WHEN "internshipPhase" = 'ACTIVE' THEN 'ONGOING'
  WHEN "internshipPhase" = 'COMPLETED' THEN 'COMPLETED'
  WHEN "internshipPhase" = 'TERMINATED' THEN 'CANCELLED'
  ELSE NULL
END;

-- Drop new field and enum
ALTER TABLE "InternshipApplication" DROP COLUMN IF EXISTS "internshipPhase";
DROP TYPE IF EXISTS "InternshipPhase";

-- Drop new index
DROP INDEX IF EXISTS "InternshipApplication_internshipPhase_isActive_idx";

COMMIT;
