/**
 * MongoDB to PostgreSQL Server Migration Script
 *
 * This script migrates all data from a MongoDB server to a PostgreSQL server.
 * Designed to run on a server for production migrations.
 *
 * Features:
 * - Configurable via environment variables or CLI arguments
 * - Connection testing before migration
 * - Dry-run mode for testing
 * - Batch processing for large datasets
 * - Progress logging and resume capability
 * - Graceful error handling
 *
 * Environment Variables:
 *   SOURCE_MONGODB_URL - MongoDB connection string (source)
 *   TARGET_DATABASE_URL - PostgreSQL connection string (target)
 *
 * Usage:
 *   # Using environment variables:
 *   SOURCE_MONGODB_URL="mongodb://..." TARGET_DATABASE_URL="postgresql://..." npx ts-node prisma/server-migrate-mongo-to-postgres.ts
 *
 *   # Using CLI arguments:
 *   npx ts-node prisma/server-migrate-mongo-to-postgres.ts \
 *     --mongodb-url "mongodb://user:pass@source-server:27017/db" \
 *     --postgres-url "postgresql://user:pass@target-server:5432/db" \
 *     --dry-run
 *
 *   # With batch size:
 *   npx ts-node prisma/server-migrate-mongo-to-postgres.ts --batch-size 500
 */

