# Migration Flow Diagram

## Overview

This document provides a visual representation of the migration process for removing legacy fields and adding InternshipPhase.

---

## Migration Timeline

```
┌─────────────────┐
│  Before         │
│  Migration      │
└────────┬────────┘
         │
         ├─── InternshipApplication Table
         │    ├─ hasJoined (Boolean)
         │    ├─ reviewedBy (String)
         │    ├─ internshipStatus (String)
         │    └─ [other fields...]
         │
         ▼
┌─────────────────┐
│  Step 1:        │
│  Backup         │
└────────┬────────┘
         │
         ├─── Create Backup Tables
         │    ├─ InternshipApplication_backup_20260103
         │    ├─ InternshipApplication_migration_report_20260103
         │    └─ migration_metadata_20260103
         │
         ▼
┌─────────────────┐
│  Step 2:        │
│  Create Enum    │
└────────┬────────┘
         │
         ├─── CREATE TYPE "InternshipPhase"
         │    ├─ NOT_STARTED
         │    ├─ ACTIVE
         │    ├─ COMPLETED
         │    └─ TERMINATED
         │
         ▼
┌─────────────────┐
│  Step 3:        │
│  Add Column     │
└────────┬────────┘
         │
         ├─── ALTER TABLE "InternshipApplication"
         │    └─ ADD COLUMN "internshipPhase" (default: NOT_STARTED)
         │
         ▼
┌─────────────────┐
│  Step 4:        │
│  Migrate Data   │
└────────┬────────┘
         │
         ├─── Data Migration Logic
         │    ├─ internshipStatus: 'ONGOING' → ACTIVE
         │    ├─ internshipStatus: 'IN_PROGRESS' → ACTIVE
         │    ├─ internshipStatus: 'COMPLETED' → COMPLETED
         │    ├─ internshipStatus: 'CANCELLED' → TERMINATED
         │    ├─ status: 'JOINED' → ACTIVE
         │    ├─ joiningDate exists → ACTIVE
         │    ├─ completionDate exists → COMPLETED
         │    └─ Default → NOT_STARTED
         │
         ▼
┌─────────────────┐
│  Step 5:        │
│  Drop Columns   │
└────────┬────────┘
         │
         ├─── DROP COLUMN
         │    ├─ hasJoined
         │    ├─ reviewedBy
         │    └─ internshipStatus
         │
         ▼
┌─────────────────┐
│  Step 6:        │
│  Add Indexes    │
└────────┬────────┘
         │
         ├─── CREATE INDEX
         │    ├─ internshipPhase_idx
         │    ├─ internshipPhase_isActive_idx
         │    ├─ studentId_internshipPhase_idx
         │    └─ status_internshipPhase_idx
         │
         ▼
┌─────────────────┐
│  After          │
│  Migration      │
└────────┬────────┘
         │
         └─── InternshipApplication Table
              ├─ internshipPhase (InternshipPhase enum)
              └─ [other fields...]
```

---

## Data Mapping Flow

```
OLD FIELDS                          NEW FIELD
┌──────────────────────────┐       ┌─────────────────┐
│                          │       │                 │
│  hasJoined: false        │       │  NOT_STARTED    │
│  internshipStatus: NULL  │──────▶│                 │
│                          │       │                 │
└──────────────────────────┘       └─────────────────┘

┌──────────────────────────┐       ┌─────────────────┐
│                          │       │                 │
│  hasJoined: true         │       │                 │
│  internshipStatus:       │──────▶│     ACTIVE      │
│    'ONGOING' or          │       │                 │
│    'IN_PROGRESS'         │       │                 │
└──────────────────────────┘       └─────────────────┘

┌──────────────────────────┐       ┌─────────────────┐
│                          │       │                 │
│  hasJoined: true         │       │                 │
│  internshipStatus:       │──────▶│   COMPLETED     │
│    'COMPLETED'           │       │                 │
│                          │       │                 │
└──────────────────────────┘       └─────────────────┘

┌──────────────────────────┐       ┌─────────────────┐
│                          │       │                 │
│  hasJoined: true         │       │                 │
│  internshipStatus:       │──────▶│   TERMINATED    │
│    'CANCELLED' or        │       │                 │
│    'TERMINATED'          │       │                 │
└──────────────────────────┘       └─────────────────┘

SPECIAL CASES:
┌──────────────────────────┐       ┌─────────────────┐
│  status: 'JOINED'        │──────▶│     ACTIVE      │
└──────────────────────────┘       └─────────────────┘

┌──────────────────────────┐       ┌─────────────────┐
│  joiningDate: NOT NULL   │──────▶│     ACTIVE      │
└──────────────────────────┘       └─────────────────┘

┌──────────────────────────┐       ┌─────────────────┐
│  completionDate: NOT NULL│──────▶│   COMPLETED     │
└──────────────────────────┘       └─────────────────┘
```

---

## State Transition Diagram

### InternshipPhase Lifecycle

