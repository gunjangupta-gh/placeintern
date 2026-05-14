/**
 * Fix Staff Branch Data Migration Script
 *
 * This script fixes inconsistencies between branchId and branchName on User (staff) records:
 * 1. Staff with branchName but no branchId: Links to matching branch
 * 2. Staff with branchId but mismatched branchName: Updates branchName to match branch
 *
 * Usage:
 *   npx ts-node scripts/fix-staff-branch-data.ts           # dry run (default)
 *   npx ts-node scripts/fix-staff-branch-data.ts --execute # actually fix
 */

import { PrismaClient, Role, Branch, User } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// =============================================
// Types
// =============================================

interface BranchLite {
  id: string;
  name: string;
  shortName: string;
  code: string;
  institutionId: string | null;
}

interface StaffRecord {
  id: string;
  name: string;
  email: string | null;
  role: Role | null;
  branchName: string | null;
  branchId: string | null;
  institutionId: string | null;
  branch: BranchLite | null;
}

interface FixResult {
  type: 'link_branch' | 'update_name';
  staffId: string;
  staffName: string;
  staffEmail: string | null;
  oldBranchName: string | null;
  newBranchName: string | null;
  oldBranchId: string | null;
  newBranchId: string | null;
  branchCode: string;
}

interface UnresolvableStaff {
  id: string;
  name: string;
  email: string | null;
  branchName: string;
  reason: string;
}

// =============================================
// Parse Arguments
// =============================================

const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isDryRun = !isExecute;

// =============================================
// Utility Functions
// =============================================

/**
 * Normalize a string for comparison: lowercase, trim, remove extra spaces
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings (Levenshtein distance based)
 * Returns a value between 0 and 1, where 1 is exact match
 */
function similarity(s1: string, s2: string): number {
  const n1 = normalize(s1);
  const n2 = normalize(s2);

  if (n1 === n2) return 1;
  if (n1.length === 0 || n2.length === 0) return 0;

  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;

  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longerLength - distance) / longerLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Check if branchName is "close enough" to the actual branch name/shortName
 * Returns true if similarity is >= 0.8 (80% match)
 */
function isCloseEnough(branchName: string, branch: BranchLite): boolean {
  const THRESHOLD = 0.8;

  const simName = similarity(branchName, branch.name);
  const simShort = similarity(branchName, branch.shortName);

  return simName >= THRESHOLD || simShort >= THRESHOLD;
}

/**
 * Get the preferred display name for a branch (shortName if available, else name)
 */
function getBranchDisplayName(branch: BranchLite): string {
  return branch.shortName || branch.name;
}

/**
 * Build lookup maps for branches by normalized name/shortName
 */
function buildBranchMaps(branches: BranchLite[]): {
  byInstitution: Map<string, Map<string, BranchLite[]>>;
  global: Map<string, BranchLite[]>;
} {
  const byInstitution = new Map<string, Map<string, BranchLite[]>>();
  const global = new Map<string, BranchLite[]>();

  function addToMap(map: Map<string, BranchLite[]>, key: string, branch: BranchLite) {
    if (!key) return;
    const current = map.get(key) ?? [];
    current.push(branch);
    map.set(key, current);
  }

  for (const branch of branches) {
    const instKey = branch.institutionId ?? '__global__';

    if (!byInstitution.has(instKey)) {
      byInstitution.set(instKey, new Map<string, BranchLite[]>());
    }

    const localMap = byInstitution.get(instKey)!;
    const keys = [normalize(branch.name), normalize(branch.shortName), normalize(branch.code)];

    for (const key of keys) {
      if (key) {
        addToMap(localMap, key, branch);
        addToMap(global, key, branch);
      }
    }
  }

  return { byInstitution, global };
}

/**
 * Find a unique branch match for a given branchName
 * Returns null if no match or ambiguous
 */