import {
  PrismaClient,
  ApplicationStatus,
  InternshipPhase,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { MongoClient, ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";

// =============================================================================
// Configuration
// =============================================================================

interface MigrationConfig {
  mongodbUrl: string;
  postgresUrl: string;
  dryRun: boolean;
  batchSize: number;
  skipClear: boolean;
  verbose: boolean;
}

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    mongodbUrl: process.env.SOURCE_MONGODB_URL || process.env.MONGODB_URL || "",
    postgresUrl:
      process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL || "",
    dryRun: false,
    batchSize: 1000,
    skipClear: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--mongodb-url":
      case "-m":
        config.mongodbUrl = args[++i];
        break;
      case "--postgres-url":
      case "-p":
        config.postgresUrl = args[++i];
        break;
      case "--dry-run":
      case "-d":
        config.dryRun = true;
        break;
      case "--batch-size":
      case "-b":
        config.batchSize = parseInt(args[++i], 10);
        break;
      case "--skip-clear":
      case "-s":
        config.skipClear = true;
        break;
      case "--verbose":
      case "-v":
        config.verbose = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
MongoDB to PostgreSQL Server Migration Script

USAGE:
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts [OPTIONS]

OPTIONS:
  -m, --mongodb-url <url>     MongoDB connection URL (source server)
  -p, --postgres-url <url>    PostgreSQL connection URL (target server)
  -d, --dry-run               Test connections without migrating data
  -b, --batch-size <number>   Number of records per batch (default: 1000)
  -s, --skip-clear            Skip clearing PostgreSQL tables before migration
  -v, --verbose               Enable verbose logging and error details
  -h, --help                  Show this help message

ENVIRONMENT VARIABLES:
  SOURCE_MONGODB_URL          MongoDB connection URL (alternative to -m)
  TARGET_DATABASE_URL         PostgreSQL connection URL (alternative to -p)

FEATURES:
  • Migrates 14 core collections from MongoDB to PostgreSQL
  • Automatically maps ObjectId to UUID
  • Handles foreign key constraints with proper ordering
  • Maps deprecated internshipStatus to new InternshipPhase enum
  • Displays comprehensive CLI report with statistics
  • Tracks and displays error details with --verbose flag
  • Shows ID mappings and migration time per collection

EXAMPLES:
  # Basic migration
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
    -m "mongodb://admin:password@source-vps:27017/cms_db?authSource=admin" \\
    -p "postgresql://user:password@target-vps:5432/cms_db"

  # Dry run to test connections
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
    -m "mongodb://..." -p "postgresql://..." --dry-run

  # Migration with verbose error reporting
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts \\
    -m "mongodb://..." -p "postgresql://..." --verbose

  # Using environment variables
  export SOURCE_MONGODB_URL="mongodb://..."
  export TARGET_DATABASE_URL="postgresql://..."
  npx ts-node prisma/server-migrate-mongo-to-postgres.ts
`);
}

// =============================================================================
// Logging Utilities
// =============================================================================

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset"): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log("");
  log("=".repeat(60), "cyan");
  log(title, "cyan");
  log("=".repeat(60), "cyan");
}

function logPhase(phase: string): void {
  console.log("");
  log(`--- ${phase} ---`, "blue");
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, "green");
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, "yellow");
}

function logError(message: string): void {
  log(`✗ ${message}`, "red");
}

function maskConnectionUrl(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
}

// =============================================================================
// ID Mapping
// =============================================================================

const idMaps: Record<string, Map<string, string>> = {
  users: new Map(),
  institutions: new Map(),
  students: new Map(),
  branches: new Map(),
  batches: new Map(),
  internshipApplications: new Map(),
  mentorAssignments: new Map(),
  documents: new Map(),
  notifications: new Map(),
  auditLogs: new Map(),
  grievances: new Map(),
  supportTickets: new Map(),
  monthlyReports: new Map(),
  facultyVisitLogs: new Map(),
};

function convertId(
  objectId: string | ObjectId | null | undefined,
  collection: string,
): string {
  if (!objectId) return "";
  const idStr = objectId.toString();
  const map = idMaps[collection];
  if (!map) {
    console.warn(`No ID map for collection: ${collection}`);
    return uuidv4();
  }
  if (!map.has(idStr)) {
    map.set(idStr, uuidv4());
  }
  return map.get(idStr)!;
}

function getMappedId(
  objectId: string | ObjectId | null | undefined,
  collection: string,
): string | null {
  if (!objectId) return null;
  const idStr = objectId.toString();
  const map = idMaps[collection];
  return map?.get(idStr) || null;
}

function processDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  let index = 0;

  const workers = Array.from({ length: effectiveLimit }, async () => {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      await handler(items[currentIndex]);
    }
  });

  await Promise.all(workers);
}

// =============================================================================
// Migration Statistics
// =============================================================================

interface MigrationStats {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  startTime: number;
  endTime?: number;
  errorDetails: Array<{ id: string; message: string }>;
}

const migrationStats: MigrationStats[] = [];
let globalErrors: Array<{ collection: string; id: string; message: string }> =
  [];

function startCollectionMigration(
  collection: string,
  total: number,
): MigrationStats {
  const stats: MigrationStats = {
    collection,
    total,
    migrated: 0,
    skipped: 0,
    errors: 0,
    startTime: Date.now(),
    errorDetails: [],
  };
  migrationStats.push(stats);
  return stats;
}

function recordError(stats: MigrationStats, id: string, message: string): void {
  stats.errors++;
  stats.errorDetails.push({ id, message });
  globalErrors.push({ collection: stats.collection, id, message });
}

function finishCollectionMigration(stats: MigrationStats): void {
  stats.endTime = Date.now();
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  log(
    `  Migrated: ${stats.migrated}/${stats.total} | Skipped: ${stats.skipped} | Errors: ${stats.errors} | Time: ${duration}s`,
    "reset",
  );
}

async function bulkInsertWithFallback<T>(
  items: Array<{ data: T; sourceId: string }>,
  batchSize: number,
  createMany: (data: T[]) => Promise<{ count: number }>,
  createOne: (data: T) => Promise<unknown>,
  stats: MigrationStats,
  config: MigrationConfig,
  onError?: (error: any, sourceId: string) => "skip" | "error",
): Promise<void> {
  if (items.length === 0) return;

  const batches = chunkArray(items, batchSize);
  for (const batch of batches) {
    const dataBatch = batch.map((item) => item.data);
    try {
      const result = await createMany(dataBatch);
      stats.migrated += result.count;
    } catch (error: any) {
      for (const item of batch) {
        try {
          await createOne(item.data);
          stats.migrated++;
        } catch (itemError: any) {
          const action = onError ? onError(itemError, item.sourceId) : "error";
          if (action === "skip") {
            stats.skipped++;
          } else {
            recordError(stats, item.sourceId, itemError.message);
          }
          if (config.verbose) {
            logError(
              `Error inserting ${stats.collection} ${item.sourceId}: ${itemError.message}`,
            );
          }
        }
      }
    }
  }
}

// =============================================================================
// Pre-Migration Validation
// =============================================================================

interface ValidationResult {
  collection: string;
  total: number;
  issues: Array<{ type: string; count: number; examples: string[] }>;
}

async function validateSourceData(
  mongoDb: any,
  config: MigrationConfig,
): Promise<ValidationResult[]> {
  logPhase("Validating Source Data");
  const results: ValidationResult[] = [];

  // Validate Users
  log("Checking Users collection...", "reset");
  const users = await mongoDb.collection("User").find({}).toArray();
  const userIssues: Array<{ type: string; count: number; examples: string[] }> =
    [];

  const duplicateEmails = new Map<string, string[]>();
  const missingPasswords: string[] = [];
  const missingNames: string[] = [];
  const invalidRoles: string[] = [];

  for (const user of users) {
    const email = user.email?.toLowerCase()?.trim();
    if (email) {
      if (!duplicateEmails.has(email)) {
        duplicateEmails.set(email, []);
      }
      duplicateEmails.get(email)!.push(user._id.toString());
    }
    if (!user.password) missingPasswords.push(user._id.toString());
    if (!user.name) missingNames.push(user._id.toString());
    const validRoles = [
      "STUDENT",
      "PRINCIPAL",
      "TEACHER",
      "STATE_DIRECTORATE",
      "SYSTEM_ADMIN",
    ];
    if (user.role && !validRoles.includes(user.role.toUpperCase())) {
      invalidRoles.push(`${user._id}: ${user.role}`);
    }
  }

  const actualDuplicates = Array.from(duplicateEmails.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([email, ids]) => `${email} (${ids.length} occurrences)`);

  if (actualDuplicates.length > 0) {
    userIssues.push({
      type: "Duplicate emails",
      count: actualDuplicates.length,
      examples: actualDuplicates.slice(0, 5),
    });
  }
  if (missingPasswords.length > 0) {
    userIssues.push({
      type: "Missing passwords",
      count: missingPasswords.length,
      examples: missingPasswords.slice(0, 5),
    });
  }
  if (missingNames.length > 0) {
    userIssues.push({
      type: "Missing names",
      count: missingNames.length,
      examples: missingNames.slice(0, 5),
    });
  }
  if (invalidRoles.length > 0) {
    userIssues.push({
      type: "Invalid roles",
      count: invalidRoles.length,
      examples: invalidRoles.slice(0, 5),
    });
  }

  results.push({ collection: "User", total: users.length, issues: userIssues });

  // Validate Students
  log("Checking Student collection...", "reset");
  const students = await mongoDb.collection("Student").find({}).toArray();
  const studentIssues: Array<{
    type: string;
    count: number;
    examples: string[];
  }> = [];

  const orphanedStudents: string[] = [];
  const duplicateUserIds = new Map<string, string[]>();
  const missingStudentNames: string[] = [];

  const userIdSet = new Set(users.map((u: any) => u._id.toString()));

  for (const student of students) {
    const userId = student.userId?.toString();
    if (!userId || !userIdSet.has(userId)) {
      orphanedStudents.push(`${student._id}: userId=${userId || "null"}`);
    }
    if (userId) {
      if (!duplicateUserIds.has(userId)) {
        duplicateUserIds.set(userId, []);
      }
      duplicateUserIds.get(userId)!.push(student._id.toString());
    }
    if (!student.name) {
      missingStudentNames.push(student._id.toString());
    }
  }

  const studentDuplicates = Array.from(duplicateUserIds.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([userId, ids]) => `userId=${userId} (${ids.length} students)`);

  if (orphanedStudents.length > 0) {
    studentIssues.push({
      type: "Orphaned students (no matching User)",
      count: orphanedStudents.length,
      examples: orphanedStudents.slice(0, 5),
    });
  }
  if (studentDuplicates.length > 0) {
    studentIssues.push({
      type: "Duplicate userId references",
      count: studentDuplicates.length,
      examples: studentDuplicates.slice(0, 5),
    });
  }
  if (missingStudentNames.length > 0) {
    studentIssues.push({
      type: "Missing student names",
      count: missingStudentNames.length,
      examples: missingStudentNames.slice(0, 5),
    });
  }

  results.push({
    collection: "Student",
    total: students.length,
    issues: studentIssues,
  });

  // Validate Institutions
  log("Checking Institution collection...", "reset");
  const institutions = await mongoDb
    .collection("Institution")
    .find({})
    .toArray();
  const institutionIssues: Array<{
    type: string;
    count: number;
    examples: string[];
  }> = [];

  const duplicateCodes = new Map<string, number>();
  for (const inst of institutions) {
    const code = inst.code?.toLowerCase();
    if (code) {
      duplicateCodes.set(code, (duplicateCodes.get(code) || 0) + 1);
    }
  }
  const instDuplicates = Array.from(duplicateCodes.entries())
    .filter(([, count]) => count > 1)
    .map(([code, count]) => `${code} (${count}x)`);

  if (instDuplicates.length > 0) {
    institutionIssues.push({
      type: "Duplicate institution codes",
      count: instDuplicates.length,
      examples: instDuplicates.slice(0, 5),
    });
  }

  results.push({
    collection: "Institution",
    total: institutions.length,
    issues: institutionIssues,
  });

  // Validate Internship Applications
  log("Checking internship_applications collection...", "reset");
  const applications = await mongoDb
    .collection("internship_applications")
    .find({})
    .toArray();
  const applicationIssues: Array<{
    type: string;
    count: number;
    examples: string[];
  }> = [];

  const studentAppCounts = new Map<string, number>();
  const studentApprovedCounts = new Map<string, number>();
  for (const app of applications) {
    const studentId = app.studentId?.toString();
    if (studentId) {
      studentAppCounts.set(
        studentId,
        (studentAppCounts.get(studentId) || 0) + 1,
      );
      if (app.status?.toUpperCase() === "APPROVED") {
        studentApprovedCounts.set(
          studentId,
          (studentApprovedCounts.get(studentId) || 0) + 1,
        );
      }
    }
  }

  const duplicateApps = Array.from(studentAppCounts.entries())
    .filter(([, count]) => count > 1)
    .map(
      ([studentId, count]) =>
        `studentId=${studentId.slice(-8)}... (${count} apps)`,
    );

  const duplicateApproved = Array.from(studentApprovedCounts.entries())
    .filter(([, count]) => count > 1)
    .map(
      ([studentId, count]) =>
        `studentId=${studentId.slice(-8)}... (${count} APPROVED)`,
    );

  if (duplicateApps.length > 0) {
    applicationIssues.push({
      type: "Students with multiple applications",
      count: duplicateApps.length,
      examples: duplicateApps.slice(0, 5),
    });
  }
  if (duplicateApproved.length > 0) {
    applicationIssues.push({
      type: "Students with multiple APPROVED apps",
      count: duplicateApproved.length,
      examples: duplicateApproved.slice(0, 5),
    });
  }

  results.push({
    collection: "InternshipApplication",
    total: applications.length,
    issues: applicationIssues,
  });

  // Validate Mentor Assignments
  log("Checking mentor_assignments collection...", "reset");
  const assignments = await mongoDb
    .collection("mentor_assignments")
    .find({})
    .toArray();
  const assignmentIssues: Array<{
    type: string;
    count: number;
    examples: string[];
  }> = [];

  const studentMentorCounts = new Map<string, number>();
  const studentActiveMentorCounts = new Map<string, number>();
  for (const assign of assignments) {
    const studentId = assign.studentId?.toString();
    if (studentId) {
      studentMentorCounts.set(
        studentId,
        (studentMentorCounts.get(studentId) || 0) + 1,
      );
      if (assign.isActive !== false) {
        studentActiveMentorCounts.set(
          studentId,
          (studentActiveMentorCounts.get(studentId) || 0) + 1,
        );
      }
    }
  }

  const duplicateMentors = Array.from(studentMentorCounts.entries())
    .filter(([, count]) => count > 1)
    .map(
      ([studentId, count]) =>
        `studentId=${studentId.slice(-8)}... (${count} assignments)`,
    );

  const duplicateActiveMentors = Array.from(studentActiveMentorCounts.entries())
    .filter(([, count]) => count > 1)
    .map(
      ([studentId, count]) =>
        `studentId=${studentId.slice(-8)}... (${count} active)`,
    );

  if (duplicateMentors.length > 0) {
    assignmentIssues.push({
      type: "Students with multiple mentor assignments",
      count: duplicateMentors.length,
      examples: duplicateMentors.slice(0, 5),
    });
  }
  if (duplicateActiveMentors.length > 0) {
    assignmentIssues.push({
      type: "Students with multiple ACTIVE mentors",
      count: duplicateActiveMentors.length,
      examples: duplicateActiveMentors.slice(0, 5),
    });
  }

  results.push({
    collection: "MentorAssignment",
    total: assignments.length,
    issues: assignmentIssues,
  });

  // Print validation results
  console.log("");
  log(
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "reset",
  );
  log(
    "│                         VALIDATION RESULTS                                   │",
    "reset",
  );
  log(
    "├─────────────────────────────────────────────────────────────────────────────┤",
    "reset",
  );

  let hasIssues = false;
  for (const result of results) {
    if (result.issues.length > 0) {
      hasIssues = true;
      log(
        `│ ${result.collection} (${result.total} records):`.padEnd(78) + "│",
        "yellow",
      );
      for (const issue of result.issues) {
        log(`│   - ${issue.type}: ${issue.count}`.padEnd(78) + "│", "yellow");
        if (config.verbose && issue.examples.length > 0) {
          for (const example of issue.examples) {
            log(`│       ${example.slice(0, 68)}`.padEnd(78) + "│", "reset");
          }
        }
      }
    } else {
      log(
        `│ ${result.collection} (${result.total} records): ✓ No issues`.padEnd(
          78,
        ) + "│",
        "green",
      );
    }
  }

  log(
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "reset",
  );

  if (hasIssues) {
    logWarning(
      "Data quality issues detected. Migration will attempt to handle these automatically.",
    );
    logWarning("Use --verbose to see detailed examples of each issue.");
  } else {
    logSuccess("All validation checks passed!");
  }

  return results;
}

// =============================================================================
// Migration Functions
// =============================================================================

async function migrateInstitutions(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Institutions...", "blue");
  const institutions = await mongoDb
    .collection("Institution")
    .find({})
    .toArray();
  const stats = startCollectionMigration("institutions", institutions.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${institutions.length} institutions`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  const usedCodes = new Set<string>();

  for (const inst of institutions) {
    const sourceId = inst._id?.toString() || "unknown";
    const baseCode =
      (inst.code || `INST${sourceId.slice(-6)}`).toString().trim() ||
      `INST${sourceId.slice(-6)}`;
    let finalCode = baseCode;
    let attempt = 1;

    while (usedCodes.has(finalCode.toLowerCase())) {
      finalCode = `${baseCode}-${attempt}`;
      attempt += 1;
    }

    usedCodes.add(finalCode.toLowerCase());

    const newId = convertId(inst._id, "institutions");

    items.push({
      sourceId: sourceId,
      data: {
        id: newId,
        code: finalCode,
        name: inst.name,
        shortName: inst.shortName,
        type: inst.type || "POLYTECHNIC",
        address: inst.address,
        city: inst.city,
        state: inst.state,
        pinCode: inst.pinCode,
        country: inst.country || "India",
        contactEmail: inst.contactEmail,
        contactPhone: inst.contactPhone,
        website: inst.website,
        isActive: inst.isActive ?? true,
        createdAt: processDate(inst.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.institution.createMany({ data }),
    (data) => prisma.institution.create({ data }),
    stats,
    config,
  );
  finishCollectionMigration(stats);
}

async function migrateUsers(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Users...", "blue");
  const users = await mongoDb.collection("User").find({}).toArray();
  const stats = startCollectionMigration("users", users.length);
  const processedEmails = new Set<string>();
  const emailToUserId = new Map<string, string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${users.length} users`);
    return;
  }

  // Progress tracking
  let progressCounter = 0;
  const progressInterval = Math.max(1, Math.floor(users.length / 10));

  const items: Array<{ data: any; sourceId: string }> = [];

  for (const user of users) {
    progressCounter++;
    if (progressCounter % progressInterval === 0) {
      log(
        `  Progress: ${progressCounter}/${users.length} (${Math.round((progressCounter / users.length) * 100)}%)`,
        "reset",
      );
    }

    const mongoUserId = user._id?.toString() || "unknown";
    const newId = convertId(user._id, "users");
    const institutionId = getMappedId(user.institutionId, "institutions");

    // Normalize and validate email
    let email = user.email?.toLowerCase()?.trim();
    const isValidEmail =
      email &&
      typeof email === "string" &&
      email.includes("@") &&
      email.length > 3;

    // Handle duplicate emails
    const isDuplicate = isValidEmail && processedEmails.has(email!);
    if (isValidEmail && !isDuplicate) {
      processedEmails.add(email!);
      emailToUserId.set(email!, mongoUserId);
    }

    // Generate unique email for duplicates
    let finalEmail: string | null = null;
    if (isDuplicate) {
      finalEmail = `duplicate_${mongoUserId}@removed.local`;
      if (config.verbose) {
        const originalUserId = emailToUserId.get(email!);
        logWarning(
          `Duplicate email '${email}' for user ${mongoUserId}, original user: ${originalUserId}`,
        );
      }
    } else if (isValidEmail) {
      finalEmail = email!;
    } else {
      // No email or invalid email - generate placeholder for non-student roles
      if (user.role !== "STUDENT") {
        finalEmail = `no_email_${mongoUserId}@placeholder.local`;
        if (config.verbose)
          logWarning(
            `User ${mongoUserId} has no valid email, using placeholder`,
          );
      }
    }

    // Validate required fields
    const name = user.name?.trim() || `User_${mongoUserId.slice(-8)}`;

    // Validate role enum
    const validRoles = [
      "STUDENT",
      "PRINCIPAL",
      "TEACHER",
      "STATE_DIRECTORATE",
      "SYSTEM_ADMIN",
    ];
    const role = validRoles.includes(user.role?.toUpperCase())
      ? user.role.toUpperCase()
      : null;

    // Validate password - must exist
    const password = user.password || "$2b$10$placeholder.hash.for.migration";

    items.push({
      sourceId: mongoUserId,
      data: {
        id: newId,
        email: finalEmail,
        password: password,
        name: name,
        role: role as any,
        active: isDuplicate ? false : (user.active ?? true),
        institutionId: institutionId || null,
        designation: user.designation || null,
        phoneNo: user.phoneNo || null,
        rollNumber: user.rollNumber || null,
        branchName: user.branchName || null,
        dob: user.dob || null,
        createdAt: processDate(user.createdAt) || new Date(),
      },
    });

    if (isDuplicate) stats.skipped++;
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.user.createMany({ data }),
    (data) => prisma.user.create({ data }),
    stats,
    config,
    (error, sourceId) => {
      if (error.code === "P2002") {
        recordError(
          stats,
          sourceId,
          `Unique constraint violation: ${error.meta?.target || "unknown"}`,
        );
        return "error";
      }
      return "error";
    },
  );

  log(`  Processed ${progressCounter} users`, "reset");
  finishCollectionMigration(stats);
}

async function migrateBatches(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Batches...", "blue");
  const batches = await mongoDb.collection("Batch").find({}).toArray();
  const stats = startCollectionMigration("batches", batches.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${batches.length} batches`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = batches.map(
    (batch: any) => ({
      sourceId: batch._id?.toString() || "unknown",
      data: {
        id: convertId(batch._id, "batches"),
        name: batch.name,
        isActive: batch.isActive ?? true,
        institutionId: getMappedId(batch.institutionId, "institutions"),
        createdAt: processDate(batch.createdAt) || new Date(),
      },
    }),
  );

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.batch.createMany({ data }),
    (data) => prisma.batch.create({ data }),
    stats,
    config,
  );
  finishCollectionMigration(stats);
}

async function migrateBranches(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Branches...", "blue");
  const branches = await mongoDb.collection("branches").find({}).toArray();
  const stats = startCollectionMigration("branches", branches.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${branches.length} branches`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = branches.map(
    (branch: any) => ({
      sourceId: branch._id?.toString() || "unknown",
      data: {
        id: convertId(branch._id, "branches"),
        name: branch.name,
        shortName: branch.shortName,
        code: branch.code || `${branch.shortName}-${Date.now()}`,
        duration: branch.duration || 3,
        isActive: branch.isActive ?? true,
        institutionId: getMappedId(branch.institutionId, "institutions"),
        createdAt: processDate(branch.createdAt) || new Date(),
      },
    }),
  );

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.branch.createMany({ data }),
    (data) => prisma.branch.create({ data }),
    stats,
    config,
  );
  finishCollectionMigration(stats);
}

async function migrateStudents(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Students...", "blue");
  const students: any[] = await mongoDb
    .collection("Student")
    .find({})
    .toArray();
  const stats = startCollectionMigration("students", students.length);
  const processedUserIds = new Map<string, string>();
  const processedAdmissionNumbers = new Set<string>();

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${students.length} students`);
    return;
  }

  // Progress tracking for large datasets
  let progressCounter = 0;
  const progressInterval = Math.max(1, Math.floor(students.length / 10));

  const studentChunks = chunkArray(students, config.batchSize);
  const updateConcurrency = Math.min(20, config.batchSize);

  for (const chunk of studentChunks) {
    const updateTasks: Array<{
      userId: string;
      data: Record<string, any>;
      mongoStudentId: string;
      rollNumber?: string;
    }> = [];
    const items: Array<{ data: any; sourceId: string }> = [];

    for (const student of chunk) {
      progressCounter++;
      if (progressCounter % progressInterval === 0) {
        log(
          `  Progress: ${progressCounter}/${students.length} (${Math.round((progressCounter / students.length) * 100)}%)`,
          "reset",
        );
      }

      const mongoStudentId = student._id?.toString() || "unknown";
      const userId = getMappedId(student.userId, "users");
      const institutionId = getMappedId(student.institutionId, "institutions");
      const branchId = getMappedId(student.branchId, "branches");
      const batchId = getMappedId(student.batchId, "batches");

      // Validation: Skip if no userId mapping
      if (!userId) {
        recordError(
          stats,
          mongoStudentId,
          "Missing userId mapping - User not found in migration",
        );
        stats.skipped++;
        continue;
      }

      // Handle duplicate userIds (one user can only have one student record)
      const isDuplicate = processedUserIds.has(userId);
      if (isDuplicate) {
        const existingUuid = processedUserIds.get(userId)!;
        idMaps["students"].set(mongoStudentId, existingUuid);
        if (config.verbose)
          logWarning(
            `Duplicate student for userId ${userId}, mapping to existing: ${existingUuid}`,
          );
        stats.skipped++;
        continue;
      }

      // Handle duplicate admission numbers
      const admissionNumber = student.admissionNumber?.trim();
      if (
        admissionNumber &&
        processedAdmissionNumbers.has(admissionNumber.toLowerCase())
      ) {
        if (config.verbose)
          logWarning(
            `Duplicate admission number: ${admissionNumber} for student ${mongoStudentId}`,
          );
        // Still migrate but with modified admission number
      }
      if (admissionNumber) {
        processedAdmissionNumbers.add(admissionNumber.toLowerCase());
      }

      const newId = convertId(student._id, "students");
      processedUserIds.set(userId, newId);

      // STEP 1: Update User with Student data (User is Single Source of Truth)
      // Build update data carefully, only including fields that have values
      const userUpdateData: Record<string, any> = {};

      // Name is required for User, use student name or fallback
      if (student.name) userUpdateData.name = student.name;

      // Email - only update if student has one and it's valid
      if (
        student.email &&
        typeof student.email === "string" &&
        student.email.includes("@")
      ) {
        userUpdateData.email = student.email.toLowerCase().trim();
      }

      // Phone number (contact in old schema → phoneNo in new schema)
      if (student.contact) userUpdateData.phoneNo = student.contact;

      // Date of birth
      if (student.dob) userUpdateData.dob = student.dob;

      // Roll number
      if (student.rollNumber) userUpdateData.rollNumber = student.rollNumber;

      // Branch - set both branchId FK and cached branchName
      if (branchId) userUpdateData.branchId = branchId;
      if (student.branchName) userUpdateData.branchName = student.branchName;

      // Institution
      if (institutionId) userUpdateData.institutionId = institutionId;

      // Active status (isActive in old schema → active in new schema)
      userUpdateData.active = student.isActive ?? true;

      updateTasks.push({
        userId,
        data: userUpdateData,
        mongoStudentId,
        rollNumber: student.rollNumber,
      });

      // STEP 2: Prepare Student record with ONLY student-specific fields
      // Validate numeric fields
      const currentYear =
        typeof student.currentYear === "number"
          ? student.currentYear
          : typeof student.currentYear === "string"
            ? parseInt(student.currentYear, 10)
            : null;
      const currentSemester =
        typeof student.currentSemester === "number"
          ? student.currentSemester
          : typeof student.currentSemester === "string"
            ? parseInt(student.currentSemester, 10)
            : null;

      // Validate clearance status enum
      const validClearanceStatuses = ["PENDING", "CLEARED", "HOLD", "REJECTED"];
      const clearanceStatus = validClearanceStatuses.includes(
        student.clearanceStatus?.toUpperCase(),
      )
        ? student.clearanceStatus.toUpperCase()
        : "PENDING";

      // Validate admission type enum
      const validAdmissionTypes = ["FIRST_YEAR", "LEET"];
      const admissionType = validAdmissionTypes.includes(
        student.admissionType?.toUpperCase(),
      )
        ? student.admissionType.toUpperCase()
        : null;

      // Validate category enum
      const validCategories = ["GENERAL", "OBC", "ST", "SC"];
      const category = validCategories.includes(student.category?.toUpperCase())
        ? student.category.toUpperCase()
        : null;

      items.push({
        sourceId: mongoStudentId,
        data: {
          id: newId,
          userId: userId,
          profileImage: student.profilePicture || student.profileImage || null,
          admissionNumber: admissionNumber || null,
          // Address
          address: student.address || null,
          city: student.city || null,
          state: student.state || null,
          pinCode: student.pinCode || null,
          tehsil: student.tehsil || null,
          district: student.district || null,
          // Family
          parentName: student.parentName || null,
          parentContact: student.parentContact || null,
          motherName: student.motherName || null,
          // Demographics
          gender: student.gender || null,
          // Academic
          currentYear: isNaN(currentYear as number) ? null : currentYear,
          currentSemester: isNaN(currentSemester as number)
            ? null
            : currentSemester,
          admissionType: admissionType as any,
          category: category as any,
          clearanceStatus: clearanceStatus as any,
          // Batch & Institution (keep FKs for direct queries)
          batchId: batchId || null,
          institutionId: institutionId || null,
          branchId: branchId || null,
          createdAt: processDate(student.createdAt) || new Date(),
        },
      });
    }

    await runWithConcurrency(updateTasks, updateConcurrency, async (task) => {
      try {
        await prisma.user.update({
          where: { id: task.userId },
          data: task.data,
        });
      } catch (userError: any) {
        // If email conflict, retry without email but still update other fields (especially active status)
        if (
          userError.code === "P2002" &&
          userError.message?.includes("email")
        ) {
          try {
            const { email, ...dataWithoutEmail } = task.data;
            await prisma.user.update({
              where: { id: task.userId },
              data: dataWithoutEmail,
            });
            if (config.verbose)
              logWarning(
                `Updated User for student ${task.rollNumber || task.mongoStudentId} without email (conflict)`,
              );
          } catch (retryError: any) {
            recordError(
              stats,
              task.mongoStudentId,
              `User update failed (retry): ${retryError.message}`,
            );
            if (config.verbose)
              logError(
                `Failed to update User for student ${task.rollNumber || task.mongoStudentId}: ${retryError.message}`,
              );
          }
        } else {
          recordError(
            stats,
            task.mongoStudentId,
            `User update failed: ${userError.message}`,
          );
          if (config.verbose)
            logError(
              `Failed to update User for student ${task.rollNumber || task.mongoStudentId}: ${userError.message}`,
            );
        }
        // Continue to try creating student anyway if user update fails
      }
    });

    await bulkInsertWithFallback(
      items,
      config.batchSize,
      (data) => prisma.student.createMany({ data }),
      (data) => prisma.student.create({ data }),
      stats,
      config,
      (studentError, sourceId) => {
        if (studentError.code === "P2002") {
          recordError(
            stats,
            sourceId,
            `Unique constraint violation: ${studentError.meta?.target || "unknown field"}`,
          );
          return "error";
        }
        recordError(
          stats,
          sourceId,
          `Student create failed: ${studentError.message}`,
        );
        return "error";
      },
    );
  }

  log(`  Processed ${progressCounter} students`, "reset");
  finishCollectionMigration(stats);
}

async function migrateInternshipApplications(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Internship Applications...", "blue");
  const applications = await mongoDb
    .collection("internship_applications")
    .find({})
    .toArray();
  const stats = startCollectionMigration(
    "internshipApplications",
    applications.length,
  );

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${applications.length} applications`);
    return;
  }

  const mapStatus = (status: string): ApplicationStatus => {
    const statusMap: Record<string, ApplicationStatus> = {
      PENDING: ApplicationStatus.APPLIED,
      APPLIED: ApplicationStatus.APPLIED,
      UNDER_REVIEW: ApplicationStatus.UNDER_REVIEW,
      SHORTLISTED: ApplicationStatus.SHORTLISTED,
      SELECTED: ApplicationStatus.SELECTED,
      REJECTED: ApplicationStatus.REJECTED,
      JOINED: ApplicationStatus.JOINED,
      COMPLETED: ApplicationStatus.COMPLETED,
      WITHDRAWN: ApplicationStatus.WITHDRAWN,
      APPROVED: ApplicationStatus.APPROVED,
    };
    return statusMap[status?.toUpperCase()] || ApplicationStatus.APPLIED;
  };

  // Map old internshipStatus to new InternshipPhase enum
  const mapInternshipPhase = (app: any): InternshipPhase => {
    const oldStatus = app.internshipStatus?.toUpperCase();

    // Map based on old internshipStatus field
    if (oldStatus === "ONGOING" || oldStatus === "IN_PROGRESS") {
      return InternshipPhase.ACTIVE;
    }
    if (oldStatus === "COMPLETED") {
      return InternshipPhase.COMPLETED;
    }
    if (oldStatus === "CANCELLED" || oldStatus === "TERMINATED") {
      return InternshipPhase.TERMINATED;
    }

    // Additional logic based on other fields
    if (app.completionDate) {
      return InternshipPhase.COMPLETED;
    }
    if (app.status === "JOINED" || app.joiningDate) {
      return InternshipPhase.ACTIVE;
    }
    if (app.startDate && new Date(app.startDate) <= new Date()) {
      return InternshipPhase.ACTIVE;
    }
    if (app.endDate && new Date(app.endDate) <= new Date()) {
      return InternshipPhase.COMPLETED;
    }

    return InternshipPhase.NOT_STARTED;
  };

  // Track processed students to prevent duplicate APPROVED applications
  // Key: studentId, Value: { appId: string, status: string, createdAt: Date }
  const processedStudentApps = new Map<
    string,
    { mongoId: string; status: string; createdAt: Date }
  >();

  // First pass: identify the best application per student (prefer APPROVED, then newest)
  for (const app of applications) {
    const studentId = getMappedId(app.studentId, "students");
    if (!studentId) continue;

    const appStatus = app.status?.toUpperCase() || "APPLIED";
    const appCreatedAt = processDate(app.createdAt) || new Date(0);
    const existing = processedStudentApps.get(studentId);

    if (!existing) {
      processedStudentApps.set(studentId, {
        mongoId: app._id.toString(),
        status: appStatus,
        createdAt: appCreatedAt,
      });
    } else {
      // Priority: APPROVED > other statuses, then by date (newest wins)
      const existingIsApproved = existing.status === "APPROVED";
      const newIsApproved = appStatus === "APPROVED";

      let shouldReplace = false;
      if (newIsApproved && !existingIsApproved) {
        shouldReplace = true;
      } else if (newIsApproved === existingIsApproved) {
        // Both same priority, take newest
        shouldReplace = appCreatedAt > existing.createdAt;
      }

      if (shouldReplace) {
        processedStudentApps.set(studentId, {
          mongoId: app._id.toString(),
          status: appStatus,
          createdAt: appCreatedAt,
        });
      }
    }
  }

  // Create a set of the best application IDs to keep active
  const bestAppIds = new Set(
    Array.from(processedStudentApps.values()).map((v) => v.mongoId),
  );

  // Count duplicates that will be skipped
  let duplicateCount = 0;
  for (const app of applications) {
    const studentId = getMappedId(app.studentId, "students");
    if (studentId && !bestAppIds.has(app._id.toString())) {
      duplicateCount++;
    }
  }
  if (duplicateCount > 0) {
    logWarning(
      `Found ${duplicateCount} duplicate applications (will be migrated as inactive)`,
    );
  }

  const items: Array<{ data: any; sourceId: string }> = [];

  for (const app of applications) {
    const newId = convertId(app._id, "internshipApplications");
    const studentId = getMappedId(app.studentId, "students");

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    // Determine if this is the best application for this student
    const isBestApp = bestAppIds.has(app._id.toString());
    const shouldBeActive = isBestApp && (app.isActive ?? true);

    if (!isBestApp) {
      stats.skipped++; // Count as skipped since it's deactivated
      if (config.verbose)
        logWarning(
          `Deactivated duplicate application for student ${studentId}`,
        );
    }

    items.push({
      sourceId: app._id?.toString() || "unknown",
      data: {
        id: newId,
        studentId: studentId,
        isSelfIdentified: app.isSelfIdentified ?? false,
        companyName: app.companyName,
        companyAddress: app.companyAddress,
        companyContact: app.companyContact,
        companyEmail: app.companyEmail,
        hrName: app.hrName,
        hrContact: app.hrContact,
        hrEmail: app.hrEmail,
        stipend: app.stipend,
        jobProfile: app.jobProfile,
        hrDesignation: app.hrDesignation,
        status: mapStatus(app.status),
        internshipPhase: mapInternshipPhase(app),
        startDate: processDate(app.startDate),
        endDate: processDate(app.endDate),
        joiningDate: processDate(app.joiningDate),
        completionDate: processDate(app.completionDate),
        coverLetter: app.coverLetter,
        resume: app.resumeUrl || app.resume,
        internshipDuration: app.internshipDuration,
        joiningLetterUrl:
          app.offerLetterUrl || app.offerLetter || app.joiningLetterUrl,
        additionalInfo: app.noc || app.remarks || app.notes,
        isActive: shouldBeActive,
        createdAt: processDate(app.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.internshipApplication.createMany({ data }),
    (data) => prisma.internshipApplication.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateMentorAssignments(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Mentor Assignments...", "blue");
  const assignments = await mongoDb
    .collection("mentor_assignments")
    .find({})
    .toArray();
  const stats = startCollectionMigration(
    "mentorAssignments",
    assignments.length,
  );

  if (config.dryRun) {
    logWarning(
      `Dry run: Would migrate ${assignments.length} mentor assignments`,
    );
    return;
  }

  // Track processed students to prevent duplicate active mentor assignments
  // Key: studentId, Value: { mongoId: string, isActive: boolean, createdAt: Date }
  const processedStudentMentors = new Map<
    string,
    { mongoId: string; isActive: boolean; createdAt: Date }
  >();

  // First pass: identify the best active assignment per student (newest active wins)
  for (const assign of assignments) {
    const studentId = getMappedId(assign.studentId, "students");
    if (!studentId) continue;

    const isActive = assign.isActive ?? true;
    const createdAt = processDate(assign.createdAt) || new Date(0);
    const existing = processedStudentMentors.get(studentId);

    if (!existing) {
      processedStudentMentors.set(studentId, {
        mongoId: assign._id.toString(),
        isActive: isActive,
        createdAt: createdAt,
      });
    } else {
      // Priority: active > inactive, then newest wins
      let shouldReplace = false;
      if (isActive && !existing.isActive) {
        shouldReplace = true;
      } else if (isActive === existing.isActive) {
        // Both same active status, take newest
        shouldReplace = createdAt > existing.createdAt;
      }

      if (shouldReplace) {
        processedStudentMentors.set(studentId, {
          mongoId: assign._id.toString(),
          isActive: isActive,
          createdAt: createdAt,
        });
      }
    }
  }

  // Create a set of the best assignment IDs to keep active
  const bestAssignmentIds = new Set(
    Array.from(processedStudentMentors.values()).map((v) => v.mongoId),
  );

  // Count duplicates
  let duplicateCount = 0;
  for (const assign of assignments) {
    const studentId = getMappedId(assign.studentId, "students");
    if (studentId && !bestAssignmentIds.has(assign._id.toString())) {
      duplicateCount++;
    }
  }
  if (duplicateCount > 0) {
    logWarning(
      `Found ${duplicateCount} duplicate mentor assignments (will be migrated as inactive)`,
    );
  }

  const items: Array<{ data: any; sourceId: string }> = [];

  for (const assign of assignments) {
    const newId = convertId(assign._id, "mentorAssignments");
    const studentId = getMappedId(assign.studentId, "students");
    const mentorId = getMappedId(assign.mentorId, "users");
    const assignedBy = getMappedId(assign.assignedBy, "users");

    if (!studentId || !mentorId || !assignedBy) {
      stats.skipped++;
      continue;
    }

    // Determine if this is the best assignment for this student
    const isBestAssignment = bestAssignmentIds.has(assign._id.toString());
    const shouldBeActive = isBestAssignment && (assign.isActive ?? true);

    if (!isBestAssignment && (assign.isActive ?? true)) {
      stats.skipped++; // Count as skipped since it's deactivated
      if (config.verbose)
        logWarning(
          `Deactivated duplicate mentor assignment for student ${studentId}`,
        );
    }

    items.push({
      sourceId: assign._id?.toString() || "unknown",
      data: {
        id: newId,
        studentId: studentId,
        mentorId: mentorId,
        assignedBy: assignedBy,
        assignmentDate: processDate(assign.assignmentDate) || new Date(),
        isActive: shouldBeActive,
        deactivatedAt:
          !shouldBeActive && (assign.isActive ?? true) ? new Date() : null,
        deactivationReason:
          !shouldBeActive && (assign.isActive ?? true)
            ? "Superseded by newer assignment"
            : null,
        academicYear: assign.academicYear || "2024-25",
        semester: assign.semester,
        createdAt: processDate(assign.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.mentorAssignment.createMany({ data }),
    (data) => prisma.mentorAssignment.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateDocuments(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Documents...", "blue");
  const documents = await mongoDb.collection("Document").find({}).toArray();
  const stats = startCollectionMigration("documents", documents.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${documents.length} documents`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const doc of documents) {
    const newId = convertId(doc._id, "documents");
    const studentId = getMappedId(doc.studentId, "students");

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    items.push({
      sourceId: doc._id?.toString() || "unknown",
      data: {
        id: newId,
        studentId: studentId,
        type: doc.type || "OTHER",
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        createdAt: processDate(doc.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.document.createMany({ data }),
    (data) => prisma.document.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateMonthlyReports(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Monthly Reports...", "blue");
  const reports = await mongoDb
    .collection("monthly_reports")
    .find({})
    .toArray();
  const stats = startCollectionMigration("monthlyReports", reports.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${reports.length} monthly reports`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const report of reports) {
    const newId = convertId(report._id, "monthlyReports");
    const applicationId = getMappedId(
      report.applicationId,
      "internshipApplications",
    );
    const studentId = getMappedId(report.studentId, "students");

    if (!applicationId || !studentId) {
      stats.skipped++;
      continue;
    }

    items.push({
      sourceId: report._id?.toString() || "unknown",
      data: {
        id: newId,
        applicationId: applicationId,
        studentId: studentId,
        reportMonth: report.reportMonth,
        reportYear: report.reportYear,
        reportFileUrl: report.reportFileUrl,
        status: report.status || "PENDING",
        submittedAt: processDate(report.submittedAt),
        reviewedAt: processDate(report.reviewedAt),
        reviewComments: report.reviewerComments || report.reviewComments,
        createdAt: processDate(report.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.monthlyReport.createMany({ data }),
    (data) => prisma.monthlyReport.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

/**
 * Normalize a MongoDB file URL/key to a proper MinIO object key.
 * MongoDB may store full URLs (e.g. https://files.sukeerat.com/cms-uploads/path/file.ext)
 * or just the key. We need to extract just the object key for PostgreSQL storage.
 */
function normalizeFileKeyForMigration(
  fileUrl: string | null | undefined,
): string | null {
  if (!fileUrl) return null;
  const trimmed = fileUrl.trim();
  if (!trimmed) return null;

  // If it's a full URL, extract the key (everything after bucket name)
  try {
    const url = new URL(trimmed);
    // Path looks like /bucket-name/actual/key/file.ext
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length > 1) {
      // Skip the bucket name (first segment), return the rest as the key
      return pathParts.slice(1).join("/");
    }
    // If only one segment, it's just the key
    return pathParts.join("/");
  } catch {
    // Not a URL, treat as a raw key - return as-is
    return trimmed;
  }
}

/**
 * Normalize an array of file URLs/keys from MongoDB to MinIO object keys.
 */
function normalizeFileKeysArray(arr: any): string[] {
  if (!arr) return [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item: any) =>
      normalizeFileKeyForMigration(
        typeof item === "string" ? item : item?.toString(),
      ),
    )
    .filter((k: string | null): k is string => !!k);
}

/**
 * Parse filesUrl field which could be JSON array, comma-separated, or single value.
 * Returns normalized MinIO keys.
 */
function parseAndNormalizeFilesUrl(fileValue: any): string | null {
  if (!fileValue) return null;
  const raw =
    typeof fileValue === "string" ? fileValue.trim() : String(fileValue).trim();
  if (!raw) return null;

  let keys: string[] = [];

  // Try JSON array
  try {
    if (raw.startsWith("[")) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        keys = parsed
          .filter(Boolean)
          .map((v: string) => normalizeFileKeyForMigration(v))
          .filter(Boolean) as string[];
      }
    }
  } catch {
    // fallthrough
  }

  // Try comma-separated or single value
  if (keys.length === 0) {
    if (raw.includes(",")) {
      keys = raw
        .split(",")
        .map((v: string) => normalizeFileKeyForMigration(v.trim()))
        .filter(Boolean) as string[];
    } else {
      const k = normalizeFileKeyForMigration(raw);
      if (k) keys = [k];
    }
  }

  if (keys.length === 0) return null;
  // Store as JSON array string for consistency
  return JSON.stringify(keys);
}

async function migrateFacultyVisitLogs(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Faculty Visit Logs...", "blue");
  const visits = await mongoDb
    .collection("faculty_visit_logs")
    .find({})
    .toArray();
  const stats = startCollectionMigration("facultyVisitLogs", visits.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${visits.length} faculty visit logs`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const visit of visits) {
    const newId = convertId(visit._id, "facultyVisitLogs");
    const applicationId = getMappedId(
      visit.applicationId,
      "internshipApplications",
    );
    const facultyId = getMappedId(visit.facultyId, "users");

    if (!applicationId) {
      stats.skipped++;
      if (config.verbose) {
        logWarning(`Skipping visit log ${visit._id}: no mapped applicationId`);
      }
      continue;
    }

    // Normalize file URLs: extract MinIO object keys from full URLs
    const visitPhotos = normalizeFileKeysArray(visit.visitPhotos);
    const signedDocumentUrl = normalizeFileKeyForMigration(
      visit.signedDocumentUrl,
    );
    const filesUrl = parseAndNormalizeFilesUrl(visit.filesUrl);

    items.push({
      sourceId: visit._id?.toString() || "unknown",
      data: {
        id: newId,
        applicationId: applicationId,
        facultyId: facultyId || null,
        visitDate: processDate(visit.visitDate) || new Date(),
        visitType: visit.visitType || "PHYSICAL",
        status: visit.status || "COMPLETED",

        // Location
        visitLocation: visit.visitLocation || null,
        latitude: visit.latitude ? parseFloat(String(visit.latitude)) : null,
        longitude: visit.longitude ? parseFloat(String(visit.longitude)) : null,
        gpsAccuracy: visit.gpsAccuracy
          ? parseFloat(String(visit.gpsAccuracy))
          : null,

        // File fields - normalized to MinIO keys
        visitPhotos: visitPhotos,
        signedDocumentUrl: signedDocumentUrl,
        filesUrl: filesUrl,

        // Visit details
        visitNumber: visit.visitNumber
          ? parseInt(String(visit.visitNumber), 10)
          : null,
        visitDuration: visit.visitDuration || null,
        visitMonth: visit.visitMonth
          ? parseInt(String(visit.visitMonth), 10)
          : null,
        visitYear: visit.visitYear
          ? parseInt(String(visit.visitYear), 10)
          : null,

        // Observations
        studentPerformance: visit.studentPerformance || null,
        workEnvironment: visit.workEnvironment || null,
        industrySupport: visit.industrySupport || null,
        skillsDevelopment: visit.skillsDevelopment || null,
        attendanceStatus: visit.attendanceStatus || null,
        workQuality: visit.workQuality || null,
        organisationFeedback: visit.organisationFeedback || null,
        projectTopics: visit.projectTopics || null,

        // New form fields
        titleOfProjectWork: visit.titleOfProjectWork || null,
        assistanceRequiredFromInstitute:
          visit.assistanceRequiredFromInstitute || null,
        responseFromOrganisation: visit.responseFromOrganisation || null,
        remarksOfOrganisationSupervisor:
          visit.remarksOfOrganisationSupervisor || null,
        significantChangeInPlan: visit.significantChangeInPlan || null,
        observationsAboutStudent: visit.observationsAboutStudent || null,
        feedbackSharedWithStudent: visit.feedbackSharedWithStudent || null,

        // Ratings
        studentProgressRating: visit.studentProgressRating
          ? parseInt(String(visit.studentProgressRating), 10)
          : null,
        industryCooperationRating: visit.industryCooperationRating
          ? parseInt(String(visit.industryCooperationRating), 10)
          : null,
        workEnvironmentRating: visit.workEnvironmentRating
          ? parseInt(String(visit.workEnvironmentRating), 10)
          : null,
        mentoringSupportRating: visit.mentoringSupportRating
          ? parseInt(String(visit.mentoringSupportRating), 10)
          : null,
        overallSatisfactionRating: visit.overallSatisfactionRating
          ? parseInt(String(visit.overallSatisfactionRating), 10)
          : null,

        // Issues and recommendations
        issuesIdentified: visit.issuesIdentified || null,
        recommendations: visit.recommendations || null,
        actionRequired: visit.actionRequired || null,

        // Documentation
        meetingMinutes: visit.meetingMinutes || null,
        attendeesList: Array.isArray(visit.attendeesList)
          ? visit.attendeesList.filter(Boolean)
          : [],

        // Administrative
        reportSubmittedTo: visit.reportSubmittedTo || null,
        followUpRequired: visit.followUpRequired === true,
        nextVisitDate: processDate(visit.nextVisitDate),
        requiredByDate: processDate(visit.requiredByDate),
        isMonthlyVisit: visit.isMonthlyVisit !== false,

        // Soft delete
        isDeleted: visit.isDeleted === true,
        deletedAt: processDate(visit.deletedAt),

        createdAt: processDate(visit.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.facultyVisitLog.createMany({ data }),
    (data) => prisma.facultyVisitLog.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateNotifications(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Notifications...", "blue");
  const notifications = await mongoDb
    .collection("Notification")
    .find({})
    .toArray();
  const stats = startCollectionMigration("notifications", notifications.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${notifications.length} notifications`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const notif of notifications) {
    const newId = convertId(notif._id, "notifications");
    const userId = getMappedId(notif.userId, "users");

    if (!userId) {
      stats.skipped++;
      continue;
    }

    items.push({
      sourceId: notif._id?.toString() || "unknown",
      data: {
        id: newId,
        userId: userId,
        title: notif.title,
        body: notif.body,
        type: notif.type || "INFO",
        read: notif.read ?? false,
        createdAt: processDate(notif.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.notification.createMany({ data }),
    (data) => prisma.notification.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateGrievances(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Grievances...", "blue");
  const grievances = await mongoDb.collection("Grievance").find({}).toArray();
  const stats = startCollectionMigration("grievances", grievances.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${grievances.length} grievances`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const grievance of grievances) {
    const newId = convertId(grievance._id, "grievances");
    const studentId = getMappedId(grievance.studentId, "students");

    if (!studentId) {
      stats.skipped++;
      continue;
    }

    items.push({
      sourceId: grievance._id?.toString() || "unknown",
      data: {
        id: newId,
        studentId: studentId,
        title: grievance.title,
        description: grievance.description,
        category: grievance.category || "OTHER",
        status: grievance.status || "PENDING",
        severity: grievance.severity || grievance.priority || "MEDIUM",
        resolution: grievance.resolution,
        resolvedDate: processDate(
          grievance.resolvedAt || grievance.resolvedDate,
        ),
        createdAt: processDate(grievance.createdAt) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.grievance.createMany({ data }),
    (data) => prisma.grievance.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateSupportTickets(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Support Tickets (from Technical Queries)...", "blue");
  const queries = await mongoDb
    .collection("technical_queries")
    .find({})
    .toArray();
  const stats = startCollectionMigration("supportTickets", queries.length);

  if (config.dryRun) {
    logWarning(
      `Dry run: Would migrate ${queries.length} technical queries to support tickets`,
    );
    return;
  }

  let ticketCounter = 1;

  const userIds = Array.from(
    new Set(
      queries.map((q: any) => getMappedId(q.userId, "users")).filter(Boolean),
    ),
  ) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Map priority
  const priorityMap: Record<string, SupportTicketPriority> = {
    LOW: SupportTicketPriority.LOW,
    MEDIUM: SupportTicketPriority.MEDIUM,
    HIGH: SupportTicketPriority.HIGH,
    URGENT: SupportTicketPriority.URGENT,
    CRITICAL: SupportTicketPriority.URGENT,
  };

  // Map status
  const statusMap: Record<string, SupportTicketStatus> = {
    OPEN: SupportTicketStatus.OPEN,
    IN_PROGRESS: SupportTicketStatus.IN_PROGRESS,
    RESOLVED: SupportTicketStatus.RESOLVED,
    CLOSED: SupportTicketStatus.CLOSED,
    PENDING: SupportTicketStatus.PENDING_USER,
  };

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const query of queries) {
    const newId = convertId(query._id, "supportTickets");
    const userId = getMappedId(query.userId, "users");

    if (!userId) {
      stats.skipped++;
      continue;
    }

    const user = userMap.get(userId);
    if (!user || !user.role) {
      stats.skipped++;
      continue;
    }

    // Generate ticket number (SUP-YYYYMMDD-XXXX)
    const createdDate = processDate(query.createdAt) || new Date();
    const dateStr = createdDate.toISOString().slice(0, 10).replace(/-/g, "");
    const ticketNumber = `SUP-${dateStr}-${String(ticketCounter++).padStart(4, "0")}`;

    items.push({
      sourceId: query._id?.toString() || "unknown",
      data: {
        id: newId,
        ticketNumber: ticketNumber,
        submittedById: userId,
        submitterRole: user.role,
        submitterName: user.name || "Unknown User",
        submitterEmail: user.email,
        subject: query.title || "Technical Query",
        description: query.description || "",
        category: "TECHNICAL_ISSUES",
        priority:
          priorityMap[query.priority?.toUpperCase()] ||
          SupportTicketPriority.MEDIUM,
        attachments: query.attachments || [],
        status:
          statusMap[query.status?.toUpperCase()] || SupportTicketStatus.OPEN,
        resolution: query.resolution,
        resolvedAt: query.resolution ? processDate(query.updatedAt) : null,
        createdAt: createdDate,
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.supportTicket.createMany({ data }),
    (data) => prisma.supportTicket.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2002" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

async function migrateAuditLogs(
  mongoDb: any,
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  log("Migrating Audit Logs...", "blue");
  const logs = await mongoDb.collection("AuditLog").find({}).toArray();
  const stats = startCollectionMigration("auditLogs", logs.length);

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${logs.length} audit logs`);
    return;
  }

  const items: Array<{ data: any; sourceId: string }> = [];
  for (const l of logs) {
    const newId = convertId(l._id, "auditLogs");
    const userId = getMappedId(l.userId, "users");

    items.push({
      sourceId: l._id?.toString() || "unknown",
      data: {
        id: newId,
        userId: userId,
        action: l.action,
        userRole: l.userRole,
        userName: l.userName,
        entityType: l.entityType,
        entityId: l.entityId,
        oldValues: l.oldValues,
        newValues: l.newValues,
        changedFields: l.changedFields || [],
        category: l.category,
        severity: l.severity || "LOW",
        timestamp: processDate(l.timestamp) || new Date(),
      },
    });
  }

  await bulkInsertWithFallback(
    items,
    config.batchSize,
    (data) => prisma.auditLog.createMany({ data }),
    (data) => prisma.auditLog.create({ data }),
    stats,
    config,
    (error) => (error.code === "P2003" ? "skip" : "error"),
  );
  finishCollectionMigration(stats);
}

// =============================================================================
// Post-Migration: Branch Fixing
// =============================================================================

const branchNormalizationMap: Record<string, string> = {
  // CSE variants
  cse: "CSE",
  Cse: "CSE",
  "CSE ": "CSE",
  "Computer Science": "CSE",
  "Computer Science Engineering": "CSE",
  "Computer Science and Engineering": "CSE",
  "COMPUTER SCIENCE AND ENGINEERING": "CSE",
  "COMPUTER SCIENCE": "CSE",
  // ECE variants
  ece: "ECE",
  Ece: "ECE",
  "ECE ": "ECE",
  Electronics: "ECE",
  "Electronics and Communication": "ECE",
  "Electronics and Communication Engineering": "ECE",
  "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
  // EE / Electrical variants
  ee: "EE",
  Ee: "EE",
  "EE ": "EE",
  Electrical: "EE",
  "Electrical Engineering": "EE",
  "ELECTRICAL ENGINEERING": "EE",
  ELECTRICAL: "EE",
  // ME / Mechanical variants
  me: "ME",
  Me: "ME",
  "ME ": "ME",
  MECH: "ME",
  Mech: "ME",
  mech: "ME",
  Mechanical: "ME",
  "Mechanical Engineering": "ME",
  "MECHANICAL ENGINEERING": "ME",
  MECHANICAL: "ME",
  // CE / Civil variants
  ce: "CE",
  Ce: "CE",
  "CE ": "CE",
  CIVIL: "CE",
  Civil: "CE",
  "Civil Engineering": "CE",
  "CIVIL ENGINEERING": "CE",
  // IT variants
  it: "IT",
  It: "IT",
  "IT ": "IT",
  "Information Technology": "IT",
  "INFORMATION TECHNOLOGY": "IT",
  // Other
  LT: "LT",
  lt: "LT",
  "Leather Technology": "LT",
  AS: "AS",
  "Applied Science": "AS",
  "Applied Sciences": "AS",
};

function normalizeBranchName(
  branchName: string | null | undefined,
): string | null {
  if (!branchName) return null;
  const trimmed = branchName.trim();
  if (!trimmed) return null;
  if (branchNormalizationMap[trimmed]) return branchNormalizationMap[trimmed];
  const lowerTrimmed = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(branchNormalizationMap)) {
    if (key.toLowerCase() === lowerTrimmed) return value;
  }
  return trimmed;
}

async function postMigrationBranchFix(
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  logPhase("Post-Migration: Fixing Branch Data");

  if (config.dryRun) {
    logWarning("Dry run: Would fix branch data");
    return;
  }

  try {
    // Step 1: Get all unique branchName values from Users
    const usersWithBranch = await prisma.user.findMany({
      where: { branchName: { not: null } },
      select: { branchName: true },
      distinct: ["branchName"],
    });

    const uniqueBranchNames: string[] = [];
    for (const u of usersWithBranch) {
      if (u.branchName) {
        const normalized = normalizeBranchName(u.branchName);
        if (normalized && !uniqueBranchNames.includes(normalized)) {
          uniqueBranchNames.push(normalized);
        }
      }
    }

    log(`  Found ${uniqueBranchNames.length} unique branch names`, "reset");

    // Step 2: Create branches that don't exist (using name, shortName, code fields)
    let branchesCreated = 0;
    for (const branchName of uniqueBranchNames) {
      const existing = await prisma.branch.findFirst({
        where: { code: branchName },
      });
      if (!existing) {
        await prisma.branch.create({
          data: {
            name: `${branchName} Department`,
            shortName: branchName,
            code: branchName,
            duration: 4, // Default 4 years
          },
        });
        branchesCreated++;
      }
    }
    logSuccess(`Created ${branchesCreated} new branches`);

    // Step 3: Link users to branches
    const allBranches = await prisma.branch.findMany();
    const branchMap = new Map(
      allBranches.map((b) => [b.code.toUpperCase(), b.id]),
    );

    const usersToUpdate = await prisma.user.findMany({
      where: { branchName: { not: null }, branchId: null },
      select: { id: true, branchName: true },
    });

    let usersLinked = 0;
    for (const user of usersToUpdate) {
      if (user.branchName) {
        const normalized = normalizeBranchName(user.branchName);
        if (normalized) {
          const branchId = branchMap.get(normalized.toUpperCase());
          if (branchId) {
            await prisma.user.update({
              where: { id: user.id },
              data: { branchId, branchName: normalized },
            });
            usersLinked++;
          }
        }
      }
    }
    logSuccess(`Linked ${usersLinked} users to branches`);

    // Step 4: Sync Student.branchId from User.branchId
    const studentsToUpdate = await prisma.student.findMany({
      where: { branchId: null },
      include: { user: { select: { branchId: true } } },
    });

    let studentsLinked = 0;
    for (const student of studentsToUpdate) {
      if (student.user?.branchId) {
        await prisma.student.update({
          where: { id: student.id },
          data: { branchId: student.user.branchId },
        });
        studentsLinked++;
      }
    }
    logSuccess(`Linked ${studentsLinked} students to branches`);
  } catch (error: any) {
    logError(`Branch fix error: ${error.message}`);
    if (config.verbose) console.error(error);
  }
}

// =============================================================================
// Post-Migration: Data Integrity Cleanup
// =============================================================================

async function postMigrationDataIntegrityCleanup(
  prisma: PrismaClient,
  config: MigrationConfig,
) {
  logPhase("Post-Migration: Data Integrity Cleanup");

  if (config.dryRun) {
    logWarning("Dry run: Would perform data integrity cleanup");
    return;
  }

  try {
    // 1. Deactivate internship applications for inactive students
    log("  Checking for active internships with inactive students...", "reset");
    const inactiveStudentApps = await prisma.$executeRaw`
      UPDATE "internship_applications"
      SET "isActive" = false,
          "internshipPhase" = 'TERMINATED',
          "updatedAt" = NOW()
      WHERE "studentId" IN (
        SELECT s.id FROM "Student" s
        JOIN "User" u ON u.id = s."userId"
        WHERE u.active = false
      )
      AND ("isActive" = true OR "internshipPhase" = 'ACTIVE')
    `;
    if (inactiveStudentApps > 0) {
      logSuccess(
        `Deactivated ${inactiveStudentApps} internship applications for inactive students`,
      );
    } else {
      log("  No active internships found for inactive students", "reset");
    }

    // 2. Deactivate mentor assignments for inactive students
    log(
      "  Checking for active mentor assignments with inactive students...",
      "reset",
    );
    const inactiveStudentMentors = await prisma.$executeRaw`
      UPDATE "mentor_assignments"
      SET "isActive" = false,
          "deactivatedAt" = NOW(),
          "deactivationReason" = 'Student account deactivated',
          "updatedAt" = NOW()
      WHERE "studentId" IN (
        SELECT s.id FROM "Student" s
        JOIN "User" u ON u.id = s."userId"
        WHERE u.active = false
      )
      AND "isActive" = true
    `;
    if (inactiveStudentMentors > 0) {
      logSuccess(
        `Deactivated ${inactiveStudentMentors} mentor assignments for inactive students`,
      );
    } else {
      log(
        "  No active mentor assignments found for inactive students",
        "reset",
      );
    }

    // 3. Deactivate mentor assignments for inactive mentors
    log(
      "  Checking for active mentor assignments with inactive mentors...",
      "reset",
    );
    const inactiveMentorAssignments = await prisma.$executeRaw`
      UPDATE "mentor_assignments"
      SET "isActive" = false,
          "deactivatedAt" = NOW(),
          "deactivationReason" = 'Mentor account deactivated',
          "updatedAt" = NOW()
      WHERE "mentorId" IN (
        SELECT id FROM "User"
        WHERE active = false
      )
      AND "isActive" = true
    `;
    if (inactiveMentorAssignments > 0) {
      logSuccess(
        `Deactivated ${inactiveMentorAssignments} mentor assignments for inactive mentors`,
      );
    } else {
      log("  No active mentor assignments found for inactive mentors", "reset");
    }

    // 4. Deactivate WITHDRAWN applications still marked isActive=true
    log(
      "  Checking for WITHDRAWN applications still marked active...",
      "reset",
    );
    const withdrawnButActive = await prisma.$executeRaw`
      UPDATE "internship_applications"
      SET "isActive" = false,
          "updatedAt" = NOW()
      WHERE status = 'WITHDRAWN'
      AND "isActive" = true
    `;
    if (withdrawnButActive > 0) {
      logSuccess(
        `Deactivated ${withdrawnButActive} WITHDRAWN applications that were still marked active`,
      );
    } else {
      log("  No WITHDRAWN applications found with isActive=true", "reset");
    }

    // 5. Soft-delete visits and reports linked to inactive applications
    log(
      "  Checking for visits/reports linked to inactive applications...",
      "reset",
    );
    const orphanedVisits = await prisma.$executeRaw`
      UPDATE "faculty_visit_logs"
      SET "isDeleted" = true,
          "updatedAt" = NOW()
      WHERE "isDeleted" = false
      AND "applicationId" IN (
        SELECT id FROM "internship_applications" WHERE "isActive" = false
      )
    `;
    if (orphanedVisits > 0) {
      logSuccess(
        `Soft-deleted ${orphanedVisits} visits linked to inactive applications`,
      );
    } else {
      log("  No orphaned visits found", "reset");
    }

    const orphanedReports = await prisma.$executeRaw`
      UPDATE "monthly_reports"
      SET "isDeleted" = true,
          "updatedAt" = NOW()
      WHERE "isDeleted" = false
      AND "applicationId" IN (
        SELECT id FROM "internship_applications" WHERE "isActive" = false
      )
    `;
    if (orphanedReports > 0) {
      logSuccess(
        `Soft-deleted ${orphanedReports} reports linked to inactive applications`,
      );
    } else {
      log("  No orphaned reports found", "reset");
    }

    // 6. Fix invalid dates (end date before start date) - log only
    log(
      "  Checking for applications with invalid dates (end before start)...",
      "reset",
    );
    const invalidDates = await prisma.$queryRaw<any[]>`
      SELECT id, "studentId", "startDate", "endDate", status
      FROM "internship_applications"
      WHERE "isActive" = true
      AND "startDate" IS NOT NULL
      AND "endDate" IS NOT NULL
      AND "endDate" < "startDate"
    `;
    if (invalidDates.length > 0) {
      logWarning(
        `Found ${invalidDates.length} applications with end date before start date (manual review needed):`,
      );
      invalidDates.forEach((a: any) => {
        log(
          `    App ID: ${a.id} | Start: ${a.startDate} | End: ${a.endDate} | Status: ${a.status}`,
          "yellow",
        );
      });
    } else {
      log("  No applications with invalid dates found", "reset");
    }

    // 7. Fix duplicate active applications (keep only newest APPROVED per student)
    log("  Checking for remaining duplicate active applications...", "reset");
    const duplicateAppsFixed = await prisma.$executeRaw`
      UPDATE "internship_applications"
      SET "isActive" = false, "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM (
          SELECT
            id,
            "studentId",
            "createdAt",
            ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY
              CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END,
              "createdAt" DESC
            ) as rn
          FROM "internship_applications"
          WHERE "isActive" = true
        ) ranked
        WHERE rn > 1
      )
    `;
    if (duplicateAppsFixed > 0) {
      logSuccess(`Fixed ${duplicateAppsFixed} duplicate active applications`);
    } else {
      log("  No duplicate active applications found", "reset");
    }

    // 8. Fix duplicate active mentor assignments (keep only newest per student)
    log(
      "  Checking for remaining duplicate active mentor assignments...",
      "reset",
    );
    const duplicateMentorsFixed = await prisma.$executeRaw`
      UPDATE "mentor_assignments"
      SET "isActive" = false,
          "deactivatedAt" = NOW(),
          "deactivationReason" = 'Superseded by newer assignment',
          "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM (
          SELECT
            id,
            "studentId",
            "createdAt",
            ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "createdAt" DESC) as rn
          FROM "mentor_assignments"
          WHERE "isActive" = true
        ) ranked
        WHERE rn > 1
      )
    `;
    if (duplicateMentorsFixed > 0) {
      logSuccess(
        `Fixed ${duplicateMentorsFixed} duplicate active mentor assignments`,
      );
    } else {
      log("  No duplicate active mentor assignments found", "reset");
    }

    // 9. Verify final counts
    log("  Verifying data integrity...", "reset");
    const verificationResults = await prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(*) FROM "User" WHERE active = true AND role = 'STUDENT') as active_student_users,
        (SELECT COUNT(DISTINCT s.id) FROM "Student" s
         JOIN "User" u ON u.id = s."userId"
         WHERE u.active = true) as active_students,
        (SELECT COUNT(*) FROM "internship_applications" WHERE "isActive" = true) as active_internships,
        (SELECT COUNT(DISTINCT "studentId") FROM "internship_applications" WHERE "isActive" = true) as students_with_internships,
        (SELECT COUNT(*) FROM "mentor_assignments" WHERE "isActive" = true) as active_mentor_assignments,
        (SELECT COUNT(DISTINCT "studentId") FROM "mentor_assignments" WHERE "isActive" = true) as students_with_mentors
    `;

    if (verificationResults.length > 0) {
      const v = verificationResults[0];
      log("", "reset");
      log("  ┌─────────────────────────────────────────────────┐", "cyan");
      log("  │           DATA INTEGRITY VERIFICATION           │", "cyan");
      log("  ├─────────────────────────────────────────────────┤", "cyan");
      log(
        `  │  Active Student Users:          ${String(v.active_student_users).padStart(10)}   │`,
        "cyan",
      );
      log(
        `  │  Active Students:               ${String(v.active_students).padStart(10)}   │`,
        "cyan",
      );
      log(
        `  │  Active Internships:            ${String(v.active_internships).padStart(10)}   │`,
        "cyan",
      );
      log(
        `  │  Students with Internships:     ${String(v.students_with_internships).padStart(10)}   │`,
        "cyan",
      );
      log(
        `  │  Active Mentor Assignments:     ${String(v.active_mentor_assignments).padStart(10)}   │`,
        "cyan",
      );
      log(
        `  │  Students with Mentors:         ${String(v.students_with_mentors).padStart(10)}   │`,
        "cyan",
      );
      log("  └─────────────────────────────────────────────────┘", "cyan");

      // Check for issues
      const internshipDiff =
        parseInt(v.active_internships) - parseInt(v.students_with_internships);
      const mentorDiff =
        parseInt(v.active_mentor_assignments) -
        parseInt(v.students_with_mentors);

      if (internshipDiff > 0) {
        logWarning(
          `  ${internshipDiff} students have multiple active internships (may need review)`,
        );
      }
      if (mentorDiff > 0) {
        logWarning(
          `  ${mentorDiff} students have multiple active mentor assignments (may need review)`,
        );
      }
      if (internshipDiff === 0 && mentorDiff === 0) {
        logSuccess("Data integrity verified - no duplicates found");
      }
    }
  } catch (error: any) {
    logError(`Data integrity cleanup error: ${error.message}`);
    if (config.verbose) console.error(error);
  }
}

// =============================================================================
// Connection Testing
// =============================================================================

async function testMongoConnection(
  url: string,
): Promise<{
  success: boolean;
  message: string;
  db?: any;
  client?: MongoClient;
}> {
  try {
    const client = new MongoClient(url);
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();
    return {
      success: true,
      message: `Connected. Found ${collections.length} collections.`,
      db,
      client,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

async function testPostgresConnection(
  url: string,
): Promise<{
  success: boolean;
  message: string;
  prisma?: PrismaClient;
  pool?: Pool;
}> {
  try {
    const pool = new Pool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter } as any);

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return {
      success: true,
      message: "Connected successfully.",
      prisma,
      pool,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

// =============================================================================
// CLI Report Functions
// =============================================================================

function printMigrationReport(
  config: MigrationConfig,
  totalTime: string,
): void {
  const totalRecords = migrationStats.reduce((sum, s) => sum + s.total, 0);
  const totalMigrated = migrationStats.reduce((sum, s) => sum + s.migrated, 0);
  const totalSkipped = migrationStats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = migrationStats.reduce((sum, s) => sum + s.errors, 0);
  const successRate =
    totalRecords > 0 ? ((totalMigrated / totalRecords) * 100).toFixed(1) : "0";

  logSection("MIGRATION REPORT");

  if (config.dryRun) {
    logWarning("DRY RUN MODE - No data was actually migrated");
    console.log("");
  }

  // Overview
  log("╔══════════════════════════════════════════════════════════╗", "cyan");
  log("║                    MIGRATION OVERVIEW                     ║", "cyan");
  log("╠══════════════════════════════════════════════════════════╣", "cyan");
  log(
    `║  Total Records:     ${String(totalRecords).padStart(10)}                         ║`,
    "cyan",
  );
  log(
    `║  Migrated:          ${String(totalMigrated).padStart(10)}  (${successRate}%)                  ║`,
    "green",
  );
  log(
    `║  Skipped:           ${String(totalSkipped).padStart(10)}                         ║`,
    "yellow",
  );
  log(
    `║  Errors:            ${String(totalErrors).padStart(10)}                         ║`,
    totalErrors > 0 ? "red" : "green",
  );
  log(
    `║  Duration:          ${String(totalTime + "s").padStart(10)}                         ║`,
    "cyan",
  );
  log("╚══════════════════════════════════════════════════════════╝", "cyan");

  console.log("");

  // Detailed collection stats
  log(
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "reset",
  );
  log(
    "│                         COLLECTION DETAILS                                   │",
    "reset",
  );
  log(
    "├──────────────────────────┬────────┬──────────┬─────────┬─────────┬──────────┤",
    "reset",
  );
  log(
    "│ Collection               │  Total │ Migrated │ Skipped │  Errors │  Time(s) │",
    "reset",
  );
  log(
    "├──────────────────────────┼────────┼──────────┼─────────┼─────────┼──────────┤",
    "reset",
  );

  for (const stat of migrationStats) {
    const duration = stat.endTime
      ? ((stat.endTime - stat.startTime) / 1000).toFixed(2)
      : "-";
    const errorColor = stat.errors > 0 ? "red" : "reset";
    const collName = stat.collection.padEnd(24).slice(0, 24);
    const total = String(stat.total).padStart(6);
    const migrated = String(stat.migrated).padStart(8);
    const skipped = String(stat.skipped).padStart(7);
    const errors = String(stat.errors).padStart(7);
    const time = String(duration).padStart(8);

    if (stat.errors > 0) {
      log(
        `│ ${collName} │ ${total} │ ${migrated} │ ${skipped} │ ${colors.red}${errors}${colors.reset} │ ${time} │`,
        "reset",
      );
    } else {
      console.log(
        `│ ${collName} │ ${total} │ ${migrated} │ ${skipped} │ ${errors} │ ${time} │`,
      );
    }
  }

  log(
    "└──────────────────────────┴────────┴──────────┴─────────┴─────────┴──────────┘",
    "reset",
  );

  // ID mappings summary
  console.log("");
  log(
    "┌─────────────────────────────────────────────────────────────────────────────┐",
    "reset",
  );
  log(
    "│                          ID MAPPINGS CREATED                                 │",
    "reset",
  );
  log(
    "├─────────────────────────────────────────────────────────────────────────────┤",
    "reset",
  );

  let mappingLine = "│ ";
  let count = 0;
  for (const [collection, map] of Object.entries(idMaps)) {
    if (map.size > 0) {
      const item = `${collection}: ${map.size}`;
      if (mappingLine.length + item.length > 75) {
        console.log(mappingLine.padEnd(78) + "│");
        mappingLine = "│ ";
      }
      mappingLine += item + "  ";
      count++;
    }
  }
  if (mappingLine.length > 2) {
    console.log(mappingLine.padEnd(78) + "│");
  }
  log(
    "└─────────────────────────────────────────────────────────────────────────────┘",
    "reset",
  );

  // Error details (if any)
  if (globalErrors.length > 0 && config.verbose) {
    console.log("");
    log(
      "┌─────────────────────────────────────────────────────────────────────────────┐",
      "red",
    );
    log(
      "│                            ERROR DETAILS                                     │",
      "red",
    );
    log(
      "├─────────────────────────────────────────────────────────────────────────────┤",
      "red",
    );

    const maxErrors = 20;
    const displayErrors = globalErrors.slice(0, maxErrors);

    for (const err of displayErrors) {
      const msg = `${err.collection}: ${err.id} - ${err.message}`.slice(0, 75);
      log(`│ ${msg.padEnd(76)}│`, "red");
    }

    if (globalErrors.length > maxErrors) {
      log(
        `│ ... and ${globalErrors.length - maxErrors} more errors (use --verbose for full list)`.padEnd(
          77,
        ) + "│",
        "red",
      );
    }

    log(
      "└─────────────────────────────────────────────────────────────────────────────┘",
      "red",
    );
  } else if (globalErrors.length > 0) {
    console.log("");
    logWarning(
      `${globalErrors.length} errors occurred. Use --verbose to see details.`,
    );
  }

  // Final status
  console.log("");
  if (totalErrors === 0 && !config.dryRun) {
    log(
      "╔══════════════════════════════════════════════════════════╗",
      "green",
    );
    log(
      "║          ✓ MIGRATION COMPLETED SUCCESSFULLY              ║",
      "green",
    );
    log(
      "╚══════════════════════════════════════════════════════════╝",
      "green",
    );
  } else if (totalErrors > 0) {
    log(
      "╔══════════════════════════════════════════════════════════╗",
      "yellow",
    );
    log(
      "║       ⚠ MIGRATION COMPLETED WITH ERRORS                  ║",
      "yellow",
    );
    log(
      "╚══════════════════════════════════════════════════════════╝",
      "yellow",
    );
  }

  // Recommendations
  if (totalSkipped > 0 || totalErrors > 0) {
    console.log("");
    log("Recommendations:", "cyan");
    if (totalSkipped > 0) {
      console.log(
        "  • Review skipped records - often caused by missing foreign key references",
      );
    }
    if (totalErrors > 0) {
      console.log("  • Run with --verbose flag to see detailed error messages");
      console.log("  • Check for data integrity issues in source MongoDB");
    }
  }
}

// =============================================================================
// Main Migration Function
// =============================================================================

async function main() {
  const config = parseArgs();

  logSection("MongoDB to PostgreSQL Server Migration");

  // Validate configuration
  if (!config.mongodbUrl) {
    logError(
      "MongoDB URL is required. Use --mongodb-url or set SOURCE_MONGODB_URL",
    );
    process.exit(1);
  }

  if (!config.postgresUrl) {
    logError(
      "PostgreSQL URL is required. Use --postgres-url or set TARGET_DATABASE_URL",
    );
    process.exit(1);
  }

  console.log("");
  log("Configuration:", "cyan");
  log(`  MongoDB (Source): ${maskConnectionUrl(config.mongodbUrl)}`);
  log(`  PostgreSQL (Target): ${maskConnectionUrl(config.postgresUrl)}`);
  log(`  Dry Run: ${config.dryRun ? "Yes" : "No"}`);
  log(`  Batch Size: ${config.batchSize}`);
  log(`  Skip Clear: ${config.skipClear ? "Yes" : "No"}`);
  log(`  Verbose: ${config.verbose ? "Yes" : "No"}`);

  let mongoClient: MongoClient | null = null;
  let prisma: PrismaClient | null = null;
  let pgPool: Pool | null = null;

  try {
    // Test connections
    logPhase("Testing Connections");

    log("Testing MongoDB connection...", "reset");
    const mongoResult = await testMongoConnection(config.mongodbUrl);
    if (!mongoResult.success) {
      logError(`MongoDB connection failed: ${mongoResult.message}`);
      process.exit(1);
    }
    logSuccess(`MongoDB: ${mongoResult.message}`);
    mongoClient = mongoResult.client!;
    const mongoDb = mongoResult.db;

    log("Testing PostgreSQL connection...", "reset");
    const pgResult = await testPostgresConnection(config.postgresUrl);
    if (!pgResult.success) {
      logError(`PostgreSQL connection failed: ${pgResult.message}`);
      process.exit(1);
    }
    logSuccess(`PostgreSQL: ${pgResult.message}`);
    prisma = pgResult.prisma!;
    pgPool = pgResult.pool!;

    // List MongoDB collections
    const collections = await mongoDb.listCollections().toArray();
    log(
      `Available MongoDB collections: ${collections.map((c: any) => c.name).join(", ")}`,
      "reset",
    );

    // Run pre-migration validation
    await validateSourceData(mongoDb, config);

    if (config.dryRun) {
      logPhase("Dry Run Mode - No data will be modified");
    }

    // Clear PostgreSQL tables
    if (!config.dryRun && !config.skipClear) {
      logPhase("Clearing PostgreSQL Tables");

      // First, terminate other connections to avoid locks
      log("Terminating other connections to the database...", "yellow");
      try {
        await prisma.$executeRawUnsafe(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> pg_backend_pid()
            AND state != 'idle';
        `);
      } catch (e) {
        // Ignore errors - we may not have permission to terminate other connections
        log("Could not terminate other connections (this is usually fine)", "yellow");
      }

      // Get list of tables to truncate
      const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);

      log(`Found ${tables.length} tables to clear`, "cyan");

      // Truncate tables one by one with progress
      for (const table of tables) {
        try {
          log(`  Clearing ${table.tablename}...`, "cyan");
          await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" CASCADE`);
        } catch (e: any) {
          log(`  Warning: Could not truncate ${table.tablename}: ${e.message}`, "yellow");
        }
      }

      logSuccess("PostgreSQL tables cleared");
    }

    // Run migrations
    logPhase("Starting Data Migration");

    const startTime = Date.now();

    // Phase 1: Core entities
    await migrateInstitutions(mongoDb, prisma, config);

    // Phase 2: Users
    await migrateUsers(mongoDb, prisma, config);

    // Phase 3: Academic structure
    await migrateBatches(mongoDb, prisma, config);
    await migrateBranches(mongoDb, prisma, config);

    // Phase 4: Students
    await migrateStudents(mongoDb, prisma, config);

    // Phase 5: Applications and assignments
    await migrateInternshipApplications(mongoDb, prisma, config);
    await migrateMentorAssignments(mongoDb, prisma, config);

    // Phase 6: Documents
    await migrateDocuments(mongoDb, prisma, config);

    // Phase 7: Reports and visits
    await migrateMonthlyReports(mongoDb, prisma, config);
    await migrateFacultyVisitLogs(mongoDb, prisma, config);

    // Phase 8: Support data
    await migrateNotifications(mongoDb, prisma, config);
    await migrateGrievances(mongoDb, prisma, config);
    await migrateSupportTickets(mongoDb, prisma, config);
    await migrateAuditLogs(mongoDb, prisma, config);

    // Phase 9: Post-migration fixes
    await postMigrationBranchFix(prisma, config);

    // Phase 10: Data integrity cleanup
    await postMigrationDataIntegrityCleanup(prisma, config);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print comprehensive CLI report
    printMigrationReport(config, totalTime);

    // Summary message
    if (!config.dryRun) {
      console.log("");
      log(
        "┌─────────────────────────────────────────────────────────────────────────────┐",
        "cyan",
      );
      log(
        "│                         MIGRATION COMPLETE                                   │",
        "cyan",
      );
      log(
        "├─────────────────────────────────────────────────────────────────────────────┤",
        "cyan",
      );
      log(
        "│ The migration has completed with the following data synced:                  │",
        "cyan",
      );
      log(
        "│                                                                              │",
        "cyan",
      );
      log(
        "│   • User.name, email, phoneNo, dob, rollNumber synced from Student           │",
        "cyan",
      );
      log(
        "│   • User.branchId, branchName, institutionId synced from Student             │",
        "cyan",
      );
      log(
        "│   • User.active synced from Student.isActive                                 │",
        "cyan",
      );
      log(
        "│   • Branch records created and linked to Users/Students                      │",
        "cyan",
      );
      log(
        "│   • Technical queries migrated to Support Tickets (TechnicalQuery removed)    │",
        "cyan",
      );
      log(
        "│   • User is now the Single Source of Truth (SOT) for these fields            │",
        "cyan",
      );
      log(
        "└─────────────────────────────────────────────────────────────────────────────┘",
        "cyan",
      );
    }
  } catch (error: any) {
    logError(`Migration failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pgPool) {
      await pgPool.end();
    }
  }
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
