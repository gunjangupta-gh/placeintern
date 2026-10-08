import { IsString, IsNotEmpty, IsInt, IsOptional, IsBoolean, IsEnum, Min, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CoveredAreaEntityType } from '../../../generated/prisma/client';

export class BranchInfrastructureDto {
  @ApiProperty({ description: 'Branch (course) ID' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ enum: CoveredAreaEntityType })
  @IsEnum(CoveredAreaEntityType)
  entityType: CoveredAreaEntityType;

  @ApiPropertyOptional({ nullable: true, description: 'Number of rooms / labs / workshops' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  numberOfRooms?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  furnitureAvailable?: boolean | null;

  @ApiPropertyOptional({ nullable: true, description: 'Smart boards / TVs' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  smartBoardsCount?: number | null;
}

export class ReplaceBranchInfrastructureDto {
  @ApiProperty({ type: [BranchInfrastructureDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchInfrastructureDto)
  rows: BranchInfrastructureDto[];
}
