# Migration: Remove Legacy Fields and Add InternshipPhase

**Migration ID:** `20260103135310_remove_legacy_fields`

**Created:** 2026-01-03

## Overview

This migration removes deprecated fields from the `InternshipApplication` model and introduces a new `InternshipPhase` enum for better lifecycle tracking of internships. This change is **NOT backward compatible** by design.

## Changes

### 1. New Enum: InternshipPhase

A new enum type `InternshipPhase` is created with the following values:

- `NOT_STARTED` - Application accepted but student hasn't joined yet
- `ACTIVE` - Internship is currently ongoing
- `COMPLETED` - Internship successfully finished
- `TERMINATED` - Internship ended early or was cancelled

### 2. Added Fields

- `internshipPhase` (InternshipPhase, NOT NULL, default: `NOT_STARTED`)

### 3. Removed Fields

The following deprecated fields are removed from `InternshipApplication`:

- `hasJoined` (Boolean) - Replaced by checking `internshipPhase`
- `reviewedBy` (String) - Redundant field
- `internshipStatus` (String) - Replaced by `internshipPhase` enum

### 4. Data Migration Strategy

The migration automatically migrates existing data:

```sql
internshipStatus -> internshipPhase mapping:
- 'ONGOING', 'IN_PROGRESS' -> ACTIVE
- 'COMPLETED' -> COMPLETED
- 'CANCELLED', 'TERMINATED' -> TERMINATED
- Default -> NOT_STARTED

Additional logic:
- If status = 'JOINED' -> ACTIVE
- If joiningDate exists -> ACTIVE
- If completionDate exists -> COMPLETED
- If startDate <= NOW() and no endDate -> ACTIVE
- If endDate <= NOW() -> COMPLETED
```

### 5. Performance Indexes

The migration creates the following indexes for optimal query performance:

- `InternshipApplication_internshipPhase_idx`
- `InternshipApplication_internshipPhase_isActive_idx`
- `InternshipApplication_studentId_internshipPhase_idx`
- `InternshipApplication_status_internshipPhase_idx`

## Running the Migration

### Automatic (via Prisma Migrate)

```bash
# Navigate to backend directory
cd backend

# Run the migration
npx prisma migrate deploy
```

### Manual (if needed)

```bash
# Connect to your PostgreSQL database
psql -U your_username -d your_database

# Run the migration SQL
\i backend/prisma/migrations/20260103135310_remove_legacy_fields/migration.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check the new enum type
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'InternshipPhase'::regtype;

-- Verify data distribution
SELECT "internshipPhase", COUNT(*) as count
FROM "InternshipApplication"
GROUP BY "internshipPhase";

-- Check that old columns are removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'InternshipApplication'
  AND column_name IN ('hasJoined', 'reviewedBy', 'internshipStatus');
-- Should return 0 rows

-- Verify indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'InternshipApplication'
  AND indexname LIKE '%internshipPhase%';
```

## Impact Assessment

### Database Changes
- ✅ New enum type created
- ✅ New column added with default value
- ✅ Data migrated from old fields
- ✅ Old columns dropped
- ✅ Performance indexes created

### Application Code Changes Required

After running this migration, you **MUST** update your application code:

1. **Remove references to deleted fields:**
   - `hasJoined` → Check `internshipPhase !== 'NOT_STARTED'`
   - `reviewedBy` → Use alternative tracking mechanism
   - `internshipStatus` → Use `internshipPhase` instead

2. **Update queries:**
   ```typescript
   // Before
   const activeInternships = await prisma.internshipApplication.findMany({
     where: { hasJoined: true, internshipStatus: 'ONGOING' }
   });

   // After
   const activeInternships = await prisma.internshipApplication.findMany({
     where: { internshipPhase: 'ACTIVE' }
   });
   ```

3. **Update DTOs and Types:**
   ```typescript
   // Add to your types
   enum InternshipPhase {
     NOT_STARTED = 'NOT_STARTED',
     ACTIVE = 'ACTIVE',
     COMPLETED = 'COMPLETED',
     TERMINATED = 'TERMINATED'
   }
   ```

### API Changes

If your API exposes these fields, you'll need to:

1. Update API documentation
2. Version your API or provide migration guide for clients
3. Update frontend applications

## Rollback Strategy

⚠️ **WARNING:** This migration is NOT designed to be easily reversible. If you need to rollback:

### Manual Rollback Steps

1. **Re-add the removed columns:**
   ```sql
   ALTER TABLE "InternshipApplication"
   ADD COLUMN "hasJoined" BOOLEAN DEFAULT false,
   ADD COLUMN "reviewedBy" VARCHAR,
   ADD COLUMN "internshipStatus" VARCHAR;
   ```

2. **Migrate data back:**
   ```sql
   UPDATE "InternshipApplication"
   SET
     "hasJoined" = CASE WHEN "internshipPhase" != 'NOT_STARTED' THEN true ELSE false END,
     "internshipStatus" = CASE
       WHEN "internshipPhase" = 'ACTIVE' THEN 'ONGOING'
       WHEN "internshipPhase" = 'COMPLETED' THEN 'COMPLETED'
       WHEN "internshipPhase" = 'TERMINATED' THEN 'CANCELLED'
       ELSE NULL
     END;
   ```

3. **Drop the new field and enum:**
   ```sql
   ALTER TABLE "InternshipApplication" DROP COLUMN "internshipPhase";
   DROP TYPE "InternshipPhase";
   ```

4. **Remove indexes:**
   ```sql
   DROP INDEX IF EXISTS "InternshipApplication_internshipPhase_idx";
   DROP INDEX IF EXISTS "InternshipApplication_internshipPhase_isActive_idx";
   DROP INDEX IF EXISTS "InternshipApplication_studentId_internshipPhase_idx";
   DROP INDEX IF EXISTS "InternshipApplication_status_internshipPhase_idx";
   ```

## Testing Checklist

Before deploying to production:

- [ ] Backup database
- [ ] Run migration in staging environment
- [ ] Verify data migration accuracy
- [ ] Test all affected application features
- [ ] Update application code to use new field
- [ ] Update API documentation
- [ ] Test all queries that previously used old fields
- [ ] Performance test with new indexes
- [ ] Update frontend applications
- [ ] Test rollback procedure (in staging)

## Benefits

1. **Clearer Semantics:** `InternshipPhase` is more explicit than boolean `hasJoined`
2. **Better State Management:** Four distinct phases vs. scattered boolean/string fields
3. **Type Safety:** Enum prevents invalid values
4. **Performance:** Optimized indexes for common query patterns
5. **Maintainability:** Single source of truth for internship lifecycle state

## Support

For questions or issues with this migration, contact:
- Database Administrator
- Backend Development Team

## References

- Prisma Schema: `backend/prisma/schema.prisma`
- InternshipPhase enum definition: Line 1884
- InternshipApplication model: Line 1133
