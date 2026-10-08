-- Additive-only migration: a brand new table, nothing existing is altered.
-- Course (branch) wise infrastructure; NULL = "not yet filled in".

-- CreateTable
CREATE TABLE "branch_infrastructure" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "entityType" "CoveredAreaEntityType" NOT NULL,
    "numberOfRooms" INTEGER,
    "furnitureAvailable" BOOLEAN,
    "smartBoardsCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_infrastructure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_infrastructure_institutionId_idx" ON "branch_infrastructure"("institutionId");

-- CreateIndex
CREATE INDEX "branch_infrastructure_branchId_idx" ON "branch_infrastructure"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_infrastructure_institutionId_branchId_entityType_key" ON "branch_infrastructure"("institutionId", "branchId", "entityType");

-- AddForeignKey
ALTER TABLE "branch_infrastructure" ADD CONSTRAINT "branch_infrastructure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_infrastructure" ADD CONSTRAINT "branch_infrastructure_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
