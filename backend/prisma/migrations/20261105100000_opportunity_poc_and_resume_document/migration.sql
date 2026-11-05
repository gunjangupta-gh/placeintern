-- Source of an internship opportunity: institution + faculty point of contact (state-only)
ALTER TABLE "internship_opportunities" ADD COLUMN "institutionName" TEXT;
ALTER TABLE "internship_opportunities" ADD COLUMN "pocName" TEXT;
ALTER TABLE "internship_opportunities" ADD COLUMN "pocPhone" TEXT;

-- Students can upload a resume to their profile
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'RESUME';
