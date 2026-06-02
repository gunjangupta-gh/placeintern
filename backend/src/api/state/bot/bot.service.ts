import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { SupervisorAgent, SupervisorQueryResult } from './agents/supervisor.agent';
import { BotQueryDto } from './dto/bot-query.dto';
import {
  BotResponseDto,
  QueryHistoryEntryDto,
  QueryHistoryResponseDto,
} from './dto/bot-response.dto';
import {
  BatchQueryDto,
  BatchQueryResponseDto,
  BatchQueryResultDto,
} from './dto/batch-query.dto';
import {
  QueryContext,
  AgentResponse,
  QueryLogEntry,
  SessionData,
} from './interfaces/bot.interfaces';
import { Role } from '../../../generated/prisma/client';
import { BotCacheService, CachedQueryResponse } from './services/cache.service';
import { BotTokenService, TokenUsage } from './services/token.service';

/**
 * BotService - Main orchestrator for the AI Bot functionality
 *
 * This service handles:
 * - Processing user queries through the SupervisorAgent
 * - Query logging for audit and analysis
 * - Session management for conversation continuity
 * - Error handling and fallback responses
 * - Suggestion generation based on context
 */
@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  // In-memory session storage (can be replaced with Redis for production)
  private readonly sessions: Map<string, SessionData> = new Map();

  // In-memory query log (can be replaced with database storage)
  private readonly queryLogs: Map<string, QueryLogEntry[]> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly supervisorAgent: SupervisorAgent,
    private readonly cacheService: BotCacheService,
    private readonly tokenService: BotTokenService,
  ) {}

  /**
   * Process a user query and return a response
   *
   * @param dto - The query DTO containing the query and optional session ID
   * @param user - The authenticated user making the query
   * @returns BotResponseDto with the answer and related data
   */
  async processQuery(
    dto: BotQueryDto,
    user: { userId: string; role: Role; institutionId?: string },
  ): Promise<BotResponseDto> {
    const startTime = Date.now();
    const sessionId = dto.sessionId || this.generateSessionId();

    this.logger.log(`Processing query for user ${user.userId}: "${dto.query.substring(0, 50)}..."`);

    try {
      // Check user's token budget
      const budgetCheck = this.tokenService.checkBudget(user.userId);
      if (!budgetCheck.allowed) {
        return {
          success: false,
          answer: budgetCheck.reason || 'Token budget exceeded. Please try again later.',
          metadata: { sessionId, processingTimeMs: Date.now() - startTime },
          error: 'BUDGET_EXCEEDED',
        };
      }

      // Build the query context for logging
      const context: QueryContext = {
        userId: user.userId,
        role: user.role,
        sessionId,
        institutionId: user.institutionId,
        timestamp: new Date(),
        metadata: {
          queryLength: dto.query.length,
          hasExistingSession: dto.sessionId ? this.sessions.has(dto.sessionId) : false,
        },
      };

      // Strategy 1: Check cache first
      let agentResult: SupervisorQueryResult;
      let fromCache = false;

      if (this.cacheService.shouldCache(dto.query)) {
        const cached = await this.cacheService.get(dto.query);
        if (cached) {
          fromCache = true;
          agentResult = {
            answer: cached.answer,
            toolsUsed: cached.toolsUsed,
            processingTimeMs: cached.processingTimeMs,
            inputTokens: cached.tokensUsed?.input,
            outputTokens: cached.tokensUsed?.output,
          };
          this.logger.debug(`Cache hit for query: "${dto.query.substring(0, 50)}..."`);
        }
      }

      // If not cached, process through supervisor agent
      if (!fromCache) {
        agentResult = await this.supervisorAgent.query(dto.query, sessionId);

        // Cache the result
        if (this.cacheService.shouldCache(dto.query)) {
          const ttl = this.cacheService.getTTLForQuery(dto.query);
          await this.cacheService.set(
            dto.query,
            {
              answer: agentResult.answer,
              toolsUsed: agentResult.toolsUsed,
              processingTimeMs: agentResult.processingTimeMs,
              cachedAt: Date.now(),
              tokensUsed: {
                input: agentResult.inputTokens || 0,
                output: agentResult.outputTokens || 0,
                cost: this.tokenService.calculateCost(
                  agentResult.inputTokens || 0,
                  agentResult.outputTokens || 0,
                ),
              },
            },
            ttl,
          );
        }

        // Track token usage (only for non-cached queries)
        if (agentResult.inputTokens || agentResult.outputTokens) {
          this.tokenService.trackUsage(
            agentResult.inputTokens || 0,
            agentResult.outputTokens || 0,
            user.userId,
          );
        }
      }

      // Convert SupervisorQueryResult to AgentResponse format for logging
      const agentResponse: AgentResponse = {
        success: true,
        answer: agentResult.answer,
        toolsUsed: agentResult.toolsUsed.map((toolName) => ({
          toolName,
          success: true,
        })),
        metadata: {
          processingTimeMs: agentResult.processingTimeMs,
          sessionId,
        },
      };

      // Log the query for audit and analysis
      await this.logQuery(dto.query, agentResponse, context, agentResult.processingTimeMs);

      // Update or create session tracking
      this.updateSession(sessionId, user.userId, dto.query, agentResponse);

      // Generate suggestions based on the query
      const suggestions = this.generateSuggestions(dto.query, agentResult.toolsUsed);

      // Build and return the response
      const response: BotResponseDto = {
        success: true,
        answer: agentResult.answer,
        suggestions,
        metadata: {
          sessionId,
          processingTimeMs: fromCache ? 0 : agentResult.processingTimeMs,
          toolsUsed: agentResult.toolsUsed,
          tokensUsed: (agentResult.inputTokens || 0) + (agentResult.outputTokens || 0),
        },
      };

      // Add cache info to metadata
      if (fromCache) {
        (response.metadata as any).cached = true;
      }

      this.logger.log(
        `Query processed successfully in ${agentResult.processingTimeMs}ms${fromCache ? ' (cached)' : ''}`,
      );
      return response;
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      this.logger.error(`Error processing query: ${error.message}`, error.stack);

      // Build context for error logging
      const context: QueryContext = {
        userId: user.userId,
        role: user.role,
        sessionId,
        timestamp: new Date(),
      };

      // Log the failed query
      await this.logQuery(
        dto.query,
        {
          success: false,
          answer: '',
          error: error.message,
        },
        context,
        processingTimeMs,
      );

      return {
        success: false,
        answer: this.getErrorMessage(error),
        suggestions: this.getRecoverySuggestions(),
        metadata: {
          sessionId,
          processingTimeMs,
        },
        error: error.message,
      };
    }
  }

  /**
   * Get query history for a user
   *
   * @param userId - The user ID to get history for
   * @param page - Page number (1-indexed)
   * @param limit - Number of items per page
   * @returns QueryHistoryResponseDto with the history entries
   */
  async getQueryHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<QueryHistoryResponseDto> {
    try {
      const userLogs = this.queryLogs.get(userId) || [];

      // Sort by date descending
      const sortedLogs = [...userLogs].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      // Paginate
      const startIndex = (page - 1) * limit;
      const paginatedLogs = sortedLogs.slice(startIndex, startIndex + limit);

      const entries: QueryHistoryEntryDto[] = paginatedLogs.map((log) => ({
        id: log.id,
        query: log.query,
        answer: log.response.answer,
        createdAt: log.createdAt,
        sessionId: log.context.sessionId,
      }));

      return {
        success: true,
        data: entries,
        total: userLogs.length,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Error getting query history: ${error.message}`);
      return {
        success: false,
        data: [],
        total: 0,
        page,
        limit,
      };
    }
  }

  /**
   * Get session data for conversation continuity
   *
   * @param sessionId - The session ID to retrieve
   * @returns SessionData or null if not found
   */
  getSession(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Clear a user's query history
   *
   * @param userId - The user ID whose history to clear
   */
  async clearHistory(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      this.queryLogs.delete(userId);
      return { success: true, message: 'Query history cleared successfully' };
    } catch (error) {
      this.logger.error(`Error clearing history: ${error.message}`);
      return { success: false, message: 'Failed to clear query history' };
    }
  }

  /**
   * Clear a specific session from the supervisor agent
   *
   * @param sessionId - The session ID to clear
   */
  clearSession(sessionId: string): boolean {
    const localCleared = this.sessions.delete(sessionId);
    const agentCleared = this.supervisorAgent.clearSession(sessionId);
    return localCleared || agentCleared;
  }

  /**
   * Log a query for audit and analysis purposes
   */
  private async logQuery(
    query: string,
    response: AgentResponse,
    context: QueryContext,
    durationMs: number,
  ): Promise<void> {
    const logEntry: QueryLogEntry = {
      id: this.generateLogId(),
      userId: context.userId,
      query,
      response,
      context,
      createdAt: new Date(),
      durationMs,
    };

    // Store in memory (can be persisted to database)
    const userLogs = this.queryLogs.get(context.userId) || [];
    userLogs.push(logEntry);

    // Keep only the last 100 queries per user
    if (userLogs.length > 100) {
      userLogs.shift();
    }

    this.queryLogs.set(context.userId, userLogs);

    // Log metrics for monitoring
    this.logger.debug(
      `Query logged: ${logEntry.id} | Duration: ${durationMs}ms | Success: ${response.success}`,
    );
  }

  /**
   * Update or create a session for conversation continuity (local tracking)
   */
  private updateSession(
    sessionId: string,
    userId: string,
    query: string,
    response: AgentResponse,
  ): void {
    const existingSession = this.sessions.get(sessionId);
    const now = new Date();

    if (existingSession) {
      // Update existing session
      existingSession.history.push(
        { role: 'user', content: query, timestamp: now },
        {
          role: 'assistant',
          content: response.answer,
          timestamp: now,
          toolsUsed: response.toolsUsed?.map((t) => t.toolName),
        },
      );
      existingSession.lastActiveAt = now;

      // Trim history to last 20 messages
      if (existingSession.history.length > 20) {
        existingSession.history = existingSession.history.slice(-20);
      }
    } else {
      // Create new session
      this.sessions.set(sessionId, {
        sessionId,
        userId,
        history: [
          { role: 'user', content: query, timestamp: now },
          {
            role: 'assistant',
            content: response.answer,
            timestamp: now,
            toolsUsed: response.toolsUsed?.map((t) => t.toolName),
          },
        ],
        createdAt: now,
        lastActiveAt: now,
      });
    }

    // Clean up old sessions (older than 24 hours)
    this.cleanupOldSessions();
  }

  /**
   * Clean up sessions older than 24 hours
   */
  private cleanupOldSessions(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActiveAt.getTime() < cutoff) {
        this.sessions.delete(sessionId);
        // Also clear from the supervisor agent
        this.supervisorAgent.clearSession(sessionId);
      }
    }
  }

  /**
   * Generate suggestions based on the query and tools used
   */
  private generateSuggestions(query: string, toolsUsed: string[]): string[] {
    const lowerQuery = query.toLowerCase();
    const suggestions: string[] = [];

    // Generate context-aware suggestions
    if (toolsUsed.some((t) => t.includes('student'))) {
      suggestions.push(
        'How many students are without mentors?',
        'Show student distribution by branch',
        'Which students have pending reports?',
      );
    } else if (toolsUsed.some((t) => t.includes('institution'))) {
      suggestions.push(
        'Which institution has the most students?',
        'Show institutions with low compliance',
        'List institutions by location',
      );
    } else if (toolsUsed.some((t) => t.includes('visit'))) {
      suggestions.push(
        'Show visit completion rates by month',
        'Which faculty have completed the most visits?',
        'List pending visits for this month',
      );
    } else if (toolsUsed.some((t) => t.includes('report'))) {
      suggestions.push(
        'Show monthly report submission trends',
        'Which institutions have pending reports?',
        'What is the overall report completion rate?',
      );
    } else if (lowerQuery.includes('dashboard') || lowerQuery.includes('overview')) {
      suggestions.push(
        'Show me the top performing institutions',
        'Which institutions have compliance issues?',
        'What is the overall internship placement rate?',
      );
    } else {
      // Default suggestions
      suggestions.push(
        'Show me the dashboard overview',
        'How many students are enrolled?',
        'What is the compliance status across institutions?',
      );
    }

    return suggestions.slice(0, 3); // Return max 3 suggestions
  }

  /**
   * Generate a user-friendly error message
   */
  private getErrorMessage(error: Error): string {
    if (error.message.includes('timeout')) {
      return 'The query took too long to process. Please try a simpler query or try again later.';
    }

    if (error.message.includes('rate limit')) {
      return 'You have made too many queries in a short time. Please wait a moment and try again.';
    }

    if (error.message.includes('OPENAI_API_KEY')) {
      return 'The AI service is not properly configured. Please contact support.';
    }

    return 'I encountered an unexpected error while processing your query. Please try again or contact support if the issue persists.';
  }

  /**
   * Get recovery suggestions after an error
   */
  private getRecoverySuggestions(): string[] {
    return [
      'Try asking a simpler question',
      'Show me basic statistics',
      'What can you help me with?',
    ];
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate a unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get active session statistics (for monitoring)
   */
  getSessionStats(): { activeSessions: number; agentSessions: number } {
    return {
      activeSessions: this.sessions.size,
      agentSessions: this.supervisorAgent.getActiveSessionCount(),
    };
  }

  /**
   * Strategy 7: Batch Processing
   * Process multiple queries in a single request
   *
   * Benefits:
   * - Reduced per-request overhead
   * - Better for dashboard initialization
   * - Single API call for multiple data points
   */
  async processBatchQuery(
    dto: BatchQueryDto,
    user: { userId: string; role: Role; institutionId?: string },
  ): Promise<BatchQueryResponseDto> {
    const startTime = Date.now();
    const results: BatchQueryResultDto[] = [];
    let cacheHits = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    this.logger.log(`Processing batch query with ${dto.queries.length} queries for user ${user.userId}`);

    // Process each query
    for (const query of dto.queries) {
      try {
        // Check cache first
        let fromCache = false;
        let answer: string;
        let toolsUsed: string[] = [];

        if (this.cacheService.shouldCache(query)) {
          const cached = await this.cacheService.get(query);
          if (cached) {
            fromCache = true;
            cacheHits++;
            answer = cached.answer;
            toolsUsed = cached.toolsUsed;

            if (cached.tokensUsed) {
              totalInputTokens += cached.tokensUsed.input;
              totalOutputTokens += cached.tokensUsed.output;
            }
          }
        }

        // If not cached, process through agent
        if (!fromCache) {
          const agentResult = await this.supervisorAgent.query(query, dto.sessionId);
          answer = agentResult.answer;
          toolsUsed = agentResult.toolsUsed;

          // Track tokens
          totalInputTokens += agentResult.inputTokens || 0;
          totalOutputTokens += agentResult.outputTokens || 0;

          // Cache the result
          if (this.cacheService.shouldCache(query)) {
            const ttl = this.cacheService.getTTLForQuery(query);
            await this.cacheService.set(
              query,
              {
                answer,
                toolsUsed,
                processingTimeMs: agentResult.processingTimeMs,
                cachedAt: Date.now(),
                tokensUsed: {
                  input: agentResult.inputTokens || 0,
                  output: agentResult.outputTokens || 0,
                  cost: this.tokenService.calculateCost(
                    agentResult.inputTokens || 0,
                    agentResult.outputTokens || 0,
                  ),
                },
              },
              ttl,
            );
          }
        }

        results.push({
          query,
          success: true,
          answer,
          toolsUsed,
          cached: fromCache,
        });
      } catch (error) {
        results.push({
          query,
          success: false,
          answer: 'Failed to process this query',
          error: error.message,
        });
      }
    }

    const totalProcessingTimeMs = Date.now() - startTime;
    const estimatedCost = this.tokenService.calculateCost(totalInputTokens, totalOutputTokens);

    // Track total token usage
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      this.tokenService.trackUsage(totalInputTokens, totalOutputTokens, user.userId);
    }

    this.logger.log(
      `Batch query completed: ${results.length} queries in ${totalProcessingTimeMs}ms (${cacheHits} cached)`,
    );

    return {
      success: true,
      results,
      totalProcessingTimeMs,
      queriesProcessed: results.length,
      cacheHits,
      tokenUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCost,
      },
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Get token usage metrics
   */
  getTokenMetrics() {
    return this.tokenService.getMetrics();
  }

  /**
   * Get cost report
   */
  getCostReport() {
    return this.tokenService.getCostReport();
  }

  /**
   * Clear query cache
   */
  async clearCache(): Promise<number> {
    return this.cacheService.clearAll();
  }

  /**
   * Get user's token budget status
   */
  getUserBudget(userId: string) {
    return this.tokenService.getUserBudget(userId);
  }

  /**
   * Reset token metrics (admin function)
   */
  resetMetrics(): void {
    this.tokenService.resetMetrics();
    this.cacheService.resetStats();
  }
}
