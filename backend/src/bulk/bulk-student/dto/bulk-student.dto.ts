import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkStudentRowDto {
  @ApiProperty({ description: 'Roll number (used as the student login identifier)' })
  @IsString()
  @IsNotEmpty({ message: 'Roll number is required' })
  rollNumber: string;

  @ApiProperty({ description: 'Student full name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Year of admission (e.g., 2025)', required: true })
  @IsInt()
  @IsNotEmpty({ message: 'Admission year is required' })
  @Min(2000, { message: 'Admission year must be 2000 or later' })
  @Max(2100, { message: 'Admission year must be before 2100' })
  admissionYear: number;

  @ApiProperty({ description: 'Batch name (e.g., "2023-2026"). Auto-matched to an existing batch.' })
  @IsString()
  @IsNotEmpty({ message: 'Batch is required' })
  batchName: string;

  @ApiProperty({ description: 'Student email address (must be unique)' })
  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({ description: 'Student contact number (10 digits)' })
  @IsString()
  @IsNotEmpty({ message: 'Contact number is required' })
  phone: string;

  @ApiProperty({ description: 'Gender: Male, Female or Other' })
  @IsString()
  @IsNotEmpty({ message: 'Gender is required' })
  gender: string;

  @ApiProperty({ description: 'Category: General, OBC, SC or ST' })
  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @ApiProperty({ description: 'Admission type: First Year or LEET' })
  @IsString()
  @IsNotEmpty({ message: 'Admission type is required' })
  admissionType: string;

  @ApiProperty({
    description: 'Scholarship code or name (see "Scholarships" sheet). Leave blank or "None" if not applicable.',
    required: false,
  })
  @IsString()
  @IsOptional()
  scholarship?: string;

  @ApiProperty({
    description: 'College/Institution name. Auto-matched to an existing institution.',
  })
  @IsString()
  @IsNotEmpty({ message: 'College name is required' })
  institutionName: string;

  @ApiProperty({ description: 'Full course/branch name. Auto-matched to an existing branch.' })
  @IsString()
  @IsNotEmpty({ message: 'Course is required' })
  branchName: string;
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
    rollNumber: string;
    institution?: string;
    branch?: string;
    studentId: string;
    userId: string;
    temporaryPassword: string;
    warning?: string;
  }>;

  @ApiProperty({ description: 'List of failed student creations with error details' })
  failedRecords: Array<{
    row: number;
    name?: string;
    rollNumber?: string;
    institution?: string;
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
