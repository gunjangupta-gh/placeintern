# State Directorate AI Bot - Implementation Plan

## Overview

Build an AI-powered query bot for State Directorate users to easily access data counts, breakdowns, and compliance information using natural language queries.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USER QUERY                                   │
│           "How many students completed internships this month?"         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BOT CONTROLLER                                 │
│                     POST /api/state/bot/query                           │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BOT SERVICE                                   │
│                    (Orchestrates the flow)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SUPERVISOR AGENT                                 │
│                  (LangChain AgentExecutor)                              │
│                                                                         │
│  • Powered by GPT-4o-mini / Claude Haiku                               │
│  • Understands user intent from natural language                        │
│  • Selects appropriate tool(s) to call                                  │
│  • Formats response in user-friendly language                           │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│   STUDENT TOOLS   │  │    VISIT TOOLS    │  │   REPORT TOOLS    │
├───────────────────┤  ├───────────────────┤  ├───────────────────┤
│ • student_count   │  │ • visit_count     │  │ • report_count    │
│ • student_breakdown│ │ • visit_breakdown │  │ • report_breakdown│
│ • student_list    │  │ • pending_visits  │  │ • overdue_reports │
└───────────────────┘  └───────────────────┘  └───────────────────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRISMA DATABASE                                  │
│              (Students, Visits, Reports, Institutions...)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component        | Technology                          |
|------------------|-------------------------------------|
| Backend Framework| NestJS (existing)                   |
| AI Framework     | LangChain.js                        |
| LLM Provider     | OpenAI GPT-4o-mini (primary)        |
| Database         | PostgreSQL + Prisma (existing)      |
| Validation       | Zod (for tool schemas)              |
| Memory           | In-memory (session-based)           |

---

## File Structure

```
backend/src/api/state/bot/
│
├── bot.module.ts                      # NestJS module definition
├── bot.controller.ts                  # REST API endpoint
├── bot.service.ts                     # Main orchestrator service
│
├── agents/
│   └── supervisor.agent.ts            # LangChain agent setup
│
├── tools/
│   ├── index.ts                       # Export all tools
│   ├── base.tool.ts                   # Abstract base tool class
│   │
│   ├── student/
│   │   ├── student-count.tool.ts      # Count students
│   │   ├── student-breakdown.tool.ts  # Breakdown by branch/institution
│   │   └── student-list.tool.ts       # List top N students
│   │
│   ├── visit/
│   │   ├── visit-count.tool.ts        # Count faculty visits
│   │   ├── visit-breakdown.tool.ts    # Breakdown by type/institution
│   │   └── pending-visits.tool.ts     # Pending/overdue visits
│   │
│   ├── report/
│   │   ├── report-count.tool.ts       # Count monthly reports
│   │   ├── report-breakdown.tool.ts   # Breakdown by status
│   │   └── overdue-reports.tool.ts    # Overdue reports list
│   │
│   ├── institution/
│   │   ├── institution-count.tool.ts  # Count institutions
│   │   ├── institution-breakdown.tool.ts
│   │   └── institution-performance.tool.ts
│   │
│   ├── staff/
│   │   ├── staff-count.tool.ts        # Count staff/faculty
│   │   └── mentor-stats.tool.ts       # Mentor workload stats
│   │
│   ├── compliance/
│   │   ├── compliance-summary.tool.ts # Overall compliance
│   │   └── compliance-alerts.tool.ts  # Critical alerts
│   │
│   └── training/
│       ├── training-count.tool.ts     # Training counts
│       └── training-stats.tool.ts     # Training statistics
│
├── prompts/
│   └── system.prompt.ts               # System prompt for LLM
│
├── dto/
│   ├── bot-query.dto.ts               # Request validation
│   └── bot-response.dto.ts            # Response structure
│
├── interfaces/
│   └── bot.interfaces.ts              # TypeScript interfaces
│
└── utils/
    └── institution-resolver.util.ts   # Fuzzy match institution names
```

---

## Implementation Phases

### Phase 1: Core Foundation

**Objective:** Set up the basic infrastructure and get a working bot with one tool.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 1.1 | Install dependencies | `langchain`, `@langchain/openai`, `zod` |
| 1.2 | Create `bot.module.ts` | NestJS module with providers |
| 1.3 | Create `bot.controller.ts` | POST `/state/bot/query` endpoint |
| 1.4 | Create `bot.service.ts` | Main service orchestrator |
| 1.5 | Create `supervisor.agent.ts` | LangChain agent setup |
| 1.6 | Create `system.prompt.ts` | System prompt for the LLM |
| 1.7 | Create `base.tool.ts` | Abstract base class for tools |
| 1.8 | Create DTOs | Request/Response validation |
| 1.9 | Create `student-count.tool.ts` | First working tool |
| 1.10 | Integration test | Test end-to-end flow |