function findBranchMatch(
  branchName: string,
  institutionId: string | null,
  maps: { byInstitution: Map<string, Map<string, BranchLite[]>>; global: Map<string, BranchLite[]> },
): { branch: BranchLite | null; reason: string | null } {
  const key = normalize(branchName);
  const instKey = institutionId ?? '__global__';

  // Try institution-specific lookup first
  const localCandidates = maps.byInstitution.get(instKey)?.get(key) ?? [];
  const localUnique = uniqueById(localCandidates);

  if (localUnique.length === 1) {
    return { branch: localUnique[0], reason: null };
  }

  if (localUnique.length > 1) {
    return { branch: null, reason: `Ambiguous: ${localUnique.length} branches match within institution` };
  }

  // Try global lookup
  const globalCandidates = uniqueById(maps.global.get(key) ?? []);

  if (globalCandidates.length === 1) {
    return { branch: globalCandidates[0], reason: null };
  }

  if (globalCandidates.length > 1) {
    return { branch: null, reason: `Ambiguous: ${globalCandidates.length} branches match globally` };
  }

  return { branch: null, reason: 'No matching branch found' };
}

/**
 * Remove duplicate branches by ID
 */
function uniqueById(branches: BranchLite[]): BranchLite[] {
  const seen = new Set<string>();
  const result: BranchLite[] = [];

  for (const branch of branches) {
    if (!seen.has(branch.id)) {
      seen.add(branch.id);
      result.push(branch);
    }
  }

  return result;
}

