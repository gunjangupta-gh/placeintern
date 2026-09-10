import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';
import { EnrollmentStatus, InternshipMode } from '../../../generated/prisma/client';

export class CreateInternshipReportDto {
  @ApiProperty({ description: 'Student ID this report is for' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ enum: EnrollmentStatus, default: EnrollmentStatus.ENROLLED, required: false })
  @IsEnum(EnrollmentStatus)
  @IsOptional()
  enrollmentStatus?: EnrollmentStatus;

  @ApiProperty({ description: 'Name of the organisation of internship' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ required: false })
  @IsUrl({ require_protocol: false })
  @IsOptional()
  organizationWebsite?: string;

  @ApiProperty({ enum: InternshipMode, required: false })
  @IsEnum(InternshipMode)
  @IsOptional()
  modeOfInternship?: InternshipMode;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  industrySector?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isWorkInPunjab?: boolean;

  @ApiProperty({ description: 'Required when isWorkInPunjab = true', required: false })
  @ValidateIf((o) => o.isWorkInPunjab === true)
  @IsString()
  @IsNotEmpty({ message: 'workDistrict is required when isWorkInPunjab is true' })
  workDistrict?: string;

  @ApiProperty({ description: 'Required when isWorkInPunjab = false', required: false })
  @ValidateIf((o) => o.isWorkInPunjab === false)
  @IsString()
  @IsNotEmpty({ message: 'workState is required when isWorkInPunjab is false' })
  workState?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hrName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hrPhoneNumber?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isStipendOffered?: boolean;

  @ApiProperty({ description: 'Required when isStipendOffered = true', required: false })
  @ValidateIf((o) => o.isStipendOffered === true)
  @IsNumber()
  @Min(0)
  stipendAmountPerMonth?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isOfferLetterReceived?: boolean;

  @ApiProperty({ description: 'Required when isOfferLetterReceived = true', required: false })
  @ValidateIf((o) => o.isOfferLetterReceived === true)
  @IsUrl({ require_protocol: false })
  @IsNotEmpty({ message: 'offerLetterUrl is required when isOfferLetterReceived is true' })
  offerLetterUrl?: string;

  @ApiProperty({ description: 'User ID of the faculty mentor (TEACHER or FACULTY_COORDINATOR)', required: false })
  @IsString()
  @IsOptional()
  facultyMentorId?: string;
}
