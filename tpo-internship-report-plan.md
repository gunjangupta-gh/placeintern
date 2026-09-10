# TPO Internship Report — Implementation Plan

## Data protection note (please read first)

`D:\chrome download\tpo gathering data from student.xlsx` contains one row of **real student
data** (name, registration number) in addition to the column headers. Per org policy, student
identifiers should not be uploaded to Claude without governance approval. Only the **column
headers** were used to design this plan — no student names/numbers from the file are stored,
repeated, or used as sample data below. Recommend not re-sharing the filled version of this file
in chat again; if headers are needed again, a stripped copy (header row only) is safer.

## 1. Purpose

Punjab's TPO (Training & Placement Officer) / DTE process periodically asks each polytechnic to
gather internship details directly from students — including informal/self-arranged internships
that were never run through the app's formal internship workflow. This is **not** the permanent
internship record for the student; it's a standalone data-collection log that a Principal fills in
per student, scoped to their own institution, mainly so State Directorate can pull a consolidated
export for government submission.

`InternshipApplication` remains the app's main/permanent internship table and is untouched by this
feature — no linkage, no promotion, no automation between the two. This is purely: **gather, list,
edit, export.**

## 2. Decisions locked in (from your answers)

- **Standalone table**, no relation to `InternshipApplication`. Confirmed: "I just want to gather
  the record only" — no promote/link/sync mechanism.
- **Purpose**: periodic government export. Principals maintain the data; State Directorate
  exports it in the template layout when a submission is due.
- **Access**: PRINCIPAL creates/edits/deletes reports for their own institution's students only.
  STATE_DIRECTORATE is read-only across all institutions, plus the Excel export.
- **Entry method**: manual form only (no bulk upload for this table).

## 3. Data model

Student identity/college/district/course/semester are derived via the `studentId` relation (to
`Student` → `User` for name/roll no/contact, and `Student` → `Institution` for college/district) —
not duplicated. Everything else the government form asks for that doesn't exist anywhere in the
schema lives directly on this table, since it's independent of any application record.

The faculty mentor is linked to an actual `User` record (role `TEACHER` or `FACULTY_COORDINATOR`)
instead of free-text name/contact/designation — same pattern already used for `mentorId` on
`InternshipApplication` (`@relation("StudentMentor")`). Name, phone, and designation are then
always read live off that `User` row, so a correction to a teacher's phone number or designation
automatically reflects on every report instead of needing to be re-typed on each one.

Company entry reuses the existing shared `Company` table (`backend/prisma/schema.prisma`, already
powering the student self-identified internship company autocomplete at `GET /student/companies`).
`companyName` stays a plain string on `InternshipReport` — selecting an existing company just
auto-fills it (and other company fields), but typing a name not in the list is still accepted as a
new, manually-entered company (no foreign key, no forced selection). Two fields this form needs
that `Company` doesn't have yet (`website`, `industrySector`) are being added to that shared table
so the autofill covers them too, and other flows benefit going forward:

```prisma
model Company {
  // ...existing fields unchanged...
  website        String?
  industrySector String?
}
```

```prisma
enum EnrollmentStatus {
  ENROLLED
  DROPPED_OUT
}

enum InternshipMode {
  ONLINE
  OFFLINE
}

model InternshipReport {
  id String @id @default(uuid())

  studentId     String
  student       Student     @relation(fields: [studentId], references: [id])
  institutionId String      // denormalized from student, for fast principal/state scoping
  institution   Institution @relation(fields: [institutionId], references: [id])

  enrollmentStatus EnrollmentStatus @default(ENROLLED)

  companyName         String
  organizationWebsite String?
  modeOfInternship    InternshipMode?
  industrySector      String?

  isWorkInPunjab Boolean?
  workDistrict   String?  // filled when isWorkInPunjab = true
  workState      String?  // filled when isWorkInPunjab = false

  hrName        String?
  hrPhoneNumber String?

  isStipendOffered      Boolean?
  stipendAmountPerMonth Float?   // filled when isStipendOffered = true

  isOfferLetterReceived Boolean?
  offerLetterUrl        String?

  facultyMentorId String?
  facultyMentor   User?   @relation("ReportFacultyMentor", fields: [facultyMentorId], references: [id])

  createdBy String   // Principal user id who entered this record
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([institutionId])
  @@index([studentId])
  @@index([facultyMentorId])
}
```

