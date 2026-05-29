import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Metadata about the bot response
 */
export class BotResponseMetadataDto {
  @ApiPropertyOptional({
    description: 'Model used to generate the response',
    example: 'gpt-4',
  })
  model?: string;

  @ApiPropertyOptional({
    description: 'Total processing time in milliseconds',
    example: 1250,
  })
  processingTimeMs?: number;

  @ApiPropertyOptional({
    description: 'Number of tokens used',
    example: 450,
  })
  tokensUsed?: number;

  @ApiPropertyOptional({
    description: 'Confidence score of the response (0-1)',
    example: 0.95,
  })
  confidence?: number;

  @ApiPropertyOptional({
    description: 'Session ID for conversation continuity',
    example: 'session_abc123xyz',
  })
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Unique request ID for tracking',
    example: 'req_xyz789',
  })
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Tools that were used to generate the response',
    example: ['get_dashboard_stats', 'get_institution_count'],
  })
  toolsUsed?: string[];
}

/**
 * DTO for bot query responses
 */
export class BotResponseDto {
  @ApiProperty({
    description: 'Whether the query was processed successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'The natural language answer to the query',
    example: 'There are currently 15,432 students enrolled across 45 institutions.',
  })
  answer: string;

  @ApiPropertyOptional({
    description: 'Structured data returned by the bot (charts, tables, etc.)',
    example: {
      totalStudents: 15432,
      totalInstitutions: 45,
      breakdown: [
        { institution: 'ABC College', students: 1200 },
        { institution: 'XYZ Institute', students: 980 },
      ],
    },
  })
  data?: unknown;

  @ApiPropertyOptional({
    description: 'Suggested follow-up queries based on the current context',
    example: [
      'Show me the institution with the most students',
      'What is the average enrollment per institution?',
      'Which institutions have fewer than 100 students?',
    ],
  })
  suggestions?: string[];

  @ApiPropertyOptional({
    description: 'Response metadata including processing information',
    type: BotResponseMetadataDto,
  })
  metadata?: BotResponseMetadataDto;

  @ApiPropertyOptional({
    description: 'Error message if the query processing failed',
    example: 'Unable to process query due to invalid parameters',
  })
  error?: string;
}

/**
 * DTO for query history response
 */
export class QueryHistoryEntryDto {
  @ApiProperty({
    description: 'Unique identifier for the query',
    example: 'query_abc123',
  })
  id: string;

  @ApiProperty({
    description: 'The original query text',
    example: 'How many students are enrolled?',
  })
  query: string;

  @ApiProperty({
    description: 'The response answer',
    example: 'There are 15,432 students enrolled.',
  })
  answer: string;

  @ApiProperty({
    description: 'When the query was made',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Session ID if part of a conversation',
    example: 'session_abc123xyz',
  })
  sessionId?: string;
}

/**
 * DTO for query history list response
 */
export class QueryHistoryResponseDto {
  @ApiProperty({
    description: 'Whether the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'List of query history entries',
    type: [QueryHistoryEntryDto],
  })
  data: QueryHistoryEntryDto[];

  @ApiProperty({
    description: 'Total number of queries in history',
    example: 25,
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Current page number',
    example: 1,
  })
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
  })
  limit?: number;
}
