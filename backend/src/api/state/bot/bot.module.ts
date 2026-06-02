import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { SupervisorAgent } from './agents/supervisor.agent';
import { PrismaModule } from '../../../core/database/prisma.module';
import { BotCacheService } from './services/cache.service';
import { BotTokenService } from './services/token.service';
import { BotThrottleGuard } from './guards/bot-throttle.guard';

/**
 * BotModule - AI-powered natural language query module for State Directorate
 *
 * This module provides:
 * - Natural language query processing for state-level analytics
 * - Dashboard and statistics queries
 * - Student, institution, and compliance inquiries
 * - Conversational AI interface with session support
 *
 * Cost Optimization Features:
 * - Strategy 1: Query caching with Redis (BotCacheService)
 * - Strategy 2: Optimized system prompt (~71% token reduction)
 * - Strategy 3: Smart memory management (6 messages vs 20)
 * - Strategy 5: Optimized tool responses
 * - Strategy 6: Rate limiting (BotThrottleGuard)
 * - Strategy 7: Batch processing support
 * - Token tracking and budget enforcement (BotTokenService)
 *
 * The module uses a SupervisorAgent pattern where the main agent
 * coordinates various tools and capabilities to answer user queries.
 *
 * @example
 * // Import in StateModule
 * import { BotModule } from './bot/bot.module';
 *
 * @Module({
 *   imports: [BotModule],
 *   // ...
 * })
 * export class StateModule {}
 */
@Module({
  imports: [PrismaModule],
  controllers: [BotController],
  providers: [
    BotService,
    SupervisorAgent,
    BotCacheService,
    BotTokenService,
    BotThrottleGuard,
  ],
  exports: [BotService, BotCacheService, BotTokenService],
})
export class BotModule {}
