import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackFormPurpose } from '../../../generated/prisma/client';

export class CreateFeedbackFormDto {
  @ApiProperty({ description: 'Form title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Form description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Questions as JSON array' })
  @IsArray()
  questions: Array<{
    id: string;
    type: 'rating' | 'text' | 'multiChoice' | 'checkbox' | 'yesNo';
    question: string;
    required: boolean;
    options?: any;
  }>;

  @ApiPropertyOptional({ description: 'Form purpose', enum: FeedbackFormPurpose })
  @IsOptional()
  @IsEnum(FeedbackFormPurpose)
  purpose?: FeedbackFormPurpose;

  @ApiPropertyOptional({ description: 'Publish immediately' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpdateFeedbackFormDto {
  @ApiPropertyOptional({ description: 'Form title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Form description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Questions as JSON array' })
  @IsOptional()
  @IsArray()
  questions?: Array<{
    id: string;
    type: 'rating' | 'text' | 'multiChoice' | 'checkbox' | 'yesNo';
    question: string;
    required: boolean;
    options?: any;
  }>;

  @ApiPropertyOptional({ description: 'Form purpose', enum: FeedbackFormPurpose })
  @IsOptional()
  @IsEnum(FeedbackFormPurpose)
  purpose?: FeedbackFormPurpose;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubmitFeedbackDto {
  @ApiProperty({ description: 'Feedback form ID' })
  @IsUUID()
  feedbackFormId: string;

  @ApiPropertyOptional({ description: 'Training ID (for training feedback)' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;

  @ApiProperty({ description: 'Responses as JSON object' })
  @IsObject()
  responses: Record<string, any>;
}

export class FeedbackFilterDto {
  @ApiPropertyOptional({ description: 'Filter by purpose', enum: FeedbackFormPurpose })
  @IsOptional()
  @IsEnum(FeedbackFormPurpose)
  purpose?: FeedbackFormPurpose;

  @ApiPropertyOptional({ description: 'Filter by published status' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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
