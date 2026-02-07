import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlyComplianceQueryDto {
  @ApiProperty({ description: 'Month number (1-12)', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year', example: 2025 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 50 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search by institution name, code, or city' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class InstitutionComplianceQueryDto {
  @ApiProperty({ description: 'Month number (1-12)', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Year', example: 2025 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year: number;
}