#### Deliverables:
- Working bot that can answer "How many students?" queries
- Basic error handling
- API endpoint accessible

---

### Phase 2: Student Tools

**Objective:** Complete all student-related query capabilities.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 2.1 | `student-count.tool.ts` | Count with filters (institution, branch, status, internship phase, mentor) |
| 2.2 | `student-breakdown.tool.ts` | Group by institution, branch, status, internship phase |
| 2.3 | `student-list.tool.ts` | List students with specific criteria |
| 2.4 | `institution-resolver.util.ts` | Fuzzy match institution names to IDs |
| 2.5 | Test all student queries | Verify various query patterns |

#### Supported Queries After Phase 2:
- "How many students are there?"
- "Total students in Government Polytechnic Amritsar?"
- "Students in Computer Science branch?"
- "How many students have completed internships?"
- "Students without mentors assigned?"
- "Active vs inactive students?"
- "Branch-wise student breakdown?"
- "Institution-wise student count?"

---

### Phase 3: Faculty Visit Tools

**Objective:** Enable faculty visit related queries.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 3.1 | `visit-count.tool.ts` | Count visits with filters (type, month, institution, faculty) |
| 3.2 | `visit-breakdown.tool.ts` | Group by type, institution, month |
| 3.3 | `pending-visits.tool.ts` | Get pending/overdue visits |
| 3.4 | Test all visit queries | Verify various query patterns |

#### Supported Queries After Phase 3:
- "How many faculty visits this month?"
- "Physical vs virtual visits breakdown?"
- "Visits completed by Government Polytechnic?"
- "Pending visits for May 2026?"
- "Which institutions have overdue visits?"
- "Visit compliance rate?"

---

### Phase 4: Monthly Report Tools

**Objective:** Enable monthly report related queries.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 4.1 | `report-count.tool.ts` | Count reports with filters (status, month, institution) |
| 4.2 | `report-breakdown.tool.ts` | Group by status, institution, month |
| 4.3 | `overdue-reports.tool.ts` | Get overdue/late reports |
| 4.4 | Test all report queries | Verify various query patterns |

#### Supported Queries After Phase 4:
- "How many reports submitted this month?"
- "Pending reports count?"
- "Overdue reports?"
- "Reports approved vs rejected?"
- "Institution-wise report submission?"
- "Report compliance rate?"

---

### Phase 5: Institution & Staff Tools

**Objective:** Enable institution and staff/faculty queries.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 5.1 | `institution-count.tool.ts` | Count institutions with filters |
| 5.2 | `institution-breakdown.tool.ts` | Group by type |
| 5.3 | `institution-performance.tool.ts` | Top/bottom performers |
| 5.4 | `staff-count.tool.ts` | Count staff with filters |
| 5.5 | `mentor-stats.tool.ts` | Mentor workload statistics |
| 5.6 | Test all queries | Verify various query patterns |

#### Supported Queries After Phase 5:
- "How many institutions?"
- "Polytechnics vs Engineering colleges?"
- "Top 5 performing institutions?"
- "Lowest compliance institutions?"
- "Total faculty count?"
- "Faculty by designation?"
- "Average students per mentor?"
- "Mentors with most students?"

---

### Phase 6: Compliance & Training Tools

**Objective:** Enable compliance monitoring and training queries.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 6.1 | `compliance-summary.tool.ts` | Overall compliance statistics |
| 6.2 | `compliance-alerts.tool.ts` | Critical compliance alerts |
| 6.3 | `training-count.tool.ts` | Training program counts |
| 6.4 | `training-stats.tool.ts` | Training participation stats |
| 6.5 | Test all queries | Verify various query patterns |

#### Supported Queries After Phase 6:
- "Overall compliance rate?"
- "Critical compliance alerts?"
- "Non-compliant institutions?"
- "Upcoming trainings?"
- "Faculty trained this month?"
- "Certificates issued?"

---

### Phase 7: Enhancements & Polish

**Objective:** Add advanced features and polish the bot.

#### Tasks:

| # | Task | Description |
|---|------|-------------|
| 7.1 | Conversation memory | Multi-turn conversation support |
| 7.2 | Query caching | Cache frequent queries (5 min TTL) |
| 7.3 | Query logging | Log all queries for analytics |
| 7.4 | Follow-up suggestions | Suggest related queries |
| 7.5 | Error handling | Graceful error messages |
| 7.6 | Rate limiting | Prevent abuse |
| 7.7 | Response formatting | Better number formatting, tables |

