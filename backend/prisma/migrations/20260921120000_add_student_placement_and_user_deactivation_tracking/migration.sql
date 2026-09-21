-- Additive-only migration: one new enum, four new nullable columns on "User"
-- (deactivation tracking), and four new columns on "Student" (placement flag).
-- Nothing existing is renamed, retyped, or given a new NOT NULL constraint on
-- top of existing data. "isPlaced" is NOT NULL but carries a DEFAULT false,
-- which Postgres 11+ applies as a metadata-only change (no table rewrite,
-- no risk to existing rows). See PLAN-institution-student-flags.md.

-- CreateEnum
CREATE TYPE "DeactivationReason" AS ENUM ('DROPOUT', 'TRANSFERRED', 'DISCIPLINARY', 'DATA_CLEANUP', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" TEXT,
ADD COLUMN     "deactivationReason" "DeactivationReason",
ADD COLUMN     "deactivationRemarks" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "isPlaced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placedAt" TIMESTAMP(3),
ADD COLUMN     "placedCompany" TEXT,
ADD COLUMN     "placedPackage" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "User_deactivationReason_idx" ON "User"("deactivationReason");

-- CreateIndex
CREATE INDEX "Student_isPlaced_idx" ON "Student"("isPlaced");
