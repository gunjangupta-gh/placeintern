import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkStudentRowDto {
  @ApiProperty({ description: 'Student full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsString()
  @IsOptional()
  phoneNo?: string;

  @ApiProperty({ description: 'Enrollment/Admission number', required: false })
  @IsString()
  @IsOptional()
  enrollmentNumber?: string;

  @ApiProperty({ description: 'Roll number', required: false })
  @IsString()
  @IsOptional()
  rollNumber?: string;

  @ApiProperty({ description: 'Batch name (e.g., "2023-2026")', required: false })
  @IsString()
  @IsOptional()
  batchName?: string;

  @ApiProperty({ description: 'Branch/Department name', required: false })
  @IsString()
  @IsOptional()
  branchName?: string;

  @ApiProperty({ description: 'Current semester (1-8)', required: false })
  @IsInt()
  @Min(1)
  @Max(8)
  @IsOptional()
  currentSemester?: number;

  @ApiProperty({ description: 'Date of birth (YYYY-MM-DD)', required: false })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ description: 'Gender', enum: ['MALE', 'FEMALE', 'OTHER'], required: false })
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  @IsOptional()
  gender?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'Parent name', required: false })
  @IsString()
  @IsOptional()
  parentName?: string;

  @ApiProperty({ description: 'Parent contact', required: false })
  @IsString()
  @IsOptional()
  parentContact?: string;

  @ApiProperty({ description: '10th percentage', required: false })
  @IsOptional()
  tenthPercentage?: number;

  @ApiProperty({ description: '12th percentage', required: false })
  @IsOptional()
  twelfthPercentage?: number;
}

export class BulkStudentUploadDto {
  @ApiProperty({ description: 'Array of student data to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStudentRowDto)
  students: BulkStudentRowDto[];
}

export class BulkStudentResultDto {
  @ApiProperty({ description: 'Total number of students in the file' })
  total: number;

  @ApiProperty({ description: 'Number of successfully created students' })
  success: number;

  @ApiProperty({ description: 'Number of failed students' })
  failed: number;

  @ApiProperty({ description: 'List of successful student creations' })
  successRecords: Array<{
    row: number;
    name: string;
    email: string;
    enrollmentNumber: string;
    studentId: string;
    userId: string;
    temporaryPassword: string;
  }>;

  @ApiProperty({ description: 'List of failed student creations with error details' })
  failedRecords: Array<{
    row: number;
    name?: string;
    email?: string;
    enrollmentNumber?: string;
    error: string;
    details?: string;
  }>;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTime: number;
}

export class BulkStudentValidationResultDto {
  @ApiProperty({ description: 'Is the data valid' })
  isValid: boolean;

  @ApiProperty({ description: 'Total number of rows' })
  totalRows: number;

  @ApiProperty({ description: 'Number of valid rows' })
  validRows: number;

  @ApiProperty({ description: 'Number of invalid rows' })
  invalidRows: number;

  @ApiProperty({ description: 'Validation errors' })
  errors: Array<{
    row: number;
    field?: string;
    value?: string;
    error: string;
  }>;

  @ApiProperty({ description: 'Warnings (non-blocking)' })
  warnings: Array<{
    row: number;
    field?: string;
    message: string;
  }>;
}
