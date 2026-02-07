# Migration Guide: Remove Legacy Fields

**Migration ID:** `20260103135310_remove_legacy_fields`

**Status:** Breaking Change - Not Backward Compatible

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Steps](#migration-steps)
4. [Verification](#verification)
5. [Code Changes Required](#code-changes-required)
6. [Rollback Procedure](#rollback-procedure)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What This Migration Does

This migration performs the following changes to the `InternshipApplication` table:

**Adds:**
- New enum type: `InternshipPhase` (NOT_STARTED, ACTIVE, COMPLETED, TERMINATED)
- New field: `internshipPhase` (InternshipPhase, NOT NULL, default: NOT_STARTED)
- Four new performance indexes for optimized queries

**Removes:**
- `hasJoined` field (Boolean)
- `reviewedBy` field (String)
- `internshipStatus` field (String)

**Migrates:**
- All existing data from old fields to new `internshipPhase` field
- Ensures no data loss during transition

### Why This Change

1. **Clearer Semantics:** The new enum provides explicit lifecycle states
2. **Type Safety:** Prevents invalid status values
3. **Better Performance:** Optimized indexes for common query patterns
4. **Simplified Logic:** Single source of truth for internship state
5. **Maintainability:** Reduces redundant fields

### Impact Assessment

- **Breaking Change:** Yes - removes fields from database
- **Downtime Required:** No - migration is safe for zero-downtime deployment
- **Data Loss:** No - all data is migrated to new field
- **Code Changes Required:** Yes - application code must be updated

---

## Prerequisites

### 1. Environment Setup

Ensure you have:
- PostgreSQL 12+ database
- Prisma CLI installed (`npm install -g prisma`)
- Database backup capability
- Staging environment for testing

### 2. Database Access

You'll need:
- Database connection with migration privileges
- Ability to create/drop tables, enums, and indexes
- Read/write access to `InternshipApplication` table

### 3. Backup Requirements

Before proceeding:
- [ ] Full database backup completed
- [ ] Backup verification successful
- [ ] Rollback plan documented
- [ ] Staging environment tested

---

## Migration Steps

### Step 1: Pre-Migration Preparation

#### 1.1 Review Current State

```bash
cd backend
npx prisma db pull
npx prisma format
```

#### 1.2 Create Backup

Run the pre-migration backup script:

```bash
# Connect to database
psql -U your_username -d your_database_name

# Run backup script
\i backend/prisma/migrations/20260103135310_remove_legacy_fields/pre_migration_backup.sql
```

This creates three backup tables:
- `InternshipApplication_backup_20260103` - Full data backup
- `InternshipApplication_migration_report_20260103` - Predicted migration outcomes
- `migration_metadata_20260103` - Migration metadata

#### 1.3 Review Backup Results

Check the output of the backup script:
- Verify total record count matches expectations
- Review predicted phase distribution
- Check for data inconsistencies
- Save the output for reference

### Step 2: Run Migration

#### Option A: Using Prisma Migrate (Recommended)

```bash
cd backend

# Preview the migration
npx prisma migrate deploy --preview

# Apply the migration
npx prisma migrate deploy
```

#### Option B: Manual SQL Execution

```bash
# Connect to database
psql -U your_username -d your_database_name

# Run migration
\i backend/prisma/migrations/20260103135310_remove_legacy_fields/migration.sql

# Check for errors
# If no errors, commit the transaction
```

### Step 3: Verify Migration

#### 3.1 Run Verification Script

```bash
# Connect to database
psql -U your_username -d your_database_name

# Run verification
\i backend/prisma/migrations/20260103135310_remove_legacy_fields/verify_migration.sql
```

#### 3.2 Check Results

Verify the following:
- [ ] InternshipPhase enum exists with 4 values
- [ ] internshipPhase column exists and is NOT NULL
- [ ] Old columns (hasJoined, reviewedBy, internshipStatus) are removed
- [ ] Data distribution makes sense
- [ ] No NULL values in internshipPhase
- [ ] All 4 indexes created successfully
- [ ] Total record count unchanged

#### 3.3 Compare with Backup

```sql
-- Compare record counts
SELECT
  'Original' as source,
  COUNT(*) as total
FROM "InternshipApplication_backup_20260103"
UNION ALL
SELECT
  'After Migration' as source,
  COUNT(*) as total
FROM "InternshipApplication";

-- Should be identical
```

### Step 4: Update Application Code

See [Code Changes Required](#code-changes-required) section below.

### Step 5: Deploy and Test

1. Deploy updated application code
2. Test all internship-related features
3. Monitor for errors
4. Check application logs

### Step 6: Cleanup (After 30 days)

Once migration is verified successful and stable:

```sql
-- Remove backup tables (after 30 days of successful operation)
DROP TABLE IF EXISTS "InternshipApplication_backup_20260103";
DROP TABLE IF EXISTS "InternshipApplication_migration_report_20260103";
DROP TABLE IF EXISTS "migration_metadata_20260103";
```

---

## Verification

### Quick Verification Checklist

Run these queries to verify success:

```sql
-- 1. Check enum exists
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'InternshipPhase'::regtype;
-- Expected: 4 rows

-- 2. Check column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'InternshipApplication' AND column_name = 'internshipPhase';
-- Expected: 1 row

-- 3. Check old columns removed
SELECT column_name FROM information_schema.columns
WHERE table_name = 'InternshipApplication'
AND column_name IN ('hasJoined', 'reviewedBy', 'internshipStatus');
-- Expected: 0 rows

-- 4. Check data distribution
SELECT "internshipPhase", COUNT(*) FROM "InternshipApplication"
GROUP BY "internshipPhase";
-- Expected: Reasonable distribution across phases

-- 5. Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'InternshipApplication' AND indexname LIKE '%internshipPhase%';
-- Expected: 4 rows
```

---

## Code Changes Required

### Backend Changes

#### 1. Update Type Definitions

```typescript
// src/types/internship.types.ts

// Remove old types
// type InternshipStatus = 'ONGOING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Add new enum
export enum InternshipPhase {
  NOT_STARTED = 'NOT_STARTED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED'
}
```

#### 2. Update DTOs

```typescript
// Before
export class InternshipApplicationDto {
  hasJoined?: boolean;
  reviewedBy?: string;
  internshipStatus?: string;
}

// After
export class InternshipApplicationDto {
  internshipPhase: InternshipPhase;
  // Remove hasJoined, reviewedBy, internshipStatus
}
```

#### 3. Update Queries

```typescript
// Before
const activeInternships = await prisma.internshipApplication.findMany({
  where: {
    hasJoined: true,
    internshipStatus: 'ONGOING'
  }
});

// After
const activeInternships = await prisma.internshipApplication.findMany({
  where: {
    internshipPhase: InternshipPhase.ACTIVE
  }
});
```

#### 4. Update Business Logic

```typescript
// Before
if (application.hasJoined) {
  // Do something
}

// After
if (application.internshipPhase !== InternshipPhase.NOT_STARTED) {
  // Do something
}

// More specific checks
if (application.internshipPhase === InternshipPhase.ACTIVE) {
  // Currently ongoing
}

if (application.internshipPhase === InternshipPhase.COMPLETED) {
  // Successfully finished
}
```

#### 5. Update Filters and Searches

```typescript
// Before
const filters = {
  hasJoined: true,
  internshipStatus: { in: ['ONGOING', 'IN_PROGRESS'] }
};

// After
const filters = {
  internshipPhase: InternshipPhase.ACTIVE
};
```

### Frontend Changes

#### 1. Update Type Definitions

```typescript
// types/internship.ts

export enum InternshipPhase {
  NOT_STARTED = 'NOT_STARTED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED'
}

export interface InternshipApplication {
  // ... other fields
  internshipPhase: InternshipPhase;
  // Remove: hasJoined, reviewedBy, internshipStatus
}
```

#### 2. Update UI Components

```typescript
// Before
{application.hasJoined ? (
  <Badge color="green">Joined</Badge>
) : (
  <Badge color="gray">Not Joined</Badge>
)}

// After
const phaseColors = {
  NOT_STARTED: 'gray',
  ACTIVE: 'green',
  COMPLETED: 'blue',
  TERMINATED: 'red'
};

const phaseLabels = {
  NOT_STARTED: 'Not Started',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  TERMINATED: 'Terminated'
};

<Badge color={phaseColors[application.internshipPhase]}>
  {phaseLabels[application.internshipPhase]}
</Badge>
```

#### 3. Update Filters

```typescript
// Before
const statusOptions = [
  { value: 'true', label: 'Joined' },
  { value: 'false', label: 'Not Joined' }
];

// After
const phaseOptions = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'TERMINATED', label: 'Terminated' }
];
```

---

## Rollback Procedure

### Quick Rollback (Emergency)

If you need to rollback immediately:

```sql
-- 1. Restore from backup table
BEGIN;

-- Add old columns back
ALTER TABLE "InternshipApplication"
ADD COLUMN "hasJoined" BOOLEAN,
ADD COLUMN "reviewedBy" VARCHAR,
ADD COLUMN "internshipStatus" VARCHAR;

-- Restore data from backup
UPDATE "InternshipApplication" app
SET
  "hasJoined" = backup."hasJoined",
  "reviewedBy" = backup."reviewedBy",
  "internshipStatus" = backup."internshipStatus"
FROM "InternshipApplication_backup_20260103" backup
WHERE app.id = backup.id;

-- Verify data
SELECT COUNT(*) FROM "InternshipApplication" WHERE "hasJoined" IS NOT NULL;

-- If verified, commit
COMMIT;

-- 2. Drop new column and enum
ALTER TABLE "InternshipApplication" DROP COLUMN "internshipPhase";
DROP TYPE "InternshipPhase";

-- 3. Drop indexes
DROP INDEX IF EXISTS "InternshipApplication_internshipPhase_idx";
DROP INDEX IF EXISTS "InternshipApplication_internshipPhase_isActive_idx";
DROP INDEX IF EXISTS "InternshipApplication_studentId_internshipPhase_idx";
DROP INDEX IF EXISTS "InternshipApplication_status_internshipPhase_idx";
```

### Full Rollback (Planned)

For a planned rollback with testing:

```bash
# 1. Create a rollback migration
cd backend/prisma/migrations
mkdir 20260103_rollback_remove_legacy_fields

# 2. Create rollback SQL file
# (Use the emergency rollback SQL above)

# 3. Test in staging
npx prisma migrate deploy

# 4. Verify rollback
# Run verification queries

# 5. Update application code back to old version

# 6. Deploy
```

---

## Troubleshooting

### Issue 1: Migration Fails - Enum Already Exists

**Error:**
```
ERROR: type "InternshipPhase" already exists
```

**Solution:**
```sql
-- Check if enum exists
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'InternshipPhase'::regtype;

-- If it exists with correct values, continue with rest of migration
-- Comment out the CREATE TYPE line in migration.sql
```

### Issue 2: Column Already Exists

**Error:**
```
ERROR: column "internshipPhase" already exists
```

**Solution:**
```sql
-- Check if column exists with correct type
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'InternshipApplication' AND column_name = 'internshipPhase';

-- If exists with correct type, skip ADD COLUMN step
-- Continue with data migration
```

### Issue 3: Data Inconsistency After Migration

**Problem:** Some applications have incorrect phases

**Solution:**
```sql
-- Review inconsistent records
SELECT * FROM "InternshipApplication"
WHERE
  ("internshipPhase" = 'COMPLETED' AND "completionDate" IS NULL)
  OR ("internshipPhase" = 'ACTIVE' AND "joiningDate" IS NULL);

-- Fix manually or run corrective update
UPDATE "InternshipApplication"
SET "internshipPhase" = 'ACTIVE'
WHERE "joiningDate" IS NOT NULL AND "internshipPhase" = 'NOT_STARTED';
```

### Issue 4: Application Errors After Migration

**Problem:** Application throws errors about missing fields

**Solution:**
1. Check if you updated Prisma client: `npx prisma generate`
2. Verify code changes are deployed
3. Check for cached responses
4. Review error logs for specific field references

### Issue 5: Performance Issues

**Problem:** Queries are slow after migration

**Solution:**
```sql
-- Check if indexes were created
SELECT indexname FROM pg_indexes
WHERE tablename = 'InternshipApplication' AND indexname LIKE '%internshipPhase%';

-- Analyze table
ANALYZE "InternshipApplication";

-- Check query plan
EXPLAIN ANALYZE
SELECT * FROM "InternshipApplication"
WHERE "internshipPhase" = 'ACTIVE';
```

---

## Support

For additional support:

1. **Database Issues:** Contact DBA team
2. **Application Errors:** Check backend logs
3. **Migration Problems:** Review this guide and verification results
4. **Rollback Needed:** Follow rollback procedure above

---

## Summary

This migration successfully transitions the internship application lifecycle tracking from multiple scattered fields to a single, type-safe enum field. The migration is designed to:

- ✅ Preserve all existing data
- ✅ Improve query performance
- ✅ Enhance type safety
- ✅ Simplify business logic
- ✅ Support easy rollback if needed

Follow this guide carefully and test thoroughly in staging before production deployment.
