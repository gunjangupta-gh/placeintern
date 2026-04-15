import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsObject, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestFormPurpose } from '../../../generated/prisma/client';

export class CreateTestFormDto {
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
    type: 'rating' | 'text' | 'multiChoice' | 'checkbox' | 'yesNo' | 'number';
    question: string;
    required: boolean;
    options?: any;
    correctAnswer?: any; // For scoring
    points?: number; // Points for this question
  }>;

  @ApiPropertyOptional({ description: 'Form purpose', enum: TestFormPurpose })
  @IsOptional()
  @IsEnum(TestFormPurpose)
  purpose?: TestFormPurpose;

  @ApiPropertyOptional({ description: 'Passing score percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ description: 'Publish immediately' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class UpdateTestFormDto {
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
    type: 'rating' | 'text' | 'multiChoice' | 'checkbox' | 'yesNo' | 'number';
    question: string;
    required: boolean;
    options?: any;
    correctAnswer?: any;
    points?: number;
  }>;

  @ApiPropertyOptional({ description: 'Form purpose', enum: TestFormPurpose })
  @IsOptional()
  @IsEnum(TestFormPurpose)
  purpose?: TestFormPurpose;

  @ApiPropertyOptional({ description: 'Passing score percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubmitTestResponseDto {
  @ApiProperty({ description: 'Test form ID' })
  @IsUUID()
  testFormId: string;

  @ApiProperty({ description: 'Training ID' })
  @IsUUID()
  trainingId: string;

  @ApiProperty({ description: 'Responses as JSON object' })
  @IsObject()
  responses: Record<string, any>;
}

export class UpdateAnswerKeysDto {
  @ApiPropertyOptional({ description: 'Answer keys - map of question ID to correct answer' })
  @IsOptional()
  @IsObject()
  answerKeys?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Passing score percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingScore?: number;
}

export class TestFormFilterDto {
  @ApiPropertyOptional({ description: 'Filter by purpose', enum: TestFormPurpose })
  @IsOptional()
  @IsEnum(TestFormPurpose)
  purpose?: TestFormPurpose;

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
