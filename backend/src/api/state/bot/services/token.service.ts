import { Injectable, Logger } from '@nestjs/common';

/**
 * Token usage metrics for a single query
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Aggregate token metrics for monitoring
 */
export interface TokenMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  queryCount: number;
  avgTokensPerQuery: number;
  avgCostPerQuery: number;
  periodStart: Date;
}

/**
 * User-level token budget
 */
export interface TokenBudget {
  userId: string;
  dailyLimit: number;
  monthlyLimit: number;
  dailyUsed: number;
  monthlyUsed: number;
  lastResetDaily: Date;
  lastResetMonthly: Date;
}

/**
 * Model pricing configuration
 */
interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

/**
 * BotTokenService - Token counting and cost tracking
 *
 * Provides:
 * - Token estimation using character-based approximation
 * - Cost calculation based on model pricing
 * - Budget enforcement (daily/monthly limits)
 * - Usage metrics aggregation
 *
 * Note: For precise token counting, consider using tiktoken library.
 * This implementation uses approximation (1 token ≈ 4 characters) for efficiency.
 */
@Injectable()
export class BotTokenService {
  private readonly logger = new Logger(BotTokenService.name);

  // Model pricing (per 1M tokens) - GPT-4o-mini
  private readonly MODEL_PRICING: Record<string, ModelPricing> = {
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
    'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.0 },
    'gpt-4': { inputPer1M: 30.0, outputPer1M: 60.0 },
    'claude-haiku': { inputPer1M: 0.80, outputPer1M: 4.0 },
    'claude-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
    'deepseek-v3': { inputPer1M: 0.01, outputPer1M: 0.02 },
  };

  private currentModel = 'gpt-4o-mini';

