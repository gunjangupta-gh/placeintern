/**
 * Post-Migration Branch Fix Script
 *
 * Run this AFTER server-migrate-mongo-to-postgres.ts to fix branch data.
 *
 * This script:
 * 1. Creates branches from unique Student.branchName values (if not exists)
 * 2. Links Student.branchId to the corresponding Branch record
 * 3. Syncs User.branchName from linked Student.branchName (for STUDENT users)
 * 4. Normalizes faculty (TEACHER) branchName to match Branch table values
 *
 * Usage:
 *   npx tsx prisma/post-migrate-fix-branches.ts
 *   npx tsx prisma/post-migrate-fix-branches.ts --dry-run
 *   npx tsx prisma/post-migrate-fix-branches.ts --verbose
 *   DATABASE_URL="postgresql://..." npx tsx prisma/post-migrate-fix-branches.ts
 */

import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// =============================================================================
// Configuration
// =============================================================================

interface Config {
  databaseUrl: string;
  dryRun: boolean;
  verbose: boolean;
  batchSize: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    databaseUrl: process.env.DATABASE_URL || '',
    dryRun: false,
    verbose: false,
    batchSize: 500,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
      case '-d':
        config.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--batch-size':
      case '-b':
        config.batchSize = parseInt(args[++i], 10) || 500;
        break;
      case '--database-url':
      case '-u':
        config.databaseUrl = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
Post-Migration Branch Fix Script

USAGE:
  npx tsx prisma/post-migrate-fix-branches.ts [OPTIONS]

OPTIONS:
  -d, --dry-run             Preview changes without applying them
  -v, --verbose             Enable verbose logging
  -b, --batch-size <n>      Batch size for updates (default: 500)
  -u, --database-url <url>  PostgreSQL connection URL
  -h, --help                Show this help message

ENVIRONMENT VARIABLES:
  DATABASE_URL              PostgreSQL connection URL

EXAMPLES:
  # Run with dry-run to preview changes
  npx tsx prisma/post-migrate-fix-branches.ts --dry-run

  # Run with verbose logging
  npx tsx prisma/post-migrate-fix-branches.ts --verbose

