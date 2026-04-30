-- CreateTable
CREATE TABLE "branch_staff_capacities" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "sanctionedPosts" INTEGER NOT NULL DEFAULT 0,
    "filledPosts" INTEGER NOT NULL DEFAULT 0,
    "guestFaculty" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_staff_capacities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_staff_capacities_institutionId_branchId_academicYear_key" ON "branch_staff_capacities"("institutionId", "branchId", "academicYear");

-- CreateIndex
CREATE INDEX "branch_staff_capacities_institutionId_idx" ON "branch_staff_capacities"("institutionId");

-- CreateIndex
CREATE INDEX "branch_staff_capacities_branchId_idx" ON "branch_staff_capacities"("branchId");

-- CreateIndex
CREATE INDEX "branch_staff_capacities_academicYear_idx" ON "branch_staff_capacities"("academicYear");

-- AddForeignKey
ALTER TABLE "branch_staff_capacities" ADD CONSTRAINT "branch_staff_capacities_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_staff_capacities" ADD CONSTRAINT "branch_staff_capacities_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
