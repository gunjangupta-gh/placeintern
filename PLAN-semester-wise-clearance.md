# Plan: Semester-wise clearance / result status

Status: **Phases 1-2 implemented (2026-10-08); phases 3-4 not built.**

Decisions confirmed: principal edits the whole college, faculty only their assigned students (active `MentorAssignment`); `CLEARED` is **blocked** (not just warned) until every earlier semester is `PASSED`; legacy `APPEARED`/`PASSED` students are moved to a semester 6 row and reset to `PENDING`; **no Excel bulk upload for semester status** (the existing student/staff bulk upload is untouched). Status set kept as `PENDING / APPEARED / PASSED / FAILED` + backlog count (Q1 default); status does not gate anything else (Q4 default).

Built: `StudentSemesterStatus` model + migration `20261008000000_add_student_semester_status` (**not yet applied to any database**: run `npx prisma migrate deploy`), `StudentSemesterStatusService` (rules + audit), `GET/PUT /principal|faculty/students/:id/semester-status[/:semester]`, CLEARED gate in principal and faculty `updateStudent` (only when the value actually changes) and on principal create, shared `SemesterStatusEditor` in both Student forms (edit mode).
Not built: list filters / multi-select bulk action, scheduler rollover alerts, report/dashboard counts, student read-only view.
Scope: `backend/prisma/schema.prisma`, principal + faculty student APIs, student-progress scheduler, Student form/profile/list UI, reports, bulk upload.

## 1. What exists today (verified in code)

| Fact | Where |
|---|---|
| Clearance is **one enum on the student**: `ClearanceStatus { PENDING, CLEARED, HOLD, REJECTED, APPEARED, PASSED }`, default `PENDING`. | `schema.prisma` `Student.clearanceStatus` |
| `APPEARED` / `PASSED` were added to mean the **final-exam** outcome only (`PLAN-institution-student-flags.md` §4). There is no `FAILED`. | same |
| It is edited from one dropdown in the principal Student form and one in the faculty Student form; AllStudents has a quick-change handler. | `StudentModal.jsx:400`, `FacultyStudentModal.jsx:432`, `AllStudents.jsx:378` |
| Backend just writes the value through; no rules, no history, no semester. | `principal.service.ts` (create/update), `faculty.service.ts:3216` |
| Nothing reads it to make a decision. Only the report builder echoes it. | `report-generator.service.ts:796` |
| The student's own profile has the clearance badge **commented out**. | `StudentProfile.jsx:637` |
| `ResultService` is a stub: `addResult` / `bulkUploadResults` throw "Academic results feature has been removed"; no `Semester`, `Subject` or `Result` tables exist in the schema. | `domain/academic/result/result.service.ts` |
| `Student.currentYear` / `currentSemester` (1-6) are maintained by cron on 1 Jul (odd) and 1 Jan (even). | `student-progress.scheduler.ts` |
| `Student.totalBacklogs` exists (default 0) but nothing computes it. | `schema.prisma` |

**Gap:** a student has one status, so we cannot say "passed sem 1-4, failed sem 5, sem 6 not yet appeared", cannot keep history, and cannot list who is behind in a given semester.

## 2. Proposed design

Keep `Student.clearanceStatus` as the **overall** decision (PENDING / CLEARED / HOLD / REJECTED), and add a per-semester record underneath it.

### 2.1 New table

```prisma
model StudentSemesterStatus {
  id          String   @id @default(uuid())
  studentId   String
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  semester    Int                      // 1-6
  academicYear String?                 // e.g. "2025-26", for reporting
  status      SemesterResultStatus @default(PENDING)
  backlogCount Int     @default(0)     // subjects still to clear after this semester
  remarks     String?
  updatedBy   String?                  // userId
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([studentId, semester])
  @@index([semester, status])
}

enum SemesterResultStatus {
  PENDING     // semester not finished / not yet recorded
  APPEARED    // exam written, result awaited
  PASSED      // all subjects cleared
  FAILED      // one or more subjects failed (see backlogCount)
}
```

Notes:
- One row per student per semester, upserted. `@@unique` prevents duplicates.
- `FAILED` + `backlogCount` covers "passed with backlog" (common in diploma); the count is the detail, the status is the filterable bucket. **Assumption, to confirm (Q1).**
- `Student.totalBacklogs` becomes **derived**: sum of `backlogCount` across the student's semesters, recomputed on every write.

### 2.2 Rules (enforced in the service, not just the UI)

1. A semester can only be set for `semester <= currentSemester` (no future results).
2. Allowed forward moves: `PENDING -> APPEARED -> PASSED | FAILED`; correction back to an earlier state is allowed for principal only and is audit-logged.
3. `PASSED` forces `backlogCount = 0`; `FAILED` requires `backlogCount >= 1`.
4. Setting overall `clearanceStatus = CLEARED` **warns** (or blocks, see Q3) if any semester `<= currentSemester - 1` is not `PASSED`.
5. Every change writes an `AuditLog` entry (old -> new, semester, actor), using the existing `AuditService`.

