import { IsString, IsNotEmpty, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for bot query requests
 */
export class BotQueryDto {
  @ApiProperty({
    description: 'The natural language query to process',
    example: 'How many students are currently enrolled across all institutions?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Query is required' })
  @MinLength(1, { message: 'Query must not be empty' })
  @MaxLength(2000, { message: 'Query must not exceed 2000 characters' })
  query: string;

  @ApiPropertyOptional({
    description: 'Session ID for maintaining conversation context across multiple queries',
    example: 'session_abc123xyz',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Session ID must not exceed 100 characters' })
  sessionId?: string;
}
