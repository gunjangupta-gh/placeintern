-- Additive-only migration: new table + two nullable columns on an existing table.
-- Nothing existing is renamed, retyped, or given a new NOT NULL/default constraint.
-- See tpo-internship-report-plan.md ("Production safety") for the full reasoning.

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'DROPPED_OUT');

-- CreateEnum
CREATE TYPE "InternshipMode" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterTable (nullable columns, no default — metadata-only on Postgres 11+)
ALTER TABLE "companies" ADD COLUMN     "industrySector" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "internship_reports" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "companyName" TEXT NOT NULL,
    "organizationWebsite" TEXT,
    "modeOfInternship" "InternshipMode",
    "industrySector" TEXT,
    "isWorkInPunjab" BOOLEAN,
    "workDistrict" TEXT,
    "workState" TEXT,
    "hrName" TEXT,
    "hrPhoneNumber" TEXT,
    "isStipendOffered" BOOLEAN,
    "stipendAmountPerMonth" DOUBLE PRECISION,
    "isOfferLetterReceived" BOOLEAN,
    "offerLetterUrl" TEXT,
    "facultyMentorId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internship_reports_institutionId_idx" ON "internship_reports"("institutionId");

-- CreateIndex
CREATE INDEX "internship_reports_studentId_idx" ON "internship_reports"("studentId");

-- CreateIndex
CREATE INDEX "internship_reports_facultyMentorId_idx" ON "internship_reports"("facultyMentorId");

-- AddForeignKey
ALTER TABLE "internship_reports" ADD CONSTRAINT "internship_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_reports" ADD CONSTRAINT "internship_reports_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_reports" ADD CONSTRAINT "internship_reports_facultyMentorId_fkey" FOREIGN KEY ("facultyMentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
