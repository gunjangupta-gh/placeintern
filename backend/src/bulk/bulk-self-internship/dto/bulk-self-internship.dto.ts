import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkSelfInternshipRowDto {
  // Student identification (one of these is required)
  @ApiPropertyOptional()
  studentEmail?: string;

  @ApiPropertyOptional()
  studentRollNumber?: string;

  @ApiPropertyOptional()
  enrollmentNumber?: string;

  // Company information (required)
  @ApiProperty()
  companyName: string;

  @ApiPropertyOptional()
  companyAddress?: string;

  @ApiPropertyOptional()
  companyContact?: string;

  @ApiPropertyOptional()
  companyEmail?: string;

  // HR information (optional)
  @ApiPropertyOptional()
  hrName?: string;

  @ApiPropertyOptional()
  hrDesignation?: string;

  @ApiPropertyOptional()
  hrContact?: string;

  @ApiPropertyOptional()
  hrEmail?: string;

  // Internship details
  @ApiPropertyOptional()
  jobProfile?: string;

  @ApiPropertyOptional()
  stipend?: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  endDate?: string;

  @ApiPropertyOptional()
  duration?: string;

  // Faculty mentor details (optional)
  @ApiPropertyOptional()
  facultyMentorName?: string;

  @ApiPropertyOptional()
  facultyMentorEmail?: string;

  @ApiPropertyOptional()
  facultyMentorContact?: string;

  @ApiPropertyOptional()
  facultyMentorDesignation?: string;

  // Joining letter (optional)
  @ApiPropertyOptional()
  joiningLetterUrl?: string;
}

export class BulkSelfInternshipResultDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  success: number;

  @ApiProperty()
  failed: number;

  @ApiProperty()
  successRecords: Array<{
    row: number;
    studentEmail: string;
    companyName: string;
    applicationId: string;
  }>;

  @ApiProperty()
  failedRecords: Array<{
    row: number;
    studentEmail?: string;
    companyName?: string;
    error: string;
    details?: string;
  }>;

  @ApiProperty()
  processingTime: number;
}

export class BulkSelfInternshipValidationResultDto {
  @ApiProperty()
  isValid: boolean;

  @ApiProperty()
  totalRows: number;

  @ApiProperty()
  validRows: number;

  @ApiProperty()
  invalidRows: number;

  @ApiProperty()
  errors: Array<{
    row: number;
    field?: string;
    value?: string;
    error: string;
  }>;

  @ApiProperty()
  warnings: Array<{
    row: number;
    field?: string;
    message: string;
  }>;
}
