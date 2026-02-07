/**
 * PostgreSQL to PostgreSQL Migration Script
 *
 * This script migrates all data from a source PostgreSQL database to a target PostgreSQL database.
 * Designed for migrating local development data to a production server.
 *
 * Features:
 * - Configurable via environment variables or CLI arguments
 * - Connection testing before migration
 * - Dry-run mode for testing
 * - Batch processing for large datasets
 * - Progress logging
 * - Proper handling of foreign key constraints (migration order)
 * - Graceful error handling
 *
 * Environment Variables:
 *   SOURCE_DATABASE_URL - Source PostgreSQL connection string
 *   TARGET_DATABASE_URL - Target PostgreSQL connection string
 *
 * Usage:
 *   # Using CLI arguments:
 *   npx ts-node prisma/postgres-to-postgres-migrate.ts \
 *     --source "postgresql://user:pass@localhost:5432/local_db" \
 *     --target "postgresql://user:pass@server:5432/prod_db" \
 *     --dry-run
 *
 *   # Using environment variables:
 *   SOURCE_DATABASE_URL="postgresql://..." TARGET_DATABASE_URL="postgresql://..." npx ts-node prisma/postgres-to-postgres-migrate.ts
 */

import { Pool } from 'pg';

// =============================================================================
// Configuration
// =============================================================================

interface MigrationConfig {
  sourceUrl: string;
  targetUrl: string;
  dryRun: boolean;
  batchSize: number;
  skipClear: boolean;
  verbose: boolean;
  skipTables: string[];
}

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    sourceUrl: process.env.SOURCE_DATABASE_URL || '',
    targetUrl: process.env.TARGET_DATABASE_URL || '',
    dryRun: false,
    batchSize: 1000,
    skipClear: false,
    verbose: false,
    skipTables: [],
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
      case '-s':
        config.sourceUrl = args[++i];
        break;
      case '--target':
      case '-t':
        config.targetUrl = args[++i];
        break;
      case '--dry-run':
      case '-d':
        config.dryRun = true;
        break;
      case '--batch-size':
      case '-b':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--skip-clear':
        config.skipClear = true;
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--skip-table':
        config.skipTables.push(args[++i]);
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
PostgreSQL to PostgreSQL Migration Script

USAGE:
  npx ts-node prisma/postgres-to-postgres-migrate.ts [OPTIONS]

OPTIONS:
  -s, --source <url>        Source PostgreSQL connection URL
  -t, --target <url>        Target PostgreSQL connection URL
  -d, --dry-run             Test connections without migrating data
  -b, --batch-size <number> Number of records per batch (default: 1000)
  --skip-clear              Skip clearing target tables before migration
  --skip-table <table>      Skip specific table (can be used multiple times)
  -v, --verbose             Enable verbose logging
  -h, --help                Show this help message

ENVIRONMENT VARIABLES:
  SOURCE_DATABASE_URL       Source PostgreSQL connection URL (alternative to -s)
  TARGET_DATABASE_URL       Target PostgreSQL connection URL (alternative to -t)

EXAMPLES:
  # Basic migration from local to server
  npx ts-node prisma/postgres-to-postgres-migrate.ts \\
    -s "postgresql://postgres:pass@localhost:5432/cms_db" \\
    -t "postgresql://user:pass@server:5432/cms_db"

  # Dry run to test connections
  npx ts-node prisma/postgres-to-postgres-migrate.ts \\
    -s "postgresql://..." -t "postgresql://..." --dry-run

  # Migration with verbose output
  npx ts-node prisma/postgres-to-postgres-migrate.ts \\
    -s "postgresql://..." -t "postgresql://..." --verbose
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
};

function log(message: string, color: keyof typeof colors = 'reset'): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('');
  log('='.repeat(60), 'cyan');
  log(title, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logPhase(phase: string): void {
  console.log('');
  log(`--- ${phase} ---`, 'blue');
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, 'green');
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message: string): void {
  log(`✗ ${message}`, 'red');
}

