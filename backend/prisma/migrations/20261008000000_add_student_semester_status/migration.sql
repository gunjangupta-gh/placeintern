-- Semester-wise result status (see PLAN-semester-wise-clearance.md).
-- Additive: one new enum and one new table. The only change to existing data is the
-- backfill at the bottom, which moves the legacy final-exam clearance values
-- (APPEARED / PASSED on "Student"."clearanceStatus") onto a semester 6 row and resets the
-- overall clearance to PENDING. Reversible: the inverse is
--   UPDATE "Student" s SET "clearanceStatus" = CASE x.status WHEN 'PASSED' THEN 'PASSED' ELSE 'APPEARED' END
--   FROM student_semester_statuses x WHERE x."studentId" = s.id AND x.semester = 6 AND x.remarks = 'Migrated from overall clearance status';

-- CreateEnum
CREATE TYPE "SemesterResultStatus" AS ENUM ('PENDING', 'APPEARED', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "student_semester_statuses" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT,
    "status" "SemesterResultStatus" NOT NULL DEFAULT 'PENDING',
    "backlogCount" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_semester_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_semester_statuses_studentId_semester_key" ON "student_semester_statuses"("studentId", "semester");

-- CreateIndex
CREATE INDEX "student_semester_statuses_semester_status_idx" ON "student_semester_statuses"("semester", "status");

-- AddForeignKey
ALTER TABLE "student_semester_statuses" ADD CONSTRAINT "student_semester_statuses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: legacy final-exam clearance values -> semester 6 row
INSERT INTO "student_semester_statuses" ("id", "studentId", "semester", "status", "remarks", "updatedAt")
SELECT gen_random_uuid()::text,
       s."id",
       6,
       CASE s."clearanceStatus" WHEN 'PASSED' THEN 'PASSED'::"SemesterResultStatus" ELSE 'APPEARED'::"SemesterResultStatus" END,
       'Migrated from overall clearance status',
       CURRENT_TIMESTAMP
FROM "Student" s
WHERE s."clearanceStatus" IN ('APPEARED', 'PASSED')
ON CONFLICT ("studentId", "semester") DO NOTHING;

UPDATE "Student" SET "clearanceStatus" = 'PENDING' WHERE "clearanceStatus" IN ('APPEARED', 'PASSED');
