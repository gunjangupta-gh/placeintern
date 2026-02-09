import { IsOptional, IsString, IsInt, IsEnum, IsArray, IsBoolean, IsDateString, IsUUID, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TrainingDeliveryMode, TrainingDifficulty } from '../../../generated/prisma/client';

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
}
