import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PrincipalVisitType {
  PHYSICAL = 'PHYSICAL',
  VIRTUAL = 'VIRTUAL',
  PHONE = 'PHONE',
  TELEPHONIC = 'TELEPHONIC',
}

export enum PrincipalVisitStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreatePrincipalVisitLogDto {
  @ApiProperty({ description: 'Application ID' })
  @IsUUID()
  applicationId: string;

  @ApiPropertyOptional({ description: 'Faculty user ID (teacher) to attribute this visit to' })
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @ApiProperty({ description: 'Type of visit', enum: PrincipalVisitType })
  @IsEnum(PrincipalVisitType)
  visitType: PrincipalVisitType;

  @ApiPropertyOptional({ description: 'Location of the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  visitLocation?: string;

  @ApiPropertyOptional({ description: 'Date of the visit' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: 'Visit status', enum: PrincipalVisitStatus })
  @IsOptional()
  @IsEnum(PrincipalVisitStatus)
  status?: PrincipalVisitStatus;

  @ApiPropertyOptional({ description: 'Visit duration (e.g., 2 hours)' })
  @IsOptional()
  @IsString()
  visitDuration?: string;

  @ApiPropertyOptional({ description: 'Student performance observation' })
  @IsOptional()
  @IsString()
  studentPerformance?: string;

  @ApiPropertyOptional({ description: 'Work environment observation' })
  @IsOptional()
  @IsString()
  workEnvironment?: string;

  @ApiPropertyOptional({ description: 'Skills development observation' })
  @IsOptional()
  @IsString()
  skillsDevelopment?: string;

  @ApiPropertyOptional({ description: 'Attendance status observation' })
  @IsOptional()
  @IsString()
  attendanceStatus?: string;

  @ApiPropertyOptional({ description: 'Work quality observation' })
  @IsOptional()
  @IsString()
  workQuality?: string;

  @ApiPropertyOptional({ description: 'General observations about student' })
  @IsOptional()
  @IsString()
  observationsAboutStudent?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsOptional()
  @IsString()
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Issues identified' })
  @IsOptional()
  @IsString()
  issuesIdentified?: string;

  @ApiPropertyOptional({ description: 'Action required' })
  @IsOptional()
  @IsString()
  actionRequired?: string;

  @ApiPropertyOptional({ description: 'Overall satisfaction rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  overallSatisfactionRating?: number;

  @ApiPropertyOptional({ description: 'Student progress rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  studentProgressRating?: number;

  @ApiPropertyOptional({ description: 'Follow up required' })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({ description: 'Next visit date' })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  @ApiPropertyOptional({ description: 'Visit photos URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visitPhotos?: string[];

  @ApiPropertyOptional({ description: 'Attendees list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeesList?: string[];
}

export class UpdatePrincipalVisitLogDto {
  @ApiPropertyOptional({ description: 'Faculty user ID (teacher) to attribute this visit to' })
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'Type of visit', enum: PrincipalVisitType })
  @IsOptional()
  @IsEnum(PrincipalVisitType)
  visitType?: PrincipalVisitType;

  @ApiPropertyOptional({ description: 'Location of the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  visitLocation?: string;

  @ApiPropertyOptional({ description: 'Date of the visit' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: 'Visit status', enum: PrincipalVisitStatus })
  @IsOptional()
  @IsEnum(PrincipalVisitStatus)
  status?: PrincipalVisitStatus;

  @ApiPropertyOptional({ description: 'Visit duration (e.g., 2 hours)' })
  @IsOptional()
  @IsString()
  visitDuration?: string;

  @ApiPropertyOptional({ description: 'Student performance observation' })
  @IsOptional()
  @IsString()
  studentPerformance?: string;

  @ApiPropertyOptional({ description: 'Work environment observation' })
  @IsOptional()
  @IsString()
  workEnvironment?: string;

  @ApiPropertyOptional({ description: 'Skills development observation' })
  @IsOptional()
  @IsString()
  skillsDevelopment?: string;

  @ApiPropertyOptional({ description: 'Attendance status observation' })
  @IsOptional()
  @IsString()
  attendanceStatus?: string;

  @ApiPropertyOptional({ description: 'Work quality observation' })
  @IsOptional()
  @IsString()
  workQuality?: string;

  @ApiPropertyOptional({ description: 'General observations about student' })
  @IsOptional()
  @IsString()
  observationsAboutStudent?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsOptional()
  @IsString()
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Issues identified' })
  @IsOptional()
  @IsString()
  issuesIdentified?: string;

  @ApiPropertyOptional({ description: 'Action required' })
  @IsOptional()
  @IsString()
  actionRequired?: string;

  @ApiPropertyOptional({ description: 'Overall satisfaction rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  overallSatisfactionRating?: number;

  @ApiPropertyOptional({ description: 'Student progress rating (1-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  studentProgressRating?: number;

  @ApiPropertyOptional({ description: 'Follow up required' })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({ description: 'Next visit date' })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  @ApiPropertyOptional({ description: 'Visit photos URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visitPhotos?: string[];

  @ApiPropertyOptional({ description: 'Attendees list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeesList?: string[];
}

export class PrincipalVisitLogQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by faculty id' })
  @IsOptional()
  @IsUUID()
  facultyId?: string;

  @ApiPropertyOptional({ description: 'Filter by visit status', enum: PrincipalVisitStatus })
  @IsOptional()
  @IsEnum(PrincipalVisitStatus)
  status?: PrincipalVisitStatus;

  @ApiPropertyOptional({ description: 'Start date (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
