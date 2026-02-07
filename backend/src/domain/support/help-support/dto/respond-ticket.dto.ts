import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RespondTicketDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Response must be at least 5 characters long' })
  @MaxLength(5000, { message: 'Response must not exceed 5000 characters' })
  message: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean; // For internal notes not visible to submitter
}
