import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { SupportTicketStatus, SupportTicketPriority } from '../../../../generated/prisma/client';

export class UpdateTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class AssignTicketDto {
  @IsString()
  assigneeId: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ResolveTicketDto {
  @IsString()
  resolution: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class CloseTicketDto {
  @IsString()
  @IsOptional()
  closureRemarks?: string;
}

export class UpdateTicketPriorityDto {
  @IsEnum(SupportTicketPriority)
  priority: SupportTicketPriority;
}
