import { IsString, IsOptional, IsEnum, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingApplicationStatus } from '../../../generated/prisma/client';

export class CreateApplicationDto {
  @ApiPropertyOptional({ description: 'How is this training relevant to your teaching?' })
  @IsOptional()
  @IsString()
  relevanceToTeaching?: string;

  @ApiPropertyOptional({ description: 'How will you apply this learning?' })
  @IsOptional()
  @IsString()
  expectedApplication?: string;
}

export class ApplyForTrainingDto {
  @ApiProperty({ description: 'Training ID to apply for' })
  @IsUUID()
  trainingId: string;

  @ApiPropertyOptional({ description: 'How is this training relevant to your teaching?' })
  @IsOptional()
  @IsString()
  relevanceToTeaching?: string;

  @ApiPropertyOptional({ description: 'How will you apply this learning?' })
  @IsOptional()
  @IsString()
  expectedApplication?: string;
}

export class ReviewApplicationDto {
  @ApiProperty({ description: 'New status', enum: TrainingApplicationStatus })
  @IsEnum(TrainingApplicationStatus)
  status: TrainingApplicationStatus;

  @ApiPropertyOptional({ description: 'Review comments' })
  @IsOptional()
  @IsString()
  reviewComments?: string;
}

export class BulkReviewApplicationDto {
  @ApiProperty({ description: 'Application IDs to review' })
  @IsArray()
  @IsUUID('4', { each: true })
  applicationIds: string[];

  @ApiProperty({ description: 'New status', enum: TrainingApplicationStatus })
  @IsEnum(TrainingApplicationStatus)
  status: TrainingApplicationStatus;

  @ApiPropertyOptional({ description: 'Review comments' })
  @IsOptional()
  @IsString()
  reviewComments?: string;
}

export class ApplicationFilterDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: TrainingApplicationStatus })
  @IsOptional()
  @IsEnum(TrainingApplicationStatus)
  status?: TrainingApplicationStatus;

  @ApiPropertyOptional({ description: 'Filter by training ID' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;

  @ApiPropertyOptional({ description: 'Filter by institution ID' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

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
