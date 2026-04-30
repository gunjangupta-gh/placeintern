import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class BranchStaffCapacityDto {
  @ApiProperty({ description: 'Branch ID' })
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: 'Academic year (e.g., "2023-24")' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ description: 'Total officially allocated teaching posts' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sanctionedPosts: number;

  @ApiProperty({ description: 'Regular staff currently filling those posts' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  filledPosts: number;

  @ApiProperty({ description: 'Guest/contract faculty count' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  guestFaculty: number;

  @ApiPropertyOptional({ description: 'Whether this capacity record is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReplaceBranchStaffCapacitiesDto {
  @ApiProperty({ type: [BranchStaffCapacityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BranchStaffCapacityDto)
  capacities: BranchStaffCapacityDto[];
}