### 2.3 Legacy `APPEARED` / `PASSED` on `clearanceStatus`

Postgres cannot drop enum values cleanly, so keep them in the enum but stop offering them.
Migration/backfill: students currently `APPEARED` -> semester 6 row `APPEARED`; `PASSED` -> semester 6 row `PASSED`; their overall `clearanceStatus` set back to `PENDING`. This is a data change, so it ships as its own reviewed migration (see Phase 1) and is reversible by the inverse update.

## 3. API

Principal (`/principal/...`) and a matching read/write pair for faculty, same guards as today:

| Endpoint | Purpose |
|---|---|
| `GET /students/:id/semester-status` | all semesters for one student (fills missing ones as PENDING up to `currentSemester`) |
| `PUT /students/:id/semester-status/:semester` | set status, backlogs, remarks for one semester |
| `PUT /students/semester-status/bulk` | body: `{ semester, status, studentIds[] }` for "mark selected students as APPEARED for sem 5" |
| `POST /bulk/semester-status/upload` | Excel upload (below) |
| list filter: `GET /students?semester=5&semesterStatus=FAILED` | filtering and dashboards |

All institution-scoped from the logged-in principal, never from the request body (same rule as the bulk upload and institution fixes).

## 4. Bulk update (reuses the bulk framework we just extended)

Excel columns, all required: **Roll Number, Semester (1-6), Status (Appeared/Passed/Failed), Backlog Count, Remarks (optional)**. Validation: roll number belongs to the principal's college, semester `<= currentSemester`, status/backlog consistency (rule 3). Result report lists failed rows like the student upload does. Templates follow the same pattern (reference sheet, dropdowns). This is the realistic way to update a whole class after results are declared, since per-student editing does not scale.

## 5. Scheduler

Extend `StudentProgressScheduler` (already runs 1 Jul / 1 Jan):
- When a student's `currentSemester` advances, create the new semester's `PENDING` row.
- Any earlier semester still `PENDING` or `APPEARED` after rollover is flagged "result not updated" and surfaced to the principal as a notification/dashboard count, so statuses do not silently go stale.

## 6. UI

- **Student form (principal + faculty):** keep the existing overall "Clearance Status" dropdown; add a "Semester-wise Status" block beneath it: rows Sem 1..6, each with a status select and backlog input; future semesters disabled (same pattern as the read-only Current Year/Semester fields in your screenshot).
- **AllStudents profile:** a compact Sem 1-6 chip strip (colour by status) with backlog badge.
- **Student List:** new filters "Semester" + "Semester status" and a bulk action on selected rows ("Update semester result").
- **Student's own profile:** read-only strip (re-enable the commented-out clearance area).
- **Reports/dashboard:** counts of students per semester per status, and "students with backlogs"; replace the report builder's passthrough of the single value.

## 7. Phasing

| Phase | Content | Risk |
|---|---|---|
| 1 | Schema + migration + enum + backfill of legacy APPEARED/PASSED; service with rules + audit; per-student GET/PUT | Low; additive except the backfill |
| 2 | Student form semester block (principal + faculty), AllStudents chips | Low |
| 3 | List filters, bulk select update, Excel bulk upload | Medium (largest UI + bulk validation) |
| 4 | Scheduler rollover + stale-result alerts, reports/dashboard counts, student read-only view | Low |

Each phase is independently shippable; Phase 1+2 already answer "which sem is passed/failed/appeared" per student.

## 8. Decisions needed from you

1. **Status set:** is `PENDING / APPEARED / PASSED / FAILED` + backlog count enough, or do you need more (e.g. Detained, Absent, Result Withheld, Reappear)? Do students who pass with backlogs count as `PASSED` or `FAILED` for you?
2. **Who edits:** principal only, or principal + faculty (as the clearance field works today)? Should faculty be limited to their assigned students?
3. **Gate for CLEARED:** warn only, or block until all earlier semesters are PASSED?
4. **Does status affect anything else** (internship eligibility, placement, certificates)? Today clearance gates nothing; if you want it to, that is a separate rule set and should be specified before building.
5. **Legacy values:** OK to backfill existing APPEARED/PASSED into semester 6 and reset overall clearance to PENDING?

## 9. Assumptions and non-goals

- Assumed: 3-year / 6-semester programmes (matches the scheduler's caps). Courses with different durations (e.g. 2-year) would need `Branch.duration`-aware limits.
- Not in scope: subject-wise marks, SGPA/CGPA, or reviving the removed Result/Semester/Subject models. This plan tracks **outcome per semester**, not marks.
- Per Vibha's data-protection policy, no student records were read, uploaded or exported to produce this plan; only schema and code were inspected. Excel files for bulk semester updates contain student identifiers, so test with anonymised data only.
