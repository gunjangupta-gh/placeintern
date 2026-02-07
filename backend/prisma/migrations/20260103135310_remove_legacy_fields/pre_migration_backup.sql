-- =============================================
-- PRE-MIGRATION BACKUP SCRIPT
-- Migration: 20260103135310_remove_legacy_fields
-- =============================================
-- Run this BEFORE applying the migration to create a backup
-- of the data that will be modified or removed

-- =============================================
-- 1. Create backup table for InternshipApplication
-- =============================================

-- Drop backup table if it exists from previous attempts
DROP TABLE IF EXISTS "InternshipApplication_backup_20260103";

-- Create backup table with current data
CREATE TABLE "InternshipApplication_backup_20260103" AS
SELECT * FROM "InternshipApplication";

-- Add a timestamp column to track when backup was created
ALTER TABLE "InternshipApplication_backup_20260103"
ADD COLUMN backup_created_at TIMESTAMP DEFAULT NOW();

-- Verify backup was created
SELECT
  'Backup created successfully' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT "studentId") as unique_students,
  MIN("createdAt") as oldest_application,
  MAX("createdAt") as newest_application
FROM "InternshipApplication_backup_20260103";

-- =============================================
-- 2. Export old field values to CSV (optional)
-- =============================================
-- Uncomment the following line to export to CSV
-- Note: Adjust the path as needed for your system
-- \copy (SELECT id, "studentId", "hasJoined", "reviewedBy", "internshipStatus", status, "joiningDate", "completionDate" FROM "InternshipApplication") TO '/path/to/backup/internship_application_old_fields.csv' CSV HEADER;

-- =============================================
-- 3. Create summary report of current state
-- =============================================

-- Summary of hasJoined values
SELECT
  'hasJoined distribution' as metric,
  "hasJoined",
  COUNT(*) as count
FROM "InternshipApplication"
GROUP BY "hasJoined"
UNION ALL
-- Summary of internshipStatus values
SELECT
  'internshipStatus distribution' as metric,
  "internshipStatus",
  COUNT(*) as count
FROM "InternshipApplication"
WHERE "internshipStatus" IS NOT NULL
GROUP BY "internshipStatus"
UNION ALL
-- Summary of reviewedBy usage
SELECT
  'reviewedBy usage' as metric,
  CASE
    WHEN "reviewedBy" IS NULL THEN 'NULL'
    ELSE 'HAS_VALUE'
  END,
  COUNT(*) as count
FROM "InternshipApplication"
GROUP BY
  CASE
    WHEN "reviewedBy" IS NULL THEN 'NULL'
    ELSE 'HAS_VALUE'
  END;

-- =============================================
-- 4. Create detailed report for validation
-- =============================================

-- Create a detailed report table
DROP TABLE IF EXISTS "InternshipApplication_migration_report_20260103";

CREATE TABLE "InternshipApplication_migration_report_20260103" AS
SELECT
  id,
  "studentId",
  status,
  "hasJoined",
  "reviewedBy",
  "internshipStatus",
  "joiningDate",
  "completionDate",
  "startDate",
  "endDate",
  "isActive",
  -- Predicted internshipPhase value based on migration logic
  CASE
    WHEN "internshipStatus" IN ('ONGOING', 'IN_PROGRESS') THEN 'ACTIVE'
    WHEN "internshipStatus" = 'COMPLETED' THEN 'COMPLETED'
    WHEN "internshipStatus" IN ('CANCELLED', 'TERMINATED') THEN 'TERMINATED'
    WHEN "startDate" IS NOT NULL AND "startDate" <= NOW() AND "endDate" IS NULL THEN 'ACTIVE'
    WHEN "endDate" IS NOT NULL AND "endDate" <= NOW() THEN 'COMPLETED'
    WHEN status = 'JOINED' THEN 'ACTIVE'
    WHEN "joiningDate" IS NOT NULL THEN 'ACTIVE'
    WHEN "completionDate" IS NOT NULL THEN 'COMPLETED'
    ELSE 'NOT_STARTED'
  END as predicted_internship_phase,
  NOW() as report_created_at
FROM "InternshipApplication";

-- Display summary of predicted phases
SELECT
  'Predicted InternshipPhase distribution' as report,
  predicted_internship_phase,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM "InternshipApplication_migration_report_20260103"
