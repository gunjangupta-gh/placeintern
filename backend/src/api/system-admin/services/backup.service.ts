import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../infrastructure/file-storage/file-storage.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import { AuditAction, AuditCategory, AuditSeverity, BackupStatus, Role } from '../../../generated/prisma/client';
import { CreateBackupDto, StorageType } from '../dto/backup.dto';
import { spawn } from 'child_process';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

// Timeout constants (in milliseconds)
const BACKUP_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes for backup
const RESTORE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes for restore
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for file download

// Initialization states
type InitState = 'pending' | 'initializing' | 'ready' | 'failed';

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly localBackupDir: string;
  private mongoToolsAvailable: boolean = false;
  private mongoToolPaths: { mongodump: string; mongorestore: string } | null = null;
  private initState: InitState = 'pending';
  private initError: Error | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fileStorageService: FileStorageService,
    private readonly auditService: AuditService,
    private readonly wsService: WebSocketService,
  ) {
    // Use platform-appropriate paths
    if (process.platform === 'win32') {
      this.backupDir = process.env.TEMP || 'C:\\temp\\backups';
      this.localBackupDir = process.env.BACKUP_DIR || 'C:\\app\\backups';
    } else {
      this.backupDir = '/tmp/backups';
      this.localBackupDir = process.env.BACKUP_DIR || '/app/backups';
    }
    this.ensureDirectories();
  }

  /**
   * Initialize async operations after module is ready
   */
  async onModuleInit() {
    this.initPromise = this.verifyMongoToolsAsync();
    await this.initPromise;
  }

  /**
   * Ensure initialization is complete before operations
   * Call this at the start of any backup/restore operation
   */
  private async ensureInitialized(): Promise<void> {
    // If still initializing, wait for it
    if (this.initPromise && this.initState !== 'ready' && this.initState !== 'failed') {
      await this.initPromise;
    }

    // Check final state
    if (this.initState === 'failed') {
      throw new InternalServerErrorException(
        `Backup service initialization failed: ${this.initError?.message || 'Unknown error'}`
      );
    }

    if (this.initState !== 'ready') {
      throw new InternalServerErrorException('Backup service not initialized');
    }
  }

  /**
   * Verify MongoDB tools exist asynchronously on startup
   */
  private async verifyMongoToolsAsync(): Promise<void> {
    this.initState = 'initializing';

    try {
      const mongodumpPath = await this.resolveMongoToolPath('mongodump');
      const mongorestorePath = await this.resolveMongoToolPath('mongorestore');

      // Check if tools exist on Windows
      if (process.platform === 'win32') {
        const dumpExists = await this.fileExists(mongodumpPath);
        const restoreExists = await this.fileExists(mongorestorePath);
        this.mongoToolsAvailable = dumpExists && restoreExists;

        if (this.mongoToolsAvailable) {
          // Cache the resolved paths
          this.mongoToolPaths = { mongodump: mongodumpPath, mongorestore: mongorestorePath };
          this.logger.log('MongoDB tools verified successfully');
        } else {
          this.logger.warn('MongoDB tools not found at expected Windows path. Backup/restore may fail.');
          this.logger.warn(`Expected path: C:\\Program Files\\MongoDB\\Tools\\100\\bin\\`);
        }
      } else {
        // On Unix, assume tools are in PATH (will fail at runtime if not)
        this.mongoToolsAvailable = true;
        this.mongoToolPaths = { mongodump: 'mongodump', mongorestore: 'mongorestore' };
      }

      this.initState = 'ready';
      this.logger.log(`Backup service initialized. Temp: ${this.backupDir}, Local: ${this.localBackupDir}`);
    } catch (error) {
      this.initState = 'failed';
      this.initError = error as Error;
      this.logger.error('Failed to initialize backup service', (error as Error).stack);
      // Don't throw - allow the service to start, but operations will fail gracefully
    }
  }

  /**
   * Pre-flight validation before backup/restore operations
   */
  private async validatePreFlight(operation: 'backup' | 'restore'): Promise<void> {
    // Check MongoDB tools availability
    if (!this.mongoToolsAvailable) {
      const mongodumpPath = await this.resolveMongoToolPath('mongodump');
      if (process.platform === 'win32' && !(await this.fileExists(mongodumpPath))) {
        throw new BadRequestException(
          'MongoDB tools not installed. Please install MongoDB Database Tools from https://www.mongodb.com/try/download/database-tools'
        );
      }
    }

    // Check database connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      throw new BadRequestException('Cannot connect to database. Please check database status.');
    }

    // Check disk space for backup
    if (operation === 'backup') {
      try {
        // Ensure directories exist
        await this.ensureDirectoriesAsync();

        const testFile = path.join(this.backupDir, '.space-check');
        await fsPromises.writeFile(testFile, 'test');
        await fsPromises.unlink(testFile);
      } catch (error) {
        throw new BadRequestException(`Cannot write to backup directory: ${this.backupDir}`);
      }
    }

    // Check MinIO connectivity (optional - warn only)
    try {
      await this.fileStorageService.getSignedUrl('test-key', 1);
    } catch (error) {
      this.logger.warn('MinIO may not be available. Local backup will still work.');
    }
  }

  private async ensureDirectoriesAsync(): Promise<void> {
    try {
      await fsPromises.mkdir(this.backupDir, { recursive: true });
      await fsPromises.mkdir(this.localBackupDir, { recursive: true });
    } catch (error) {
      this.logger.warn('Could not create backup directories', error);
    }
  }

  /**
   * Synchronous directory check for constructor - only checks existence
   * Actual creation is done asynchronously before operations
   */
  private ensureDirectories(): void {
    // Just log - actual creation will be done async before operations
    this.logger.debug(`Backup directories configured: temp=${this.backupDir}, local=${this.localBackupDir}`);
  }

  async createBackup(
    dto: CreateBackupDto,
    userId: string,
    userRole: Role,
  ) {
    // Ensure service is initialized
    await this.ensureInitialized();

    // Pre-flight validation
    await this.validatePreFlight('backup');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.gz`;
    const tempPath = path.join(this.backupDir, filename);
    const startTime = Date.now();

    // Create backup record with IN_PROGRESS status
    const backupRecord = await this.prisma.backupRecord.create({
      data: {
        filename,
        description: dto.description,
        size: 0,
        storageLocations: [],
        status: BackupStatus.IN_PROGRESS,
        createdById: userId,
      },
    });

    // Emit initial progress
    this.wsService.sendBackupProgress({
      backupId: backupRecord.id,
      status: 'in_progress',
      progress: 10,
      message: 'Starting database backup...',
    });

    try {
      // Execute mongodump with progress callback
      const dbUrl = this.configService.get<string>('DATABASE_URL');

      this.wsService.sendBackupProgress({
        backupId: backupRecord.id,
        status: 'in_progress',
        progress: 15,
        message: 'Executing database dump...',
      });

      // Progress callback for mongodump
      let dumpProgress = 15;
      const onDumpProgress = (message: string) => {
        dumpProgress = Math.min(dumpProgress + 3, 45);
        this.wsService.sendBackupProgress({
          backupId: backupRecord.id,
          status: 'in_progress',
          progress: dumpProgress,
          message,
        });
      };

      await this.executeMongoDump(dbUrl, tempPath, onDumpProgress);

      // Get file size (async)
      const stats = await fsPromises.stat(tempPath);
      const size = stats.size;

      this.wsService.sendBackupProgress({
        backupId: backupRecord.id,
        status: 'in_progress',
        progress: 50,
        message: `Database dump complete (${this.formatBytes(size)}). Uploading to storage...`,
      });

      const storageLocations: string[] = [];
      let minioKey: string | undefined;
      let localPath: string | undefined;

      // Upload to MinIO
      if (dto.storageType === StorageType.MINIO || dto.storageType === StorageType.BOTH) {
        try {
          this.wsService.sendBackupProgress({
            backupId: backupRecord.id,
            status: 'in_progress',
            progress: 55,
            message: 'Uploading to MinIO...',
          });

          const buffer = await fsPromises.readFile(tempPath);
          const uploadResult = await this.fileStorageService.uploadBuffer(
            buffer,
            filename,
            { folder: 'backups', contentType: 'application/gzip' },
          );
          minioKey = uploadResult.key;
          storageLocations.push('minio');
          this.logger.log(`Backup uploaded to MinIO: ${minioKey}`);

          this.wsService.sendBackupProgress({
            backupId: backupRecord.id,
            status: 'in_progress',
            progress: 75,
            message: 'Uploaded to MinIO successfully',
          });
        } catch (error) {
          this.logger.error('Failed to upload backup to MinIO', error);
          if (dto.storageType === StorageType.MINIO) {
            throw error;
          }
          // Continue with local storage if BOTH was selected
        }
      }

      // Store locally
      if (dto.storageType === StorageType.LOCAL || dto.storageType === StorageType.BOTH) {
        try {
          this.wsService.sendBackupProgress({
            backupId: backupRecord.id,
            status: 'in_progress',
            progress: 80,
            message: 'Saving to local storage...',
          });

          localPath = path.join(this.localBackupDir, filename);
          await fsPromises.copyFile(tempPath, localPath);
          storageLocations.push('local');
          this.logger.log(`Backup stored locally: ${localPath}`);

          this.wsService.sendBackupProgress({
            backupId: backupRecord.id,
            status: 'in_progress',
            progress: 90,
            message: 'Saved to local storage successfully',
          });
        } catch (error) {
          this.logger.error('Failed to store backup locally', error);
          if (dto.storageType === StorageType.LOCAL) {
            throw error;
          }
        }
      }

      // Verify at least one storage location succeeded
      if (storageLocations.length === 0) {
        throw new Error('Failed to store backup in any location');
      }

      // Update backup record
      const updatedRecord = await this.prisma.backupRecord.update({
        where: { id: backupRecord.id },
        data: {
          size,
          storageLocations,
          minioKey,
          localPath,
          status: BackupStatus.COMPLETED,
        },
      });

      // Cleanup temp file (async, non-blocking)
      await this.safeUnlink(tempPath);

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Emit completion progress
      this.wsService.sendBackupProgress({
        backupId: updatedRecord.id,
        status: 'completed',
        progress: 100,
        message: `Backup completed successfully (${this.formatBytes(size)}) in ${duration}s`,
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.SYSTEM_BACKUP,
        entityType: 'Backup',
        entityId: updatedRecord.id,
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        description: `Database backup created: ${filename} (${this.formatBytes(size)}) in ${duration}s`,
      });

      return {
        success: true,
        backup: updatedRecord,
        message: `Backup created successfully. Size: ${this.formatBytes(size)}. Duration: ${duration}s`,
        duration: `${duration}s`,
      };
    } catch (error) {
      // Emit failure progress
      this.wsService.sendBackupProgress({
        backupId: backupRecord.id,
        status: 'failed',
        progress: 0,
        message: `Backup failed: ${error.message}`,
      });

      // Update record to failed status
      try {
        await this.prisma.backupRecord.update({
          where: { id: backupRecord.id },
          data: { status: BackupStatus.FAILED },
        });
      } catch (dbError) {
        this.logger.error('Failed to update backup record status', dbError);
      }

      // Cleanup temp file if exists (async, non-blocking)
      await this.safeUnlink(tempPath);

      this.logger.error('Backup creation failed', error);
      throw new InternalServerErrorException(`Backup failed: ${error.message}`);
    }
  }

  async listBackups(page: number = 1, limit: number = 20, status?: BackupStatus) {
    const where = status ? { status } : {};

    const [backups, total] = await Promise.all([
      this.prisma.backupRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.backupRecord.count({ where }),
    ]);

    return {
      backups,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBackupDownloadUrl(backupId: string) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    // Try MinIO first
    if (backup.minioKey && backup.storageLocations.includes('minio')) {
      try {
        const url = await this.fileStorageService.getSignedUrl(backup.minioKey, 3600);
        return {
          url,
          filename: backup.filename,
          expiresIn: 3600,
          source: 'minio',
        };
      } catch (error) {
        this.logger.warn('Failed to get MinIO signed URL', error);
      }
    }

    // Fallback to local
    if (backup.localPath && backup.storageLocations.includes('local')) {
      try {
        await fsPromises.access(backup.localPath);
        return {
          localPath: backup.localPath,
          filename: backup.filename,
          source: 'local',
        };
      } catch {
        // File doesn't exist, continue to throw
      }
    }

    throw new NotFoundException('Backup file not available');
  }

  async restoreBackup(
    backupId: string,
    userId: string,
    userRole: Role,
    dropExisting: boolean = true,
  ) {
    // Ensure service is initialized
    await this.ensureInitialized();

    const startTime = Date.now();

    // Pre-flight validation
    await this.validatePreFlight('restore');

    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    // Allow restore from COMPLETED or RESTORED (already restored once but still valid)
    if (backup.status !== BackupStatus.COMPLETED && backup.status !== BackupStatus.RESTORED) {
      throw new BadRequestException(
        `Cannot restore from backup with status '${backup.status}'. Only COMPLETED or RESTORED backups can be restored.`
      );
    }

    const tempPath = path.join(this.backupDir, `restore_${backup.filename}`);

    // Emit initial progress
    this.logger.log(`Starting restore for backup ${backupId}, sending initial progress...`);
    this.wsService.sendRestoreProgress({
      backupId,
      status: 'in_progress',
      stage: 'initializing',
      progress: 5,
      message: 'Initializing restore process...',
    });

    try {
      // Stage 1: Download/copy backup file
      this.wsService.sendRestoreProgress({
        backupId,
        status: 'in_progress',
        stage: 'downloading',
        progress: 10,
        message: 'Retrieving backup file...',
      });

      if (backup.minioKey && backup.storageLocations.includes('minio')) {
        this.logger.log(`Downloading backup from MinIO: ${backup.minioKey}`);
        const buffer = await this.fileStorageService.getFile(backup.minioKey);
        await fsPromises.writeFile(tempPath, buffer);
        this.logger.log(`Backup downloaded: ${this.formatBytes(buffer.length)}`);
      } else if (backup.localPath && backup.storageLocations.includes('local')) {
        try {
          await fsPromises.access(backup.localPath);
        } catch {
          throw new NotFoundException(`Local backup file not found: ${backup.localPath}`);
        }
        this.logger.log(`Copying local backup: ${backup.localPath}`);
        await fsPromises.copyFile(backup.localPath, tempPath);
      } else {
        throw new NotFoundException('Backup file not available in any storage location');
      }

      // Verify file was retrieved (async)
      let fileSize: number;
      try {
        const fileStats = await fsPromises.stat(tempPath);
        fileSize = fileStats.size;
        this.logger.log(`Backup file ready: ${this.formatBytes(fileSize)}`);
      } catch {
        throw new Error('Failed to retrieve backup file');
      }

      this.wsService.sendRestoreProgress({
        backupId,
        status: 'in_progress',
        stage: 'downloading',
        progress: 30,
        message: `Backup file retrieved (${this.formatBytes(fileSize)})`,
      });

      // Stage 2: Execute mongorestore with progress tracking
      this.wsService.sendRestoreProgress({
        backupId,
        status: 'in_progress',
        stage: 'restoring',
        progress: 35,
        message: dropExisting
          ? 'Restoring database (existing data will be replaced)...'
          : 'Restoring database (merging with existing data)...',
      });

      const dbUrl = this.configService.get<string>('DATABASE_URL');

      // Progress callback for mongorestore
      let lastProgress = 35;
      const onProgress = (message: string) => {
        lastProgress = Math.min(lastProgress + 5, 85);
        this.wsService.sendRestoreProgress({
          backupId,
          status: 'in_progress',
          stage: 'restoring',
          progress: lastProgress,
          message,
        });
      };

      await this.executeMongoRestore(dbUrl, tempPath, dropExisting, onProgress);

      // Stage 3: Finalization
      this.wsService.sendRestoreProgress({
        backupId,
        status: 'in_progress',
        stage: 'finalizing',
        progress: 90,
        message: 'Finalizing restore...',
      });

      // Update backup record
      await this.prisma.backupRecord.update({
        where: { id: backupId },
        data: {
          restoredAt: new Date(),
          restoredById: userId,
          status: BackupStatus.RESTORED,
        },
      });

      // Cleanup temp file (async)
      await this.safeUnlink(tempPath);

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Audit log
      await this.auditService.log({
        action: AuditAction.SYSTEM_RESTORE,
        entityType: 'Backup',
        entityId: backupId,
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.CRITICAL,
        description: `Database restored from backup: ${backup.filename} (took ${duration}s)`,
      });

      // Emit completion
      this.wsService.sendRestoreProgress({
        backupId,
        status: 'completed',
        stage: 'done',
        progress: 100,
        message: `Database restored successfully in ${duration} seconds`,
      });

      return {
        success: true,
        message: `Database restored successfully from ${backup.filename}`,
        restoredAt: new Date(),
        duration: `${duration}s`,
      };
    } catch (error) {
      // Cleanup temp file if exists (async)
      await this.safeUnlink(tempPath);

      // Emit failure
      this.wsService.sendRestoreProgress({
        backupId,
        status: 'failed',
        stage: 'done',
        progress: 0,
        message: `Restore failed: ${error.message}`,
      });

      this.logger.error('Restore failed', error);
      throw new InternalServerErrorException(`Restore failed: ${error.message}`);
    }
  }

  async uploadBackup(
    file: Express.Multer.File,
    userId: string,
    userRole: Role,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const filename = `uploaded_${Date.now()}_${file.originalname}`;
    const storageLocations: string[] = [];

    try {
      // Upload to MinIO
      const uploadResult = await this.fileStorageService.uploadBuffer(
        file.buffer,
        filename,
        { folder: 'backups', contentType: file.mimetype },
      );
      storageLocations.push('minio');

      // Also store locally (async)
      const localPath = path.join(this.localBackupDir, filename);
      await this.ensureDirectoriesAsync();
      await fsPromises.writeFile(localPath, file.buffer);
      storageLocations.push('local');

      // Create backup record
      const backupRecord = await this.prisma.backupRecord.create({
        data: {
          filename,
          description: `Uploaded backup: ${file.originalname}`,
          size: file.size,
          storageLocations,
          minioKey: uploadResult.key,
          localPath,
          status: BackupStatus.COMPLETED,
          createdById: userId,
        },
      });

      // Audit log
      await this.auditService.log({
        action: AuditAction.SYSTEM_BACKUP,
        entityType: 'Backup',
        entityId: backupRecord.id,
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.HIGH,
        description: `Backup file uploaded: ${filename}`,
      });

      return {
        success: true,
        backup: backupRecord,
        message: 'Backup uploaded successfully',
      };
    } catch (error) {
      this.logger.error('Failed to upload backup', error);
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }
  }

  async deleteBackup(backupId: string, userId: string, userRole: Role) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    const deletedFrom: string[] = [];

    // Delete from MinIO
    if (backup.minioKey) {
      try {
        await this.fileStorageService.deleteFile(backup.minioKey);
        deletedFrom.push('minio');
      } catch (error) {
        this.logger.warn(`Failed to delete backup from MinIO: ${error.message}`);
      }
    }

    // Delete from local (async)
    if (backup.localPath) {
      try {
        await fsPromises.unlink(backup.localPath);
        deletedFrom.push('local');
      } catch (error) {
        // File may not exist - only warn for other errors
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn(`Failed to delete local backup: ${error.message}`);
        }
      }
    }

    // Delete record
    await this.prisma.backupRecord.delete({
      where: { id: backupId },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.SYSTEM_BACKUP,
      entityType: 'Backup',
      entityId: backupId,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.MEDIUM,
      description: `Backup deleted: ${backup.filename}`,
    });

    return {
      success: true,
      deletedFrom,
      message: `Backup deleted successfully`,
    };
  }

  /**
   * Get backup details by ID
   */
  async getBackupById(backupId: string) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    return backup;
  }

  /**
   * Update backup status manually (admin recovery function)
   */
  async updateBackupStatus(
    backupId: string,
    newStatus: BackupStatus,
    userId: string,
    userRole: Role,
  ) {
    const backup = await this.prisma.backupRecord.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    const oldStatus = backup.status;

    // Validate the status transition
    if (newStatus === BackupStatus.COMPLETED) {
      // Only allow marking as COMPLETED if we have actual backup files
      if (!backup.minioKey && !backup.localPath) {
        throw new BadRequestException(
          'Cannot mark as COMPLETED: no backup files exist. Use FAILED instead.'
        );
      }
    }

    const updatedBackup = await this.prisma.backupRecord.update({
      where: { id: backupId },
      data: { status: newStatus },
    });

    await this.auditService.log({
      action: AuditAction.CONFIGURATION_CHANGE,
      entityType: 'Backup',
      entityId: backupId,
      userId,
      userRole,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.HIGH,
      description: `Backup status manually changed: ${oldStatus} → ${newStatus}`,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
    });

    return {
      success: true,
      backup: updatedBackup,
      message: `Backup status updated from ${oldStatus} to ${newStatus}`,
    };
  }

  /**
   * Cleanup stale IN_PROGRESS backups (stuck for more than 1 hour)
   */
  async cleanupStaleBackups(userId: string, userRole: Role) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const staleBackups = await this.prisma.backupRecord.findMany({
      where: {
        status: BackupStatus.IN_PROGRESS,
        createdAt: { lt: oneHourAgo },
      },
    });

    const results: { id: string; filename: string; action: string }[] = [];

    for (const backup of staleBackups) {
      try {
        // Check if files actually exist (async)
        const hasMinioFile = backup.minioKey ?
          await this.checkMinioFileExists(backup.minioKey) : false;
        const hasLocalFile = backup.localPath ?
          await this.fileExists(backup.localPath) : false;

        if (hasMinioFile || hasLocalFile) {
          // Files exist, mark as COMPLETED
          await this.prisma.backupRecord.update({
            where: { id: backup.id },
            data: { status: BackupStatus.COMPLETED },
          });
          results.push({ id: backup.id, filename: backup.filename, action: 'marked_completed' });
        } else {
          // No files exist, mark as FAILED
          await this.prisma.backupRecord.update({
            where: { id: backup.id },
            data: { status: BackupStatus.FAILED },
          });
          results.push({ id: backup.id, filename: backup.filename, action: 'marked_failed' });
        }
      } catch (error) {
        this.logger.error(`Failed to cleanup stale backup ${backup.id}`, error);
        results.push({ id: backup.id, filename: backup.filename, action: `error: ${error.message}` });
      }
    }

    if (results.length > 0) {
      await this.auditService.log({
        action: AuditAction.SYSTEM_BACKUP,
        entityType: 'Backup',
        entityId: 'cleanup',
        userId,
        userRole,
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.MEDIUM,
        description: `Cleaned up ${results.length} stale backups`,
        newValues: { results },
      });
    }

    return {
      success: true,
      cleaned: results.length,
      results,
      message: results.length > 0
        ? `Cleaned up ${results.length} stale backups`
        : 'No stale backups found',
    };
  }

  private async checkMinioFileExists(key: string): Promise<boolean> {
    try {
      await this.fileStorageService.getFile(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached MongoDB tool path (sync, uses pre-resolved paths)
   */
  private getMongoToolPath(tool: 'mongodump' | 'mongorestore'): string {
    // Return cached path if available
    if (this.mongoToolPaths) {
      return this.mongoToolPaths[tool];
    }
    // Fallback to tool name (will be resolved via PATH)
    return tool;
  }

  /**
   * Resolve MongoDB tool path asynchronously
   */
  private async resolveMongoToolPath(tool: 'mongodump' | 'mongorestore'): Promise<string> {
    // Return cached path if available
    if (this.mongoToolPaths) {
      return this.mongoToolPaths[tool];
    }

    // On Windows, check full path
    if (process.platform === 'win32') {
      const windowsPath = `C:\\Program Files\\MongoDB\\Tools\\100\\bin\\${tool}.exe`;
      if (await this.fileExists(windowsPath)) {
        return windowsPath;
      }
    }
    // Fallback to PATH-based lookup
    return tool;
  }

  private executeMongoDump(
    dbUrl: string,
    outputPath: string,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const mongodumpPath = this.getMongoToolPath('mongodump');
      const child = spawn(mongodumpPath, [
        `--uri=${dbUrl}`,
        `--archive=${outputPath}`,
        '--gzip',
      ]);

      let stderr = '';
      let lastProgressUpdate = Date.now();

      // Timeout handler
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Backup timed out after ${BACKUP_TIMEOUT_MS / 60000} minutes`));
      }, BACKUP_TIMEOUT_MS);

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.logger.debug(`mongodump: ${output}`);

        // Parse progress from mongodump output (it outputs collection names)
        if (onProgress && Date.now() - lastProgressUpdate > 1000) {
          const collectionMatch = output.match(/writing (\S+) to/);
          if (collectionMatch) {
            onProgress(`Dumping collection: ${collectionMatch[1]}`);
            lastProgressUpdate = Date.now();
          }
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve();
        } else if (code === null) {
          reject(new Error('Backup process was terminated'));
        } else {
          reject(new Error(`mongodump exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to start mongodump: ${error.message}`));
      });
    });
  }

  private executeMongoRestore(
    dbUrl: string,
    archivePath: string,
    dropExisting: boolean = true,
    onProgress?: (message: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const mongorestorePath = this.getMongoToolPath('mongorestore');
      const args = [
        `--uri=${dbUrl}`,
        `--archive=${archivePath}`,
        '--gzip',
      ];

      // Only add --drop flag if explicitly requested (DANGEROUS: deletes all existing data!)
      if (dropExisting) {
        args.push('--drop');
        this.logger.warn('Restore with --drop flag: existing collections will be deleted!');
      }

      const child = spawn(mongorestorePath, args);

      let stderr = '';
      let lastProgressUpdate = Date.now();

      // Timeout handler
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Restore timed out after ${RESTORE_TIMEOUT_MS / 60000} minutes`));
      }, RESTORE_TIMEOUT_MS);

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.logger.debug(`mongorestore: ${output}`);

        // Parse progress from mongorestore output
        if (onProgress && Date.now() - lastProgressUpdate > 1000) {
          const progressMatch = output.match(/(\d+) document\(s\) restored/);
          const collectionMatch = output.match(/restoring (\S+)/);
          if (progressMatch) {
            onProgress(`Restored ${progressMatch[1]} documents`);
            lastProgressUpdate = Date.now();
          } else if (collectionMatch) {
            onProgress(`Restoring collection: ${collectionMatch[1]}`);
            lastProgressUpdate = Date.now();
          }
        }
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve();
        } else if (code === null) {
          reject(new Error('Restore process was terminated'));
        } else {
          reject(new Error(`mongorestore exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to start mongorestore: ${error.message}`));
      });
    });
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Safely delete a file asynchronously, suppressing errors if file doesn't exist
   */
  private async safeUnlink(filePath: string): Promise<void> {
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      // Only log if it's not a "file not found" error
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to cleanup file ${filePath}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Check if a file exists asynchronously
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
