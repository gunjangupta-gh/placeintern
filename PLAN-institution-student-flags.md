# Plan: Institution Type/Ownership, Sanctioned Seats, Clearance, Dropout & Placement Flags

Status: **Dropout tracking (§5) and Placement flag (§6) are implemented**, including the principal Student List UI (§7). Institution type/ownership (§1) and the clearance `APPEARED`/`PASSED` addition (§4) are still just proposals — deliberately **not** touched in this pass, to keep the production changeset small and reviewable (see "Why §1 and §4 were held back" at the end).
Scope: `backend/prisma/schema.prisma` + the services/scripts/UI that read/write these fields.

## 1. Institution type (Polytechnic / Govt / Govt-Aided / Private / Special Trade Institute / ...)

**Current state** (`schema.prisma:371-450`):
- `Institution.type` is a single enum `InstitutionType`: `POLYTECHNIC, ENGINEERING_COLLEGE, UNIVERSITY, DEGREE_COLLEGE, ITI, SKILL_CENTER`.
- There is **no ownership/management axis at all** — nothing distinguishes Government vs Government-Aided vs Private. The only "ownership" field that exists is `landOwnership` (`OWNED/LEASED/GOVERNMENT_ALLOTTED/PPP/OTHER`), which is about the land the campus sits on, not who runs the institution.
- "Special Trade Institutes" does not exist as a value anywhere.

**Decision (confirmed with you):** one combined enum, not two separate fields.

**Proposed change** — replace/extend `InstitutionType` with a combined list crossing kind × ownership, e.g.:

```prisma
enum InstitutionType {
  GOVT_POLYTECHNIC
  GOVT_AIDED_POLYTECHNIC
  PRIVATE_POLYTECHNIC

  GOVT_ITI
  GOVT_AIDED_ITI
  PRIVATE_ITI

  GOVT_SPECIAL_TRADE_INSTITUTE
  GOVT_AIDED_SPECIAL_TRADE_INSTITUTE
  PRIVATE_SPECIAL_TRADE_INSTITUTE

  // Existing kinds kept as-is unless you confirm they also need govt/aided/private variants:
  ENGINEERING_COLLEGE
  UNIVERSITY
  DEGREE_COLLEGE
  SKILL_CENTER
}
```

**Open item — needs your confirmation before writing the migration:** which of the existing kinds (`ENGINEERING_COLLEGE`, `UNIVERSITY`, `DEGREE_COLLEGE`, `SKILL_CENTER`) actually occur under more than one ownership in your data (e.g. do you ever have a *Private* Engineering College in scope, or are all of those always Government)? I don't want to generate 20+ enum values combinatorially if most combinations never occur in your dataset. If you confirm the real list, I'll size the enum to match.

**Migration/backfill:** existing rows have `type ∈ {POLYTECHNIC, ITI, ...}` with no ownership info recorded elsewhere, so a straight rename can't infer GOVT vs PRIVATE automatically — this will need either (a) a one-time manual/CSV backfill per institution, or (b) defaulting everything to `GOVT_*` on migration (since most current institutions are believed to be government polytechnics/ITIs) and letting State-Directorate correct the handful of private/aided ones afterward. **Please confirm which backfill approach you want.**

**Code touch points:** `backend/src/api/state/dto/create-institution.dto.ts`, `backend/src/domain/institution/institution.service.ts`, `backend/src/bulk/bulk-institution/bulk-institution.service.ts` (all reference `InstitutionType` and will need the new enum values wired into dropdowns/validation).

## 2. Course-level sanctioned seats (students)

**Already exists** — no gap here. `BranchIntake` (`schema.prisma:524-552`) has `sanctionedSeats Int` and `feeWaiverSeats Int`, scoped per `institutionId + branchId + academicYear` (branch = course/discipline). This is exactly "sanctioned seats per course per year." Nothing to build.

## 3. Staff sanctioned seats

**Already exists at two levels** — no gap here:
- Branch/course level: `BranchStaffCapacity` (`schema.prisma:554-579`) has `sanctionedPosts`, `filledPosts`, `guestFaculty`, per `institutionId + branchId + academicYear`.
- Institution level total: `Institution.totalStaffSeats` (`schema.prisma:407`).

Nothing to build here either, unless you want per-designation sanctioned seats (e.g. sanctioned Lecturer posts vs sanctioned Lab Technician posts) rather than one aggregate number per branch — flag if you need that finer breakdown.

