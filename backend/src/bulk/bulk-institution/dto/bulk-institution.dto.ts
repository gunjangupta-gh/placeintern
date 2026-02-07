import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkInstitutionRowDto {
  @ApiProperty({ description: 'Institution name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Institution code (unique identifier)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Institution type', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'Contact email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Contact phone number', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

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

  @ApiProperty({ description: 'Pin code', required: false })
  @IsString()
  @IsOptional()
  pinCode?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ description: 'Principal name', required: false })
  @IsString()
  @IsOptional()
  principalName?: string;

  @ApiProperty({ description: 'Principal email', required: false })
  @IsEmail()
  @IsOptional()
  principalEmail?: string;

  @ApiProperty({ description: 'Principal phone', required: false })
  @IsString()
  @IsOptional()
  principalPhone?: string;
}

export class BulkInstitutionUploadDto {
  @ApiProperty({ description: 'Array of institution data to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkInstitutionRowDto)
  institutions: BulkInstitutionRowDto[];
}

export class BulkInstitutionResultDto {
  @ApiProperty({ description: 'Total number of institutions in the file' })
  total: number;

  @ApiProperty({ description: 'Number of successfully created institutions' })
  success: number;

  @ApiProperty({ description: 'Number of failed institutions' })
  failed: number;

  @ApiProperty({ description: 'List of successful institution creations' })
  successRecords: Array<{
    row: number;
    name: string;
    code: string;
    institutionId: string;
    principalCreated: boolean;
    principalUserId?: string;
  }>;

  @ApiProperty({ description: 'List of failed institution creations with error details' })
  failedRecords: Array<{
    row: number;
    name?: string;
    code?: string;
    error: string;
    details?: string;
  }>;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTime: number;
}

export class BulkInstitutionValidationResultDto {
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
}
