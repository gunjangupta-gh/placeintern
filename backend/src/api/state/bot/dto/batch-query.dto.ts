import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, MaxLength, MinLength, ArrayMaxSize, ArrayMinSize } from 'class-validator';

/**
 * DTO for batch query request
 *
 * Strategy 7: Batch Processing
 * - Allows multiple queries in a single request
 * - Reduces per-request overhead
 * - Useful for dashboard initialization or reports
 */
export class BatchQueryDto {
  @ApiProperty({
    description: 'Array of queries to process',
    example: ['How many students?', 'Total visits this month?', 'Compliance rate?'],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(500, { each: true })
  queries: string[];

  @ApiPropertyOptional({
    description: 'Session ID for conversation context',
    example: 'session_abc123xyz',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

/**
 * Single query result in batch response
 */
export class BatchQueryResultDto {
  @ApiProperty({
    description: 'The original query',
    example: 'How many students?',
  })
  query: string;

  @ApiProperty({
    description: 'Whether this query was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'The answer to the query',
    example: 'There are 12,456 students across all institutions.',
  })
  answer: string;

  @ApiPropertyOptional({
    description: 'Tools used for this query',
    example: ['student_count'],
  })
  toolsUsed?: string[];

  @ApiPropertyOptional({
    description: 'Whether result was from cache',
    example: true,
  })
  cached?: boolean;

  @ApiPropertyOptional({
    description: 'Error message if failed',
  })
  error?: string;
}

/**
 * Response DTO for batch queries
 */
export class BatchQueryResponseDto {
  @ApiProperty({
    description: 'Whether the batch request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Results for each query',
    type: [BatchQueryResultDto],
  })
  results: BatchQueryResultDto[];

  @ApiProperty({
    description: 'Total processing time for all queries in ms',
    example: 2500,
  })
  totalProcessingTimeMs: number;

  @ApiProperty({
    description: 'Number of queries processed',
    example: 3,
  })
  queriesProcessed: number;

  @ApiProperty({
    description: 'Number of cache hits',
    example: 1,
  })
  cacheHits: number;

  @ApiPropertyOptional({
    description: 'Token usage summary',
  })
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
  };
}
