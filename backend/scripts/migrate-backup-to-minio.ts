/**
 * =============================================================================
 * BACKUP TO MINIO MIGRATION SCRIPT
 * =============================================================================
 *
 * This script extracts a tar.gz backup file and uploads all files to MinIO
 * while preserving the folder structure.
 *
 * EXPECTED BACKUP STRUCTURE:
 *   {institutionName}/profile/{rollNumber}_profile.webp
 *   {institutionName}/joining-letters/{rollNumber}_joiningletter.pdf
 *   {institutionName}/reports/{rollNumber}_{month}_{year}_monthlyreport.pdf
 *   {institutionName}/documents/{rollNumber}_{docType}_document.pdf
 *   etc.
 *
 * USAGE:
 *   npx ts-node scripts/migrate-backup-to-minio.ts [backup_file_path]
 *
 * EXAMPLE:
 *   npx ts-node scripts/migrate-backup-to-minio.ts "D:/chrome download/photo_backup.tar.gz"
 *
 * OPTIONS (via environment variables):
 *   DRY_RUN=true          - Preview what would be uploaded without uploading
 *   SKIP_EXTRACT=true     - Skip extraction if already extracted
 *   EXTRACT_PATH=/path    - Custom extraction path
 *
 * =============================================================================
 */

import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import * as tar from 'tar';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // MinIO Configuration
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_BUCKET: process.env.MINIO_BUCKE || 'cms-uploads',
  MINIO_ACCESS_KEY: process.env.MINIO_ROOT_USER || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_ROOT_PASSWORD || 'minioadmin123',
  MINIO_REGION: process.env.MINIO_REGION || 'us-east-1',

  // Default backup file path
  DEFAULT_BACKUP_PATH: path.resolve(__dirname, '../../photo_backup.tar.gz'),

  // Extraction path
  EXTRACT_PATH: process.env.EXTRACT_PATH || path.resolve(__dirname, '../temp/extracted_backup'),

  // Options
  DRY_RUN: process.env.DRY_RUN === 'true',
  SKIP_EXTRACT: process.env.SKIP_EXTRACT === 'true',

  // Logging
  LOG_FILE: path.resolve(__dirname, '../logs/minio-migration.log'),
};

// =============================================================================
// TYPES
// =============================================================================

interface MigrationStats {
  totalFiles: number;
  uploaded: number;
  skipped: number;
  errors: number;
  totalBytes: number;
}

interface FileInfo {
  localPath: string;
  minioKey: string;
  size: number;
}

// =============================================================================
// LOGGING
// =============================================================================

let logStream: fs.WriteStream | null = null;

function initLogging() {
  const logsDir = path.dirname(CONFIG.LOG_FILE);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });
}

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = {
    INFO: '\x1b[36m[INFO]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
    SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
  if (logStream) {
    logStream.write(`[${timestamp}] [${level}] ${message}\n`);
  }
}

function logSection(title: string) {
  log('');
  log('='.repeat(70));
  log(title);
  log('='.repeat(70));
}

// =============================================================================
// MINIO HELPERS
// =============================================================================

function createMinioClient(): S3Client {
  return new S3Client({
    endpoint: CONFIG.MINIO_ENDPOINT,
    region: CONFIG.MINIO_REGION,
    credentials: {
      accessKeyId: CONFIG.MINIO_ACCESS_KEY,
      secretAccessKey: CONFIG.MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

async function testMinioConnection(s3: S3Client): Promise<boolean> {
  try {
    const { Buckets } = await s3.send(new ListBucketsCommand({}));
    log(`MinIO connected! Found ${Buckets?.length || 0} bucket(s)`);
    return true;
  } catch (error: any) {
    log(`MinIO connection failed: ${error.message}`, 'ERROR');
    return false;
  }
}

async function ensureBucketExists(s3: S3Client): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: CONFIG.MINIO_BUCKET }));
    log(`Bucket "${CONFIG.MINIO_BUCKET}" exists`);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: CONFIG.MINIO_BUCKET }));
        log(`Bucket "${CONFIG.MINIO_BUCKET}" created`, 'SUCCESS');
        return true;
      } catch (createErr: any) {
        log(`Failed to create bucket: ${createErr.message}`, 'ERROR');
        return false;
      }
    }
    log(`Bucket check failed: ${error.message}`, 'ERROR');
    return false;
  }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.zip': 'application/zip',
  };
  return types[ext] || 'application/octet-stream';
}

