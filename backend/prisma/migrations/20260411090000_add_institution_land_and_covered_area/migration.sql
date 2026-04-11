-- CreateEnum
CREATE TYPE "LandOwnershipType" AS ENUM ('OWNED', 'LEASED', 'GOVERNMENT_ALLOTTED', 'PPP', 'OTHER');

-- CreateEnum
CREATE TYPE "CoveredAreaEntityType" AS ENUM ('LECTURE_ROOMS', 'LABS', 'WORKSHOPS', 'COMMON_AREA', 'OTHERS');

-- AlterTable
ALTER TABLE "Institution"
ADD COLUMN "gpsMapLink" TEXT,
ADD COLUMN "hasLandDispute" BOOLEAN,
ADD COLUMN "landOwnership" "LandOwnershipType",
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "totalLandAcres" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "dateOfJoining" TIMESTAMP(3),
ADD COLUMN "qualification" TEXT;

-- CreateTable
CREATE TABLE "institution_covered_areas" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityType" "CoveredAreaEntityType" NOT NULL,
    "numberOfRooms" INTEGER,
    "requiredAreaSqFt" DOUBLE PRECISION,
    "availableAreaSqFt" DOUBLE PRECISION,
    "additionalRequirementSqFt" DOUBLE PRECISION,
    "declaredUnsafeAreaSqFt" DOUBLE PRECISION,
    "lastMajorRepairDate" TIMESTAMP(3),
    "futureExpansionScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_covered_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_dateOfJoining_idx" ON "User"("dateOfJoining");

-- CreateIndex
CREATE INDEX "Institution_landOwnership_idx" ON "Institution"("landOwnership");

-- CreateIndex
CREATE UNIQUE INDEX "institution_covered_areas_institutionId_entityType_key" ON "institution_covered_areas"("institutionId", "entityType");

-- CreateIndex
CREATE INDEX "institution_covered_areas_institutionId_idx" ON "institution_covered_areas"("institutionId");

-- CreateIndex
CREATE INDEX "institution_covered_areas_entityType_idx" ON "institution_covered_areas"("entityType");

-- AddForeignKey
ALTER TABLE "institution_covered_areas" ADD CONSTRAINT "institution_covered_areas_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
