import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { BulkJobType, BulkJobStatus } from '../../../generated/prisma/client';

export class CreateBulkJobDto {
  @ApiProperty({ enum: BulkJobType })
  @IsEnum(BulkJobType)
  type: BulkJobType;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsNumber()
  fileSize: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  originalName?: string;

  @ApiProperty()
  @IsNumber()
  totalRows: number;

  @ApiProperty()
  @IsString()
  institutionId: string;

  @ApiProperty()
  @IsString()
  createdById: string;
}

export class UpdateBulkJobDto {
  @ApiPropertyOptional({ enum: BulkJobStatus })
  @IsEnum(BulkJobStatus)
  @IsOptional()
  status?: BulkJobStatus;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  processedRows?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  successCount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  failedCount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional()
  @IsOptional()
  errorReport?: any;

  @ApiPropertyOptional()
  @IsOptional()
  successReport?: any;

  @ApiPropertyOptional()
  @IsOptional()
  warnings?: any;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  processingTime?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  retryCount?: number;
}

export class BulkJobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: BulkJobType })
  type: BulkJobType;

  @ApiProperty({ enum: BulkJobStatus })
  status: BulkJobStatus;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileSize: number;

  @ApiPropertyOptional()
  originalName?: string;

  @ApiProperty()
  totalRows: number;

  @ApiProperty()
  processedRows: number;

  @ApiProperty()
  successCount: number;

  @ApiProperty()
  failedCount: number;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  errorReport?: any;

  @ApiPropertyOptional()
  successReport?: any;

  @ApiPropertyOptional()
  warnings?: any;

  @ApiProperty()
  queuedAt: Date;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  processingTime?: number;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiProperty()
  institutionId: string;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BulkJobListQueryDto {
  @ApiPropertyOptional({ enum: BulkJobType })
  @IsEnum(BulkJobType)
  @IsOptional()
  type?: BulkJobType;

  @ApiPropertyOptional({ enum: BulkJobStatus })
  @IsEnum(BulkJobStatus)
  @IsOptional()
  status?: BulkJobStatus;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  toDate?: string;
}

export class BulkJobListResponseDto {
  @ApiProperty({ type: [BulkJobResponseDto] })
  jobs: BulkJobResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class QueueJobResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  bulkJobId: string;

  @ApiProperty({ enum: BulkJobStatus })
  status: BulkJobStatus;
}