---

## Tool Specifications

### Complete Tool List (20 Tools)

| # | Tool Name | Category | Input Schema | Output |
|---|-----------|----------|--------------|--------|
| 1 | `student_count` | Student | institutionName?, branchCode?, isActive?, internshipPhase?, hasMentor? | count |
| 2 | `student_breakdown` | Student | groupBy (institution/branch/status/phase), filters? | breakdown[] |
| 3 | `student_list` | Student | filters?, limit?, orderBy? | students[] |
| 4 | `visit_count` | Visit | institutionName?, visitType?, month?, year?, status? | count |
| 5 | `visit_breakdown` | Visit | groupBy (type/institution/month), filters? | breakdown[] |
| 6 | `pending_visits` | Visit | institutionName?, month?, year? | pendingVisits[] |
| 7 | `report_count` | Report | institutionName?, status?, month?, year? | count |
| 8 | `report_breakdown` | Report | groupBy (status/institution/month), filters? | breakdown[] |
| 9 | `overdue_reports` | Report | institutionName?, limit? | overdueReports[] |
| 10 | `institution_count` | Institution | type?, isActive? | count |
| 11 | `institution_breakdown` | Institution | groupBy (type) | breakdown[] |
| 12 | `institution_performance` | Institution | metric?, order (top/bottom)?, limit? | institutions[] |
| 13 | `staff_count` | Staff | institutionName?, designation?, role? | count |
| 14 | `mentor_stats` | Staff | institutionName? | stats |
| 15 | `compliance_summary` | Compliance | institutionName?, month?, year? | summary |
| 16 | `compliance_alerts` | Compliance | severity?, limit? | alerts[] |
| 17 | `training_count` | Training | status?, deliveryMode? | count |
| 18 | `training_stats` | Training | month?, year? | stats |
| 19 | `company_stats` | Company | limit? | stats |
| 20 | `comparison` | Analytics | metric, period (mom/yoy) | comparison |

---

## API Specification

### Endpoint

```
POST /api/state/bot/query
```

### Request

```typescript
{
  "query": string,           // Natural language query (required)
  "sessionId"?: string       // For conversation continuity (optional)
}
```

### Response

```typescript
{
  "success": boolean,
  "answer": string,          // Natural language response
  "data": {
    "type": "count" | "breakdown" | "list" | "summary",
    "value": number | object | array,
    "filters": object        // Filters that were applied
  },
  "suggestions": string[],   // Follow-up query suggestions
  "metadata": {
    "toolsUsed": string[],
    "processingTimeMs": number,
    "queryId": string
  }
}
```

### Example Request/Response

**Request:**
```json
{
  "query": "How many students completed internships in Government Polytechnic?",
  "sessionId": "session-123"
}
```

**Response:**
```json
{
  "success": true,
  "answer": "There are 234 students who have completed their internships in Government Polytechnic Amritsar.",
  "data": {
    "type": "count",
    "value": 234,
    "filters": {
      "institutionName": "Government Polytechnic",
      "internshipPhase": "COMPLETED"
    }
  },
  "suggestions": [
    "Show branch-wise breakdown",
    "Compare with last month",
    "Show active internships"
  ],
  "metadata": {
    "toolsUsed": ["student_count"],
    "processingTimeMs": 1250,
    "queryId": "q-abc123"
  }
}
```

---

## System Prompt

```typescript
export const SYSTEM_PROMPT = `You are an AI assistant for the State Directorate of Technical Education, Punjab.
You help state officials query data about students, institutions, faculty visits, monthly reports, and compliance.

## YOUR ROLE
- Answer questions about student counts, internship status, compliance rates
- Provide breakdowns by institution, branch, or other dimensions
- Identify pending items and compliance issues
- Help track faculty visits and monthly reports

## AVAILABLE DATA
- Students: count, status, branch, institution, internship phase, mentor assignment
- Faculty Visits: count, type (physical/virtual/telephonic), status, compliance
- Monthly Reports: count, status (submitted/approved/rejected), overdue
- Institutions: count, type, performance metrics
- Staff/Faculty: count, designation, mentor workload
- Compliance: submission rates, visit completion rates, alerts
- Training: programs, participation, certificates

## GUIDELINES
1. Use the appropriate tool to fetch accurate data
2. If user mentions an institution name, use it as a filter
3. If month/year not specified, assume current month ({currentMonth}/{currentYear})
4. Always provide clear, concise answers with specific numbers
5. If data is zero or empty, say so clearly
6. Suggest 2-3 relevant follow-up queries