Relations to add: `Student.internshipReports InternshipReport[]`,
`Institution.internshipReports InternshipReport[]`,
`User.mentoredInternshipReports InternshipReport[] @relation("ReportFacultyMentor")`.

### Resolved — the second "Course" column is the faculty mentor's branch
The header row has "Course" twice: once near the student fields (student's own course) and once
at the end alongside the faculty mentor's Contact Number/Designation. Confirmed: the second one is
the **mentor's branch/department**, not a duplicate. Since `facultyMentorId` links to a real
`User`, this is already covered for free — it's read from `facultyMentor.branchName` (the same
branch field already on `User` for TEACHER/FACULTY_COORDINATOR), no new column needed on
`InternshipReport`. On export, the two "Course" columns map to `student.branchName` and
`facultyMentor.branchName` respectively.

## 4. Business rules

- Server-side institution scoping on every route (not just hidden in the UI): a PRINCIPAL's
  `institutionId` comes from their JWT/user record, same pattern already used in
  `bulk-self-internship.controller.ts`. A principal can only create/read/edit/delete reports for
  students in their own institution.
- `studentId` must belong to the principal's own institution (validated server-side on create).
- `facultyMentorId`, if provided, must reference a `User` with role `TEACHER` or
  `FACULTY_COORDINATOR` belonging to the same institution (validated server-side, mirroring the
  existing `mentorId` validation pattern for `InternshipApplication`).
- `workDistrict` and `workState` are mutually exclusive based on `isWorkInPunjab`; validated in
  the DTO, not just the UI.
- `stipendAmountPerMonth` only meaningful when `isStipendOffered = true`; `offerLetterUrl` only
  meaningful when `isOfferLetterReceived = true`.

## 5. API routes (new module `backend/src/internship-report/`)

| Method | Route | Roles | Notes |
|---|---|---|---|
| POST | `/internship-reports` | PRINCIPAL | Body: `studentId` + all gathered fields. Validates student belongs to the principal's institution |
| GET | `/internship-reports` | PRINCIPAL, STATE_DIRECTORATE | PRINCIPAL auto-scoped to own institution; STATE_DIRECTORATE gets all, with optional `?institutionId=&district=` filters |
| GET | `/internship-reports/:id` | PRINCIPAL (own institution), STATE_DIRECTORATE | |
| PATCH | `/internship-reports/:id` | PRINCIPAL (own institution) | |
| DELETE | `/internship-reports/:id` | PRINCIPAL (own institution) | |
| GET | `/internship-reports/export` | STATE_DIRECTORATE | Streams an `.xlsx` with the government column order/headers, built the same way `template.controller.ts` builds template files |
| GET | `/internship-reports/companies` | PRINCIPAL | Same query as `student.service.ts#getCompanies` (search against the `Company` table), just exposed for this role too — powers the company autocomplete |

## 6. Frontend