  # Run with custom database URL
  npx tsx prisma/post-migrate-fix-branches.ts -u "postgresql://user:pass@host:5432/db"
`);
}

// =============================================================================
// Logging Utilities
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

let verboseMode = false;

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('');
  log('='.repeat(70), 'cyan');
  log(` ${title}`, 'cyan');
  log('='.repeat(70), 'cyan');
}

function logStep(step: number, title: string): void {
  console.log('');
  log(`--- Step ${step}: ${title} ---`, 'blue');
}

function logSuccess(message: string): void {
  log(`  ✓ ${message}`, 'green');
}

function logWarning(message: string): void {
  log(`  ⚠ ${message}`, 'yellow');
}

function logError(message: string): void {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message: string): void {
  log(`  ℹ ${message}`, 'cyan');
}

function logVerbose(message: string): void {
  if (verboseMode) {
    log(`    ${message}`, 'gray');
  }
}

function logProgress(current: number, total: number, label: string): void {
  const percent = Math.round((current / total) * 100);
  process.stdout.write(`\r  Processing ${label}: ${current}/${total} (${percent}%)   `);
}

function logProgressDone(): void {
  process.stdout.write('\n');
}

// =============================================================================
// Branch Name Normalization Mapping
// =============================================================================

// Comprehensive mapping of messy branchName values to clean standardized names
const branchNormalizationMap: Record<string, string> = {
  // CSE variants
  'cse': 'CSE',
  'Cse': 'CSE',
  'CSE ': 'CSE',
  ' CSE': 'CSE',
  'C.S.E': 'CSE',
  'C.S.E.': 'CSE',
  'Computer Science': 'CSE',
  'Computer Science Engineering': 'CSE',
  'Computer science engineering': 'CSE',
  'Computer Science and Engineering': 'CSE',
  'Computer science and engineering': 'CSE',
  'Computer Science &amp; Engineering': 'CSE',
  'Computer science & Engineering': 'CSE',
  'Computer Science & Engineering': 'CSE',
  'COMPUTER SCIENCE AND ENGINEERING': 'CSE',
  'COMPUTER SCIENCE': 'CSE',

  // ECE variants
  'ece': 'ECE',
  'Ece': 'ECE',
  'ECE ': 'ECE',
  ' ECE': 'ECE',
  'E.C.E': 'ECE',
  'E.C.E.': 'ECE',
  'Electronics': 'ECE',
  'Electronics and Communication': 'ECE',
  'Electronics and Communication Engineering': 'ECE',
  'Electronics & Communication Engineering': 'ECE',
  'Electronics And Communication Engineering': 'ECE',
  'ELECTRONICS AND COMMUNICATION ENGINEERING': 'ECE',
  'ELECTRONICS': 'ECE',

  // EE / Electrical variants
  'ee': 'EE',
  'Ee': 'EE',
  'EE ': 'EE',
  ' EE': 'EE',
  'E.E': 'EE',
  'E.E.': 'EE',
  'Electrical': 'EE',
  'Electrical Engineering': 'EE',
  'Electrical engineering': 'EE',
  'ELECTRICAL ENGINEERING': 'EE',
  'Electrical Engg': 'EE',
  'Electrical Engg.': 'EE',
  'ELECTRICAL ENGG.': 'EE',
  'ELECTRICAL ENGG': 'EE',
  'Electrical engineer': 'EE',
  'Electrical Engineer': 'EE',
  'Electriccal Engineering': 'EE',
  'Electical Engineering': 'EE',
  'ELECTRICAL': 'EE',

  // ME / Mechanical variants
  'me': 'ME',
  'Me': 'ME',
  'ME ': 'ME',
  ' ME': 'ME',
  'M.E': 'ME',
  'M.E.': 'ME',
  'MECH': 'ME',
  'Mech': 'ME',
  'mech': 'ME',
  'Mechanical': 'ME',
  'mechanical': 'ME',
  'Mechanical Engineering': 'ME',
  'Mechanical engineering': 'ME',
  'MECHANICAL ENGINEERING': 'ME',
  'Mechanical Engg': 'ME',
  'Mechanical Engg.': 'ME',
  'MECHANICAL': 'ME',

  // CE / Civil variants
  'ce': 'CE',
  'Ce': 'CE',
  'CE ': 'CE',
  ' CE': 'CE',
  'C.E': 'CE',
  'C.E.': 'CE',
  'CIVIL': 'CE',
  'Civil': 'CE',
  'civil': 'CE',
  'Civil Engineering': 'CE',
  'Civil engineering': 'CE',
  'CIVIL ENGINEERING': 'CE',
  'Civil Engg': 'CE',
  'Civil Engg.': 'CE',

  // IT variants
  'it': 'IT',
  'It': 'IT',
  'IT ': 'IT',
  ' IT': 'IT',
  'I.T': 'IT',
  'I.T.': 'IT',
  'Information Technology': 'IT',
  'Information technology': 'IT',
  'INFORMATION TECHNOLOGY': 'IT',
  'Info Tech': 'IT',

  // Other common branches
  'LT': 'LT',
  'lt': 'LT',
  'Leather Technology': 'LT',
  'AS': 'AS',
  'Applied Science': 'AS',
  'Applied Sciences': 'AS',
};

function normalizeBranchName(branchName: string | null | undefined): string | null {
  if (!branchName) return null;

  const trimmed = branchName.trim();
  if (!trimmed) return null;

  // Try exact match first
  if (branchNormalizationMap[trimmed]) {
    return branchNormalizationMap[trimmed];
  }

  // Try case-insensitive match
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(branchNormalizationMap)) {
    if (key.toLowerCase() === lowerTrimmed) {
      return value;
    }
  }

  // Try removing extra spaces and special characters
  const cleaned = trimmed.replace(/\s+/g, ' ').replace(/[^\w\s&]/g, '');
  if (branchNormalizationMap[cleaned]) {
    return branchNormalizationMap[cleaned];
  }

  // Return original (trimmed) if no mapping found
  return trimmed;
}

// =============================================================================
// Statistics Tracking
// =============================================================================

interface Stats {
  branchesCreated: number;
  branchesExisted: number;
  studentsLinked: number;
  studentsAlreadyLinked: number;
  studentsNotFound: number;
  usersSynced: number;
  usersAlreadySynced: number;
  facultyNormalized: number;
  facultyCleared: number;
  errors: string[];
}

function createStats(): Stats {
  return {
    branchesCreated: 0,
    branchesExisted: 0,
    studentsLinked: 0,
    studentsAlreadyLinked: 0,
    studentsNotFound: 0,
    usersSynced: 0,
    usersAlreadySynced: 0,
    facultyNormalized: 0,
    facultyCleared: 0,
    errors: [],
  };
}

// =============================================================================
// Database Operations
// =============================================================================

async function withTransaction<T>(
  client: PoolClient,
  operation: () => Promise<T>,
  config: Config
): Promise<T> {
  if (config.dryRun) {
    return operation();
  }

  try {
    await client.query('BEGIN');
    const result = await operation();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function safeQuery(
  client: PoolClient,
  query: string,
  params: any[],
  stats: Stats,
  errorContext: string
): Promise<any> {
  try {
    return await client.query(query, params);
  } catch (error: any) {
    const errorMsg = `${errorContext}: ${error.message}`;
    stats.errors.push(errorMsg);
    logVerbose(`Error: ${errorMsg}`);
    return null;
  }
}

// =============================================================================
// Migration Steps
// =============================================================================

async function analyzeCurrentState(client: PoolClient, config: Config): Promise<void> {
  logStep(1, 'Analyzing current state');

  // Check if tables exist
  const tablesCheck = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('Student', 'User', 'branches', 'Institution')
  `);

  const existingTables = tablesCheck.rows.map(r => r.table_name);
  logInfo(`Found tables: ${existingTables.join(', ')}`);

  if (!existingTables.includes('Student')) {
    throw new Error('Student table not found. Run main migration first.');
  }

  if (!existingTables.includes('branches')) {
    logWarning('branches table not found. It will be created.');
  }

  // Student statistics
  const studentStats = await client.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN "branchId" IS NOT NULL THEN 1 END) as with_branch_id,
      COUNT(CASE WHEN "branchName" IS NOT NULL AND "branchName" != '' THEN 1 END) as with_branch_name,
      COUNT(CASE WHEN "branchId" IS NULL AND "branchName" IS NOT NULL AND "branchName" != '' THEN 1 END) as needs_linking
    FROM "Student"
  `);

  const ss = studentStats.rows[0];
  logInfo(`Students: ${ss.total} total`);
  logInfo(`  - With branchId: ${ss.with_branch_id}`);
  logInfo(`  - With branchName: ${ss.with_branch_name}`);
  logInfo(`  - Needs linking: ${ss.needs_linking}`);

  // Branch statistics
  try {
    const branchCount = await client.query(`SELECT COUNT(*) as count FROM branches`);
    logInfo(`Existing branches: ${branchCount.rows[0].count}`);
  } catch {
    logInfo(`Existing branches: 0 (table does not exist)`);
  }

  // User statistics by role
  const userStats = await client.query(`
    SELECT
      role,
      COUNT(*) as total,
      COUNT(CASE WHEN "branchName" IS NOT NULL AND "branchName" != '' THEN 1 END) as with_branch
    FROM "User"
    WHERE role IS NOT NULL
    GROUP BY role
    ORDER BY total DESC
  `);

  logInfo('Users by role:');
  userStats.rows.forEach(row => {
    logInfo(`  - ${row.role}: ${row.total} total, ${row.with_branch} with branchName`);
  });

  // Check User-Student sync status
  const syncStatus = await client.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN u."branchName" = s."branchName" THEN 1 END) as synced,
      COUNT(CASE WHEN u."branchName" IS NULL AND s."branchName" IS NOT NULL THEN 1 END) as user_missing,
      COUNT(CASE WHEN u."branchName" != s."branchName" THEN 1 END) as mismatch
    FROM "User" u
    JOIN "Student" s ON s."userId" = u.id
    WHERE u.role = 'STUDENT'
  `);

  const sync = syncStatus.rows[0];
  logInfo(`User-Student sync status (STUDENT role):`);
  logInfo(`  - Total: ${sync.total}`);
  logInfo(`  - Synced: ${sync.synced}`);
  logInfo(`  - User branchName missing: ${sync.user_missing}`);
  logInfo(`  - Mismatch: ${sync.mismatch}`);
}

