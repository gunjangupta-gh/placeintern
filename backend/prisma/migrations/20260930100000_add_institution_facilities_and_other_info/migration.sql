-- Additive-only migration: new NULLABLE columns, no defaults, no backfill.
-- Nothing existing is renamed, retyped, dropped or rewritten, so live rows are
-- untouched. NULL means "not yet filled in" (distinct from an explicit No/0).
-- Adding nullable columns without a default is a metadata-only change in
-- Postgres (no table rewrite), so it is safe to run on a live database.

-- AlterTable: per-covered-area facilities (Land Records)
ALTER TABLE "institution_covered_areas"
  ADD COLUMN "furnitureAvailable" BOOLEAN,
  ADD COLUMN "smartBoardsCount" INTEGER;

-- AlterTable: "Other Information" section on the institution
ALTER TABLE "Institution"
  ADD COLUMN "hasLibrary" BOOLEAN,
  ADD COLUMN "libraryAictBooksAvailable" BOOLEAN,
  ADD COLUMN "hasCollegeBus" BOOLEAN,
  ADD COLUMN "busHasDriver" BOOLEAN,
  ADD COLUMN "computersCount" INTEGER,
  ADD COLUMN "computersAllInternetConnected" BOOLEAN;
