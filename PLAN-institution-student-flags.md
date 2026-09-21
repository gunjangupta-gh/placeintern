# Plan: Institution Type/Ownership, Sanctioned Seats, Clearance, Dropout & Placement Flags

Status: **Everything in this plan is now implemented** — §1 (institution type/ownership) and §4 (clearance `APPEARED`/`PASSED`) were originally held back in the first pass (see the now-historical "Why §1 and §4 were held back" note below §6), but were completed in a second pass once you asked for the create/edit-institution and clearance-status screenshots to be fixed. §8 covers everything added in that second pass: the institution type/ownership migration + UI, the clearance enum UI update, and rolling the deactivation-reason modal (§5/§7) out to every other page where a student can be deactivated (Principal's `AllStudents.jsx`, Faculty's two assigned-students pages, and State-Directorate's institute detail view).
Scope: `backend/prisma/schema.prisma` + the services/scripts/UI that read/write these fields.

## 1. Institution type (Polytechnic / Govt / Govt-Aided / Private / Special Trade Institute / ...) — IMPLEMENTED

**Original gap** (`schema.prisma`, before this change): `Institution.type` was a single enum `InstitutionType`: `POLYTECHNIC, ENGINEERING_COLLEGE, UNIVERSITY, DEGREE_COLLEGE, ITI, SKILL_CENTER` — no ownership axis at all, and no "Special Trade Institute" value.

**Decision (confirmed with you):** one combined enum, not two separate fields.

**What was implemented** — additive, non-destructive:
- `schema.prisma`: `InstitutionType` extended with 9 new ownership-aware values (`GOVT_POLYTECHNIC`, `GOVT_AIDED_POLYTECHNIC`, `PRIVATE_POLYTECHNIC`, `GOVT_ITI`, `GOVT_AIDED_ITI`, `PRIVATE_ITI`, `GOVT_SPECIAL_TRADE_INSTITUTE`, `GOVT_AIDED_SPECIAL_TRADE_INSTITUTE`, `PRIVATE_SPECIAL_TRADE_INSTITUTE`). `ENGINEERING_COLLEGE`, `UNIVERSITY`, `DEGREE_COLLEGE`, `SKILL_CENTER` are unchanged (no ownership variant needed there today). The legacy bare `POLYTECHNIC`/`ITI` values are **kept in the enum** (not removed) as a safety net, but are no longer offered in any UI and no row should reference them after the backfill below.
- `Institution.type`'s default changed from `POLYTECHNIC` to `GOVT_POLYTECHNIC`, since every institution seen so far is government-run.
- Two migrations (split because Postgres won't let a transaction use an enum value it just added in the same transaction):
  - `backend/prisma/migrations/20260921130000_extend_clearance_status_and_institution_type/migration.sql` — `ALTER TYPE ... ADD VALUE` only (this section's 9 new types + §4's `APPEARED`/`PASSED`).
  - `backend/prisma/migrations/20260921130100_backfill_institution_type_ownership/migration.sql` — data backfill: every existing row with `type = 'POLYTECHNIC'` → `GOVT_POLYTECHNIC`, `type = 'ITI'` → `GOVT_ITI`; then changes the column default. **No rows are deleted or renamed away from recoverability** — it's a plain `UPDATE ... SET type = ...`, reversible by re-running the inverse update if ever needed.
  - **Assumption made on your behalf** (flagged, not silently applied): every existing Polytechnic/ITI is assumed **Government**, since that matches what's been described about this program so far. If any institution is actually Government-Aided or Private, correct it via the Edit Institution screen after the migration runs — the dropdown now offers those options.
- `backend/src/api/state/dto/create-institution.dto.ts`, `backend/src/domain/institution/institution.service.ts` (the bulk-import string→enum mapper), `backend/src/bulk/bulk-institution/bulk-institution.service.ts` (Excel template sample + field docs) all updated to default to / accept the new `GOVT_*` values; old free-text `POLYTECHNIC`/`ITI` in an uploaded spreadsheet still map correctly to their Government equivalent (backward compatible with old spreadsheets).
- `backend/src/api/state/bot/tools/institution/institution-count.tool.ts` (the State-Directorate chatbot's institution-count tool) — reworked so "how many polytechnics" style questions still work correctly: it now takes an ownership-independent `kind` (POLYTECHNIC/ITI/SPECIAL_TRADE_INSTITUTE/...) plus an optional `ownership` (GOVT/GOVT_AIDED/PRIVATE) and expands `kind` to the matching set of enum values. Without this the chatbot would have silently returned 0 for "how many polytechnics" after the backfill, since no row would match the old bare `POLYTECHNIC` value any more.
- Frontend: `frontend/src/features/state/institutions/InstitutionModal.jsx` (Create/Edit Institution) — the Institution Type dropdown now lists all 13 current types with readable labels ("Govt. Polytechnic", "Private ITI", "Govt. Aided Special Trade Institute", etc.) instead of the old 6 bare enum names; new institutions default to "Govt. Polytechnic".

**Still open, not resolved by me:** whether any `ENGINEERING_COLLEGE`/`UNIVERSITY`/`DEGREE_COLLEGE`/`SKILL_CENTER` institution in your data actually needs a Private/Govt-Aided variant. I left those 4 kinds exactly as they were since nothing indicated they needed splitting; say so if that changes and I'll extend the enum the same additive way.

## 2. Course-level sanctioned seats (students)

**Already exists** — no gap here. `BranchIntake` (`schema.prisma:524-552`) has `sanctionedSeats Int` and `feeWaiverSeats Int`, scoped per `institutionId + branchId + academicYear` (branch = course/discipline). This is exactly "sanctioned seats per course per year." Nothing to build.

## 3. Staff sanctioned seats

**Already exists at two levels** — no gap here:
- Branch/course level: `BranchStaffCapacity` (`schema.prisma:554-579`) has `sanctionedPosts`, `filledPosts`, `guestFaculty`, per `institutionId + branchId + academicYear`.
- Institution level total: `Institution.totalStaffSeats` (`schema.prisma:407`).

Nothing to build here either, unless you want per-designation sanctioned seats (e.g. sanctioned Lecturer posts vs sanctioned Lab Technician posts) rather than one aggregate number per branch — flag if you need that finer breakdown.

## 4. Clearance status ("appeared", "passed") — IMPLEMENTED

**Original gap:** `Student.clearanceStatus` (enum `ClearanceStatus { PENDING, CLEARED, HOLD, REJECTED }`, editable by Principal/Faculty) had no way to record final-exam appearance/pass status.

**Decision (confirmed with you):** since the portal only carries final-year students (those enrolled for internships), extend the *same* enum rather than building a separate exam-result model.

**What was implemented:**
- `schema.prisma`: added `APPEARED` and `PASSED` to `ClearanceStatus` (no `FAILED` — kept to exactly what you asked for; easy to add later if needed).
- Migration: `ALTER TYPE "ClearanceStatus" ADD VALUE` in `backend/prisma/migrations/20260921130000_extend_clearance_status_and_institution_type/migration.sql` (additive only — existing rows keep whatever value they already have, no backfill needed).
- Frontend: the Clearance Status dropdown was hardcoded to the old 4 values in **two places** — `frontend/src/features/principal/students/StudentModal.jsx` and `frontend/src/features/faculty/students/FacultyStudentModal.jsx` (this is the modal shown in your screenshot). Both now list `Pending / Appeared (Final Exam) / Passed (Final Exam) / Cleared / Hold / Rejected`.

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
- `frontend/src/features/principal/students/AllStudents.jsx` (route `/app/all-students`) got the same treatment in the next round — see §8.

## 8. Rolling the deactivation-reason modal out everywhere a student can be deactivated — IMPLEMENTED

You asked for the Status-tag → deactivation-modal pattern to also apply to `/app/all-students`, and for every other page that can deactivate a student to use the same reason-capturing confirmation instead of whatever it had before. A survey of the codebase found 4 more entry points beyond `StudentList.jsx` (§7):

**Shared component:** `frontend/src/components/common/DeactivationConfirmModal.jsx` — a presentation-only modal (Reason `Select` + optional remarks `TextArea`, `DEACTIVATION_REASONS` exported) used by all 5 pages below instead of duplicating the same JSX 5 times. `StudentList.jsx` (§7) was refactored to use it too, so there's one place to change the reason list if it ever needs to grow.

**Backend — the reason now reaches every toggle-status endpoint, not just Principal's:**
- New shared `backend/src/core/common/dto/toggle-student-status.dto.ts` (`{ reason?, remarks? }`) replaces the Principal-only DTO from §5/§7.
- `backend/src/api/faculty/faculty.service.ts` (`toggleStudentStatus`) and `backend/src/api/state/services/state-mentor.service.ts` (`toggleStudentStatus`, called via `state.service.ts`) now stamp `deactivatedAt/deactivatedBy/deactivationReason/deactivationRemarks` on deactivate and clear them on reactivate, exactly like Principal's does — same pattern, same audit log detail (`[reason: ...]` appended to the description). Both controllers (`faculty.controller.ts`, `state.controller.ts`) now accept the DTO in the request body.
- Faculty and State's own toggle-status logic (mentor-assignment authorization check for Faculty, no such check for State, cascading to `MentorAssignment`/`InternshipApplication`) was **not otherwise changed** — only the deactivation-tracking fields were added on top.

**Frontend — 4 pages updated, each fitted to its existing layout rather than force-fitting one template:**
- **`frontend/src/features/principal/students/AllStudents.jsx`** (route `/app/all-students`, a master-detail layout, not a table): the profile header's three-dot `Dropdown` (Edit Profile / Add Document / Reset Credential / Deactivate) was replaced with 4 inline icon buttons (Edit, Add Document, Reset Credential, and a new Placement action, same as §6/§7) — no three-dot menu, matching your instruction. The Deactivate/Activate item was removed from there; the Status tag next to the student's name is now clickable and opens the same deactivation modal (Active → modal with reason; Inactive → simple activate confirm).
- **`frontend/src/features/faculty/students/AssignedStudents.jsx`**: already had a proper Actions column (no three-dot here) using `Popconfirm` on the Deactivate/Activate button. The Deactivate button now opens the shared modal instead of a plain yes/no `Popconfirm`; Activate keeps the simple `Popconfirm` (no reason needed to reactivate).
- **`frontend/src/features/faculty/students/AssignedStudentsList.jsx`**: had a three-dot Dropdown "Deactivate/Activate Student" item that toggled with **zero confirmation** of any kind. It now opens the shared modal when deactivating (reactivating still needs no reason, so it toggles immediately as before). This page's three-dot menu was left in place otherwise (Upload/Edit/Reset Password) — the instruction to remove three-dot menus was specific to the "student list" pages (§7/§8's `AllStudents.jsx`), so this one keeps its existing menu shape and only the confirmation behavior changed.
- **`frontend/src/features/state/dashboard/components/InstituteDetailView.jsx`**: had a Dropdown table-row action that opened a static `Modal.confirm` with no reason field. Deactivating now opens the shared modal (Activating keeps the existing simple `Modal.confirm`).

**Frontend service/slice plumbing:** `principal.service.js`, `faculty.service.js`, `state.service.js` (`toggleStudentStatus`) and the corresponding Redux thunks in `principalSlice.js`, `facultySlice.js`, `stateSlice.js` all now accept and forward `{ reason, remarks }` to their respective `PATCH .../toggle-status` endpoints. Existing call sites that don't pass a reason (there are a couple, e.g. reactivation paths) keep working — the backend defaults to `OTHER` when none is given.

## Running the migrations

Three migration folders now exist under `backend/prisma/migrations/`, none of them applied yet — this sandbox has no reachable Postgres instance (`DATABASE_URL` points at `127.0.0.1:5432`, which isn't running here):

1. `20260921120000_add_student_placement_and_user_deactivation_tracking` — §5/§7's `DeactivationReason` enum + `User`/`Student` columns.
2. `20260921130000_extend_clearance_status_and_institution_type` — §1/§4's new enum values only (`ALTER TYPE ... ADD VALUE`).
3. `20260921130100_backfill_institution_type_ownership` — §1's data backfill (`UPDATE "Institution" SET "type" = ...` for existing Polytechnic/ITI rows) + the new column default. **Must run after #2 has committed** (Postgres won't let a transaction use an enum value added in that same transaction) — running them in this numeric order via the standard command below handles that automatically, since Prisma applies pending migrations one at a time in order.

All three are additive/backfill-only — no column is dropped, retyped, or renamed, and the backfill only reassigns a `type` value on existing rows without touching any other column. Run them with the standard flow whenever you're ready:

```
cd backend
npx prisma migrate deploy   # applies all pending migrations, in order, to whatever DATABASE_URL points at
```

`npx prisma generate` has already been run locally against the updated schema, and `npx tsc --noEmit` (backend) and a full `vite build` (frontend) both pass with all the new code.

## Summary of schema changes

| Area | Status | Action |
|---|---|---|
| Institution type + ownership | **Implemented** | See §1 |
| Course-level sanctioned seats | Already exists | None (`BranchIntake.sanctionedSeats`) |
| Staff sanctioned seats | Already exists | None (`BranchStaffCapacity.sanctionedPosts`, `Institution.totalStaffSeats`) |
| Clearance status (appeared/passed) | **Implemented** | See §4 |
| Dropout via deactivation + recorded timestamp | **Implemented** | `DeactivationReason` enum + `User.deactivatedAt/By/Reason/Remarks`; wired into Principal/Faculty/State's `toggleStudentStatus` (§5, extended in §8) |
| Placement flag | **Implemented** | `Student.isPlaced/placedAt/placedCompany/placedPackage`; wired into Principal's `updateStudent` (§6) |
| Principal Student List UI (actions column, status tag) | **Implemented** | See §7 |
| Deactivation-reason modal on every other student page | **Implemented** | See §8 |

## Why §1 and §4 were held back in the first pass (historical - both are done now)

The first pass deliberately left §1 and §4 out to keep that changeset small, since neither was needed for the UI requested at the time and §1 in particular required a data backfill decision. You then asked for both directly (the create/edit-institution and clearance-status screenshots), so they were completed in the second pass documented in §1, §4, and §8 above. Kept here only so the reasoning for the original split isn't lost.

## Non-goals / not covered by this plan
- None of the migrations have been run against any database yet (see "Running the migrations" above) — apply them with `npx prisma migrate deploy` when you're ready. Do this in a maintenance window or low-traffic period even though they're additive, since an `ALTER TYPE` briefly locks the enum's catalog entry and the backfill touches every Institution row.
- `report-generator.service.ts`'s hardcoded `isPlaced: false` stub was left as-is (see §6) — a small follow-up now that the real field exists.
- Whether any `ENGINEERING_COLLEGE`/`UNIVERSITY`/`DEGREE_COLLEGE`/`SKILL_CENTER` institution needs a Private/Govt-Aided variant is still open (see §1's "Still open" note).
- Whether a `FAILED` clearance value is wanted alongside `APPEARED`/`PASSED` is still open (see §4).
- Does not touch any real student/personal data — per Vibha's data-protection policy, no student records were uploaded or exported while producing or implementing this plan; only the schema and code structure were inspected/changed.
