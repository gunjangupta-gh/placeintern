import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class AssignMentorDto {
  @ApiProperty({ description: 'Mentor user ID' })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({ description: 'Array of student IDs to assign', type: [String] })
  @IsArray()
  @IsNotEmpty()
  studentIds: string[];

  @ApiProperty({ description: 'Academic year (e.g., "2024-25")' })
  @IsString()
  @IsNotEmpty()
  academicYear: string;

  @ApiProperty({ description: 'Semester label/number (optional)', required: false })
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiProperty({ description: 'Assignment reason (optional)', required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'Assignment notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
