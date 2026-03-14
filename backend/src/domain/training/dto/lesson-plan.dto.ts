import { IsString, IsOptional, IsEnum, IsArray, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonPlanStatus } from '../../../generated/prisma/client';

export class CreateLessonPlanDto {
  @ApiProperty({ description: 'Training ID this lesson plan is for' })
  @IsUUID()
  trainingId: string;

  @ApiProperty({ description: 'Lesson plan title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Course or semester' })
  @IsOptional()
  @IsString()
  courseOrSemester?: string;

  @ApiPropertyOptional({ description: 'How training connects to this lesson' })
  @IsOptional()
  @IsString()
  connectionToTraining?: string;

  @ApiPropertyOptional({ description: 'Learning objectives' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningObjectives?: string[];

  @ApiPropertyOptional({ description: 'New skills/technologies introduced' })
  @IsOptional()
  @IsString()
  newSkillsTechnologies?: string;

  @ApiPropertyOptional({ description: 'Delivery methods' })
  @IsOptional()
  @IsString()
  deliveryMethods?: string;

  @ApiPropertyOptional({ description: 'Hands-on activities' })
  @IsOptional()
  @IsString()
  handsOnActivities?: string;

  @ApiPropertyOptional({ description: 'Assessment methods' })
  @IsOptional()
  @IsString()
  assessmentMethods?: string;

  @ApiPropertyOptional({ description: 'Industry connections' })
  @IsOptional()
  @IsString()
  industryConnections?: string;

  @ApiPropertyOptional({ description: 'Resource requirements' })
  @IsOptional()
  @IsString()
  resourceRequirements?: string;

  @ApiPropertyOptional({ description: 'Implementation timeline' })
  @IsOptional()
  @IsString()
  implementationTimeline?: string;

  @ApiPropertyOptional({ description: 'Expected outcomes' })
  @IsOptional()
  @IsString()
  expectedOutcomes?: string;

  @ApiPropertyOptional({ description: 'Attachment URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class UpdateLessonPlanDto {
  @ApiPropertyOptional({ description: 'Lesson plan title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Course or semester' })
  @IsOptional()
  @IsString()
  courseOrSemester?: string;

  @ApiPropertyOptional({ description: 'How training connects to this lesson' })
  @IsOptional()
  @IsString()
  connectionToTraining?: string;

  @ApiPropertyOptional({ description: 'Learning objectives' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningObjectives?: string[];

  @ApiPropertyOptional({ description: 'New skills/technologies introduced' })
  @IsOptional()
  @IsString()
  newSkillsTechnologies?: string;

  @ApiPropertyOptional({ description: 'Delivery methods' })
  @IsOptional()
  @IsString()
  deliveryMethods?: string;

  @ApiPropertyOptional({ description: 'Hands-on activities' })
  @IsOptional()
  @IsString()
  handsOnActivities?: string;

  @ApiPropertyOptional({ description: 'Assessment methods' })
  @IsOptional()
  @IsString()
  assessmentMethods?: string;

  @ApiPropertyOptional({ description: 'Industry connections' })
  @IsOptional()
  @IsString()
  industryConnections?: string;

  @ApiPropertyOptional({ description: 'Resource requirements' })
  @IsOptional()
  @IsString()
  resourceRequirements?: string;

  @ApiPropertyOptional({ description: 'Implementation timeline' })
  @IsOptional()
  @IsString()
  implementationTimeline?: string;

  @ApiPropertyOptional({ description: 'Expected outcomes' })
  @IsOptional()
  @IsString()
  expectedOutcomes?: string;

  @ApiPropertyOptional({ description: 'Attachment URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class ReviewLessonPlanDto {
  @ApiProperty({ description: 'New status', enum: LessonPlanStatus })
  @IsEnum(LessonPlanStatus)
  status: LessonPlanStatus;

  @ApiPropertyOptional({ description: 'Review comments' })
  @IsOptional()
  @IsString()
  reviewComments?: string;
}

export class LessonPlanFilterDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: LessonPlanStatus })
  @IsOptional()
  @IsEnum(LessonPlanStatus)
  status?: LessonPlanStatus;

  @ApiPropertyOptional({ description: 'Filter by training ID' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;

  @ApiPropertyOptional({ description: 'Filter by institution ID' })
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

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
