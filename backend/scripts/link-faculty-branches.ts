import { PrismaClient, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

type BranchLite = {
  id: string;
  name: string;
  shortName: string;
  code: string;
  institutionId: string | null;
};

type FacultyLite = {
  id: string;
  name: string;
  email: string | null;
  role: Role | null;
  branchName: string | null;
  branchId: string | null;
  institutionId: string | null;
};

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const overwrite = args.includes('--overwrite');
const verbose = args.includes('--verbose');
const facultyOnly = args.includes('--faculty-only');

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addToMap(
  map: Map<string, BranchLite[]>,
  key: string,
  branch: BranchLite,
) {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(branch);
  map.set(key, current);
}

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

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const branches = await prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        code: true,
        institutionId: true,
      },
    });

    const faculties = await prisma.user.findMany({
      where: {
        ...(facultyOnly ? { role: { in: [Role.TEACHER, Role.PRINCIPAL] } } : {}),
        branchName: { not: null },
        ...(overwrite ? {} : { branchId: null }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchName: true,
        branchId: true,
        institutionId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const byInstitution = new Map<string, Map<string, BranchLite[]>>();
    const global = new Map<string, BranchLite[]>();

    for (const branch of branches) {
      const instKey = branch.institutionId ?? '__no_institution__';
      if (!byInstitution.has(instKey)) {
        byInstitution.set(instKey, new Map<string, BranchLite[]>());
      }

      const localMap = byInstitution.get(instKey)!;
      const keys = [normalize(branch.name), normalize(branch.shortName), normalize(branch.code)];

      for (const key of keys) {
        addToMap(localMap, key, branch);
        addToMap(global, key, branch);
      }
    }

    let matched = 0;
    let updated = 0;
    let alreadyLinked = 0;
    let skippedEmptyBranchName = 0;
    let notFound = 0;
    let ambiguous = 0;

    console.log('='.repeat(70));
    console.log(`LINK ${facultyOnly ? 'FACULTY' : 'USERS'} -> BRANCH BY branchName`);
    console.log('='.repeat(70));
    console.log(`Users to process: ${faculties.length}`);
    console.log(`Dry run: ${isDryRun ? 'YES' : 'NO'}`);
    console.log(`Overwrite existing branchId: ${overwrite ? 'YES' : 'NO'}`);
    console.log(`Faculty only mode: ${facultyOnly ? 'YES' : 'NO'}`);

    for (const faculty of faculties as FacultyLite[]) {
      const source = faculty.branchName?.trim() ?? '';
      if (!source) {
        skippedEmptyBranchName += 1;
        continue;
      }

      const key = normalize(source);
      const instKey = faculty.institutionId ?? '__no_institution__';
      const localCandidates = byInstitution.get(instKey)?.get(key) ?? [];
      const localUnique = uniqueById(localCandidates);

      let selected: BranchLite | null = null;
      let isAmbiguous = false;

      if (localUnique.length === 1) {
        selected = localUnique[0];
      } else if (localUnique.length > 1) {
        isAmbiguous = true;
      } else {
        const globalCandidates = uniqueById(global.get(key) ?? []);
        if (globalCandidates.length === 1) {
          selected = globalCandidates[0];
        } else if (globalCandidates.length > 1) {
          isAmbiguous = true;
        }
      }

      if (isAmbiguous) {
        ambiguous += 1;
        if (verbose) {
          console.log(
            `[AMBIGUOUS] ${faculty.name} (${faculty.email ?? 'no-email'}) branchName="${source}"`,
          );
        }
        continue;
      }

      if (!selected) {
        notFound += 1;
        if (verbose) {
          console.log(
            `[NOT FOUND] ${faculty.name} (${faculty.email ?? 'no-email'}) branchName="${source}"`,
          );
        }
        continue;
      }

      matched += 1;

      if (faculty.branchId === selected.id) {
        alreadyLinked += 1;
        if (verbose) {
          console.log(`[ALREADY] ${faculty.name} -> ${selected.name} (${selected.code})`);
        }
        continue;
      }

      if (!isDryRun) {
        await prisma.user.update({
          where: { id: faculty.id },
          data: { branchId: selected.id },
        });
      }

      updated += 1;
      console.log(
        `${isDryRun ? '[DRY]' : '[UPDATED]'} ${faculty.name} -> ${selected.name} (${selected.code})`,
      );
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total users scanned: ${faculties.length}`);
    console.log(`Matched: ${matched}`);
    console.log(`Updated: ${updated}`);
    console.log(`Already linked: ${alreadyLinked}`);
    console.log(`No branchName: ${skippedEmptyBranchName}`);
    console.log(`Not found: ${notFound}`);
    console.log(`Ambiguous: ${ambiguous}`);

    if (isDryRun) {
      console.log('\nDry run mode enabled. No database changes were made.');
    }
  } catch (error: any) {
    console.error('Failed to link faculties to branches:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();