import { IsString, IsOptional, IsDateString, IsInt, IsEnum, IsArray, IsBoolean, Min, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingDeliveryMode, TrainingDifficulty } from '../../../generated/prisma/client';

export class CreateTrainingDto {
  @ApiProperty({ description: 'Training title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Training description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Training provider/partner name' })
  @IsOptional()
  @IsString()
  providedBy?: string;

  @ApiPropertyOptional({ description: 'Trainer name' })
  @IsOptional()
  @IsString()
  trainerName?: string;

  @ApiPropertyOptional({ description: 'Trainer bio' })
  @IsOptional()
  @IsString()
  trainerBio?: string;

  @ApiPropertyOptional({ description: 'Trainer contact' })
  @IsOptional()
  @IsString()
  trainerContact?: string;

  @ApiProperty({ description: 'Training start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Training end date' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Total duration in hours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @ApiPropertyOptional({ description: 'Training start time' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Training end time' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Training cost (if applicable)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Target designation (e.g., For Computer Science Faculty)' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiProperty({ description: 'Application deadline' })
  @IsDateString()
  applicationDeadline: string;

  @ApiProperty({ description: 'Delivery mode', enum: TrainingDeliveryMode })
  @IsEnum(TrainingDeliveryMode)
  deliveryMode: TrainingDeliveryMode;

  @ApiPropertyOptional({ description: 'Venue name for offline/hybrid' })
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Meeting link for online/hybrid' })
  @IsOptional()
  @IsString()
  meetingLink?: string;

  @ApiProperty({ description: 'Maximum capacity' })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({ description: 'Prerequisites' })
  @IsOptional()
  @IsString()
  prerequisites?: string;

  @ApiPropertyOptional({ description: 'Difficulty level', enum: TrainingDifficulty })
  @IsOptional()
  @IsEnum(TrainingDifficulty)
  difficulty?: TrainingDifficulty;

  @ApiPropertyOptional({ description: 'Learning outcomes as array of strings' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningOutcomes?: string[];

  @ApiPropertyOptional({ description: 'Target branch IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetBranchIds?: string[];

  @ApiPropertyOptional({ description: 'Feedback form ID to assign' })
  @IsOptional()
  @IsUUID()
  feedbackFormId?: string;

  @ApiPropertyOptional({ description: 'Pre-test form ID to assign' })
  @IsOptional()
  @IsUUID()
  preTestFormId?: string;

  @ApiPropertyOptional({ description: 'Post-test form ID to assign' })
  @IsOptional()
  @IsUUID()
  postTestFormId?: string;

  @ApiPropertyOptional({ description: 'Publish immediately' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