async function ensureBranchesTableExists(client: PoolClient, config: Config): Promise<void> {
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'branches'
    ) as exists
  `);

  if (!tableCheck.rows[0].exists) {
    logInfo('Creating branches table...');

    if (!config.dryRun) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS branches (
          "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "name" VARCHAR(255) NOT NULL,
          "shortName" VARCHAR(50),
          "code" VARCHAR(50) UNIQUE NOT NULL,
          "duration" INTEGER DEFAULT 3,
          "isActive" BOOLEAN DEFAULT true,
          "institutionId" TEXT,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);

      // Add foreign key if Institution table exists
      try {
        await client.query(`
          ALTER TABLE branches
          ADD CONSTRAINT "branches_institutionId_fkey"
          FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL
        `);
      } catch {
        logVerbose('Could not add Institution FK (may already exist or Institution table missing)');
      }

      // Create indexes
      await client.query(`CREATE INDEX IF NOT EXISTS "branches_institutionId_idx" ON branches("institutionId")`);
      await client.query(`CREATE INDEX IF NOT EXISTS "branches_isActive_idx" ON branches("isActive")`);

      logSuccess('branches table created');
    } else {
      logWarning('DRY RUN: Would create branches table');
    }
  }
}

async function createBranchesFromStudents(
  client: PoolClient,
  config: Config,
  stats: Stats
): Promise<Map<string, string>> {
  logStep(2, 'Creating branches from Student.branchName');

  // Get institution ID
  let institutionId: string | null = null;
  try {
    const institutionResult = await client.query(`SELECT id FROM "Institution" LIMIT 1`);
    institutionId = institutionResult.rows[0]?.id || null;
    if (institutionId) {
      logInfo(`Institution ID: ${institutionId}`);
    } else {
      logWarning('No institution found. Branches will be created without institution link.');
    }
  } catch {
    logWarning('Could not fetch institution ID');
  }

  // Get distinct branch names from Student
  const distinctBranches = await client.query(`
    SELECT DISTINCT "branchName", COUNT(*) as student_count
    FROM "Student"
    WHERE "branchName" IS NOT NULL AND TRIM("branchName") != ''
    GROUP BY "branchName"
    ORDER BY student_count DESC
  `);

  logInfo(`Found ${distinctBranches.rows.length} distinct branchNames in Student table`);

  const branchNameToId = new Map<string, string>();
  const processedCodes = new Set<string>();

  for (const row of distinctBranches.rows) {
    const originalName = row.branchName;
    const normalizedName = normalizeBranchName(originalName) || originalName.trim();
    const shortName = normalizedName.length <= 4
      ? normalizedName.toUpperCase()
      : normalizedName.substring(0, 4).toUpperCase();

    // Generate unique code
    let code = normalizedName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    if (!code) code = `BRANCH_${Date.now()}`;

    // Ensure code is unique
    let uniqueCode = code;
    let counter = 1;
    while (processedCodes.has(uniqueCode)) {
      uniqueCode = `${code}_${counter++}`;
    }
    processedCodes.add(uniqueCode);

    // Check if branch already exists (by normalized name)
    const existing = await client.query(
      `SELECT id, name FROM branches WHERE LOWER(name) = LOWER($1) OR code = $2`,
      [normalizedName, uniqueCode]
    );

    if (existing.rows.length > 0) {
      // Map both original and normalized names to existing branch ID
      branchNameToId.set(originalName.toLowerCase().trim(), existing.rows[0].id);
      branchNameToId.set(normalizedName.toLowerCase(), existing.rows[0].id);
      stats.branchesExisted++;
      logVerbose(`Branch exists: "${normalizedName}" (${existing.rows[0].id})`);
    } else {
      if (!config.dryRun) {
        const result = await safeQuery(
          client,
          `INSERT INTO branches (id, name, "shortName", code, duration, "isActive", "institutionId", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, 3, true, $4, NOW(), NOW())
           RETURNING id`,
          [normalizedName, shortName, uniqueCode, institutionId],
          stats,
          `Creating branch "${normalizedName}"`
        );

        if (result && result.rows.length > 0) {
          const newId = result.rows[0].id;
          branchNameToId.set(originalName.toLowerCase().trim(), newId);
          branchNameToId.set(normalizedName.toLowerCase(), newId);
          stats.branchesCreated++;
          logSuccess(`Created branch: ${normalizedName} (${uniqueCode}) - ${row.student_count} students`);
        }
      } else {
        logInfo(`DRY RUN: Would create branch: ${normalizedName} (${uniqueCode})`);
        stats.branchesCreated++;
      }
    }
  }

  // Also load any existing branches not in our map
  const allBranches = await client.query(`SELECT id, name FROM branches`);
  for (const branch of allBranches.rows) {
    const key = branch.name.toLowerCase();
    if (!branchNameToId.has(key)) {
      branchNameToId.set(key, branch.id);
    }
  }

  logInfo(`Branch name to ID map has ${branchNameToId.size} entries`);
  return branchNameToId;
}

async function linkStudentsToBranches(
  client: PoolClient,
  config: Config,
  stats: Stats,
  branchNameToId: Map<string, string>
): Promise<void> {
  logStep(3, 'Linking Student.branchId to Branch');

  // Get students that need linking
  const studentsToUpdate = await client.query(`
    SELECT id, "branchName"
    FROM "Student"
    WHERE "branchName" IS NOT NULL AND TRIM("branchName") != '' AND "branchId" IS NULL
  `);

  const total = studentsToUpdate.rows.length;
  logInfo(`Students needing branchId link: ${total}`);

  if (total === 0) {
    logSuccess('All students already have branchId linked');
    return;
  }

  let processed = 0;
  const batchSize = config.batchSize;

  for (let i = 0; i < total; i += batchSize) {
    const batch = studentsToUpdate.rows.slice(i, i + batchSize);

    for (const student of batch) {
      const normalizedName = normalizeBranchName(student.branchName);
      const lookupKey = (normalizedName || student.branchName).toLowerCase().trim();
      const branchId = branchNameToId.get(lookupKey) || branchNameToId.get(student.branchName.toLowerCase().trim());

      if (branchId) {
        if (!config.dryRun) {
          await safeQuery(
            client,
            `UPDATE "Student" SET "branchId" = $1, "branchName" = $2 WHERE id = $3`,
            [branchId, normalizedName || student.branchName.trim(), student.id],
            stats,
            `Linking student ${student.id}`
          );
        }
        stats.studentsLinked++;
      } else {
        stats.studentsNotFound++;
        logVerbose(`No branch found for: "${student.branchName}"`);
      }

      processed++;
    }

    logProgress(Math.min(processed, total), total, 'students');
  }

  logProgressDone();
  logSuccess(`Linked ${stats.studentsLinked} students to branches`);

  if (stats.studentsNotFound > 0) {
    logWarning(`${stats.studentsNotFound} students could not be linked (branch not found)`);
  }

  // Check already linked students
  const alreadyLinked = await client.query(`
    SELECT COUNT(*) as count FROM "Student" WHERE "branchId" IS NOT NULL
  `);
  stats.studentsAlreadyLinked = parseInt(alreadyLinked.rows[0].count) - stats.studentsLinked;
}

async function syncUserBranchNames(
  client: PoolClient,
  config: Config,
  stats: Stats
): Promise<void> {
  logStep(4, 'Syncing User.branchName from Student (STUDENT role)');

  // Count how many need syncing
  const needsSync = await client.query(`
    SELECT COUNT(*) as count
    FROM "User" u
    JOIN "Student" s ON s."userId" = u.id
    WHERE u.role = 'STUDENT'
      AND (u."branchName" IS DISTINCT FROM s."branchName")
  `);

  const total = parseInt(needsSync.rows[0].count);
  logInfo(`Users needing branchName sync: ${total}`);

  if (total === 0) {
    logSuccess('All STUDENT users already have synced branchName');
    return;
  }

  if (!config.dryRun) {
    const result = await client.query(`
      UPDATE "User" u
      SET "branchName" = s."branchName"
      FROM "Student" s
      WHERE s."userId" = u.id
        AND u.role = 'STUDENT'
        AND (u."branchName" IS DISTINCT FROM s."branchName")
    `);

    stats.usersSynced = result.rowCount || 0;
    logSuccess(`Synced ${stats.usersSynced} User records with Student.branchName`);
  } else {
    stats.usersSynced = total;
    logInfo(`DRY RUN: Would sync ${total} User records`);
  }

  // Count already synced
  const alreadySynced = await client.query(`
    SELECT COUNT(*) as count
    FROM "User" u
    JOIN "Student" s ON s."userId" = u.id
    WHERE u.role = 'STUDENT' AND u."branchName" = s."branchName"
  `);
  stats.usersAlreadySynced = parseInt(alreadySynced.rows[0].count);
}

async function normalizeFacultyBranchNames(
  client: PoolClient,
  config: Config,
  stats: Stats,
  branchNameToId: Map<string, string>
): Promise<void> {
  logStep(5, 'Normalizing faculty branchName (TEACHER/PRINCIPAL)');

  // Get distinct non-student branchNames
  const facultyBranches = await client.query(`
    SELECT DISTINCT "branchName", COUNT(*) as count
    FROM "User"
    WHERE role IN ('TEACHER', 'PRINCIPAL')
      AND "branchName" IS NOT NULL
      AND TRIM("branchName") != ''
    GROUP BY "branchName"
    ORDER BY count DESC
  `);

  logInfo(`Found ${facultyBranches.rows.length} distinct faculty branchNames`);

  for (const row of facultyBranches.rows) {
    const oldValue = row.branchName.trim();
    const normalizedValue = normalizeBranchName(oldValue);

    if (!normalizedValue || normalizedValue === oldValue) {
      // Check if it's a valid branch name
      const isValidBranch = branchNameToId.has(oldValue.toLowerCase());

      if (!isValidBranch) {
        // Clear invalid branch names for PRINCIPAL
        if (!config.dryRun) {
          const result = await client.query(`
            UPDATE "User" SET "branchName" = NULL
            WHERE "branchName" = $1 AND role = 'PRINCIPAL'
          `, [row.branchName]);
          stats.facultyCleared += result.rowCount || 0;
        }
        logVerbose(`Cleared unknown branchName for PRINCIPAL: "${oldValue}"`);
      }
      continue;
    }

    // Normalize the value
    if (!config.dryRun) {
      const result = await client.query(`
        UPDATE "User" SET "branchName" = $1
        WHERE "branchName" = $2 AND role IN ('TEACHER', 'PRINCIPAL')
      `, [normalizedValue, row.branchName]);

      if (result.rowCount && result.rowCount > 0) {
        stats.facultyNormalized += result.rowCount;
        logSuccess(`Normalized: "${oldValue}" -> "${normalizedValue}" (${result.rowCount} users)`);
      }
    } else {
      logInfo(`DRY RUN: Would normalize "${oldValue}" -> "${normalizedValue}" (${row.count} users)`);
      stats.facultyNormalized += parseInt(row.count);
    }
  }

  if (stats.facultyNormalized > 0 || stats.facultyCleared > 0) {
    logSuccess(`Faculty: ${stats.facultyNormalized} normalized, ${stats.facultyCleared} cleared`);
  } else {
    logInfo('No faculty branchNames needed normalization');
  }
}

async function verifyResults(client: PoolClient, config: Config): Promise<void> {
  logStep(6, 'Final Verification');

  // Student verification
  const studentVerify = await client.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN "branchId" IS NOT NULL THEN 1 END) as with_branch_id,
      COUNT(CASE WHEN "branchId" IS NULL AND "branchName" IS NOT NULL THEN 1 END) as missing_link
    FROM "Student"
  `);

  const sv = studentVerify.rows[0];
  logInfo(`Students: ${sv.with_branch_id}/${sv.total} now have branchId`);
  if (parseInt(sv.missing_link) > 0) {
    logWarning(`${sv.missing_link} students still missing branchId`);
  }

  // Branch counts
  const branchCounts = await client.query(`
    SELECT b.name, b.code, COUNT(s.id) as student_count
    FROM branches b
    LEFT JOIN "Student" s ON s."branchId" = b.id
    GROUP BY b.id, b.name, b.code
    ORDER BY student_count DESC
  `);

  logInfo('Branches with student counts:');
  branchCounts.rows.forEach(row => {
    logInfo(`  ${row.name} (${row.code}): ${row.student_count} students`);
  });

  // User sync verification
  const userVerify = await client.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN u."branchName" = s."branchName" THEN 1 END) as synced
    FROM "User" u
    JOIN "Student" s ON s."userId" = u.id
    WHERE u.role = 'STUDENT'
  `);

  const uv = userVerify.rows[0];
  logInfo(`User-Student sync: ${uv.synced}/${uv.total} STUDENT users synced`);

  // Faculty branchNames
  const facultyVerify = await client.query(`
    SELECT "branchName", COUNT(*) as count
    FROM "User"
    WHERE role = 'TEACHER' AND "branchName" IS NOT NULL AND "branchName" != ''
    GROUP BY "branchName"
    ORDER BY count DESC
  `);

  if (facultyVerify.rows.length > 0) {
    logInfo('TEACHER branchNames:');
    facultyVerify.rows.forEach(row => {
      logInfo(`  ${row.branchName}: ${row.count}`);
    });
  }
}

function printSummary(stats: Stats, config: Config, duration: number): void {
  logSection('Summary');

  if (config.dryRun) {
    logWarning('DRY RUN MODE - No changes were made');
    console.log('');
  }

  log('┌─────────────────────────────────────────────────────────────────┐', 'cyan');
  log('│                      MIGRATION RESULTS                          │', 'cyan');
  log('├─────────────────────────────────────────────────────────────────┤', 'cyan');
  log(`│  Branches created:        ${String(stats.branchesCreated).padStart(8)}                         │`, 'cyan');
  log(`│  Branches existed:        ${String(stats.branchesExisted).padStart(8)}                         │`, 'cyan');
  log(`│  Students linked:         ${String(stats.studentsLinked).padStart(8)}                         │`, 'cyan');
  log(`│  Students already linked: ${String(stats.studentsAlreadyLinked).padStart(8)}                         │`, 'cyan');
  log(`│  Students not found:      ${String(stats.studentsNotFound).padStart(8)}                         │`, stats.studentsNotFound > 0 ? 'yellow' : 'cyan');
  log(`│  Users synced:            ${String(stats.usersSynced).padStart(8)}                         │`, 'cyan');
  log(`│  Faculty normalized:      ${String(stats.facultyNormalized).padStart(8)}                         │`, 'cyan');
  log(`│  Faculty cleared:         ${String(stats.facultyCleared).padStart(8)}                         │`, 'cyan');
  log(`│  Duration:                ${String(duration.toFixed(2) + 's').padStart(8)}                         │`, 'cyan');
  log('└─────────────────────────────────────────────────────────────────┘', 'cyan');

  if (stats.errors.length > 0) {
    console.log('');
    logWarning(`${stats.errors.length} errors occurred:`);
    stats.errors.slice(0, 10).forEach(err => logError(err));
    if (stats.errors.length > 10) {
      logWarning(`... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log('');
  if (stats.errors.length === 0 && !config.dryRun) {
    log('✓ Post-migration branch fix completed successfully!', 'green');
  } else if (config.dryRun) {
    log('ℹ Dry run completed. Run without --dry-run to apply changes.', 'cyan');
  } else {
    log('⚠ Post-migration completed with some errors. Review above.', 'yellow');
  }
}