## RESPONSE FORMAT
- Lead with the direct answer and number
- Keep responses brief (2-3 sentences)
- Use bullet points for breakdowns
- Format large numbers with commas (1,234)

## EXAMPLE RESPONSES
User: "How many students are there?"
Assistant: "There are 12,456 students across all institutions."

User: "Students in Computer Science?"
Assistant: "There are 3,245 students in the Computer Science branch across all institutions."

User: "Pending visits this month?"
Assistant: "There are 45 pending faculty visits for May 2026. Government Polytechnic Amritsar has 12 pending, the highest among all institutions."

## CURRENT CONTEXT
- Current Month: {currentMonth}
- Current Year: {currentYear}
- User Role: State Directorate Official
`;
```

---

## Sample Tool Implementation

### student-count.tool.ts

```typescript
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { PrismaService } from "@/prisma/prisma.service";

export class StudentCountTool extends StructuredTool {
  name = "student_count";
  description = `Count students with optional filters. Use this tool when user asks:
    - "How many students..."
    - "Total students..."
    - "Student count..."
    - "Number of students..."`;

  schema = z.object({
    institutionName: z
      .string()
      .optional()
      .describe("Institution name to filter (partial match supported)"),
    branchCode: z
      .string()
      .optional()
      .describe("Branch code like CS, ME, EE, CE"),
    isActive: z
      .boolean()
      .optional()
      .describe("Filter by active (true) or inactive (false) status"),
    internshipPhase: z
      .enum(["NOT_STARTED", "ACTIVE", "COMPLETED", "TERMINATED"])
      .optional()
      .describe("Filter by internship phase"),
    hasMentor: z
      .boolean()
      .optional()
      .describe("Filter by mentor assignment (true = has mentor)"),
  });

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      const where: any = {};

      // Build institution filter
      if (input.institutionName) {
        where.user = {
          institution: {
            name: { contains: input.institutionName, mode: "insensitive" },
          },
        };
      }

      // Build active status filter
      if (input.isActive !== undefined) {
        where.user = {
          ...where.user,
          isActive: input.isActive,
        };
      }

      // Build branch filter
      if (input.branchCode) {
        where.user = {
          ...where.user,
          branch: { code: { equals: input.branchCode, mode: "insensitive" } },
        };
      }

      // Build mentor filter
      if (input.hasMentor !== undefined) {
        where.mentorAssignments = input.hasMentor
          ? { some: { isActive: true } }
          : { none: {} };
      }

      // Build internship phase filter
      if (input.internshipPhase) {
        where.internshipApplications = {
          some: { internshipPhase: input.internshipPhase },
        };
      }

      const count = await this.prisma.student.count({ where });

      // Build description of applied filters
      const filterDescriptions: string[] = [];
      if (input.institutionName)
        filterDescriptions.push(`institution: ${input.institutionName}`);
      if (input.branchCode)
        filterDescriptions.push(`branch: ${input.branchCode}`);
      if (input.isActive !== undefined)
        filterDescriptions.push(`status: ${input.isActive ? "active" : "inactive"}`);
      if (input.internshipPhase)
        filterDescriptions.push(`internship phase: ${input.internshipPhase}`);
      if (input.hasMentor !== undefined)
        filterDescriptions.push(`mentor: ${input.hasMentor ? "assigned" : "not assigned"}`);

      return JSON.stringify({
        success: true,
        count,
        filtersApplied: filterDescriptions.join(", ") || "none",
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: "Failed to count students",
        details: error.message,
      });
    }
  }
}
```

---

## Supervisor Agent Setup

### supervisor.agent.ts

