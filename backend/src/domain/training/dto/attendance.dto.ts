import { IsString, IsOptional, IsDateString, IsArray, IsUUID, IsNumber } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class MarkAttendanceDto {
  @ApiPropertyOptional({ description: 'Attendance date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @ApiPropertyOptional({ description: 'Latitude of attendance location' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude of attendance location' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Address of attendance location' })
  @IsOptional()
  @IsString()
  locationAddress?: string;

  @ApiPropertyOptional({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class BulkMarkAttendanceDto {
  @ApiProperty({ description: 'User IDs to mark attendance for' })
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @ApiPropertyOptional({ description: 'Attendance date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;
}

export class AttendanceFilterDto {
  @ApiPropertyOptional({ description: 'Filter by training ID' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;

  @ApiPropertyOptional({ description: 'Filter by date' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Filter by institution ID' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class MarkSelfAttendanceDto {
  @ApiProperty({ description: 'Training ID' })
  @IsUUID()
  trainingId: string;

  @ApiPropertyOptional({ description: 'Attendance date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  attendanceDate?: string;

  @ApiPropertyOptional({ description: 'Latitude of attendance location' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude of attendance location' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Address of attendance location' })
  @IsOptional()
  @IsString()
  locationAddress?: string;
}
