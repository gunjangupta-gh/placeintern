import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Staff roles to analyze
const STAFF_ROLES = [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF];

type StaffUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role | null;
  branchId: string | null;
  branchName: string | null;
  institutionId: string | null;
  branch: {
    id: string;
    name: string;
    shortName: string;
  } | null;
};

type BranchRecord = {
  id: string;
  name: string;
  shortName: string;
  code: string;
};

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function printSeparator(char = '=', length = 80): void {
  console.log(char.repeat(length));
}

function printHeader(title: string): void {
  console.log('');
  printSeparator();
  console.log(`  ${title}`);
  printSeparator();
}

function printSubHeader(title: string): void {
  console.log('');
  console.log(`--- ${title} ---`);
}

async function diagnose(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    printHeader('BRANCH DATA QUALITY DIAGNOSTIC REPORT');
    console.log(`  Generated at: ${new Date().toISOString()}`);
    console.log(`  Analyzing roles: ${STAFF_ROLES.join(', ')}`);
    printSeparator();

    // 1. Fetch all staff members
    const allStaff = await prisma.user.findMany({
      where: {
        role: { in: STAFF_ROLES },
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        branchName: true,
        institutionId: true,
        branch: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }) as StaffUser[];

    // 2. Fetch all branches for comparison
    const allBranches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
      },
    }) as BranchRecord[];

    // Build a lookup for branch names and short names (normalized)
    const branchNameLookup = new Map<string, BranchRecord>();
    const branchShortNameLookup = new Map<string, BranchRecord>();

    for (const branch of allBranches) {
      branchNameLookup.set(normalize(branch.name), branch);
      branchShortNameLookup.set(normalize(branch.shortName), branch);
    }

    // 3. Categorize staff
    const staffWithValidBranch: StaffUser[] = [];
    const staffOrphanedBranchName: StaffUser[] = []; // branchId=null but branchName!=null
    const staffMismatchedBranch: StaffUser[] = []; // branchId!=null but branchName doesn't match branch.name/shortName
    const staffNoBranchInfo: StaffUser[] = []; // branchId=null AND branchName=null

    const invalidBranchNames = new Map<string, number>(); // branchName values not found in Branch table

    for (const staff of allStaff) {
      const hasBranchId = staff.branchId !== null;
      const hasBranchName = staff.branchName !== null && staff.branchName.trim() !== '';

      if (!hasBranchId && !hasBranchName) {
        // No branch info at all
        staffNoBranchInfo.push(staff);
        continue;
      }

      if (!hasBranchId && hasBranchName) {
        // Orphaned branchName (no branchId)
        staffOrphanedBranchName.push(staff);

        // Check if branchName exists in Branch table
        const normalizedName = normalize(staff.branchName!);
        const existsInBranch =
          branchNameLookup.has(normalizedName) ||
          branchShortNameLookup.has(normalizedName);

        if (!existsInBranch) {
          const currentCount = invalidBranchNames.get(staff.branchName!) || 0;
          invalidBranchNames.set(staff.branchName!, currentCount + 1);
        }
        continue;
      }

      if (hasBranchId && staff.branch) {
        // Has branchId - check if branchName matches
        if (hasBranchName) {
          const normalizedBranchName = normalize(staff.branchName!);
          const normalizedActualName = normalize(staff.branch.name);
          const normalizedActualShortName = normalize(staff.branch.shortName);

          const matches =
            normalizedBranchName === normalizedActualName ||
            normalizedBranchName === normalizedActualShortName;

          if (matches) {
            staffWithValidBranch.push(staff);
          } else {
            staffMismatchedBranch.push(staff);
          }
        } else {
          // Has branchId but no branchName - still valid
          staffWithValidBranch.push(staff);
        }
        continue;
      }

      // branchId is set but branch relation is null (orphaned branchId)
      if (hasBranchId && !staff.branch) {
        staffMismatchedBranch.push(staff);
      }
    }

    // 4. Output detailed report
    printHeader('SUMMARY STATISTICS');

    console.log(`  Total active staff analyzed:        ${allStaff.length}`);
    console.log(`  Total branches in system:           ${allBranches.length}`);
    console.log('');
    console.log(`  Staff with valid branchId:          ${staffWithValidBranch.length}`);
    console.log(`  Staff with orphaned branchName:     ${staffOrphanedBranchName.length}`);
    console.log(`    (branchId=null but branchName!=null)`);
    console.log(`  Staff with mismatched branch data:  ${staffMismatchedBranch.length}`);
    console.log(`    (branchId set but branchName doesn't match)`);
    console.log(`  Staff with no branch info:          ${staffNoBranchInfo.length}`);
    console.log(`    (branchId=null AND branchName=null)`);

    // 5. Breakdown by role
    printSubHeader('Breakdown by Role');

    for (const role of STAFF_ROLES) {
      const roleStaff = allStaff.filter((s) => s.role === role);
      const roleOrphaned = staffOrphanedBranchName.filter((s) => s.role === role);
      const roleMismatched = staffMismatchedBranch.filter((s) => s.role === role);
      const roleNoBranch = staffNoBranchInfo.filter((s) => s.role === role);
      const roleValid = staffWithValidBranch.filter((s) => s.role === role);

      console.log(`\n  ${role}:`);
      console.log(`    Total:              ${roleStaff.length}`);
      console.log(`    Valid branchId:     ${roleValid.length}`);
      console.log(`    Orphaned name:      ${roleOrphaned.length}`);
      console.log(`    Mismatched:         ${roleMismatched.length}`);
      console.log(`    No branch info:     ${roleNoBranch.length}`);
    }

    // 6. Invalid/unknown branchName values
    printHeader('INVALID/UNKNOWN BRANCH NAMES');

    if (invalidBranchNames.size === 0) {
      console.log('  No invalid branch names found. All branchName values exist in Branch table.');
    } else {
      console.log(`  Found ${invalidBranchNames.size} unique branchName values not in Branch table:\n`);

      // Sort by count descending
      const sortedInvalid = Array.from(invalidBranchNames.entries()).sort(
        (a, b) => b[1] - a[1]
      );

      console.log('  Count  | Branch Name');
      console.log('  -------|' + '-'.repeat(60));

      for (const [branchName, count] of sortedInvalid) {
        const countStr = count.toString().padStart(5, ' ');
        console.log(`  ${countStr}  | "${branchName}"`);
      }
    }

    // 7. Sample of orphaned branchName records
    if (staffOrphanedBranchName.length > 0) {
      printHeader('SAMPLE: STAFF WITH ORPHANED branchName (max 20)');
      console.log('  These staff have branchName set but no branchId:\n');

      const sample = staffOrphanedBranchName.slice(0, 20);
      console.log('  Name                              | Email                              | Role                  | branchName');
      console.log('  ' + '-'.repeat(35) + '|' + '-'.repeat(36) + '|' + '-'.repeat(23) + '|' + '-'.repeat(30));

      for (const staff of sample) {
        const name = (staff.name || 'N/A').substring(0, 33).padEnd(33, ' ');
        const email = (staff.email || 'N/A').substring(0, 34).padEnd(34, ' ');
        const role = (staff.role || 'N/A').padEnd(21, ' ');
        const branchName = (staff.branchName || 'N/A').substring(0, 28);
        console.log(`  ${name} | ${email} | ${role} | ${branchName}`);
      }

      if (staffOrphanedBranchName.length > 20) {
        console.log(`\n  ... and ${staffOrphanedBranchName.length - 20} more`);
      }
    }

    // 8. Sample of mismatched records
    if (staffMismatchedBranch.length > 0) {
      printHeader('SAMPLE: STAFF WITH MISMATCHED BRANCH DATA (max 20)');
      console.log('  These staff have branchId but branchName doesn\'t match branch record:\n');

      const sample = staffMismatchedBranch.slice(0, 20);
      console.log('  Name                    | branchName (User)           | Branch Name (Actual)');
      console.log('  ' + '-'.repeat(24) + '|' + '-'.repeat(30) + '|' + '-'.repeat(30));

      for (const staff of sample) {
        const name = (staff.name || 'N/A').substring(0, 22).padEnd(22, ' ');
        const userBranchName = (staff.branchName || 'N/A').substring(0, 28).padEnd(28, ' ');
        const actualBranchName = staff.branch
          ? `${staff.branch.name} (${staff.branch.shortName})`.substring(0, 28)
          : 'BRANCH NOT FOUND';
        console.log(`  ${name} | ${userBranchName} | ${actualBranchName}`);
      }

      if (staffMismatchedBranch.length > 20) {
        console.log(`\n  ... and ${staffMismatchedBranch.length - 20} more`);
      }
    }

    // 9. Available branches for reference
    printHeader('AVAILABLE BRANCHES FOR REFERENCE');
    console.log(`  Total active branches: ${allBranches.length}\n`);
    console.log('  Code         | Short Name              | Full Name');
    console.log('  ' + '-'.repeat(13) + '|' + '-'.repeat(25) + '|' + '-'.repeat(40));

    for (const branch of allBranches.slice(0, 30)) {
      const code = branch.code.padEnd(11, ' ');
      const shortName = branch.shortName.substring(0, 23).padEnd(23, ' ');
      const fullName = branch.name.substring(0, 38);
      console.log(`  ${code} | ${shortName} | ${fullName}`);
    }

    if (allBranches.length > 30) {
      console.log(`\n  ... and ${allBranches.length - 30} more branches`);
    }

    // 10. Suggestions for fixes
    printHeader('SUGGESTIONS FOR FIXES');

    console.log('  1. ORPHANED branchName RECORDS:');
    console.log('     Run the link-faculty-branches.ts script to automatically match');
    console.log('     branchName values to branchId using fuzzy matching:');
    console.log('       npx ts-node scripts/link-faculty-branches.ts --dry-run');
    console.log('');

    console.log('  2. INVALID BRANCH NAMES:');
    if (invalidBranchNames.size > 0) {
      console.log('     The following branchName values need manual review/mapping:');
      const topInvalid = Array.from(invalidBranchNames.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [name, count] of topInvalid) {
        console.log(`       - "${name}" (${count} staff members)`);
      }
      console.log('     Consider adding these as aliases or correcting the data.');
    } else {
      console.log('     No action needed - all branchName values are valid.');
    }
    console.log('');

    console.log('  3. MISMATCHED RECORDS:');
    if (staffMismatchedBranch.length > 0) {
      console.log('     These records have branchId set but branchName doesn\'t match.');
      console.log('     Option A: Update branchName to match the linked branch');
      console.log('     Option B: Clear branchId and re-run the linking script');
      console.log('');
      console.log('     SQL to sync branchName from branch (CAUTION - backup first):');
      console.log('       UPDATE "User" u');
      console.log('       SET "branchName" = b.name');
      console.log('       FROM "branches" b');
      console.log('       WHERE u."branchId" = b.id AND u."branchName" != b.name;');
    } else {
      console.log('     No action needed - all linked branches have matching names.');
    }
    console.log('');

    console.log('  4. STAFF WITH NO BRANCH INFO:');
    if (staffNoBranchInfo.length > 0) {
      console.log(`     ${staffNoBranchInfo.length} staff members have no branch information at all.`);
      console.log('     These may need manual assignment or data collection.');
    } else {
      console.log('     No action needed - all staff have branch information.');
    }

    printSeparator();
    console.log('  END OF DIAGNOSTIC REPORT');
    printSeparator();

  } catch (error: any) {
    console.error('Error running diagnostic:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

diagnose()
  .catch(console.error)
  .finally(() => process.exit());
