import { IsString, IsOptional, IsEnum, IsBoolean, Equals } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BackupStatus } from '../../../generated/prisma/client';

export enum StorageType {
  MINIO = 'minio',
  LOCAL = 'local',
  BOTH = 'both',
}

export class CreateBackupDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StorageType)
  storageType?: StorageType = StorageType.BOTH;
}

export class RestoreBackupDto {
  @IsBoolean()
  confirmRestore: boolean;

  @IsString()
  @Equals('RESTORE', { message: 'You must type "RESTORE" to confirm the restore operation' })
  confirmationText: string; // Must be exactly "RESTORE"

  @IsOptional()
  @IsBoolean()
  dropExisting?: boolean = true; // Whether to drop existing data (default true for full restore)
}

export class BackupResponseDto {
  id: string;
  filename: string;
  description?: string;
  size: number;
  storageLocations: string[];
  status: string;
  createdAt: Date;
  createdById: string;
}

export class BackupListResponseDto {
  backups: BackupResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class UpdateBackupStatusDto {
  @ApiProperty({
    description: 'New backup status',
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
    example: 'COMPLETED',
  })
  @IsEnum(BackupStatus, { message: 'Invalid backup status' })
  status: BackupStatus;
}