```
                    ┌──────────────┐
                    │              │
           ┌───────▶│ NOT_STARTED  │◀────┐
           │        │              │     │
           │        └──────┬───────┘     │
           │               │             │
           │               │ Student     │ Rollback
           │               │ Joins       │ (Manual)
           │               │             │
           │               ▼             │
           │        ┌──────────────┐     │
           │        │              │     │
           │   ┌───▶│    ACTIVE    │─────┘
           │   │    │              │
           │   │    └──────┬───────┘
           │   │           │
           │   │           │ Completes or
           │   │           │ Terminates
           │   │           │
           │   │           ▼
           │   │    ┌──────────────┐
           │   │    │              │
           │   │    │  COMPLETED   │
           │   │    │      or      │
           │   │    │  TERMINATED  │
           │   │    │              │
           │   │    └──────────────┘
           │   │
           │   │ Restart
           │   └────────┐
           │            │
           └────────────┘
```

---

## Application Code Update Flow

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  1. DATABASE MIGRATION COMPLETE                     │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  2. UPDATE PRISMA CLIENT                            │
│     npx prisma generate                             │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  3. UPDATE TYPE DEFINITIONS                         │
│     - Add InternshipPhase enum                      │
│     - Remove old field types                        │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  4. UPDATE DTOs                                     │
│     - Remove: hasJoined, reviewedBy,                │
│       internshipStatus                              │
│     - Add: internshipPhase                          │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  5. UPDATE QUERIES                                  │
│     - Replace old field references                  │
│     - Use InternshipPhase enum values               │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  6. UPDATE BUSINESS LOGIC                           │
│     - Replace conditional checks                    │
│     - Use new enum-based logic                      │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  7. UPDATE UI COMPONENTS                            │
│     - Update badges/status displays                 │
│     - Update filters and selects                    │
│                                                     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│                                                     │
│  8. TEST & DEPLOY                                   │
│     - Run tests                                     │
│     - Deploy to staging                             │
│     - Verify functionality                          │
│     - Deploy to production                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Rollback Flow

```
┌─────────────────┐
│  Need Rollback? │
└────────┬────────┘
         │
         ├─── YES
         │    │
         │    ▼
         │   ┌─────────────────┐
         │   │  Step 1:        │
         │   │  Add old        │
         │   │  columns back   │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │  Step 2:        │
         │   │  Restore data   │
         │   │  from backup    │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │  Step 3:        │
         │   │  Verify data    │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │  Step 4:        │
         │   │  Drop new       │
         │   │  column & enum  │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │  Step 5:        │
         │   │  Drop indexes   │
         │   └────────┬────────┘
         │            │
         │            ▼
         │   ┌─────────────────┐
         │   │  Rollback       │
         │   │  Complete       │
         │   └─────────────────┘
         │
         └─── NO
              │
              ▼
             ┌─────────────────┐
             │  Continue       │
             │  with new       │
             │  schema         │
             └─────────────────┘
```

---

## Index Creation Flow

```
                    ┌──────────────────────────────┐
                    │                              │
                    │  InternshipApplication Table │
                    │                              │
                    └──────────┬───────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
    ┌─────────────────┐  ┌─────────────┐  ┌──────────────┐
    │                 │  │             │  │              │
    │ internshipPhase │  │ isActive    │  │  studentId   │
    │                 │  │             │  │              │
    └─────────────────┘  └─────────────┘  └──────────────┘
              │                 │                │
              │                 │                │
              ▼                 ▼                ▼
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │  INDEX: internshipPhase_idx                         │
    │                                                     │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │  INDEX: internshipPhase_isActive_idx                │
    │  (internshipPhase, isActive)                        │
    │                                                     │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │  INDEX: studentId_internshipPhase_idx               │
    │  (studentId, internshipPhase)                       │
    │                                                     │
    └─────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │  INDEX: status_internshipPhase_idx                  │
    │  (status, internshipPhase)                          │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

---

## Query Performance Comparison

### Before Migration

```
Query: Find all active internships
WHERE hasJoined = true AND internshipStatus IN ('ONGOING', 'IN_PROGRESS')

┌─────────────────────┐
│ Sequential Scan     │  ← Slow
│ Filter: hasJoined   │
│ Filter: status      │
└─────────────────────┘
```

### After Migration

```
Query: Find all active internships
WHERE internshipPhase = 'ACTIVE'

┌─────────────────────┐
│ Index Scan          │  ← Fast
│ Using:              │
│ internshipPhase_idx │
└─────────────────────┘
```

---

## Summary

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  MIGRATION SUMMARY                                       │
│                                                          │
│  ✓ Removes 3 deprecated fields                           │
│  ✓ Adds 1 enum type (4 values)                           │
│  ✓ Adds 1 new column                                     │
│  ✓ Migrates all existing data                            │
│  ✓ Creates 4 performance indexes                         │
│  ✓ Maintains data integrity                              │
│  ✓ Provides rollback capability                          │
│                                                          │
│  Timeline: ~5 minutes for migration                      │
│           ~30 minutes for code updates                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Legend

```
│  = Flow continues
▼  = Next step
─▶ = Transforms into
┌─ = Container/Box start
└─ = Container/Box end
```

---

**Visual representation of migration process**
**Last updated:** 2026-01-03
**Migration:** 20260103135310_remove_legacy_fields
