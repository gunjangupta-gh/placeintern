import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
  IsEnum,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Designation } from '../../../generated/prisma/client';

// Valid staff roles (must match Prisma Role enum values used in service)
// These are: TEACHER, FACULTY_COORDINATOR, ADMIN_STAFF, PRINCIPAL
const STAFF_ROLES = ['TEACHER', 'FACULTY_COORDINATOR', 'ADMIN_STAFF', 'PRINCIPAL'] as const;

export class CreateStaffDto {
  @ApiProperty({ description: 'Full name of the staff member' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({ description: 'Email address (must be unique)' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ description: 'Password (min 8 characters)' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiProperty({ description: 'Institution ID to assign the staff to' })
  @IsString()
  @IsNotEmpty({ message: 'Institution ID is required' })
  institutionId: string;

  @ApiProperty({ description: 'Role of the staff member', enum: STAFF_ROLES })
  @IsIn(STAFF_ROLES, { message: 'Invalid staff role. Must be one of: TEACHER, FACULTY_COORDINATOR, ADMIN_STAFF, PRINCIPAL' })
  @IsNotEmpty({ message: 'Role is required' })
  role: string;

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

  @ApiPropertyOptional({ description: 'Designation enum', enum: Designation })
  @IsOptional()
  @IsEnum(Designation)
  designationEnum?: Designation;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
