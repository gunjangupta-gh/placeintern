import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  Matches,
  IsIn,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Designation } from '../../../generated/prisma/client';

// Valid staff roles (must match Prisma Role enum values used in service)
// These are: TEACHER, FACULTY_COORDINATOR, ADMIN_STAFF
const STAFF_ROLES = ['TEACHER', 'FACULTY_COORDINATOR', 'ADMIN_STAFF'] as const;

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
  @IsIn(STAFF_ROLES, { message: 'Invalid staff role. Must be one of: TEACHER, FACULTY_COORDINATOR, ADMIN_STAFF' })
  role?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  phoneNo?: string;

  @ApiPropertyOptional({ description: 'Branch ID (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  branchId?: string;

  @ApiPropertyOptional({ description: 'Branch name' })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional({ description: 'Designation/Title' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ description: 'Designation enum', enum: Designation })
  @IsOptional()
  @IsEnum(Designation)
  designationEnum?: Designation;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Active status (alias)' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
