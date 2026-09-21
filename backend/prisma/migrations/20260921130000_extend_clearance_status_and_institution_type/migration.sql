-- Additive-only migration: new enum values only. Nothing existing is renamed,
-- retyped, or removed - old rows keep whatever value they already have.
--
-- IMPORTANT: a newly added enum value cannot be used (e.g. in an UPDATE) in
-- the same transaction that adds it (Postgres restriction, still true on PG12+).
-- The data backfill that uses these new InstitutionType values therefore
-- lives in the NEXT migration, so it runs after this one has committed.

-- AlterEnum: Add APPEARED/PASSED to ClearanceStatus (final-exam status for
-- final-year students; the existing PENDING/CLEARED/HOLD/REJECTED values and
-- all existing rows are untouched)
ALTER TYPE "ClearanceStatus" ADD VALUE 'APPEARED';
ALTER TYPE "ClearanceStatus" ADD VALUE 'PASSED';

-- AlterEnum: Add ownership-aware InstitutionType values. The legacy
-- POLYTECHNIC/ITI values are NOT removed here (see next migration for the
-- backfill that moves existing rows off of them); ENGINEERING_COLLEGE,
-- UNIVERSITY, DEGREE_COLLEGE, SKILL_CENTER are untouched.
ALTER TYPE "InstitutionType" ADD VALUE 'GOVT_POLYTECHNIC';
ALTER TYPE "InstitutionType" ADD VALUE 'GOVT_AIDED_POLYTECHNIC';
ALTER TYPE "InstitutionType" ADD VALUE 'PRIVATE_POLYTECHNIC';
ALTER TYPE "InstitutionType" ADD VALUE 'GOVT_ITI';
ALTER TYPE "InstitutionType" ADD VALUE 'GOVT_AIDED_ITI';
ALTER TYPE "InstitutionType" ADD VALUE 'PRIVATE_ITI';
ALTER TYPE "InstitutionType" ADD VALUE 'GOVT_SPECIAL_TRADE_INSTITUTE';
ALTER TYPE "InstitutionType" ADD VALUE 'GOVT_AIDED_SPECIAL_TRADE_INSTITUTE';
ALTER TYPE "InstitutionType" ADD VALUE 'PRIVATE_SPECIAL_TRADE_INSTITUTE';