async function uploadToMinio(
  s3: S3Client,
  localPath: string,
  minioKey: string
): Promise<string> {
  const buffer = fs.readFileSync(localPath);
  const contentType = getContentType(localPath);

  await s3.send(
    new PutObjectCommand({
      Bucket: CONFIG.MINIO_BUCKET,
      Key: minioKey,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${CONFIG.MINIO_ENDPOINT}/${CONFIG.MINIO_BUCKET}/${minioKey}`;
}

// =============================================================================
// EXTRACTION HELPERS
// =============================================================================

async function extractTarGz(backupFile: string, extractPath: string): Promise<boolean> {
  logSection('STEP 1: EXTRACTING BACKUP');

  if (CONFIG.SKIP_EXTRACT) {
    log('Skipping extraction (SKIP_EXTRACT=true)', 'WARN');
    return true;
  }

  if (!fs.existsSync(backupFile)) {
    log(`Backup file not found: ${backupFile}`, 'ERROR');
    return false;
  }

  const fileStats = fs.statSync(backupFile);
  log(`Backup file: ${backupFile}`);
  log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Create extraction directory
  if (fs.existsSync(extractPath)) {
    log(`Cleaning existing extraction path: ${extractPath}`);
    fs.rmSync(extractPath, { recursive: true, force: true });
  }
  fs.mkdirSync(extractPath, { recursive: true });

  log(`Extracting to: ${extractPath}`);

  try {
    // Try using tar package first
    await tar.x({
      file: backupFile,
      cwd: extractPath,
    });
    log('Extraction completed successfully!', 'SUCCESS');
    return true;
  } catch (tarError: any) {
    log(`tar package failed: ${tarError.message}`, 'WARN');
    log('Trying system tar command...');

    // Fallback to system tar command
    try {
      // For Windows, try 7zip or tar if available
      const isWindows = process.platform === 'win32';

      if (isWindows) {
        // Try Windows tar (available in Windows 10+)
        try {
          execSync(`tar -xzf "${backupFile}" -C "${extractPath}"`, { stdio: 'pipe' });
          log('Extraction completed using Windows tar!', 'SUCCESS');
          return true;
        } catch {
          // Try 7-Zip
          const sevenZipPaths = [
            'C:\\Program Files\\7-Zip\\7z.exe',
            'C:\\Program Files (x86)\\7-Zip\\7z.exe',
            '7z',
          ];

          for (const sevenZip of sevenZipPaths) {
            try {
              // First extract .gz to .tar
              execSync(`"${sevenZip}" x "${backupFile}" -o"${extractPath}" -y`, { stdio: 'pipe' });

              // Find the .tar file and extract it
              const tarFile = fs.readdirSync(extractPath).find(f => f.endsWith('.tar'));
              if (tarFile) {
                execSync(`"${sevenZip}" x "${path.join(extractPath, tarFile)}" -o"${extractPath}" -y`, { stdio: 'pipe' });
                fs.unlinkSync(path.join(extractPath, tarFile));
              }

              log('Extraction completed using 7-Zip!', 'SUCCESS');
              return true;
            } catch {
              continue;
            }
          }
        }
      } else {
        // Linux/Mac
        execSync(`tar -xzf "${backupFile}" -C "${extractPath}"`, { stdio: 'pipe' });
        log('Extraction completed using system tar!', 'SUCCESS');
        return true;
      }

      log('No suitable extraction tool found', 'ERROR');
      log('Please install 7-Zip or manually extract the backup', 'ERROR');
      return false;
    } catch (sysError: any) {
      log(`System tar failed: ${sysError.message}`, 'ERROR');
      return false;
    }
  }
}

// =============================================================================
// FILE DISCOVERY
// =============================================================================

function getAllFiles(dirPath: string, basePath: string = dirPath): FileInfo[] {
  const files: FileInfo[] = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath));
    } else if (entry.isFile()) {
      // Get relative path from base for MinIO key
      const relativePath = path.relative(basePath, fullPath);
      // Normalize path separators for MinIO (use forward slashes)
      const minioKey = relativePath.replace(/\\/g, '/');

      files.push({
        localPath: fullPath,
        minioKey,
        size: fs.statSync(fullPath).size,
      });
    }
  }

  return files;
}

function categorizeFiles(files: FileInfo[]): Record<string, FileInfo[]> {
  const categories: Record<string, FileInfo[]> = {
    profile: [],
    'joining-letters': [],
    reports: [],
    documents: [],
    certificates: [],
    'offer-letters': [],
    noc: [],
    other: [],
  };

  for (const file of files) {
    const pathLower = file.minioKey.toLowerCase();

    if (pathLower.includes('/profile/') || pathLower.includes('_profile.')) {
      categories.profile.push(file);
    } else if (pathLower.includes('/joining-letters/') || pathLower.includes('_joiningletter.')) {
      categories['joining-letters'].push(file);
    } else if (pathLower.includes('/reports/') || pathLower.includes('_monthlyreport.')) {
      categories.reports.push(file);
    } else if (pathLower.includes('/documents/') || pathLower.includes('_document.')) {
      categories.documents.push(file);
    } else if (pathLower.includes('/certificates/')) {
      categories.certificates.push(file);
    } else if (pathLower.includes('/offer-letters/')) {
      categories['offer-letters'].push(file);
    } else if (pathLower.includes('/noc/')) {
      categories.noc.push(file);
    } else {
      categories.other.push(file);
    }
  }

  return categories;
}

// =============================================================================
// MIGRATION
// =============================================================================

async function migrateFiles(s3: S3Client, files: FileInfo[]): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalFiles: files.length,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    totalBytes: 0,
  };

  for (const file of files) {
    try {
      if (CONFIG.DRY_RUN) {
        log(`  [DRY_RUN] ${file.minioKey} (${(file.size / 1024).toFixed(1)} KB)`);
        stats.uploaded++;
        stats.totalBytes += file.size;
        continue;
      }

      process.stdout.write(`  Uploading: ${file.minioKey}... `);

      await uploadToMinio(s3, file.localPath, file.minioKey);

      console.log(`OK (${(file.size / 1024).toFixed(1)} KB)`);
      stats.uploaded++;
      stats.totalBytes += file.size;
    } catch (error: any) {
      console.log(`FAILED - ${error.message}`);
      log(`  Error uploading ${file.minioKey}: ${error.message}`, 'ERROR');
      stats.errors++;
    }
  }

  return stats;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const startTime = Date.now();
  initLogging();

  logSection('BACKUP TO MINIO MIGRATION');
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`DRY_RUN: ${CONFIG.DRY_RUN}`);

  // Get backup file path
  const backupFile = process.argv[2] || CONFIG.DEFAULT_BACKUP_PATH;
  log(`Backup file: ${backupFile}`);
  log(`MinIO endpoint: ${CONFIG.MINIO_ENDPOINT}`);
  log(`MinIO bucket: ${CONFIG.MINIO_BUCKET}`);

  // Validate backup file exists
  if (!fs.existsSync(backupFile)) {
    log(`Backup file not found: ${backupFile}`, 'ERROR');
    log('Usage: npx ts-node scripts/migrate-backup-to-minio.ts [backup_file_path]', 'INFO');
    process.exit(1);
  }

  // Initialize MinIO
  logSection('STEP 2: CONNECTING TO MINIO');
  log('Initializing MinIO client...');
  const s3 = createMinioClient();

  if (!(await testMinioConnection(s3))) {
    log('Cannot connect to MinIO. Please ensure MinIO is running.', 'ERROR');
    log(`Endpoint: ${CONFIG.MINIO_ENDPOINT}`, 'ERROR');
    log('If using Docker, run: docker-compose up -d minio', 'INFO');
    process.exit(1);
  }

  if (!(await ensureBucketExists(s3))) {
    log('Cannot access or create bucket', 'ERROR');
    process.exit(1);
  }

  // Extract backup
  const extractPath = CONFIG.EXTRACT_PATH;
  const extractSuccess = await extractTarGz(backupFile, extractPath);

  if (!extractSuccess && !CONFIG.SKIP_EXTRACT) {
    log('Extraction failed. Cannot proceed with migration.', 'ERROR');
    process.exit(1);
  }

  // Discover files
  logSection('STEP 3: DISCOVERING FILES');

  // Check for nested folder (sometimes tar extracts to a subdirectory)
  let actualExtractPath = extractPath;
  const extractContents = fs.readdirSync(extractPath);

  if (extractContents.length === 1) {
    const singleEntry = path.join(extractPath, extractContents[0]);
    if (fs.statSync(singleEntry).isDirectory()) {
      actualExtractPath = singleEntry;
      log(`Found nested directory, using: ${actualExtractPath}`);
    }
  }

  const allFiles = getAllFiles(actualExtractPath);
  log(`Found ${allFiles.length} files total`);

  if (allFiles.length === 0) {
    log('No files found in extracted backup!', 'ERROR');
    log(`Extract path: ${actualExtractPath}`, 'ERROR');
    process.exit(1);
  }

  // Categorize files
  const categories = categorizeFiles(allFiles);
  log('');
  log('Files by category:');
  for (const [category, files] of Object.entries(categories)) {
    if (files.length > 0) {
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      log(`  ${category}: ${files.length} files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
    }
  }

  // Migrate files
  logSection('STEP 4: UPLOADING TO MINIO');

  const overallStats: MigrationStats = {
    totalFiles: 0,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    totalBytes: 0,
  };

  for (const [category, files] of Object.entries(categories)) {
    if (files.length === 0) continue;

    log('');
    log(`Uploading ${category} (${files.length} files)...`);

    const stats = await migrateFiles(s3, files);

    overallStats.totalFiles += stats.totalFiles;
    overallStats.uploaded += stats.uploaded;
    overallStats.skipped += stats.skipped;
    overallStats.errors += stats.errors;
    overallStats.totalBytes += stats.totalBytes;
  }

  // Cleanup
  if (!CONFIG.DRY_RUN && !CONFIG.SKIP_EXTRACT) {
    log('');
    log('Cleaning up extracted files...');
    try {
      fs.rmSync(extractPath, { recursive: true, force: true });
      log('Cleanup completed', 'SUCCESS');
    } catch (e: any) {
      log(`Cleanup failed: ${e.message}`, 'WARN');
    }
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  logSection('MIGRATION SUMMARY');
  log(`Duration: ${duration} seconds`);
  log('');
  log(`Total files: ${overallStats.totalFiles}`);
  log(`Uploaded: ${overallStats.uploaded}`, 'SUCCESS');
  log(`Skipped: ${overallStats.skipped}`);
  log(`Errors: ${overallStats.errors}`, overallStats.errors > 0 ? 'ERROR' : 'INFO');
  log(`Total size: ${(overallStats.totalBytes / 1024 / 1024).toFixed(2)} MB`);

  if (CONFIG.DRY_RUN) {
    log('');
    log('This was a DRY RUN. No files were actually uploaded.', 'WARN');
    log('Run without DRY_RUN=true to perform actual migration.', 'WARN');
  }

  log(`\nLog file: ${CONFIG.LOG_FILE}`, 'SUCCESS');

  // Close log stream
  if (logStream) {
    logStream.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
