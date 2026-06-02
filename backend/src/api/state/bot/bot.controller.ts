import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/guards/roles.guard';
import { Roles } from '../../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { Role } from '../../../generated/prisma/client';
import { BotService } from './bot.service';
import { BotQueryDto } from './dto/bot-query.dto';
import { BotResponseDto, QueryHistoryResponseDto } from './dto/bot-response.dto';
import { BatchQueryDto, BatchQueryResponseDto } from './dto/batch-query.dto';
import { BotThrottleGuard } from './guards/bot-throttle.guard';

/**
 * BotController - REST API endpoints for the AI Bot functionality
 *
 * Provides endpoints for:
 * - Processing natural language queries (POST /state/bot/query)
 * - Retrieving query history (GET /state/bot/history)
 * - Clearing query history (DELETE /state/bot/history)
 *
 * All endpoints require STATE_DIRECTORATE role and JWT authentication.
 */
@ApiTags('State Bot')
@ApiBearerAuth()
@Controller('state/bot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class BotController {
  constructor(private readonly botService: BotService) {}

  /**
   * Process a natural language query
   *
   * @param dto - The query request containing the query text and optional session ID
   * @param user - The authenticated user from the JWT token
   * @returns BotResponseDto with the answer, data, and suggestions
   */
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BotThrottleGuard) // Strategy 6: Rate limiting
  @ApiOperation({
    summary: 'Process a natural language query',
    description:
      'Submit a natural language query to get insights about students, institutions, compliance, and more. ' +
      'Optionally include a sessionId to maintain conversation context across multiple queries. ' +
      'Rate limited to 30 requests per minute per user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Query processed successfully',
    type: BotResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query format',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have STATE_DIRECTORATE role',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async processQuery(
    @Body() dto: BotQueryDto,
    @CurrentUser() user: { userId: string; role: Role; institutionId?: string },
  ): Promise<BotResponseDto> {
    return this.botService.processQuery(dto, user);
  }

  /**
   * Strategy 7: Batch Processing
   * Process multiple queries in a single request
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BotThrottleGuard)
  @ApiOperation({
    summary: 'Process multiple queries in batch',
    description:
      'Submit multiple queries in a single request for efficient batch processing. ' +
      'Useful for dashboard initialization or generating reports. ' +
      'Maximum 10 queries per batch. Rate limited.',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch queries processed successfully',
    type: BatchQueryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid batch query format',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async processBatchQuery(
    @Body() dto: BatchQueryDto,
    @CurrentUser() user: { userId: string; role: Role; institutionId?: string },
  ): Promise<BatchQueryResponseDto> {
    return this.botService.processBatchQuery(dto, user);
  }

  /**
   * Get query history for the current user
   *
   * @param user - The authenticated user from the JWT token
   * @param page - Page number (default: 1)
   * @param limit - Number of items per page (default: 10)
   * @returns QueryHistoryResponseDto with paginated query history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get query history',
    description:
      'Retrieve the query history for the current user with pagination. ' +
      'History includes the query text, response answer, and timestamp.',
  })
  @ApiResponse({
    status: 200,
    description: 'Query history retrieved successfully',
    type: QueryHistoryResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have STATE_DIRECTORATE role',
  })
  async getQueryHistory(
    @CurrentUser() user: { userId: string; role: Role },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<QueryHistoryResponseDto> {
    return this.botService.getQueryHistory(
      user.userId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  /**
   * Clear query history for the current user
   *
   * @param user - The authenticated user from the JWT token
   * @returns Success status and message
   */
  @Delete('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear query history',
    description: 'Clear all query history for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Query history cleared successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have STATE_DIRECTORATE role',
  })
  async clearHistory(
    @CurrentUser() user: { userId: string; role: Role },
  ): Promise<{ success: boolean; message: string }> {
    return this.botService.clearHistory(user.userId);
  }

  /**
   * Get available capabilities and example queries
   *
   * @returns List of capabilities and example queries
   */
  @Get('capabilities')
  @ApiOperation({
    summary: 'Get bot capabilities',
    description:
      'Get a list of what the bot can help with and example queries to try.',
  })
  @ApiResponse({
    status: 200,
    description: 'Capabilities retrieved successfully',
  })
  getCapabilities(): {
    success: boolean;
    capabilities: string[];
    examples: { category: string; queries: string[] }[];
  } {
    return {
      success: true,
      capabilities: [
        'View and analyze student enrollment data',
        'Get institution statistics and performance metrics',
        'Check compliance status across institutions',
        'Analyze faculty and mentor assignments',
        'View report submission statistics',
        'Track faculty visit completion rates',
        'Explore company partnerships and placements',
        'Generate dashboard overviews and summaries',
      ],
      examples: [
        {
          category: 'Students',
          queries: [
            'How many students are currently enrolled?',
            'Show me students without mentors',
            'What is the internship placement rate?',
          ],
        },
        {
          category: 'Institutions',
          queries: [
            'List all active institutions',
            'Which institution has the most students?',
            'Show institutions with low compliance',
          ],
        },
        {
          category: 'Compliance',
          queries: [
            'What is the overall compliance status?',
            'Which institutions have pending reports?',
            'Show compliance trends this month',
          ],
        },
        {
          category: 'Staff',
          queries: [
            'How many faculty members are active?',
            'Show faculty workload distribution',
            'List faculty with pending visits',
          ],
        },
        {
          category: 'Companies',
          queries: [
            'Which companies hire the most students?',
            'Show company distribution by industry',
            'List top industry partners',
          ],
        },
      ],
    };
  }

  /**
   * Get bot statistics including cache performance and token usage
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get bot statistics',
    description:
      'Get performance statistics including cache hit rate, token usage, and cost metrics. ' +
      'Useful for monitoring and cost optimization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  getStats(): {
    success: boolean;
    cache: { hits: number; misses: number; hitRate: number; estimatedSavings: number };
    tokens: {
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCost: number;
      queryCount: number;
      avgCostPerQuery: number;
    };
    sessions: { activeSessions: number; agentSessions: number };
    costReport: {
      period: string;
      totalCost: number;
      projection: { monthly: number };
    };
  } {
    const cacheStats = this.botService.getCacheStats();
    const tokenMetrics = this.botService.getTokenMetrics();
    const sessionStats = this.botService.getSessionStats();
    const costReport = this.botService.getCostReport();

    return {
      success: true,
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: Number(cacheStats.hitRate.toFixed(2)),
        estimatedSavings: Number(cacheStats.estimatedSavings.toFixed(6)),
      },
      tokens: {
        totalInputTokens: tokenMetrics.totalInputTokens,
        totalOutputTokens: tokenMetrics.totalOutputTokens,
        totalCost: Number(tokenMetrics.totalCost.toFixed(6)),
        queryCount: tokenMetrics.queryCount,
        avgCostPerQuery: Number(tokenMetrics.avgCostPerQuery.toFixed(6)),
      },
      sessions: sessionStats,
      costReport: {
        period: costReport.period,
        totalCost: costReport.totalCost,
        projection: costReport.projection,
      },
    };
  }

  /**
   * Get user's token budget status
   */
  @Get('budget')
  @ApiOperation({
    summary: 'Get token budget status',
    description: 'Get current token budget usage and limits for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Budget status retrieved successfully',
  })
  getBudget(@CurrentUser() user: { userId: string }): {
    success: boolean;
    budget: {
      dailyLimit: number;
      dailyUsed: number;
      dailyRemaining: number;
      monthlyLimit: number;
      monthlyUsed: number;
      monthlyRemaining: number;
    };
  } {
    const budget = this.botService.getUserBudget(user.userId);

    return {
      success: true,
      budget: {
        dailyLimit: budget.dailyLimit,
        dailyUsed: budget.dailyUsed,
        dailyRemaining: Math.max(0, budget.dailyLimit - budget.dailyUsed),
        monthlyLimit: budget.monthlyLimit,
        monthlyUsed: budget.monthlyUsed,
        monthlyRemaining: Math.max(0, budget.monthlyLimit - budget.monthlyUsed),
      },
    };
  }
}