// =============================================================================
// Main Function
// =============================================================================

async function main() {
  const config = parseArgs();
  verboseMode = config.verbose;

  if (!config.databaseUrl) {
    logError('DATABASE_URL environment variable is required');
    logInfo('Usage: DATABASE_URL="postgresql://..." npx tsx prisma/post-migrate-fix-branches.ts');
    process.exit(1);
  }

  logSection('Post-Migration Branch Fix');
  log(`Database: ${config.databaseUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  log(`Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  log(`Verbose: ${config.verbose ? 'Yes' : 'No'}`);
  log(`Batch Size: ${config.batchSize}`);

  if (config.dryRun) {
    console.log('');
    logWarning('DRY RUN MODE - No changes will be made to the database');
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const stats = createStats();
  const startTime = Date.now();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    logSuccess('Connected to database');

    // Step 1: Analyze
    await analyzeCurrentState(client, config);

    // Ensure branches table exists
    await ensureBranchesTableExists(client, config);

    // Step 2: Create branches
    const branchNameToId = await withTransaction(
      client,
      () => createBranchesFromStudents(client!, config, stats),
      config
    );

    // Step 3: Link students
    await withTransaction(
      client,
      () => linkStudentsToBranches(client!, config, stats, branchNameToId),
      config
    );

    // Step 4: Sync users
    await withTransaction(
      client,
      () => syncUserBranchNames(client!, config, stats),
      config
    );

    // Step 5: Normalize faculty
    await withTransaction(
      client,
      () => normalizeFacultyBranchNames(client!, config, stats, branchNameToId),
      config
    );

    // Step 6: Verify
    await verifyResults(client, config);

    const duration = (Date.now() - startTime) / 1000;
    printSummary(stats, config, duration);

  } catch (error: any) {
    logError(`Fatal error: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
