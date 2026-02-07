import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Role } from '../../../generated/prisma/enums';

// Staff-specific roles that can be created by principal
// Only TEACHER role is available for staff
const StaffRoles = [
  Role.TEACHER,
] as const;

export class CreateStaffDto {
  @ApiProperty({ description: 'Staff full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Staff email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Staff phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNo?: string;

  @ApiProperty({
    description: 'Staff role',
    enum: StaffRoles
  })
  @IsEnum(StaffRoles, { message: 'role must be a valid staff role' })
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: 'Branch name', required: false })
  @IsString()
  @IsOptional()
  branchName?: string;

  @ApiProperty({ description: 'Designation', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ description: 'Employee ID', required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
