-- CreateEnum
CREATE TYPE "InternshipCompensationType" AS ENUM ('WITH_STIPEND', 'WITHOUT_STIPEND', 'PAID_BY_STUDENT');

-- AlterTable
ALTER TABLE "internship_applications"
  ADD COLUMN "internshipType" "InternshipCompensationType",
  ADD COLUMN "studentFeeAmount" DOUBLE PRECISION;

-- Backfill from the old "paid / free" convention: a stipend above 0 meant paid, an explicit 0 meant free.
-- Rows with no stipend recorded stay NULL so they surface as incomplete data.
UPDATE "internship_applications"
SET "internshipType" = 'WITH_STIPEND'
WHERE "isSelfIdentified" = true
  AND "stipend" ~ '^[0-9]+(\.[0-9]+)?$'
  AND "stipend"::numeric > 0;

UPDATE "internship_applications"
SET "internshipType" = 'WITHOUT_STIPEND'
WHERE "isSelfIdentified" = true
  AND "stipend" ~ '^[0-9]+(\.[0-9]+)?$'
  AND "stipend"::numeric = 0;

-- CreateIndex
CREATE INDEX "internship_applications_internshipType_idx" ON "internship_applications"("internshipType");
