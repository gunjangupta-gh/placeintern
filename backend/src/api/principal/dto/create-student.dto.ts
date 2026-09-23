import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsDateString, Matches, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AdmissionType, Category, ClearanceStatus } from '../../../generated/prisma/client';

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

  @ApiProperty({ description: 'Student contact number (alias for phoneNo)', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  contact?: string;

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

  @ApiProperty({ description: 'Date of birth (alias for dateOfBirth)', required: false })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiProperty({ description: 'Gender', required: false })
  @IsString()
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

  @ApiProperty({ description: 'Parent/Guardian contact (alias for parentPhone)', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  parentContact?: string;

  @ApiProperty({ description: 'Mother name', required: false })
  @IsString()
  @IsOptional()
  motherName?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'District', required: false })
  @IsString()
  @IsOptional()
  district?: string;

  @ApiProperty({ description: 'Tehsil', required: false })
  @IsString()
  @IsOptional()
  tehsil?: string;

  @ApiProperty({ description: 'Pin code', required: false })
  @IsString()
  @IsOptional()
  pinCode?: string;

  @ApiProperty({ description: 'Admission type', enum: AdmissionType, required: false })
  @IsEnum(AdmissionType)
  @IsOptional()
  admissionType?: AdmissionType;

  @ApiProperty({ description: 'Category', enum: Category, required: false })
  @IsEnum(Category)
  @IsOptional()
  category?: Category;

  @ApiProperty({ description: 'Current year', required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  currentYear?: number;

  @ApiProperty({ description: 'Current semester', required: false })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  currentSemester?: number;

  @ApiProperty({ description: 'Clearance status', enum: ClearanceStatus, required: false })
  @IsEnum(ClearanceStatus)
  @IsOptional()
  clearanceStatus?: ClearanceStatus;

  @ApiProperty({ description: 'Year of admission (e.g., 2025)', required: true })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty({ message: 'Admission year is required' })
  @Min(2000, { message: 'Admission year must be 2000 or later' })
  @Max(2100, { message: 'Admission year must be before 2100' })
  admissionYear: number;
}
