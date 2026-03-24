import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, ValidateIf } from 'class-validator';

export enum PlanAfterDiploma {
  PRIVATE_JOB = 'PRIVATE_JOB',
  BTECH = 'BTECH',
  GOVT_JOB_PREPARATION = 'GOVT_JOB_PREPARATION',
}

export enum JobLocationPreference {
  WITHIN_PUNJAB = 'WITHIN_PUNJAB',
  OUTSIDE_PUNJAB = 'OUTSIDE_PUNJAB',
}

export enum ExpectedSalaryRange {
  RANGE_10K_15K = 'RANGE_10K_15K',
  RANGE_15K_20K = 'RANGE_15K_20K',
  RANGE_20K_PLUS = 'RANGE_20K_PLUS',
}

export class CreateStudentPlacementInterestDto {
  @ApiProperty({
    enum: PlanAfterDiploma,
    description: 'Plan after completing diploma',
    example: PlanAfterDiploma.PRIVATE_JOB,
  })
  @IsEnum(PlanAfterDiploma)
  planAfterDiploma: PlanAfterDiploma;

  @ApiPropertyOptional({
    enum: JobLocationPreference,
    description: 'Job location preference (only if planAfterDiploma is PRIVATE_JOB)',
    example: JobLocationPreference.WITHIN_PUNJAB,
  })
  @ValidateIf((o) => o.planAfterDiploma === PlanAfterDiploma.PRIVATE_JOB)
  @IsEnum(JobLocationPreference)
  @IsOptional()
  interestedForPrivateJob?: JobLocationPreference;

  @ApiPropertyOptional({
    enum: ExpectedSalaryRange,
    description: 'Expected salary range (only if planAfterDiploma is PRIVATE_JOB)',
    example: ExpectedSalaryRange.RANGE_15K_20K,
  })
  @ValidateIf((o) => o.planAfterDiploma === PlanAfterDiploma.PRIVATE_JOB)
  @IsEnum(ExpectedSalaryRange)
  @IsOptional()
  expectedSalary?: ExpectedSalaryRange;
}

export class UpdateStudentPlacementInterestDto {
  @ApiPropertyOptional({
    enum: PlanAfterDiploma,
    description: 'Plan after completing diploma',
  })
  @IsEnum(PlanAfterDiploma)
  @IsOptional()
  planAfterDiploma?: PlanAfterDiploma;

  @ApiPropertyOptional({
    enum: JobLocationPreference,
    description: 'Job location preference (only if planAfterDiploma is PRIVATE_JOB)',
  })
  @IsEnum(JobLocationPreference)
  @IsOptional()
  interestedForPrivateJob?: JobLocationPreference;

  @ApiPropertyOptional({
    enum: ExpectedSalaryRange,
    description: 'Expected salary range (only if planAfterDiploma is PRIVATE_JOB)',
  })
  @IsEnum(ExpectedSalaryRange)
  @IsOptional()
  expectedSalary?: ExpectedSalaryRange;
}

export class StudentPlacementInterestResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'Student ID' })
  studentId: string;

  @ApiProperty({ enum: PlanAfterDiploma, description: 'Plan after completing diploma' })
  planAfterDiploma: PlanAfterDiploma;

  @ApiPropertyOptional({ enum: JobLocationPreference, description: 'Job location preference' })
  interestedForPrivateJob?: JobLocationPreference;

  @ApiPropertyOptional({ enum: ExpectedSalaryRange, description: 'Expected salary range' })
  expectedSalary?: ExpectedSalaryRange;

  @ApiProperty({ description: 'Submission timestamp' })
  submittedAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

// =============================================
// PRE-PLACEMENT OFFER (PPO) DTOs
// =============================================

import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SubmitPPODto {
  @ApiProperty({
    description: 'Whether student received a pre-placement offer',
    example: true,
  })
  @IsBoolean()
  received: boolean;

  @ApiPropertyOptional({
    description: 'Company name if PPO received',
    example: 'Infosys',
    maxLength: 200,
  })
  @ValidateIf((o) => o.received === true)
  @IsString()
  @MaxLength(200)
  @IsOptional()
  companyName?: string;
}

export class PPOStatusResponseDto {
  @ApiProperty({ description: 'Whether PPO status has been marked' })
  hasMarked: boolean;

  @ApiPropertyOptional({ description: 'Whether student received PPO (null if not marked)' })
  received?: boolean | null;

  @ApiPropertyOptional({ description: 'Company name if PPO received' })
  companyName?: string | null;

  @ApiPropertyOptional({ description: 'When PPO status was marked' })
  markedAt?: Date | null;
}
