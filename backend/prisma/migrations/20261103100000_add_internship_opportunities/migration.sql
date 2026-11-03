-- Additive-only migration: new enum, two new tables, one nullable column on internship_applications.
-- No existing column is renamed, retyped, or given a NOT NULL/default constraint.
-- The (studentId, opportunityId) unique index is safe: opportunityId is NULL on all existing rows and NULLs are distinct.

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FILLED');

-- AlterTable
ALTER TABLE "internship_applications" ADD COLUMN     "opportunityId" TEXT;

-- CreateTable
CREATE TABLE "internship_opportunities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "district" TEXT,
    "positions" INTEGER NOT NULL,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleYears" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "durationMonths" INTEGER NOT NULL,
    "stipend" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "importBatchId" TEXT,
    "createdById" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_branches" (
    "opportunityId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "opportunity_branches_pkey" PRIMARY KEY ("opportunityId","branchId")
);

-- CreateIndex
CREATE INDEX "internship_opportunities_status_applicationDeadline_idx" ON "internship_opportunities"("status", "applicationDeadline");

-- CreateIndex
CREATE INDEX "internship_opportunities_companyId_idx" ON "internship_opportunities"("companyId");

-- CreateIndex
CREATE INDEX "internship_opportunities_importBatchId_idx" ON "internship_opportunities"("importBatchId");

-- CreateIndex
CREATE INDEX "internship_opportunities_isDeleted_status_idx" ON "internship_opportunities"("isDeleted", "status");

-- CreateIndex
CREATE INDEX "opportunity_branches_branchId_idx" ON "opportunity_branches"("branchId");

-- CreateIndex
CREATE INDEX "internship_applications_opportunityId_status_idx" ON "internship_applications"("opportunityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "internship_applications_studentId_opportunityId_key" ON "internship_applications"("studentId", "opportunityId");

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "internship_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_opportunities" ADD CONSTRAINT "internship_opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_branches" ADD CONSTRAINT "opportunity_branches_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "internship_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_branches" ADD CONSTRAINT "opportunity_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