## 4. Clearance status ("appeared", "passed")

**Current state** (`schema.prisma:246,287-292`): `Student.clearanceStatus` already exists — enum `ClearanceStatus { PENDING, CLEARED, HOLD, REJECTED }`, editable by Principal/Faculty (`faculty.service.ts:3215`, `update-student.dto.ts:149-152`).

**Decision (confirmed with you):** since the portal only carries final-year students (those enrolled for internships), extend the *same* enum rather than building a separate exam-result model.

**Proposed change:**

```prisma
enum ClearanceStatus {
  PENDING
  CLEARED
  HOLD
  REJECTED
  APPEARED   // student appeared for final exams
  PASSED     // student passed final exams
}
```

**Open item:** do you also want a `FAILED` value for students who appeared but did not pass? Without it, "not passed yet" and "failed" are indistinguishable from `APPEARED`. Let me know — easy to add if yes, easy to skip if you'd rather keep it minimal for now.

**Backfill:** existing rows keep their current value (`PENDING` by default); no data migration needed since this only adds new enum members.

## 5. Dropout via deactivation, with a recorded timestamp/reason — IMPLEMENTED

**Current state (the actual gap):**
- Dropout today = flipping `User.active` to `false`. Confirmed via `backend/prisma/seed-inactivate-students.ts` and `backend/src/api/system-admin/services/user-management.service.ts:280-350`.
- **`User` has no `deactivatedAt` / `deactivatedBy` / `deactivationReason` fields.** Only `MentorAssignment` tracks a deactivation timestamp+reason (`schema.prisma:813-816`) — the mentor *assignment* record, not the student/user themselves.
- `active=false` today is reused for several unrelated situations (bulk data cleanup via seed scripts, disciplinary action, fee default, actual dropout) with no way to tell them apart later, and seed scripts bypass `AuditLog` entirely, so even the generic audit trail is incomplete for script-driven deactivations.
- `report-generator.service.ts` and other dashboards read `user.active` directly; there's no "when did this become inactive" for reporting dropout dates/trends.

**Decision (confirmed with you):** add the tracking fields **and** a reason category, so dropout is distinguishable from other deactivations.

**What was implemented:**
- `schema.prisma`: `DeactivationReason` enum (`DROPOUT, TRANSFERRED, DISCIPLINARY, DATA_CLEANUP, OTHER`) + `User.deactivatedAt/deactivatedBy/deactivationReason/deactivationRemarks`, all nullable, plus an index on `deactivationReason`.
- Migration: `backend/prisma/migrations/20260921120000_add_student_placement_and_user_deactivation_tracking/migration.sql` — additive only (new enum + nullable columns; `Student.isPlaced` is `NOT NULL DEFAULT false`, which Postgres applies as a metadata-only change with no table rewrite). **Not yet run against any database** — see "Running the migration" below.
- `backend/src/api/principal/principal.service.ts` — `toggleStudentStatus()` now accepts an optional `ToggleStudentStatusDto { reason, remarks }`: on deactivate it stamps `deactivatedAt/deactivatedBy/deactivationReason/deactivationRemarks`; on reactivate it clears all four (resolved the earlier open question — history is not kept across a reactivate/deactivate cycle, only the current one). Falls back to `OTHER` if no reason is supplied, so existing callers that don't pass one (e.g. `AllStudents.jsx`, faculty/state pages that use their own separate toggle endpoints) keep working unchanged.
- `backend/src/api/principal/principal.controller.ts` / `dto/toggle-student-status.dto.ts` — endpoint now takes a body.
- **Not touched:** `updateStudent`'s plain `isActive` boolean path, `seed-inactivate-students.ts`, and the faculty/state equivalents of toggle-status — left exactly as they were, so this pass doesn't ripple into other pages. Anything deactivated through those paths still won't get a reason recorded; only deactivations done via the Principal Student List's new status-tag flow (see §7) do.

**Proposed change (for reference)** — added to `User` model:

```prisma
model User {
  ...
  active               Boolean            @default(true)
  deactivatedAt         DateTime?
  deactivatedBy         String?            // userId of admin/principal who deactivated, or a script tag
  deactivationReason    DeactivationReason?
  deactivationRemarks   String?            // free-text detail, e.g. "moved to another state"
  ...
}

enum DeactivationReason {
  DROPOUT
  TRANSFERRED
  DISCIPLINARY
  DATA_CLEANUP
  OTHER
}
```