// =============================================
// Main Script
// =============================================

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('='.repeat(70));
  console.log('FIX STAFF BRANCH DATA');
  console.log('='.repeat(70));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'EXECUTE (making changes)'}`);
  console.log('');

  try {
    // Fetch all branches
    const branches = await prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        institutionId: true,
      },
    });

    console.log(`Loaded ${branches.length} branches`);

    // Build lookup maps
    const branchMaps = buildBranchMaps(branches as BranchLite[]);

    // Create branch ID -> branch lookup
    const branchById = new Map<string, BranchLite>();
    for (const branch of branches) {
      branchById.set(branch.id, branch as BranchLite);
    }

    // Fetch staff (TEACHER, PRINCIPAL, ADMIN_STAFF roles)
    const staff = await prisma.user.findMany({
      where: {
        role: { in: [Role.TEACHER, Role.PRINCIPAL, Role.ADMIN_STAFF] },
        OR: [
          // Has branchName but no branchId
          { branchName: { not: null }, branchId: null },
          // Has branchId (may have mismatched branchName)
          { branchId: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchName: true,
        branchId: true,
        institutionId: true,
        branch: {
          select: {
            id: true,
            name: true,
            shortName: true,
            code: true,
            institutionId: true,
          },
        },
      },
    });

    console.log(`Found ${staff.length} staff records to check`);
    console.log('');

    const fixes: FixResult[] = [];
    const unresolvable: UnresolvableStaff[] = [];
    let skippedNoBranchInfo = 0;
    let alreadyCorrect = 0;

    for (const s of staff as StaffRecord[]) {
      // Skip staff with neither branchId nor branchName
      if (!s.branchId && !s.branchName) {
        skippedNoBranchInfo++;
        continue;
      }

      // Case 1: Has branchName but no branchId -> try to link
      if (s.branchName && !s.branchId) {
        const { branch, reason } = findBranchMatch(s.branchName, s.institutionId, branchMaps);

        if (branch) {
          fixes.push({
            type: 'link_branch',
            staffId: s.id,
            staffName: s.name,
            staffEmail: s.email,
            oldBranchName: s.branchName,
            newBranchName: getBranchDisplayName(branch),
            oldBranchId: null,
            newBranchId: branch.id,
            branchCode: branch.code,
          });
        } else {
          unresolvable.push({
            id: s.id,
            name: s.name,
            email: s.email,
            branchName: s.branchName,
            reason: reason ?? 'Unknown',
          });
        }
        continue;
      }

      // Case 2: Has branchId -> check if branchName matches
      if (s.branchId && s.branch) {
        const expectedName = getBranchDisplayName(s.branch);
        const currentName = s.branchName?.trim() ?? '';

        // If branchName is empty or null, update it
        if (!currentName) {
          fixes.push({
            type: 'update_name',
            staffId: s.id,
            staffName: s.name,
            staffEmail: s.email,
            oldBranchName: s.branchName,
            newBranchName: expectedName,
            oldBranchId: s.branchId,
            newBranchId: s.branchId,
            branchCode: s.branch.code,
          });
          continue;
        }

        // Check if names match (exact or normalized)
        if (normalize(currentName) === normalize(expectedName) || normalize(currentName) === normalize(s.branch.name)) {
          alreadyCorrect++;
          continue;
        }

        // Check if "close enough" (fuzzy match) - skip update if so
        if (isCloseEnough(currentName, s.branch)) {
          alreadyCorrect++;
          continue;
        }

        // Names are mismatched and not close enough - update
        fixes.push({
          type: 'update_name',
          staffId: s.id,
          staffName: s.name,
          staffEmail: s.email,
          oldBranchName: s.branchName,
          newBranchName: expectedName,
          oldBranchId: s.branchId,
          newBranchId: s.branchId,
          branchCode: s.branch.code,
        });
      }
    }

    // =============================================
    // Print Results
    // =============================================

    // Group fixes by type
    const linkFixes = fixes.filter((f) => f.type === 'link_branch');
    const nameFixes = fixes.filter((f) => f.type === 'update_name');

    console.log('='.repeat(70));
    console.log('CHANGES TO BE MADE');
    console.log('='.repeat(70));

    if (linkFixes.length > 0) {
      console.log(`\n--- Link branchId (${linkFixes.length} staff) ---`);
      for (const fix of linkFixes) {
        console.log(
          `  ${isDryRun ? '[DRY]' : '[FIX]'} ${fix.staffName} (${fix.staffEmail ?? 'no-email'})`,
        );
        console.log(`         branchName: "${fix.oldBranchName}" -> Link to ${fix.branchCode}`);
      }
    }

    if (nameFixes.length > 0) {
      console.log(`\n--- Update branchName (${nameFixes.length} staff) ---`);
      for (const fix of nameFixes) {
        console.log(
          `  ${isDryRun ? '[DRY]' : '[FIX]'} ${fix.staffName} (${fix.staffEmail ?? 'no-email'})`,
        );
        console.log(`         branchName: "${fix.oldBranchName}" -> "${fix.newBranchName}"`);
      }
    }

    if (fixes.length === 0) {
      console.log('\nNo fixes needed.');
    }

    // =============================================
    // Unresolvable Staff
    // =============================================

    if (unresolvable.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('UNRESOLVABLE STAFF (need manual review)');
      console.log('='.repeat(70));
      for (const u of unresolvable) {
        console.log(`  ${u.name} (${u.email ?? 'no-email'})`);
        console.log(`         branchName: "${u.branchName}"`);
        console.log(`         Reason: ${u.reason}`);
      }
    }

    // =============================================
    // Execute Changes
    // =============================================

    if (!isDryRun && fixes.length > 0) {
      console.log('\n' + '='.repeat(70));
      console.log('EXECUTING CHANGES...');
      console.log('='.repeat(70));

      let successCount = 0;
      let errorCount = 0;

      for (const fix of fixes) {
        try {
          if (fix.type === 'link_branch') {
            await prisma.user.update({
              where: { id: fix.staffId },
              data: {
                branchId: fix.newBranchId,
                branchName: fix.newBranchName,
              },
            });
          } else {
            await prisma.user.update({
              where: { id: fix.staffId },
              data: { branchName: fix.newBranchName },
            });
          }
          successCount++;
        } catch (error: any) {
          console.error(`  ERROR updating ${fix.staffName}: ${error.message}`);
          errorCount++;
        }
      }

      console.log(`\nCompleted: ${successCount} successful, ${errorCount} errors`);
    }

    // =============================================
    // Summary
    // =============================================

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total staff checked:       ${staff.length}`);
    console.log(`Already correct:           ${alreadyCorrect}`);
    console.log(`Skipped (no branch info):  ${skippedNoBranchInfo}`);
    console.log(`To link branchId:          ${linkFixes.length}`);
    console.log(`To update branchName:      ${nameFixes.length}`);
    console.log(`Unresolvable (manual):     ${unresolvable.length}`);

    if (isDryRun) {
      console.log('\n*** DRY RUN - No changes were made ***');
      console.log('Run with --execute to apply changes');
    }
  } catch (error: any) {
    console.error('\nFATAL ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
