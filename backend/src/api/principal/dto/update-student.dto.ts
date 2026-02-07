import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, IsBoolean, IsInt, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AdmissionType, Category, ClearanceStatus } from '../../../generated/prisma/client';

export class UpdateStudentDto {
  @ApiProperty({ description: 'Student full name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Student email address', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Student phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNo?: string;

  @ApiProperty({ description: 'Student contact number (alias)', required: false })
  @IsString()
  @IsOptional()
  contact?: string;

  @ApiProperty({ description: 'Roll number', required: false })
  @IsString()
  @IsOptional()
  rollNumber?: string;

  @ApiProperty({ description: 'Batch ID', required: false })
  @IsString()
  @IsOptional()
  batchId?: string;

  @ApiProperty({ description: 'Branch/Department ID', required: false })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Department ID (alias for branchId)', required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ description: 'Semester ID', required: false })
  @IsString()
  @IsOptional()
  semesterId?: string;

  @ApiProperty({ description: 'Date of birth (dateOfBirth alias)', required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Date of birth', required: false })
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
  parentPhone?: string;

  @ApiProperty({ description: 'Parent/Guardian contact', required: false })
  @IsString()
  @IsOptional()
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

  @ApiProperty({ description: 'Active status', required: false })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
