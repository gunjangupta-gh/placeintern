# Quick Start Guide - Migration 20260103135310

## TL;DR - For Impatient Developers

**What:** Removes `hasJoined`, `reviewedBy`, `internshipStatus` → Adds `internshipPhase` enum

**Impact:** Breaking change - code updates required

**Time:** ~5 minutes for migration, ~30 minutes for code updates

---

## 🚀 Quick Migration (3 Steps)

### 1. Backup (1 minute)
```bash
psql -U user -d db -f backend/prisma/migrations/20260103135310_remove_legacy_fields/pre_migration_backup.sql
```

### 2. Migrate (2 minutes)
```bash
cd backend
npx prisma migrate deploy
```

### 3. Verify (2 minutes)
```bash
psql -U user -d db -f backend/prisma/migrations/20260103135310_remove_legacy_fields/verify_migration.sql
```

---

## 📝 Code Changes Cheat Sheet

### TypeScript Enum
```typescript
enum InternshipPhase {
  NOT_STARTED = 'NOT_STARTED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TERMINATED = 'TERMINATED'
}
```

### Find & Replace Guide

| Old Code | New Code |
|----------|----------|
| `hasJoined: true` | `internshipPhase: InternshipPhase.ACTIVE` |
| `hasJoined: false` | `internshipPhase: InternshipPhase.NOT_STARTED` |
| `internshipStatus: 'ONGOING'` | `internshipPhase: InternshipPhase.ACTIVE` |
| `internshipStatus: 'COMPLETED'` | `internshipPhase: InternshipPhase.COMPLETED` |
| `internshipStatus: 'CANCELLED'` | `internshipPhase: InternshipPhase.TERMINATED` |
| `if (app.hasJoined)` | `if (app.internshipPhase !== 'NOT_STARTED')` |

### Query Updates

**Before:**
```typescript
where: { hasJoined: true, internshipStatus: 'ONGOING' }
```

**After:**
```typescript
where: { internshipPhase: InternshipPhase.ACTIVE }
```

---

## 🎨 UI Component Example

```typescript
// Phase badge colors
const PHASE_CONFIG = {
  NOT_STARTED: { color: 'gray', label: 'Not Started' },
  ACTIVE:      { color: 'green', label: 'Active' },
  COMPLETED:   { color: 'blue', label: 'Completed' },
  TERMINATED:  { color: 'red', label: 'Terminated' }
};

// Usage
<Badge color={PHASE_CONFIG[app.internshipPhase].color}>
  {PHASE_CONFIG[app.internshipPhase].label}
</Badge>
```

---

## ⚠️ Common Mistakes

### ❌ Don't Do This
```typescript
// Using string instead of enum
internshipPhase: 'active' // Wrong case!
internshipPhase: 'RUNNING' // Not a valid phase!
```

### ✅ Do This
```typescript
// Use enum values
internshipPhase: InternshipPhase.ACTIVE
internshipPhase: 'ACTIVE' // OK if you must use string
```

---

## 🔧 Troubleshooting

### Migration Failed?
```bash
# Check current state
psql -U user -d db -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'InternshipPhase'::regtype;"

# If enum exists, comment out CREATE TYPE in migration.sql and retry
```

### Application Errors?
```bash
# Regenerate Prisma client
cd backend
npx prisma generate

# Restart server
npm run dev
```

### Need to Rollback?
```bash
# Quick rollback SQL
psql -U user -d db <<EOF
ALTER TABLE "InternshipApplication"
ADD COLUMN "hasJoined" BOOLEAN,
ADD COLUMN "reviewedBy" VARCHAR,
ADD COLUMN "internshipStatus" VARCHAR;

UPDATE "InternshipApplication" app
SET "hasJoined" = backup."hasJoined",
    "reviewedBy" = backup."reviewedBy",
    "internshipStatus" = backup."internshipStatus"
FROM "InternshipApplication_backup_20260103" backup
WHERE app.id = backup.id;
EOF
```

---

## 📚 Full Documentation

- **Complete Guide:** See `MIGRATION_GUIDE.md`
- **Details:** See `README.md`
- **SQL Scripts:**
  - `migration.sql` - Main migration
  - `pre_migration_backup.sql` - Create backup
  - `verify_migration.sql` - Verify success

---

## ✅ Checklist

- [ ] Read this guide (you're doing it!)
- [ ] Run backup script
- [ ] Run migration
- [ ] Run verification script
- [ ] Update Prisma client (`npx prisma generate`)
- [ ] Update TypeScript types
- [ ] Update API endpoints
- [ ] Update UI components
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Monitor for errors
- [ ] Cleanup backup tables (after 30 days)

---

## 🆘 Need Help?

1. Check `MIGRATION_GUIDE.md` for detailed instructions
2. Check `README.md` for technical details
3. Review verification script output
4. Check database logs
5. Contact DBA team

---

## 📊 Field Mapping Reference

### InternshipPhase Values

| Phase | Meaning | When to Use |
|-------|---------|-------------|
| `NOT_STARTED` | Application accepted, not yet joined | Before joining date |
| `ACTIVE` | Currently doing internship | After joining, before completion |
| `COMPLETED` | Successfully finished | After completion date |
| `TERMINATED` | Ended early/cancelled | When cancelled or terminated |

### Old → New Mapping

```
hasJoined + internshipStatus → internshipPhase
───────────────────────────────────────────────
false + NULL/''           → NOT_STARTED
true  + 'ONGOING'         → ACTIVE
true  + 'IN_PROGRESS'     → ACTIVE
true  + 'COMPLETED'       → COMPLETED
true  + 'CANCELLED'       → TERMINATED
```

---

## 🎯 Performance Tips

The migration adds these indexes automatically:
- `internshipPhase` (single column)
- `internshipPhase, isActive` (composite)
- `studentId, internshipPhase` (composite)
- `status, internshipPhase` (composite)

Use them in your queries for best performance!

```typescript
// ✅ Good - uses index
where: { internshipPhase: 'ACTIVE', isActive: true }

// ❌ Bad - doesn't use index efficiently
where: {
  OR: [
    { internshipPhase: 'ACTIVE' },
    { internshipPhase: 'COMPLETED' }
  ]
}
```

---

**Last Updated:** 2026-01-03
**Migration Version:** 20260103135310
