-- AlterTable
ALTER TABLE "Student"
ADD COLUMN "scholarshipId" TEXT;

-- CreateIndex
CREATE INDEX "Student_scholarshipId_idx" ON "Student"("scholarshipId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_scholarshipId_fkey"
FOREIGN KEY ("scholarshipId") REFERENCES "scholarships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