function maskConnectionUrl(url: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

// =============================================================================
// Migration Statistics
// =============================================================================

interface TableStats {
  table: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  startTime: number;
  endTime?: number;
  errorDetails: Array<{ id: string; message: string }>;
}

const migrationStats: TableStats[] = [];
let globalErrors: Array<{ table: string; id: string; message: string }> = [];

function startTableMigration(table: string, total: number): TableStats {
  const stats: TableStats = {
    table,
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

function recordError(stats: TableStats, id: string, message: string): void {
  stats.errors++;
  stats.errorDetails.push({ id, message });
  globalErrors.push({ table: stats.table, id, message });
}

function finishTableMigration(stats: TableStats): void {
  stats.endTime = Date.now();
  const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
  log(`  Migrated: ${stats.migrated}/${stats.total} | Skipped: ${stats.skipped} | Errors: ${stats.errors} | Time: ${duration}s`, 'reset');
}

// =============================================================================
// Table Migration Order (respecting foreign key constraints)
// =============================================================================

const MIGRATION_ORDER = [
  // Phase 1: Core entities with no dependencies
  'Institution',

  // Phase 2: Entities depending on Institution
  'branches',          // Branch model
  'departments',       // Department model
  'Batch',

  // Phase 3: Users (depends on Institution, Branch)
  'User',

  // Phase 4: Students (depends on User, Institution, Branch, Batch)
  'Student',

  // Phase 5: Documents (depends on Student)
  'Document',

  // Phase 6: Internship Applications (depends on Student, User)
  'internship_applications',

  // Phase 7: Mentor Assignments (depends on Student, User)
  'mentor_assignments',

  // Phase 8: Monthly Reports (depends on InternshipApplication, Student)
  'monthly_reports',

  // Phase 9: Faculty Visit Logs (depends on InternshipApplication, User)
  'faculty_visit_logs',

  // Phase 10: Grievances and History (depends on Student, User)
  'Grievance',
  'GrievanceStatusHistory',

  // Phase 11: Notifications (depends on User)
  'Notification',

  // Phase 12: Support System (depends on User, Institution)
  'support_tickets',
  'support_responses',
  'faq_articles',

  // Phase 13: Audit and Logging (depends on User, Institution)
  'AuditLog',

  // Phase 14: Session and Token Management (depends on User)
  'user_sessions',
  'password_history',
  'token_blacklist',

  // Phase 15: System Management (no dependencies on user data)
  'bulk_jobs',
  'report_templates',
  'generated_reports',
  'backup_records',
  'backup_schedules',
  'system_configs',
];

// =============================================================================
// Core Migration Functions
// =============================================================================

async function getTableColumns(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows.map(row => row.column_name);
}

async function getTableCount(pool: Pool, tableName: string): Promise<number> {
  try {
    const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    return 0;
  }
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    )
  `, [tableName]);
  return result.rows[0].exists;
}

async function migrateTable(
  sourcePool: Pool,
  targetPool: Pool,
  tableName: string,
  config: MigrationConfig
): Promise<void> {
  log(`Migrating ${tableName}...`, 'blue');

  // Check if table exists in source
  const sourceExists = await tableExists(sourcePool, tableName);
  if (!sourceExists) {
    logWarning(`Table ${tableName} does not exist in source database, skipping`);
    return;
  }

  // Check if table exists in target
  const targetExists = await tableExists(targetPool, tableName);
  if (!targetExists) {
    logWarning(`Table ${tableName} does not exist in target database, skipping`);
    return;
  }

  // Get row count
  const totalCount = await getTableCount(sourcePool, tableName);
  const stats = startTableMigration(tableName, totalCount);

  if (totalCount === 0) {
    log(`  No data to migrate`, 'reset');
    finishTableMigration(stats);
    return;
  }

  if (config.dryRun) {
    logWarning(`Dry run: Would migrate ${totalCount} records from ${tableName}`);
    finishTableMigration(stats);
    return;
  }

  // Get columns that exist in both source and target
  const sourceColumns = await getTableColumns(sourcePool, tableName);
  const targetColumns = await getTableColumns(targetPool, tableName);
  const commonColumns = sourceColumns.filter(col => targetColumns.includes(col));

  if (commonColumns.length === 0) {
    logWarning(`No common columns between source and target for ${tableName}, skipping`);
    finishTableMigration(stats);
    return;
  }

  const columnList = commonColumns.map(c => `"${c}"`).join(', ');
  const placeholders = commonColumns.map((_, i) => `$${i + 1}`).join(', ');

  // Fetch data in batches
  let offset = 0;
  const progressInterval = Math.max(1, Math.floor(totalCount / 10));

  while (offset < totalCount) {
    try {
      // Fetch batch from source
      const fetchQuery = `SELECT ${columnList} FROM "${tableName}" ORDER BY "id" LIMIT ${config.batchSize} OFFSET ${offset}`;
      const result = await sourcePool.query(fetchQuery);

      if (result.rows.length === 0) break;

      // Insert each row into target
      for (const row of result.rows) {
        try {
          const values = commonColumns.map(col => row[col]);
          const insertQuery = `
            INSERT INTO "${tableName}" (${columnList})
            VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET
            ${commonColumns.filter(c => c !== 'id').map((c, i) => `"${c}" = EXCLUDED."${c}"`).join(', ')}
          `;
          await targetPool.query(insertQuery, values);
          stats.migrated++;
        } catch (rowError: any) {
          recordError(stats, row.id || 'unknown', rowError.message);
          if (config.verbose) {
            logError(`Error inserting row in ${tableName}: ${rowError.message}`);
          }
        }
      }

      offset += result.rows.length;

      // Progress logging
      if (stats.migrated % progressInterval === 0 || stats.migrated === totalCount) {
        const progress = Math.round((stats.migrated / totalCount) * 100);
        log(`  Progress: ${stats.migrated}/${totalCount} (${progress}%)`, 'reset');
      }
    } catch (batchError: any) {
      logError(`Error fetching batch from ${tableName}: ${batchError.message}`);
      break;
    }
  }

  finishTableMigration(stats);
}

// =============================================================================
// Connection Testing
// =============================================================================

async function testConnection(url: string, name: string): Promise<{ success: boolean; message: string; pool?: Pool }> {
  try {
    const pool = new Pool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    await pool.query('SELECT 1');

    // Count tables
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    return {
      success: true,
      message: `Connected. Found ${result.rows[0].count} tables.`,
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
// Clear Target Tables
// =============================================================================

async function clearTargetTables(pool: Pool, config: MigrationConfig): Promise<void> {
  logPhase('Clearing Target Tables');

  // Reverse order for deletion (to respect foreign key constraints)
  const tablesInReverseOrder = [...MIGRATION_ORDER].reverse();

  for (const table of tablesInReverseOrder) {
    if (config.skipTables.includes(table)) {
      logWarning(`Skipping clear for ${table}`);
      continue;
    }

    const exists = await tableExists(pool, table);
    if (!exists) continue;

    try {
      await pool.query(`TRUNCATE TABLE "${table}" CASCADE`);
      if (config.verbose) {
        logSuccess(`Cleared ${table}`);
      }
    } catch (error: any) {
      if (config.verbose) {
        logWarning(`Could not clear ${table}: ${error.message}`);
      }
    }
  }

  logSuccess('Target tables cleared');
}

// =============================================================================
// CLI Report Functions
// =============================================================================

function printMigrationReport(config: MigrationConfig, totalTime: string): void {
  const totalRecords = migrationStats.reduce((sum, s) => sum + s.total, 0);
  const totalMigrated = migrationStats.reduce((sum, s) => sum + s.migrated, 0);
  const totalSkipped = migrationStats.reduce((sum, s) => sum + s.skipped, 0);
  const totalErrors = migrationStats.reduce((sum, s) => sum + s.errors, 0);
  const successRate = totalRecords > 0 ? ((totalMigrated / totalRecords) * 100).toFixed(1) : '0';

  logSection('MIGRATION REPORT');

  if (config.dryRun) {
    logWarning('DRY RUN MODE - No data was actually migrated');
    console.log('');
  }

  // Overview
  log('╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    MIGRATION OVERVIEW                     ║', 'cyan');
  log('╠══════════════════════════════════════════════════════════╣', 'cyan');
  log(`║  Total Records:     ${String(totalRecords).padStart(10)}                         ║`, 'cyan');
  log(`║  Migrated:          ${String(totalMigrated).padStart(10)}  (${successRate}%)                  ║`, 'green');
  log(`║  Skipped:           ${String(totalSkipped).padStart(10)}                         ║`, 'yellow');
  log(`║  Errors:            ${String(totalErrors).padStart(10)}                         ║`, totalErrors > 0 ? 'red' : 'green');
  log(`║  Duration:          ${String(totalTime + 's').padStart(10)}                         ║`, 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');

  console.log('');

  // Detailed table stats
  log('┌─────────────────────────────────────────────────────────────────────────────┐', 'reset');
  log('│                           TABLE DETAILS                                      │', 'reset');
  log('├──────────────────────────┬────────┬──────────┬─────────┬─────────┬──────────┤', 'reset');
  log('│ Table                    │  Total │ Migrated │ Skipped │  Errors │  Time(s) │', 'reset');
  log('├──────────────────────────┼────────┼──────────┼─────────┼─────────┼──────────┤', 'reset');

  for (const stat of migrationStats) {
    const duration = stat.endTime ? ((stat.endTime - stat.startTime) / 1000).toFixed(2) : '-';
    const tableName = stat.table.padEnd(24).slice(0, 24);
    const total = String(stat.total).padStart(6);
    const migrated = String(stat.migrated).padStart(8);
    const skipped = String(stat.skipped).padStart(7);
    const errors = String(stat.errors).padStart(7);
    const time = String(duration).padStart(8);

    if (stat.errors > 0) {
      log(`│ ${tableName} │ ${total} │ ${migrated} │ ${skipped} │ ${colors.red}${errors}${colors.reset} │ ${time} │`, 'reset');
    } else {
      console.log(`│ ${tableName} │ ${total} │ ${migrated} │ ${skipped} │ ${errors} │ ${time} │`);
    }
  }

  log('└──────────────────────────┴────────┴──────────┴─────────┴─────────┴──────────┘', 'reset');

  // Error details (if any)
  if (globalErrors.length > 0 && config.verbose) {
    console.log('');
    log('┌─────────────────────────────────────────────────────────────────────────────┐', 'red');
    log('│                            ERROR DETAILS                                     │', 'red');
    log('├─────────────────────────────────────────────────────────────────────────────┤', 'red');

    const maxErrors = 20;
    const displayErrors = globalErrors.slice(0, maxErrors);

    for (const err of displayErrors) {
      const msg = `${err.table}: ${err.id} - ${err.message}`.slice(0, 75);
      log(`│ ${msg.padEnd(76)}│`, 'red');
    }

    if (globalErrors.length > maxErrors) {
      log(`│ ... and ${globalErrors.length - maxErrors} more errors`.padEnd(77) + '│', 'red');
    }

    log('└─────────────────────────────────────────────────────────────────────────────┘', 'red');
  } else if (globalErrors.length > 0) {
    console.log('');
    logWarning(`${globalErrors.length} errors occurred. Use --verbose to see details.`);
  }

  // Final status
  console.log('');
  if (totalErrors === 0 && !config.dryRun) {
    log('╔══════════════════════════════════════════════════════════╗', 'green');
    log('║          ✓ MIGRATION COMPLETED SUCCESSFULLY              ║', 'green');
    log('╚══════════════════════════════════════════════════════════╝', 'green');
  } else if (totalErrors > 0) {
    log('╔══════════════════════════════════════════════════════════╗', 'yellow');
    log('║       ⚠ MIGRATION COMPLETED WITH ERRORS                  ║', 'yellow');
    log('╚══════════════════════════════════════════════════════════╝', 'yellow');
  }
}

// =============================================================================
// Main Migration Function
// =============================================================================

async function main() {
  const config = parseArgs();

  logSection('PostgreSQL to PostgreSQL Migration');

  // Validate configuration
  if (!config.sourceUrl) {
    logError('Source database URL is required. Use --source or set SOURCE_DATABASE_URL');
    process.exit(1);
  }

  if (!config.targetUrl) {
    logError('Target database URL is required. Use --target or set TARGET_DATABASE_URL');
    process.exit(1);
  }

  console.log('');
  log('Configuration:', 'cyan');
  log(`  Source: ${maskConnectionUrl(config.sourceUrl)}`);
  log(`  Target: ${maskConnectionUrl(config.targetUrl)}`);
  log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  log(`  Batch Size: ${config.batchSize}`);
  log(`  Skip Clear: ${config.skipClear ? 'Yes' : 'No'}`);
  log(`  Verbose: ${config.verbose ? 'Yes' : 'No'}`);
  if (config.skipTables.length > 0) {
    log(`  Skip Tables: ${config.skipTables.join(', ')}`);
  }

  let sourcePool: Pool | null = null;
  let targetPool: Pool | null = null;

  try {
    // Test connections
    logPhase('Testing Connections');

    log('Testing source database connection...', 'reset');
    const sourceResult = await testConnection(config.sourceUrl, 'Source');
    if (!sourceResult.success) {
      logError(`Source database connection failed: ${sourceResult.message}`);
      process.exit(1);
    }
    logSuccess(`Source: ${sourceResult.message}`);
    sourcePool = sourceResult.pool!;

    log('Testing target database connection...', 'reset');
    const targetResult = await testConnection(config.targetUrl, 'Target');
    if (!targetResult.success) {
      logError(`Target database connection failed: ${targetResult.message}`);
      process.exit(1);
    }
    logSuccess(`Target: ${targetResult.message}`);
    targetPool = targetResult.pool!;

    // Clear target tables if not skipped
    if (!config.dryRun && !config.skipClear) {
      await clearTargetTables(targetPool, config);
    }

    // Run migrations
    logPhase('Starting Data Migration');

    const startTime = Date.now();

    // Disable foreign key checks for faster migration
    if (!config.dryRun) {
      await targetPool.query('SET session_replication_role = replica');
    }

    // Migrate tables in order
    for (const table of MIGRATION_ORDER) {
      if (config.skipTables.includes(table)) {
        logWarning(`Skipping ${table} (user requested)`);
        continue;
      }
      await migrateTable(sourcePool, targetPool, table, config);
    }

    // Re-enable foreign key checks
    if (!config.dryRun) {
      await targetPool.query('SET session_replication_role = DEFAULT');
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    // Print comprehensive CLI report
    printMigrationReport(config, totalTime);

  } catch (error: any) {
    logError(`Migration failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (sourcePool) {
      await sourcePool.end();
    }
    if (targetPool) {
      await targetPool.end();
    }
  }
}

main().catch((e) => {
  logError(e.message);
  process.exit(1);
});
