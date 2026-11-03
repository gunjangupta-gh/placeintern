-- Branch-wise positions and application limits for internship opportunities.

ALTER TABLE "opportunity_branches"
  ADD COLUMN "positions" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "approvedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxApplications" INTEGER;

-- Backfill: split each opportunity's existing positions evenly across its branches
-- (remainder goes to the first branches, ordered by branchId).
WITH ranked AS (
  SELECT
    ob."opportunityId",
    ob."branchId",
    o."positions" AS total,
    COUNT(*)     OVER (PARTITION BY ob."opportunityId") AS n,
    ROW_NUMBER() OVER (PARTITION BY ob."opportunityId" ORDER BY ob."branchId") AS rn
  FROM "opportunity_branches" ob
  JOIN "internship_opportunities" o ON o."id" = ob."opportunityId"
)
UPDATE "opportunity_branches" ob
SET "positions" = GREATEST(1, (r.total / r.n) + CASE WHEN r.rn <= (r.total % r.n) THEN 1 ELSE 0 END)
FROM ranked r
WHERE ob."opportunityId" = r."opportunityId" AND ob."branchId" = r."branchId";

-- Confirmed students per branch (SELECTED / APPROVED / JOINED / COMPLETED)
UPDATE "opportunity_branches" ob
SET "approvedCount" = c.cnt
FROM (
  SELECT a."opportunityId", s."branchId", COUNT(*)::int AS cnt
  FROM "internship_applications" a
  JOIN "Student" s ON s."id" = a."studentId"
  WHERE a."opportunityId" IS NOT NULL
    AND a."isActive" = true
    AND a."status" IN ('SELECTED', 'APPROVED', 'JOINED', 'COMPLETED')
    AND s."branchId" IS NOT NULL
  GROUP BY a."opportunityId", s."branchId"
) c
WHERE ob."opportunityId" = c."opportunityId" AND ob."branchId" = c."branchId";

-- A branch can never have more positions than confirmed students
UPDATE "opportunity_branches" SET "positions" = "approvedCount" WHERE "approvedCount" > "positions";

-- Keep the opportunity totals equal to the sum of its branches
UPDATE "internship_opportunities" o
SET "positions" = t.p, "approvedCount" = t.a
FROM (
  SELECT "opportunityId", SUM("positions")::int AS p, SUM("approvedCount")::int AS a
  FROM "opportunity_branches" GROUP BY "opportunityId"
) t
WHERE o."id" = t."opportunityId";
