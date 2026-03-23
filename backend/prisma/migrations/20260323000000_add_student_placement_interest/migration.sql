-- CreateEnum
CREATE TYPE "PlanAfterDiploma" AS ENUM ('PRIVATE_JOB', 'BTECH', 'GOVT_JOB_PREPARATION');

-- CreateEnum
CREATE TYPE "JobLocationPreference" AS ENUM ('WITHIN_DISTRICT', 'ANYWHERE_IN_PUNJAB');

-- CreateEnum
CREATE TYPE "ExpectedSalaryRange" AS ENUM ('RANGE_10K_15K', 'RANGE_15K_20K', 'RANGE_20K_PLUS');

-- CreateTable
CREATE TABLE "student_placement_interests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "planAfterDiploma" "PlanAfterDiploma" NOT NULL,
    "interestedForPrivateJob" "JobLocationPreference",
    "expectedSalary" "ExpectedSalaryRange",
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_placement_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_placement_interests_studentId_key" ON "student_placement_interests"("studentId");

-- CreateIndex
CREATE INDEX "student_placement_interests_studentId_idx" ON "student_placement_interests"("studentId");

-- AddForeignKey
ALTER TABLE "student_placement_interests" ADD CONSTRAINT "student_placement_interests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
