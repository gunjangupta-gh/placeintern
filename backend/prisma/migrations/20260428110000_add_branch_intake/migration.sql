-- CreateTable
CREATE TABLE "branch_intakes" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchId" TEXT,
    "academicYear" TEXT NOT NULL,
    "sanctionedSeats" INTEGER NOT NULL DEFAULT 0,
    "feeWaiverSeats" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_intakes_institutionId_branchId_academicYear_key" ON "branch_intakes"("institutionId", "branchId", "academicYear");

-- CreateIndex
CREATE INDEX "branch_intakes_institutionId_idx" ON "branch_intakes"("institutionId");

-- CreateIndex
CREATE INDEX "branch_intakes_branchId_idx" ON "branch_intakes"("branchId");

-- CreateIndex
CREATE INDEX "branch_intakes_academicYear_idx" ON "branch_intakes"("academicYear");

-- AddForeignKey
ALTER TABLE "branch_intakes" ADD CONSTRAINT "branch_intakes_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_intakes" ADD CONSTRAINT "branch_intakes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_intakes" ADD CONSTRAINT "branch_intakes_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;