-- Add form-level live window and timer configuration for pre/post test forms
-- Non-destructive additive migration: no existing columns/tables removed.

ALTER TABLE "pre_test_forms"
ADD COLUMN "isLiveWindowEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "liveFrom" TIMESTAMP(3),
ADD COLUMN "liveUntil" TIMESTAMP(3),
ADD COLUMN "enforceTimer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "durationMinutes" INTEGER;

ALTER TABLE "post_test_forms"
ADD COLUMN "isLiveWindowEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "liveFrom" TIMESTAMP(3),
ADD COLUMN "liveUntil" TIMESTAMP(3),
ADD COLUMN "enforceTimer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "durationMinutes" INTEGER;
