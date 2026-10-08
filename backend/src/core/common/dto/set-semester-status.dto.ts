import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { SemesterResultStatus } from '../../../generated/prisma/client';

export class SetSemesterStatusDto {
  @ApiProperty({ enum: SemesterResultStatus, description: 'Result status for the semester' })
  @IsEnum(SemesterResultStatus)
  status: SemesterResultStatus;

  @ApiProperty({ required: false, description: 'Subjects still to clear (required, >= 1, when status is FAILED)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  backlogCount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  remarks?: string;
}
