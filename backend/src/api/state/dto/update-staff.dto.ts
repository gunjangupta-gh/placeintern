import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Valid staff roles (excluding PRINCIPAL, STUDENT, STATE_DIRECTORATE, INDUSTRY roles)
const STAFF_ROLES = [
  'TEACHER',
  'FACULTY_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'ACCOUNTANT',
  'ADMISSION_OFFICER',
  'EXAMINATION_OFFICER',
  'PMS_OFFICER',
  'EXTRACURRICULAR_HEAD',
] as const;

export class UpdateStaffDto {
  @ApiPropertyOptional({ description: 'Full name of the staff member' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({ description: 'Institution ID' })
  @IsOptional()
  @IsString()
  institutionId?: string;

  @ApiPropertyOptional({ description: 'Role of the staff member', enum: STAFF_ROLES })
  @IsOptional()
  @IsEnum(STAFF_ROLES, { message: 'Invalid staff role' })
  role?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  phoneNo?: string;

  @ApiPropertyOptional({ description: 'Branch name' })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional({ description: 'Designation/Title' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Active status (alias)' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
