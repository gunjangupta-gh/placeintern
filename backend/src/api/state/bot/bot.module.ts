import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { SupervisorAgent } from './agents/supervisor.agent';
import { PrismaModule } from '../../../core/database/prisma.module';

/**
 * BotModule - AI-powered natural language query module for State Directorate
 *
 * This module provides:
 * - Natural language query processing for state-level analytics
 * - Dashboard and statistics queries
 * - Student, institution, and compliance inquiries
 * - Conversational AI interface with session support
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
  providers: [BotService, SupervisorAgent],
  exports: [BotService],
})
export class BotModule {}
