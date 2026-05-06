import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkUserRowDto {
  @ApiProperty({ description: 'Full name of the user' })
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
  phone?: string;

  @ApiProperty({ description: 'Role (TEACHER or FACULTY_SUPERVISOR)', default: 'TEACHER' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ description: 'Designation', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ description: 'Department', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ description: 'Employee ID', required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ description: 'Institution name (for matching)', required: false })
  @IsString()
  @IsOptional()
  institutionName?: string;

  @ApiProperty({ description: 'Branch/Course name (for matching)', required: false })
  @IsString()
  @IsOptional()
  branchName?: string;
}

export class BulkUserUploadDto {
  @ApiProperty({ description: 'Array of user data to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUserRowDto)
  users: BulkUserRowDto[];
}

export class BulkUserResultDto {
  @ApiProperty({ description: 'Total number of users in the file' })
  total: number;

  @ApiProperty({ description: 'Number of successfully created users' })
  success: number;

  @ApiProperty({ description: 'Number of failed users' })
  failed: number;

  @ApiProperty({ description: 'List of successful user creations' })
  successRecords: Array<{
    row: number;
    name: string;
    email: string;
    phone?: string;
    role: string;
    designation?: string;
    institution?: string;
    branch?: string;
    userId: string;
    password: string;
    warning?: string;
  }>;

  @ApiProperty({ description: 'List of failed user creations with error details' })
  failedRecords: Array<{
    row: number;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    institution?: string;
    error: string;
  }>;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTime: number;
}

export class BulkUserValidationResultDto {
  @ApiProperty({ description: 'Is the data valid' })
  isValid: boolean;

  @ApiProperty({ description: 'Total number of rows' })
  total: number;

  @ApiProperty({ description: 'Number of valid rows' })
  valid: number;

  @ApiProperty({ description: 'Number of invalid rows' })
  invalid: number;

  @ApiProperty({ description: 'Validation errors' })
  errors: Array<{
    row: number;
    field?: string;
    value?: string;
    message: string;
  }>;

  @ApiProperty({ description: 'Validation warnings' })
  warnings: string[];

  @ApiProperty({ description: 'Preview data' })
  data: any[];
}
