import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInternshipReportDto {
  @ApiProperty({ required: false, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ required: false, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Search by student name/roll number/company name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'STATE_DIRECTORATE only: filter by institution' })
  @IsString()
  @IsOptional()
  institutionId?: string;

  @ApiProperty({ required: false, description: 'STATE_DIRECTORATE only: filter by district' })
  @IsString()
  @IsOptional()
  district?: string;
}
