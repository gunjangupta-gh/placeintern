-- Add guestTeacher flag to User
-- Safe for existing data: default false is applied to all existing rows
ALTER TABLE "User"
ADD COLUMN "guestTeacher" BOOLEAN NOT NULL DEFAULT false;
