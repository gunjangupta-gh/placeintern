import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupportCategory, SupportTicketPriority } from '../../../../generated/prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Subject must be at least 5 characters long' })
  @MaxLength(200, { message: 'Subject must not exceed 200 characters' })
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'Description must be at least 20 characters long' })
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  description: string;

  @IsEnum(SupportCategory)
  @IsNotEmpty()
  category: SupportCategory;

  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriority;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}
