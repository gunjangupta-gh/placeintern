-- =============================================
-- MIGRATION VERIFICATION SCRIPT
-- Migration: 20260103135310_remove_legacy_fields
-- =============================================
-- This script helps verify that the migration was applied correctly
-- Run this after applying the migration to check the results

-- =============================================
-- 1. Verify InternshipPhase enum exists
-- =============================================
SELECT 'Checking InternshipPhase enum...' AS verification_step;

SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'InternshipPhase'::regtype
ORDER BY enumsortorder;

-- Expected output: 4 rows
-- NOT_STARTED, ACTIVE, COMPLETED, TERMINATED

-- =============================================
-- 2. Verify internshipPhase column exists
-- =============================================
SELECT 'Checking internshipPhase column exists...' AS verification_step;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'InternshipApplication'
  AND column_name = 'internshipPhase';

-- Expected: 1 row showing the column exists with NOT NULL and default 'NOT_STARTED'

-- =============================================
-- 3. Verify old columns are removed
-- =============================================
SELECT 'Checking that old columns are removed...' AS verification_step;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'InternshipApplication'
  AND column_name IN ('hasJoined', 'reviewedBy', 'internshipStatus');

-- Expected: 0 rows (all columns should be removed)

-- =============================================
-- 4. Check data distribution across phases
-- =============================================
SELECT 'Checking data distribution across InternshipPhase values...' AS verification_step;

SELECT
  "internshipPhase",
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM "InternshipApplication"
GROUP BY "internshipPhase"
ORDER BY count DESC;

-- Review the distribution - it should make sense based on your data

-- =============================================
-- 5. Verify no NULL values in internshipPhase
-- =============================================
SELECT 'Checking for NULL values in internshipPhase...' AS verification_step;

SELECT COUNT(*) as null_count
FROM "InternshipApplication"
WHERE "internshipPhase" IS NULL;

-- Expected: 0 (column is NOT NULL)

-- =============================================
-- 6. Check data consistency
-- =============================================
SELECT 'Checking data consistency...' AS verification_step;

-- Applications marked as COMPLETED should have completionDate
SELECT
  'COMPLETED phase without completionDate' as issue,
  COUNT(*) as count
FROM "InternshipApplication"
WHERE "internshipPhase" = 'COMPLETED'
  AND "completionDate" IS NULL;

-- Applications marked as ACTIVE should have joiningDate
SELECT
  'ACTIVE phase without joiningDate' as issue,
  COUNT(*) as count
FROM "InternshipApplication"
WHERE "internshipPhase" = 'ACTIVE'
  AND "joiningDate" IS NULL;

-- Applications marked as NOT_STARTED should not have joiningDate
SELECT
  'NOT_STARTED phase with joiningDate' as issue,
  COUNT(*) as count
FROM "InternshipApplication"
WHERE "internshipPhase" = 'NOT_STARTED'
  AND "joiningDate" IS NOT NULL;

-- =============================================
-- 7. Verify indexes were created
-- =============================================
SELECT 'Checking that indexes were created...' AS verification_step;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'InternshipApplication'
  AND indexname LIKE '%internshipPhase%'
ORDER BY indexname;

-- Expected: 4 indexes
-- InternshipApplication_internshipPhase_idx
-- InternshipApplication_internshipPhase_isActive_idx
-- InternshipApplication_studentId_internshipPhase_idx
-- InternshipApplication_status_internshipPhase_idx

-- =============================================
-- 8. Check total records
-- =============================================
SELECT 'Checking total record count...' AS verification_step;

SELECT
  COUNT(*) as total_applications,
  COUNT(DISTINCT "studentId") as unique_students,
  COUNT(CASE WHEN "isActive" = true THEN 1 END) as active_applications
FROM "InternshipApplication";

-- =============================================
-- 9. Sample data review
-- =============================================
SELECT 'Sample data review...' AS verification_step;

SELECT
  id,
  "studentId",
  status,
  "internshipPhase",
  "joiningDate",
  "completionDate",
  "isActive"
FROM "InternshipApplication"
ORDER BY "createdAt" DESC
LIMIT 10;

-- =============================================
-- 10. Performance check - Index usage
-- =============================================
SELECT 'Checking index statistics...' AS verification_step;

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'InternshipApplication'
  AND indexname LIKE '%internshipPhase%';

-- Note: This will show usage statistics after the migration
-- Index scans will increase as queries start using the new field

-- =============================================
-- VERIFICATION COMPLETE
-- =============================================
-- Review all the outputs above to confirm:
-- ✓ Enum created with correct values
-- ✓ New column added with correct constraints
-- ✓ Old columns removed
-- ✓ Data migrated correctly
-- ✓ No NULL values in non-nullable column
-- ✓ Data consistency maintained
-- ✓ All indexes created
-- ✓ No data lost during migration
-- =============================================
