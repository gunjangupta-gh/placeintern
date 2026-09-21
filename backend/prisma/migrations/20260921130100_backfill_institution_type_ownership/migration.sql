-- Data backfill (no schema change): moves existing "Institution" rows off the
-- legacy, ownership-less POLYTECHNIC/ITI values onto their Government
-- equivalent, since every institution in this program is currently believed
-- to be government-run. This does not delete or lose any row - it only
-- updates the `type` column value; every other column is untouched.
--
-- If any institution is actually Government-Aided or Private, correct it via
-- the Edit Institution screen after this runs (Institution Type dropdown now
-- offers GOVT_AIDED_* / PRIVATE_* options). See PLAN-institution-student-flags.md.
--
-- Must run in a separate transaction AFTER the enum values were added
-- (previous migration), per Postgres's "new enum value not yet committed"
-- restriction.

UPDATE "Institution" SET "type" = 'GOVT_POLYTECHNIC' WHERE "type" = 'POLYTECHNIC';
UPDATE "Institution" SET "type" = 'GOVT_ITI' WHERE "type" = 'ITI';

-- New institutions created without an explicit type used to default to the
-- now-legacy POLYTECHNIC; point the column default at its Government
-- equivalent instead (metadata-only change, does not touch existing rows).
ALTER TABLE "Institution" ALTER COLUMN "type" SET DEFAULT 'GOVT_POLYTECHNIC';