**Why on `User` and not `Student`:** `active` already lives on `User` (it applies to teachers/principals too, not just students), so the tracking fields belong there for symmetry — dropout is just one `DeactivationReason` value that only makes sense when `role = STUDENT`.

**Code touch points to update so the new fields actually get populated (otherwise this becomes another `isPlaced`-style dead field):**
- `backend/src/api/system-admin/services/user-management.service.ts` — set `deactivatedAt/deactivatedBy/deactivationReason` wherever it sets `active: false` (single and bulk-action paths, ~lines 280-450).
- `backend/prisma/seed-inactivate-students.ts` — pass `deactivationReason: DATA_CLEANUP` (or add a `--reason=` flag) instead of leaving it unset.
- Reactivation path should clear `deactivatedAt/By/Reason` (or keep history — **please confirm**: do you want the *last* deactivation reason kept even after reactivation, for historical reporting, or cleared on reactivate?).
- Any State-Directorate dropout dashboard/report should filter `role=STUDENT, active=false, deactivationReason=DROPOUT` and use `deactivatedAt` for trend charts, instead of just counting all `active=false` students as dropouts (which would currently overcount, since it also includes cleanup/discipline/transfer cases).

## 6. Placement flag ("is the student placed or not") — IMPLEMENTED

**Current state (the actual gap):**
- `report-generator.service.ts:788-789` **hardcodes** `placementsCount: 0, isPlaced: false` — this is a stub, not real data. Today the system cannot actually answer "is this student placed."
- Two adjacent-but-different things already exist and should **not** be confused with placement:
  - `Student.prePlacementOfferReceived` (+ `prePlacementOfferMarkedAt`, `prePlacementOfferCompany`) — a PPO *during* the internship, self-reported by the student.
  - `StudentPlacementInterest` — the student's stated *future intent* (private job / B.Tech / govt job prep), not an outcome.

**Decision (confirmed with you):** simple flag + minimal detail, not a full Placement model.