GROUP BY predicted_internship_phase
ORDER BY count DESC;

-- =============================================
-- 5. Identify potential data issues
-- =============================================

-- Check for applications with inconsistent states
SELECT
  'Potential data inconsistencies found' as warning,
  COUNT(*) as count
FROM "InternshipApplication"
WHERE
  -- Has joined but no joining date
  ("hasJoined" = true AND "joiningDate" IS NULL)
  OR
  -- Has completion date but not marked as completed
  ("completionDate" IS NOT NULL AND "internshipStatus" != 'COMPLETED')
  OR
  -- Status is JOINED but hasJoined is false
  (status = 'JOINED' AND "hasJoined" = false)
  OR
  -- Active status but has completion date
  ("internshipStatus" IN ('ONGOING', 'IN_PROGRESS') AND "completionDate" IS NOT NULL);

-- Show detailed inconsistencies
SELECT
  id,
  "studentId",
  status,
  "hasJoined",
  "internshipStatus",
  "joiningDate",
  "completionDate",
  CASE
    WHEN "hasJoined" = true AND "joiningDate" IS NULL THEN 'Joined but no joining date'
    WHEN "completionDate" IS NOT NULL AND "internshipStatus" != 'COMPLETED' THEN 'Has completion date but status not COMPLETED'
    WHEN status = 'JOINED' AND "hasJoined" = false THEN 'Status JOINED but hasJoined is false'
    WHEN "internshipStatus" IN ('ONGOING', 'IN_PROGRESS') AND "completionDate" IS NOT NULL THEN 'Active status with completion date'
  END as inconsistency_type
FROM "InternshipApplication"
WHERE
  ("hasJoined" = true AND "joiningDate" IS NULL)
  OR ("completionDate" IS NOT NULL AND "internshipStatus" != 'COMPLETED')
  OR (status = 'JOINED' AND "hasJoined" = false)
  OR ("internshipStatus" IN ('ONGOING', 'IN_PROGRESS') AND "completionDate" IS NOT NULL);

-- =============================================
-- 6. Save important metadata
-- =============================================

DROP TABLE IF EXISTS "migration_metadata_20260103";

CREATE TABLE "migration_metadata_20260103" (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(255),
  metric_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO "migration_metadata_20260103" (metric_name, metric_value)
VALUES
  ('total_applications', (SELECT COUNT(*)::TEXT FROM "InternshipApplication")),
  ('applications_with_hasJoined', (SELECT COUNT(*)::TEXT FROM "InternshipApplication" WHERE "hasJoined" = true)),
  ('applications_with_reviewedBy', (SELECT COUNT(*)::TEXT FROM "InternshipApplication" WHERE "reviewedBy" IS NOT NULL)),
  ('applications_with_internshipStatus', (SELECT COUNT(*)::TEXT FROM "InternshipApplication" WHERE "internshipStatus" IS NOT NULL)),
  ('database_name', (SELECT current_database())),
  ('database_version', (SELECT version())),
  ('backup_timestamp', (SELECT NOW()::TEXT));

-- Display metadata
SELECT * FROM "migration_metadata_20260103" ORDER BY id;

-- =============================================
-- BACKUP COMPLETE
-- =============================================
-- Review the outputs above before proceeding with migration
--
-- Backup tables created:
-- 1. InternshipApplication_backup_20260103 - Full backup of table
-- 2. InternshipApplication_migration_report_20260103 - Predicted outcomes
-- 3. migration_metadata_20260103 - Important metrics
--
-- These tables will remain after migration for validation and rollback
--
-- To proceed with migration, run:
-- npx prisma migrate deploy
-- OR manually execute: migration.sql
--
-- After migration, verify with:
-- verify_migration.sql
-- =============================================

-- =============================================
-- CLEANUP (Run after successful migration and verification)
-- =============================================
-- Uncomment these lines ONLY after successful migration and verification
--
-- DROP TABLE IF EXISTS "InternshipApplication_backup_20260103";
-- DROP TABLE IF EXISTS "InternshipApplication_migration_report_20260103";
-- DROP TABLE IF EXISTS "migration_metadata_20260103";
-- =============================================