- `frontend/src/features/principal/internship-reports/InternshipReportList.jsx` — table of this
  institution's gathered reports, "Add Report" button opens a modal:
  1. Search/select a student from the principal's own institution.
  2. **Company field is an AutoComplete** (same component/pattern as
     `SelfIdentifiedInternship.jsx`'s "Search Existing Company"): typing searches
     `/internship-reports/companies`, selecting a result auto-fills company name, website, and
     industry sector; if nothing matches, whatever was typed is kept as a new, manually-entered
     company — no restriction to only picking from the list.
  3. Form for the rest of the gathered fields (enrollment status, mode, work location toggle +
     district/state, HR name/phone, stipend toggle + amount, offer letter toggle + link, and a
     searchable **faculty mentor picker** listing the institution's TEACHER / FACULTY_COORDINATOR
     users — their phone and designation are shown read-only, pulled live from the selected user,
     not typed in).
- `frontend/src/features/state/internship-reports/InternshipReportOverview.jsx` — read-only table
  with district/institution filters + "Export for TPO Submission" button.
- Route additions in `AppRoutes.jsx` under both PRINCIPAL and STATE_DIRECTORATE sections, plus
  menu entries in `menuConfig.jsx`.

## 7. Migration & rollout

1. Add the Prisma model/enums above, `prisma migrate dev --name add_internship_report` (locally/on
   staging — this generates the SQL file, it does not itself touch production).
2. Backend module (controller/service/dto) following the existing `bulk-self-internship` folder
   structure for consistency.
3. Frontend pages + a lightweight service (no need for a full Redux slice unless the list needs
   heavy client-side caching — can add one if preferred).
4. Manual test: as PRINCIPAL, add a report for a student, edit it, delete it, confirm it never
   appears for a different institution's principal; as STATE_DIRECTORATE, confirm read-only
   access across institutions and that export produces the correct columns.

### Production safety — why this migration can't damage existing data

Everything in this change is **additive only**, nothing existing is touched:

- `InternshipReport` is a brand-new table — `CREATE TABLE`. It has zero rows on day one and no
  existing table's data is read, copied, or rewritten to create it.
- The only change to an existing table is two **nullable** columns on `Company`
  (`website`, `industrySector`), with no default value. On Postgres 11+ (confirmed provider:
  `postgresql`), adding a nullable column with no default is a metadata-only `ADD COLUMN` — it
  does not rewrite the table or scan existing rows, regardless of row count.
- No existing column is renamed, retyped, dropped, or given a new `NOT NULL`/default — the
  operations that *do* require a full table rewrite and long lock on Postgres.
- No existing enum value is removed or renamed (`EnrollmentStatus`/`InternshipMode` are new enums).
- The new foreign keys (`InternshipReport` → `Student`/`Institution`/`User`) are constraints on the
  new, empty table — validating them is instant since there are no rows yet. They do briefly touch
  the parent tables while the constraint is registered, so the standard precaution below still
  applies.

Standard precautions to follow regardless (this is what the actual PR review/deploy step should
verify, not something to skip because the change is additive):

1. Generate the migration against a **staging DB restored from a recent production snapshot** (not
   just an empty dev DB), and run it there first.
2. Review the generated SQL under `backend/prisma/migrations/.../migration.sql` by hand before it
   ships — confirm it's only `CREATE TABLE` / `CREATE TYPE` / nullable `ADD COLUMN`, nothing else.
3. Deploy with `prisma migrate deploy` (not `migrate dev`) in the production pipeline — it applies
   already-generated, already-reviewed SQL, it doesn't create/reset anything.
4. Take a fresh backup immediately before running it on production, per normal deploy process,
   even though rollback here is trivial (`DROP TABLE "InternshipReport"`, drop the two `Company`
   columns, drop the two enums — none of it can cascade into existing data).
5. Run it in a low-traffic window as a general habit, even though the lock duration here is
   expected to be negligible.

## 8. Explicitly out of scope for this version

- Bulk Excel upload for `InternshipReport` (manual form only).
- Any link, sync, or "promote" action to/from `InternshipApplication` — confirmed not wanted.
- Reporting periods/cycles (e.g., "Sept 2026 submission" vs "Jan 2027 submission") — one live
  record per gathered internship, exported whenever needed.

## Questions before I start building

1. Should `FACULTY_COORDINATOR` also get PRINCIPAL-equivalent write access for their institution,
   or is this strictly a PRINCIPAL-only feature?
2. For the export route, do you want the exact header text/line breaks from the source file (e.g.
   "Mode of Internship\r\n(Online / Offline)"), or cleaned-up single-line headers?
