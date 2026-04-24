-- CreateEnum
CREATE TYPE "ScholarshipCategory" AS ENUM ('FWS', 'PMS', 'CMS');

-- CreateTable
CREATE TABLE "scholarships" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ScholarshipCategory" NOT NULL,
    "cmsPercent" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scholarships_code_key" ON "scholarships"("code");

-- CreateIndex
CREATE INDEX "scholarships_category_idx" ON "scholarships"("category");

-- CreateIndex
CREATE INDEX "scholarships_isActive_idx" ON "scholarships"("isActive");