```typescript
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { BufferMemory } from "langchain/memory";
import { PrismaService } from "@/prisma/prisma.service";
import { SYSTEM_PROMPT } from "../prompts/system.prompt";
import { getAllTools } from "../tools";

@Injectable()
export class SupervisorAgent implements OnModuleInit {
  private executor: AgentExecutor;
  private memoryStore: Map<string, BufferMemory> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize() {
    // Initialize LLM
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Get all tools
    const tools = getAllTools(this.prisma);

    // Create prompt with system message and placeholders
    const currentDate = new Date();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        SYSTEM_PROMPT
          .replace("{currentMonth}", currentDate.toLocaleString("default", { month: "long" }))
          .replace("{currentYear}", currentDate.getFullYear().toString()),
      ],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // Create agent
    const agent = createToolCallingAgent({ llm, tools, prompt });

    // Create executor
    this.executor = new AgentExecutor({
      agent,
      tools,
      verbose: process.env.NODE_ENV === "development",
      maxIterations: 5,
      returnIntermediateSteps: true,
    });
  }

  async query(
    input: string,
    sessionId?: string
  ): Promise<{
    answer: string;
    toolsUsed: string[];
    processingTimeMs: number;
  }> {
    const startTime = Date.now();

    // Get or create memory for session
    let memory = this.memoryStore.get(sessionId);
    if (!memory && sessionId) {
      memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
      });
      this.memoryStore.set(sessionId, memory);
    }

    // Get chat history
    const chatHistory = memory
      ? (await memory.loadMemoryVariables({})).chat_history || []
      : [];

    // Execute agent
    const result = await this.executor.invoke({
      input,
      chat_history: chatHistory,
    });

    // Save to memory
    if (memory) {
      await memory.saveContext({ input }, { output: result.output });
    }

    // Extract tools used
    const toolsUsed = (result.intermediateSteps || []).map(
      (step: any) => step.action.tool
    );

    return {
      answer: result.output,
      toolsUsed: [...new Set(toolsUsed)],
      processingTimeMs: Date.now() - startTime,
    };
  }

  clearSession(sessionId: string) {
    this.memoryStore.delete(sessionId);
  }
}
```

---

## Error Handling

### Common Errors & Responses

| Error Type | Response |
|------------|----------|
| No tool matched | "I couldn't understand your query. Try asking about students, visits, reports, or institutions." |
| Database error | "I encountered an error fetching the data. Please try again." |
| Timeout | "The query took too long. Please try a simpler query." |
| Rate limited | "Too many requests. Please wait a moment." |
| Invalid filter | "I couldn't find an institution named 'X'. Did you mean 'Y'?" |

---

## Security Considerations

1. **Role-based access**: Only STATE_DIRECTORATE role can access the bot
2. **Rate limiting**: Max 60 queries per minute per user
3. **Query logging**: All queries logged for audit
4. **No write operations**: Bot can only read data, never modify
5. **Sensitive data**: No PII in responses (use counts/aggregates)
6. **API key security**: LLM API keys in environment variables

---

## Cost Estimation

| Model | Cost per 1K tokens | Avg tokens/query | Cost per query |
|-------|-------------------|------------------|----------------|
| GPT-4o-mini | $0.00015 (input) / $0.0006 (output) | ~1000 | ~$0.0004 |
| Claude Haiku | $0.00025 (input) / $0.00125 (output) | ~1000 | ~$0.0008 |

**Monthly estimate (3000 queries):** ~$1.20 - $2.40

---

## Testing Strategy

### Unit Tests
- Each tool tested independently with mock Prisma
- Schema validation tests
- Edge cases (empty results, large numbers)

### Integration Tests
- End-to-end flow with test database
- Multiple query patterns per tool
- Session/memory tests

### Sample Test Queries

```typescript
const testQueries = [
  // Student queries
  "How many students are there?",
  "Total students in Government Polytechnic?",
  "Students in Computer Science branch?",
  "How many students completed internships?",
  "Students without mentors?",

  // Visit queries
  "Faculty visits this month?",
  "Physical vs virtual visits?",
  "Pending visits?",

  // Report queries
  "Reports submitted this month?",
  "Overdue reports?",
  "Approved vs rejected reports?",

  // Institution queries
  "How many institutions?",
  "Top performing institutions?",

  // Compliance queries
  "Overall compliance rate?",
  "Critical alerts?",
];
```

---

## Dependencies

```json
{
  "dependencies": {
    "langchain": "^0.3.x",
    "@langchain/openai": "^0.3.x",
    "@langchain/core": "^0.3.x",
    "zod": "^3.x"
  }
}
```

---

## Environment Variables

```env
# LLM Configuration
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini

# Bot Configuration
BOT_MAX_ITERATIONS=5
BOT_TIMEOUT_MS=30000
BOT_RATE_LIMIT_PER_MINUTE=60
BOT_MEMORY_TTL_MINUTES=30
```

---

## Summary

This plan outlines a **7-phase implementation** to build a LangChain.js powered AI bot with:

- **20 specialized tools** covering students, visits, reports, institutions, staff, compliance, and training
- **Supervisor agent** that understands natural language and routes to appropriate tools
- **Session-based memory** for multi-turn conversations
- **Robust error handling** and security measures
- **Cost-effective** using GPT-4o-mini (~$1-2/month for 3000 queries)

The bot will enable State Directorate officials to query data using simple natural language instead of navigating complex dashboards.
