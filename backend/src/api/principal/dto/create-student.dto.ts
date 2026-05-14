import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsDateString, Matches, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStudentDto {
  @ApiProperty({ description: 'Student full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Student email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Student phone number', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  phoneNo?: string;

  @ApiProperty({ description: 'Student roll number' })
  @IsString()
  @IsNotEmpty()
  rollNumber: string;

  @ApiProperty({ description: 'Batch ID', required: false })
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiProperty({ description: 'Branch/Department ID', required: false })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Scholarship ID', required: false })
  @IsString()
  @IsOptional()
  scholarshipId?: string;

  @ApiProperty({ description: 'Department ID (alias for branchId)', required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ description: 'Semester ID', required: false })
  @IsString()
  @IsOptional()
  semesterId?: string;

  @ApiProperty({ description: 'Date of birth', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Gender', enum: ['MALE', 'FEMALE', 'OTHER'], required: false })
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  @IsOptional()
  gender?: string;

  @ApiProperty({ description: 'Blood group', required: false })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiProperty({ description: 'Parent/Guardian name', required: false })
  @IsString()
  @IsOptional()
  parentName?: string;

  @ApiProperty({ description: 'Parent/Guardian phone', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  parentPhone?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Year of admission (e.g., 2025)', required: true })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'Admission year is required' })
  @Min(2000, { message: 'Admission year must be 2000 or later' })
  @Max(2100, { message: 'Admission year must be before 2100' })
  admissionYear: number;
}
