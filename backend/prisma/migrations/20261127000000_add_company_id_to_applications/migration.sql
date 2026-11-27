-- AlterTable
ALTER TABLE "internship_applications" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE INDEX "internship_applications_companyId_idx" ON "internship_applications"("companyId");

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
