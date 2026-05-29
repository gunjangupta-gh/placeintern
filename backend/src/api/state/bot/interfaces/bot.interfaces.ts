/**
 * Bot Interfaces
 * TypeScript interfaces for the AI Bot module
 */

import { Role } from '../../../../generated/prisma/client';

/**
 * Context information about the current query and user
 */
export interface QueryContext {
  /** Unique identifier for the user making the query */
  userId: string;
  /** User's role in the system */
  role: Role;
  /** Optional session ID for conversation continuity */
  sessionId?: string;
  /** Institution ID if the user is associated with one */
  institutionId?: string;
  /** Timestamp when the query was made */
  timestamp: Date;
  /** Additional metadata about the query */
  metadata?: Record<string, unknown>;
}

/**
 * Output from a tool execution
 */
export interface ToolOutput {
  /** Name of the tool that was executed */
  toolName: string;
  /** Whether the tool execution was successful */
  success: boolean;
  /** Data returned by the tool */
  data?: unknown;
  /** Error message if the tool execution failed */
  error?: string;
  /** Time taken to execute the tool in milliseconds */
  executionTimeMs?: number;
  /** Additional metadata about the execution */
  metadata?: Record<string, unknown>;
}

/**
 * Response from an agent
 */
export interface AgentResponse {
  /** Whether the agent successfully processed the query */
  success: boolean;
  /** The natural language answer to the query */
  answer: string;
  /** Structured data returned by the agent */
  data?: unknown;
  /** Suggested follow-up queries */
  suggestions?: string[];
  /** Tools that were used to generate the response */
  toolsUsed?: ToolOutput[];
  /** Error message if processing failed */
  error?: string;
  /** Response metadata */
  metadata?: AgentResponseMetadata;
}

/**
 * Metadata about the agent response
 */
export interface AgentResponseMetadata {
  /** Model used to generate the response */
  model?: string;
  /** Total processing time in milliseconds */
  processingTimeMs?: number;
  /** Number of tokens used (if applicable) */
  tokensUsed?: number;
  /** Confidence score of the response (0-1) */
  confidence?: number;
  /** Session ID for conversation continuity */
  sessionId?: string;
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * Query log entry for audit and analysis
 */
export interface QueryLogEntry {
  /** Unique identifier for the log entry */
  id: string;
  /** User ID who made the query */
  userId: string;
  /** The original query text */
  query: string;
  /** The response provided */
  response: AgentResponse;
  /** Context at the time of the query */
  context: QueryContext;
  /** When the query was made */
  createdAt: Date;
  /** Processing duration in milliseconds */
  durationMs: number;
}

/**
 * Conversation history entry
 */
export interface ConversationEntry {
  /** Role of the message sender (user or assistant) */
  role: 'user' | 'assistant';
  /** Content of the message */
  content: string;
  /** Timestamp of the message */
  timestamp: Date;
  /** Tools used for this entry (if assistant) */
  toolsUsed?: string[];
}

/**
 * Session data for maintaining conversation context
 */
export interface SessionData {
  /** Unique session identifier */
  sessionId: string;
  /** User ID associated with this session */
  userId: string;
  /** Conversation history */
  history: ConversationEntry[];
  /** When the session was created */
  createdAt: Date;
  /** When the session was last active */
  lastActiveAt: Date;
  /** Session-specific context data */
  context?: Record<string, unknown>;
}