**What was implemented:**
- `schema.prisma`: `Student.isPlaced` (`Boolean @default(false)`), `placedAt`, `placedCompany`, `placedPackage` (`Float?`, e.g. LPA — went with numeric per the plan's recommendation, for future averaging), plus an index on `isPlaced`. Same migration file as §5.
- Who can set it — **resolved as Principal only**, via the new placement action in the Student List (§7); students do not self-report this (kept separate from `prePlacementOfferReceived`, which is still self-reported).
- `backend/src/api/principal/dto/update-student.dto.ts` — added `isPlaced`, `placedCompany`, `placedPackage` (validated, `placedPackage` numeric).
- `backend/src/api/principal/principal.service.ts` — `updateStudent()`: when `isPlaced` flips to `true`, `placedAt` is stamped server-side; when it flips to `false`, `placedAt/placedCompany/placedPackage` are all cleared server-side (regardless of what the client sent), so unmarking a student always leaves a clean state.
- `report-generator.service.ts`'s hardcoded `isPlaced: false` stub was **not** touched in this pass — it's a read-side report builder outside today's ask (principal Student List). Flag if you want that report wired to the real field next; it's a small follow-up now that the field exists.

**Proposed change (for reference)** — added to `Student` model:

```prisma
model Student {
  ...
  isPlaced       Boolean   @default(false)
  placedAt       DateTime?
  placedCompany  String?
  placedPackage  String?   // e.g. "3.5 LPA" or a stipend/salary string — confirm format below
  ...
}
```

All three open items above are now resolved (see "What was implemented").

## 7. Principal Student List UI — IMPLEMENTED

`frontend/src/features/principal/students/StudentList.jsx` (route `/app/students`) was updated:

- **Actions column**: the three-dot (`Dropdown` + `MoreOutlined`) menu was replaced with 4 inline icon buttons under an "Actions" column header — View, Edit, Reset Password, and a new Placement action (trophy icon, turns green when the student is already placed).
- **Placement**: clicking the Placement action opens a confirmation modal — a `Switch` for Placed/Not Placed, plus Company and Package (LPA) fields shown only when Placed is on. Saving calls the existing `updateStudent` action with `{ isPlaced, placedCompany, placedPackage }`.
- **Status tag → deactivation modal**: the Status tag is now clickable. Clicking an **Active** tag opens a confirmation modal requiring a deactivation **reason** (dropdown: Dropout/Transferred/Disciplinary/Data Cleanup/Other) and optional remarks, then calls the `toggleStudentStatus` thunk (now wired to the dedicated `PATCH /principal/students/:id/toggle-status` endpoint instead of the plain `isActive` update, so mentor assignments/internship applications keep getting cascaded correctly, same as before, plus the new reason is recorded). Clicking an **Inactive** tag shows a simple activate confirmation (no reason needed) via `Modal.confirm`.
- The old "Deactivate/Activate" item that lived inside the three-dot menu was removed — that action now lives on the status tag itself, per your request.
- **Not touched**: `frontend/src/features/principal/students/AllStudents.jsx` (route `/app/all-students`, reached via "View Details") has its own separate three-dot menu. Your message said "student list page" — I've read that as `StudentList.jsx` specifically (the `/app/students` table). Let me know if you also want the same actions-column/status-tag treatment applied there; I left it as-is for now to keep this change contained to one page as requested.

## Running the migration

The migration file exists at `backend/prisma/migrations/20260921120000_add_student_placement_and_user_deactivation_tracking/migration.sql` but **has not been applied to any database** — this sandbox has no reachable Postgres instance (`DATABASE_URL` points at `127.0.0.1:5432`, which isn't running here). It only adds a new enum and nullable/defaulted columns, so it's safe to run with the standard flow whenever you're ready:

```
cd backend
npx prisma migrate deploy   # applies pending migrations to whatever DATABASE_URL points at
```

`npx prisma generate` has already been run locally against the updated schema, and `npx tsc --noEmit` and a full `vite build` both pass with the new code.

## Summary of schema changes

| Area | Status | Action |
|---|---|---|
| Institution type + ownership | Deferred (held back) | Combined enum design proposed in §1; not implemented — needs your confirmation on which kinds need all 3 ownership variants, and the production backfill strategy, before touching live data |
| Course-level sanctioned seats | Already exists | None (`BranchIntake.sanctionedSeats`) |
| Staff sanctioned seats | Already exists | None (`BranchStaffCapacity.sanctionedPosts`, `Institution.totalStaffSeats`) |
| Clearance status (appeared/passed) | Deferred (held back) | Adding `APPEARED`, `PASSED` to `ClearanceStatus` is zero-risk and still planned in §4, just not bundled into this pass since nothing asked for it yet |
| Dropout via deactivation + recorded timestamp | **Implemented** | `DeactivationReason` enum + `User.deactivatedAt/By/Reason/Remarks`; wired into Principal's `toggleStudentStatus` + new Student List deactivation modal |
| Placement flag | **Implemented** | `Student.isPlaced/placedAt/placedCompany/placedPackage`; wired into Principal's `updateStudent` + new Student List placement modal |
| Principal Student List UI (actions column, status tag) | **Implemented** | See §7 |

## Why §1 (institution type/ownership) and §4 (clearance appeared/passed) were held back

You asked to keep this pass small since the system is in production. §5, §6, and §7 were unambiguous and directly needed for the UI you described, so they're done. §1 and §4 were left out because:
- **§1 is genuinely risky**: it requires renaming enum values that already sit on live `Institution` rows (e.g. `POLYTECHNIC` → `GOVT_POLYTECHNIC`), which means a data backfill, not just a schema addition — and there's still an open question on exactly which kind × ownership combinations you need. Doing that carelessly in the same pass as everything else is how migrations lose data.
- **§4 is low-risk but wasn't asked for right now** — nothing in this feature request touches clearance status, so bundling it in would be exactly the kind of unnecessary extra change you asked me to avoid. It's a one-line addition whenever you want it.

Say the word and I'll take either one on as its own focused pass.

## Non-goals / not covered by this plan
- The migration has not been run against any database yet (see "Running the migration" in §7) — apply it with `npx prisma migrate deploy` when you're ready.
- `report-generator.service.ts`'s hardcoded `isPlaced: false` stub was left as-is (see §6) — a small follow-up now that the real field exists.
- `frontend/src/features/principal/students/AllStudents.jsx` was left untouched (see §7) — say if you want the same treatment there.
- Does not touch any real student/personal data — per Vibha's data-protection policy, no student records were uploaded or exported while producing or implementing this plan; only the schema and code structure were inspected/changed.