  // Aggregated metrics (in-memory, can be persisted to DB)
  private metrics: TokenMetrics = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    queryCount: 0,
    avgTokensPerQuery: 0,
    avgCostPerQuery: 0,
    periodStart: new Date(),
  };

  // User budgets (in-memory, should be persisted to DB in production)
  private userBudgets: Map<string, TokenBudget> = new Map();

  // Default limits
  private readonly DEFAULT_DAILY_LIMIT = 50000; // tokens
  private readonly DEFAULT_MONTHLY_LIMIT = 500000; // tokens

  /**
   * Estimate token count from text using character-based approximation
   * Average: 1 token ≈ 4 characters for English text
   *
   * For more accurate counting, use tiktoken library
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    // Character-based approximation
    // English: ~4 chars/token, other languages may vary
    const charCount = text.length;
    const estimatedTokens = Math.ceil(charCount / 4);

    return estimatedTokens;
  }

  /**
   * Estimate tokens for a complete query (input + system prompt + history)
   */
  estimateQueryTokens(
    query: string,
    systemPrompt: string,
    history: string[] = [],
  ): number {
    const queryTokens = this.estimateTokens(query);
    const systemTokens = this.estimateTokens(systemPrompt);
    const historyTokens = history.reduce((sum, msg) => sum + this.estimateTokens(msg), 0);

    // Add overhead for message formatting (~10 tokens per message)
    const formatOverhead = (history.length + 2) * 10;

    return queryTokens + systemTokens + historyTokens + formatOverhead;
  }

  /**
   * Calculate cost for given token usage
   */
  calculateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = this.MODEL_PRICING[model || this.currentModel] || this.MODEL_PRICING['gpt-4o-mini'];

    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

    return Number((inputCost + outputCost).toFixed(8));
  }

  /**
   * Track token usage for a query
   */
  trackUsage(
    inputTokens: number,
    outputTokens: number,
    userId?: string,
  ): TokenUsage {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = this.calculateCost(inputTokens, outputTokens);

    // Update aggregate metrics
    this.metrics.totalInputTokens += inputTokens;
    this.metrics.totalOutputTokens += outputTokens;
    this.metrics.totalTokens += totalTokens;
    this.metrics.totalCost += estimatedCost;
    this.metrics.queryCount++;
    this.metrics.avgTokensPerQuery = this.metrics.totalTokens / this.metrics.queryCount;
    this.metrics.avgCostPerQuery = this.metrics.totalCost / this.metrics.queryCount;

    // Update user budget if userId provided
    if (userId) {
      this.updateUserBudget(userId, totalTokens);
    }

    this.logger.debug(
      `Token usage: ${inputTokens} in + ${outputTokens} out = ${totalTokens} total ($${estimatedCost.toFixed(6)})`,
    );

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): TokenMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (call at start of new period)
   */
  resetMetrics(): void {
    this.metrics = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      queryCount: 0,
      avgTokensPerQuery: 0,
      avgCostPerQuery: 0,
      periodStart: new Date(),
    };
    this.logger.log('Token metrics reset');
  }

  /**
   * Check if user has budget remaining
   */
  checkBudget(userId: string): { allowed: boolean; reason?: string; remaining?: number } {
    const budget = this.getOrCreateBudget(userId);

    // Check and reset daily limit if needed
    const now = new Date();
    if (this.isDifferentDay(budget.lastResetDaily, now)) {
      budget.dailyUsed = 0;
      budget.lastResetDaily = now;
    }

    // Check and reset monthly limit if needed
    if (this.isDifferentMonth(budget.lastResetMonthly, now)) {
      budget.monthlyUsed = 0;
      budget.lastResetMonthly = now;
    }

    // Check daily limit
    if (budget.dailyUsed >= budget.dailyLimit) {
      return {
        allowed: false,
        reason: 'Daily token limit exceeded',
        remaining: 0,
      };
    }

    // Check monthly limit
    if (budget.monthlyUsed >= budget.monthlyLimit) {
      return {
        allowed: false,
        reason: 'Monthly token limit exceeded',
        remaining: 0,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(budget.dailyLimit - budget.dailyUsed, budget.monthlyLimit - budget.monthlyUsed),
    };
  }

  /**
   * Update user's token budget after usage
   */
  private updateUserBudget(userId: string, tokensUsed: number): void {
    const budget = this.getOrCreateBudget(userId);
    budget.dailyUsed += tokensUsed;
    budget.monthlyUsed += tokensUsed;
  }

  /**
   * Get or create budget for user
   */
  private getOrCreateBudget(userId: string): TokenBudget {
    let budget = this.userBudgets.get(userId);

    if (!budget) {
      budget = {
        userId,
        dailyLimit: this.DEFAULT_DAILY_LIMIT,
        monthlyLimit: this.DEFAULT_MONTHLY_LIMIT,
        dailyUsed: 0,
        monthlyUsed: 0,
        lastResetDaily: new Date(),
        lastResetMonthly: new Date(),
      };
      this.userBudgets.set(userId, budget);
    }

    return budget;
  }

  /**
   * Set custom budget limits for a user
   */
  setUserBudget(userId: string, dailyLimit: number, monthlyLimit: number): void {
    const budget = this.getOrCreateBudget(userId);
    budget.dailyLimit = dailyLimit;
    budget.monthlyLimit = monthlyLimit;
    this.logger.log(`Updated budget for user ${userId}: daily=${dailyLimit}, monthly=${monthlyLimit}`);
  }

  /**
   * Get user's current budget status
   */
  getUserBudget(userId: string): TokenBudget {
    return { ...this.getOrCreateBudget(userId) };
  }

  /**
   * Check if two dates are on different days
   */
  private isDifferentDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() !== date2.getFullYear() ||
      date1.getMonth() !== date2.getMonth() ||
      date1.getDate() !== date2.getDate()
    );
  }

  /**
   * Check if two dates are in different months
   */
  private isDifferentMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() !== date2.getFullYear() || date1.getMonth() !== date2.getMonth();
  }

  /**
   * Get model pricing information
   */
  getModelPricing(model?: string): ModelPricing {
    return this.MODEL_PRICING[model || this.currentModel] || this.MODEL_PRICING['gpt-4o-mini'];
  }

  /**
   * Set current model for pricing calculations
   */
  setCurrentModel(model: string): void {
    if (this.MODEL_PRICING[model]) {
      this.currentModel = model;
      this.logger.log(`Current model set to: ${model}`);
    } else {
      this.logger.warn(`Unknown model: ${model}, keeping current: ${this.currentModel}`);
    }
  }

  /**
   * Estimate monthly cost based on current usage rate
   */
  estimateMonthlyProjection(): { projectedCost: number; projectedTokens: number } {
    const daysSinceStart = Math.max(
      1,
      (Date.now() - this.metrics.periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const dailyRate = this.metrics.totalCost / daysSinceStart;
    const dailyTokens = this.metrics.totalTokens / daysSinceStart;

    return {
      projectedCost: Number((dailyRate * 30).toFixed(4)),
      projectedTokens: Math.round(dailyTokens * 30),
    };
  }

  /**
   * Get a cost breakdown report
   */
  getCostReport(): {
    period: string;
    totalCost: number;
    queryCount: number;
    avgCostPerQuery: number;
    inputTokens: number;
    outputTokens: number;
    projection: { monthly: number };
  } {
    const projection = this.estimateMonthlyProjection();

    return {
      period: `${this.metrics.periodStart.toISOString()} - now`,
      totalCost: Number(this.metrics.totalCost.toFixed(6)),
      queryCount: this.metrics.queryCount,
      avgCostPerQuery: Number(this.metrics.avgCostPerQuery.toFixed(6)),
      inputTokens: this.metrics.totalInputTokens,
      outputTokens: this.metrics.totalOutputTokens,
      projection: {
        monthly: projection.projectedCost,
      },
    };
  }
}
