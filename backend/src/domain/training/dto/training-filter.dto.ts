import { IsOptional, IsString, IsInt, IsEnum, IsArray, IsBoolean, IsDateString, IsUUID, Min, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { TrainingDeliveryMode, TrainingDifficulty } from '../../../generated/prisma/client';

// Helper to transform string 'true'/'false' to actual boolean
const transformToBoolean = ({ value }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class TrainingFilterDto {
  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Filter by month (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @ApiPropertyOptional({ description: 'Filter by delivery mode', enum: TrainingDeliveryMode })
  @IsOptional()
  @IsEnum(TrainingDeliveryMode)
  deliveryMode?: TrainingDeliveryMode;

  @ApiPropertyOptional({ description: 'Filter by difficulty', enum: TrainingDifficulty })
  @IsOptional()
  @IsEnum(TrainingDifficulty)
  difficulty?: TrainingDifficulty;

  @ApiPropertyOptional({ description: 'Filter by branch IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ description: 'Filter by published status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description: 'Legacy publication status filter',
    enum: ['ALL', 'PUBLISHED', 'DRAFT'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsIn(['ALL', 'PUBLISHED', 'DRAFT'])
  status?: 'ALL' | 'PUBLISHED' | 'DRAFT';

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Start date from' })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({ description: 'Start date to' })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({ description: 'Show only eligible trainings for user (filtered by branch/designation)' })
  @IsOptional()
  @Transform(transformToBoolean)
  @IsBoolean()
  myOnly?: boolean;
}

export class CalendarFilterDto {
  @ApiPropertyOptional({ description: 'Year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ description: 'Month (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  month?: number;

  @ApiPropertyOptional({ description: 'Filter by branch IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ description: 'Filter by delivery mode', enum: TrainingDeliveryMode })
  @IsOptional()
  @IsEnum(TrainingDeliveryMode)
  deliveryMode?: TrainingDeliveryMode;

  @ApiPropertyOptional({ description: 'Show only eligible trainings for user (filtered by branch/designation)' })
  @IsOptional()
  @Transform(transformToBoolean)
  @IsBoolean()
  myOnly?: boolean;
}
