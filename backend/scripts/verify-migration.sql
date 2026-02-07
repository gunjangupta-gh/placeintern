-- Verification Queries After Migration

-- 1. Check no records use deprecated fields
SELECT COUNT(*) as deprecated_fields_check FROM "InternshipApplication"
WHERE "hasJoined" IS NOT NULL
   OR "reviewedBy" IS NOT NULL
   OR "internshipStatus" IS NOT NULL;
-- Should return 0

-- 2. Check all records have valid internshipPhase
SELECT COUNT(*) FROM "InternshipApplication"
WHERE "internshipPhase" IS NULL;
-- Should return 0

-- 3. Check phase distribution
SELECT "internshipPhase", COUNT(*)
FROM "InternshipApplication"
GROUP BY "internshipPhase";

-- 4. Check active students with active internships
SELECT COUNT(*) FROM "InternshipApplication" ia
JOIN "Student" s ON ia."studentId" = s.id
WHERE s."isActive" = true AND ia."internshipPhase" = 'ACTIVE';
