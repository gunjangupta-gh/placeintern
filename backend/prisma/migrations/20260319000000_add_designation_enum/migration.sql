-- CreateEnum
CREATE TYPE "Designation" AS ENUM (
    'PRINCIPAL',
    'HOD',
    'SENIOR_LECTURER',
    'LECTURER',
    'ASSISTANT_PROFESSOR',
    'FOREMAN_INSTRUCTOR',
    'WORKSHOP_INSTRUCTOR',
    'WORKSHOP_SUPERINTENDENT',
    'WORKSHOP_FOREMAN',
    'LAB_TECHNICIAN',
    'TECHNICIAN',
    'INSTRUCTOR',
    'SYSTEM_ANALYST',
    'SYSTEM_ADMINISTRATOR',
    'SYSTEM_MANAGER',
    'PROGRAMMER',
    'NETWORK_ENGINEER',
    'COMPUTER_OPERATOR',
    'LIBRARIAN',
    'TPO',
    'FASHION_DESIGNER',
    'PEON',
    'OTHER'
);

-- AlterTable: Add designationEnum column to User
ALTER TABLE "User" ADD COLUMN "designationEnum" "Designation";

-- AlterTable: Add targetDesignations column to Training
ALTER TABLE "trainings" ADD COLUMN "targetDesignations" "Designation"[] DEFAULT ARRAY[]::"Designation"[];

-- CreateIndex: Add indexes for performance
CREATE INDEX "User_designationEnum_idx" ON "User"("designationEnum");
CREATE INDEX "User_role_designationEnum_idx" ON "User"("role", "designationEnum");
