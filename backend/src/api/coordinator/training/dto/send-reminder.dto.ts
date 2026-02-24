import { IsUUID, IsOptional, IsArray, IsBoolean, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendReminderDto {
  @ApiPropertyOptional({ description: 'Training ID to send reminders for (optional when sending to specific users)' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;

  @ApiPropertyOptional({ description: 'Specific user IDs to send reminders to (optional, sends to all pending if not provided)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Whether to send in-app notification (default: true)' })
  @IsOptional()
  @IsBoolean()
  sendInApp?: boolean;

  @ApiPropertyOptional({ description: 'Whether to send email notification (default: true)' })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ description: 'Custom message to include in the reminder' })
  @IsOptional()
  @IsString()
  customMessage?: string;
}

export enum PendingActionType {
  ENROLLMENT = 'enrollment',
  PRE_TEST = 'pre_test',
  POST_TEST = 'post_test',
  LESSON_PLAN = 'lesson_plan',
}

export class PendingActionsFilterDto {
  @ApiPropertyOptional({ description: 'Filter by action type', enum: PendingActionType })
  @IsOptional()
  @IsEnum(PendingActionType)
  actionType?: PendingActionType;

  @ApiPropertyOptional({ description: 'Filter by training ID' })
  @IsOptional()
  @IsUUID()
  trainingId?: string;
}
