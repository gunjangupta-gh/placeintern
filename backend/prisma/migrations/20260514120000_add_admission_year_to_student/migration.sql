-- Add admissionYear column to Student table
-- This column stores the year of admission (e.g., 2025) and is used to calculate currentYear and currentSemester

-- Step 1: Add the admissionYear column (nullable initially for migration)
ALTER TABLE "Student" ADD COLUMN "admissionYear" INTEGER;

-- Step 2: Update existing students to year 3, semester 6 (as per requirement)
UPDATE "Student"
SET "currentYear" = 3,
    "currentSemester" = 6;

-- Step 3: Calculate admissionYear for existing students
-- Logic: If they are in year 3 now, they were admitted 2 years ago
-- Academic year starts in July, so:
-- - If current month >= 7 (July), academic year = current year
-- - If current month < 7, academic year = current year - 1
-- For year 3 students, admissionYear = currentAcademicYear - 2
UPDATE "Student"
SET "admissionYear" = (
    CASE
        WHEN EXTRACT(MONTH FROM NOW()) >= 7 THEN EXTRACT(YEAR FROM NOW())::INTEGER - 2
        ELSE EXTRACT(YEAR FROM NOW())::INTEGER - 3
    END
)
WHERE "admissionYear" IS NULL;

-- Step 4: Create index on admissionYear for efficient cron job queries
CREATE INDEX "Student_admissionYear_idx" ON "Student"("admissionYear");
