import { IsString, IsOptional, IsEnum, IsArray, IsUUID, IsNumber, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TrainingDeliveryMode,
  TrainingDifficulty,
  TrainingRecommendationStatus,
  TrainingRecommendationPriority,
} from '../../../generated/prisma/client';

export class CreateRecommendationDto {
  @ApiProperty({ description: 'Title of the recommended training' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description of the training recommendation' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Target audience for the training' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ description: 'Suggested duration in hours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  suggestedDuration?: number;

  @ApiPropertyOptional({ description: 'Suggested delivery mode', enum: TrainingDeliveryMode })
  @IsOptional()
  @IsEnum(TrainingDeliveryMode)
  suggestedMode?: TrainingDeliveryMode;

  @ApiPropertyOptional({ description: 'Suggested difficulty level', enum: TrainingDifficulty })
  @IsOptional()
  @IsEnum(TrainingDifficulty)
  suggestedDifficulty?: TrainingDifficulty;

  @ApiPropertyOptional({ description: 'Topics to be covered in the training' })
  @IsOptional()
  @IsString()
  topicsCovered?: string;

  @ApiPropertyOptional({ description: 'Expected learning outcomes' })
  @IsOptional()
  @IsString()
  learningOutcomes?: string;

  @ApiPropertyOptional({ description: 'Why this training is relevant/needed' })
  @IsOptional()
  @IsString()
  relevanceReason?: string;

  @ApiPropertyOptional({ description: 'Suggested trainer name or organization' })
  @IsOptional()
  @IsString()
  suggestedTrainer?: string;

  @ApiPropertyOptional({ description: 'Reference links or resources' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resourceLinks?: string[];

  @ApiPropertyOptional({ description: 'Estimated budget for the training' })
  @IsOptional()
  @IsNumber()
  estimatedBudget?: number;

  @ApiPropertyOptional({ description: 'Target branch IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetBranchIds?: string[];

  @ApiPropertyOptional({ description: 'Priority level', enum: TrainingRecommendationPriority })
  @IsOptional()
  @IsEnum(TrainingRecommendationPriority)
  priority?: TrainingRecommendationPriority;
}

export class UpdateRecommendationDto {
  @ApiPropertyOptional({ description: 'Title of the recommended training' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed description of the training recommendation' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Target audience for the training' })
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ description: 'Suggested duration in hours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  suggestedDuration?: number;

  @ApiPropertyOptional({ description: 'Suggested delivery mode', enum: TrainingDeliveryMode })
  @IsOptional()
  @IsEnum(TrainingDeliveryMode)
  suggestedMode?: TrainingDeliveryMode;

  @ApiPropertyOptional({ description: 'Suggested difficulty level', enum: TrainingDifficulty })
  @IsOptional()
  @IsEnum(TrainingDifficulty)
  suggestedDifficulty?: TrainingDifficulty;

  @ApiPropertyOptional({ description: 'Topics to be covered in the training' })
  @IsOptional()
  @IsString()
  topicsCovered?: string;

  @ApiPropertyOptional({ description: 'Expected learning outcomes' })
  @IsOptional()
  @IsString()
  learningOutcomes?: string;

  @ApiPropertyOptional({ description: 'Why this training is relevant/needed' })
  @IsOptional()
  @IsString()
  relevanceReason?: string;

  @ApiPropertyOptional({ description: 'Suggested trainer name or organization' })
  @IsOptional()
  @IsString()
  suggestedTrainer?: string;

  @ApiPropertyOptional({ description: 'Reference links or resources' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resourceLinks?: string[];

  @ApiPropertyOptional({ description: 'Estimated budget for the training' })
  @IsOptional()
  @IsNumber()
  estimatedBudget?: number;

  @ApiPropertyOptional({ description: 'Target branch IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetBranchIds?: string[];

  @ApiPropertyOptional({ description: 'Priority level', enum: TrainingRecommendationPriority })
  @IsOptional()
  @IsEnum(TrainingRecommendationPriority)
  priority?: TrainingRecommendationPriority;
}

export class ReviewRecommendationDto {
  @ApiProperty({ description: 'New status', enum: TrainingRecommendationStatus })
  @IsEnum(TrainingRecommendationStatus)
  status: TrainingRecommendationStatus;

  @ApiPropertyOptional({ description: 'Review comments' })
  @IsOptional()
  @IsString()
  reviewComments?: string;

  @ApiPropertyOptional({ description: 'Rejection reason (if rejecting)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Training ID if implementing' })
  @IsOptional()
  @IsUUID()
  implementedTrainingId?: string;
}

export class RecommendationFilterDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: TrainingRecommendationStatus })
  @IsOptional()
  @IsEnum(TrainingRecommendationStatus)
  status?: TrainingRecommendationStatus;

  @ApiPropertyOptional({ description: 'Filter by priority', enum: TrainingRecommendationPriority })
  @IsOptional()
  @IsEnum(TrainingRecommendationPriority)
  priority?: TrainingRecommendationPriority;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  limit?: number = 20;
}
