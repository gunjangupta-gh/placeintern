# AI Model Pricing, Comparison & Data Privacy Guide

> **Document Version:** 3.0
> **Last Updated:** June 2026
> **Purpose:** Comprehensive guide for selecting AI models based on cost, quality, and data privacy

---

## Table of Contents

1. [Quick Reference: Model Pricing](#1-quick-reference-model-pricing)
2. [Detailed Model Comparison](#2-detailed-model-comparison)
3. [Cost Calculation Examples](#3-cost-calculation-examples)
4. [Free Tier Providers](#4-free-tier-providers)
5. [Data Privacy & Training Policies](#5-data-privacy--training-policies)
6. [Model Selection Guide](#6-model-selection-guide)
7. [Provider API Examples](#7-provider-api-examples)

---

## 1. Quick Reference: Model Pricing

### Tier 1: Premium Models (Best Quality)

| Provider | Model | Input $/1M tokens | Output $/1M tokens | Context Window | Best For |
|----------|-------|-------------------|-------------------|----------------|----------|
| **Anthropic** | Claude Opus 4 | $15.00 | $75.00 | 200K | Complex reasoning, analysis |
| **Anthropic** | Claude Sonnet 4 | $3.00 | $15.00 | 200K | Balanced quality/cost |
| **OpenAI** | GPT-4.5 | $75.00 | $150.00 | 128K | Research, complex tasks |
| **OpenAI** | GPT-4o | $2.50 | $10.00 | 128K | Production standard |
| **Google** | Gemini 2.0 Ultra | $7.00 | $21.00 | 2M | Huge context tasks |
| **Google** | Gemini 2.0 Pro | $1.25 | $5.00 | 2M | Long documents |

### Tier 2: Cost-Optimized Models (Best Value)

| Provider | Model | Input $/1M tokens | Output $/1M tokens | Context Window | Best For |
|----------|-------|-------------------|-------------------|----------------|----------|
| **OpenAI** | GPT-4o-mini | $0.15 | $0.60 | 128K | **Chatbots, tools** |
| **Anthropic** | Claude Haiku 3.5 | $0.80 | $4.00 | 200K | Fast responses |
| **Google** | Gemini 1.5 Flash | $0.075 | $0.30 | 1M | Budget apps |
| **Google** | Gemini 2.0 Flash | $0.10 | $0.40 | 1M | Fast + cheap |
| **Mistral** | Mistral Small | $0.20 | $0.60 | 128K | EU compliance |
| **Mistral** | Mistral Medium | $2.70 | $8.10 | 128K | Quality + EU |

### Tier 3: Budget Models (Lowest Cost)

| Provider | Model | Input $/1M tokens | Output $/1M tokens | Context Window | Best For |
|----------|-------|-------------------|-------------------|----------------|----------|
| **DeepSeek** | DeepSeek V3 | $0.27 | $1.10 | 64K | Extreme budget |
| **DeepSeek** | DeepSeek R1 | $0.55 | $2.19 | 128K | Reasoning tasks |
| **Groq** | Llama 3.3 70B | $0.59 | $0.79 | 128K | Speed + open source |
| **Together** | Llama 3.1 405B | $3.50 | $3.50 | 128K | Open source quality |
| **Fireworks** | Llama 3.1 70B | $0.90 | $0.90 | 128K | Fast inference |

### OpenRouter Unified Pricing

[OpenRouter](https://openrouter.ai) provides access to 300+ models through one API:

| Model (via OpenRouter) | Input $/1M | Output $/1M | Notes |
|------------------------|------------|-------------|-------|
| claude-sonnet-4 | $3.00 | $15.00 | Same as direct |
| gpt-4o-mini | $0.15 | $0.60 | Same as direct |
| deepseek/deepseek-chat | $0.14 | $0.28 | Often cheaper |
| meta-llama/llama-3.3-70b | $0.40 | $0.40 | Competitive |
| google/gemini-flash-1.5 | $0.075 | $0.30 | Same as direct |
| mistral/mistral-large | $2.00 | $6.00 | Slightly cheaper |

---

## 2. Detailed Model Comparison

### OpenAI Models

#### GPT-4o-mini ⭐ RECOMMENDED FOR CHATBOTS

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.15 / $0.60 per 1M tokens |
| **Context** | 128K tokens |
| **Speed** | ~100 tokens/second |
| **Quality** | 90% of GPT-4o quality |
| **Tool Use** | Excellent |
| **Release** | July 2024 |

**Pros:**
- Best price-to-performance ratio
- Excellent function/tool calling
- Fast response times
- Strong instruction following
- 128K context window

**Cons:**
- Less capable than GPT-4o for complex reasoning
- May hallucinate on niche topics
- No image generation

**Best For:** Production chatbots, customer service, data analysis tools

**Example Cost:**
```
Query: "How many students are enrolled?"
Input: ~1,200 tokens × $0.00015 = $0.00018
Output: ~150 tokens × $0.0006 = $0.00009
Total: $0.00027 per query

Monthly (10,000 queries): ~$2.70
```

---

#### GPT-4o

| Attribute | Details |
|-----------|---------|
| **Pricing** | $2.50 / $10.00 per 1M tokens |
| **Context** | 128K tokens |
| **Speed** | ~80 tokens/second |
| **Quality** | State-of-the-art multimodal |
| **Tool Use** | Excellent |

**Pros:**
- Multimodal (text, image, audio)
- Best-in-class reasoning
- Excellent at complex tasks
- Strong code generation

**Cons:**
- 16x more expensive than GPT-4o-mini
- Overkill for simple tasks

**Best For:** Complex analysis, multimodal apps, code generation

**Example Cost:**
```
Complex analysis query:
Input: ~2,000 tokens × $0.0025 = $0.005
Output: ~500 tokens × $0.01 = $0.005
Total: $0.01 per query

Monthly (1,000 queries): ~$10.00
```

---

### Anthropic Models

#### Claude Sonnet 4

| Attribute | Details |
|-----------|---------|
| **Pricing** | $3.00 / $15.00 per 1M tokens |
| **Context** | 200K tokens |
| **Speed** | ~80 tokens/second |
| **Quality** | Excellent reasoning |
| **Tool Use** | Very good |

**Pros:**
- Excellent at nuanced reasoning
- Strong safety and honesty
- 200K context (larger than GPT-4o)
- Great for writing and analysis
- Constitutional AI approach

**Cons:**
- More expensive than GPT-4o-mini
- Sometimes overly cautious
- Slower than some competitors

**Best For:** Analysis, writing, research, education

**Example Cost:**
```
Research query with long context:
Input: ~5,000 tokens × $0.003 = $0.015
Output: ~1,000 tokens × $0.015 = $0.015
Total: $0.03 per query

Monthly (500 queries): ~$15.00
```

---

#### Claude Haiku 3.5

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.80 / $4.00 per 1M tokens |
| **Context** | 200K tokens |
| **Speed** | ~150 tokens/second |
| **Quality** | Good for simple tasks |
| **Tool Use** | Good |

**Pros:**
- Fast responses
- 200K context window
- Good for straightforward tasks
- Cheaper than Sonnet

**Cons:**
- Less capable than Sonnet/Opus
- May struggle with complex reasoning
- Higher cost than GPT-4o-mini

**Best For:** Quick responses, simple Q&A, high-volume applications

---

### Google Models

#### Gemini 1.5 Flash ⭐ CHEAPEST OPTION

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.075 / $0.30 per 1M tokens |
| **Context** | 1M tokens |
| **Speed** | ~150 tokens/second |
| **Quality** | Good |
| **Tool Use** | Good |

**Pros:**
- Extremely cheap
- Massive 1M token context
- Fast responses
- Good multimodal support

**Cons:**
- Quality below GPT-4o-mini
- Google's data policies (check terms)
- May have availability issues

**Best For:** Budget applications, long document analysis

**Example Cost:**
```
Simple query:
Input: ~1,200 tokens × $0.000075 = $0.00009
Output: ~150 tokens × $0.0003 = $0.000045
Total: $0.000135 per query

Monthly (10,000 queries): ~$1.35
```

---

#### Gemini 2.0 Pro

| Attribute | Details |
|-----------|---------|
| **Pricing** | $1.25 / $5.00 per 1M tokens |
| **Context** | 2M tokens |
| **Speed** | ~100 tokens/second |
| **Quality** | Very good |
| **Tool Use** | Very good |

**Pros:**
- 2M token context (largest available)
- Good quality
- Multimodal capabilities
- Reasonable pricing

**Cons:**
- Data usage policies vary by tier
- Less established than OpenAI/Anthropic

**Best For:** Extremely long documents, codebase analysis

---

### DeepSeek Models

#### DeepSeek V3

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.27 / $1.10 per 1M tokens |
| **Context** | 64K tokens |
| **Speed** | ~60 tokens/second |
| **Quality** | Surprisingly good |
| **Tool Use** | Moderate |

**Pros:**
- Extremely cheap
- Competitive quality for price
- Good at coding tasks
- Open weights available

**Cons:**
- Chinese company (data concerns)
- Smaller context than competitors
- Less reliable availability
- Unclear data policies

**Best For:** Cost-sensitive applications (with caution)

---

#### DeepSeek R1 (Reasoning Model)

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.55 / $2.19 per 1M tokens |
| **Context** | 128K tokens |
| **Speed** | ~40 tokens/second (thinking) |
| **Quality** | Excellent reasoning |
| **Tool Use** | Good |

**Pros:**
- Strong reasoning capabilities
- Chain-of-thought built-in
- Very competitive pricing
- Open weights available

**Cons:**
- Slower due to reasoning steps
- Chinese company concerns
- Can be verbose

**Best For:** Math, logic, complex problem-solving (budget)

---

### Mistral Models

#### Mistral Large

| Attribute | Details |
|-----------|---------|
| **Pricing** | $2.00 / $6.00 per 1M tokens |
| **Context** | 128K tokens |
| **Speed** | ~80 tokens/second |
| **Quality** | Very good |
| **Tool Use** | Excellent |

**Pros:**
- European company (GDPR native)
- Strong multilingual support
- Good function calling
- Self-hosting option

**Cons:**
- Less capable than Claude/GPT-4
- Smaller ecosystem

**Best For:** EU compliance, multilingual apps

---

#### Mistral Small

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.20 / $0.60 per 1M tokens |
| **Context** | 128K tokens |
| **Speed** | ~120 tokens/second |
| **Quality** | Good |
| **Tool Use** | Good |

**Pros:**
- EU data residency
- Competitive pricing
- Self-hosting available
- Fast responses

**Cons:**
- Lower quality than Large
- Limited compared to GPT-4o-mini

**Best For:** EU compliance with budget constraints

---

### Open Source Models (via Groq/Together/Fireworks)

#### Llama 3.3 70B

| Attribute | Details |
|-----------|---------|
| **Pricing** | $0.59 / $0.79 per 1M tokens (Groq) |
| **Context** | 128K tokens |
| **Speed** | 300+ tokens/second (Groq) |
| **Quality** | Very good |
| **Tool Use** | Good |

**Pros:**
- Open source (can self-host)
- Extremely fast on Groq
- No data training concerns (you control)
- Competitive quality

**Cons:**
- Requires inference provider
- Self-hosting needs resources
- Less refined than proprietary models

**Best For:** Speed-critical apps, self-hosting, privacy

---

## 3. Cost Calculation Examples

### Example 1: Simple Chatbot Query

**Scenario:** User asks "How many students are enrolled?"

| Model | Input Cost | Output Cost | Total | Monthly (10K) |
|-------|------------|-------------|-------|---------------|
| GPT-4o-mini | $0.00018 | $0.00009 | **$0.00027** | $2.70 |
| Gemini Flash | $0.00009 | $0.000045 | **$0.000135** | $1.35 |
| Claude Haiku | $0.00096 | $0.0006 | **$0.00156** | $15.60 |
| DeepSeek V3 | $0.00032 | $0.000165 | **$0.000485** | $4.85 |

**Winner:** Gemini Flash (cheapest), GPT-4o-mini (best value)

---

### Example 2: Complex Analysis Query

**Scenario:** "Analyze compliance trends across all institutions for the past 6 months and identify patterns"

| Model | Input Cost | Output Cost | Total | Monthly (1K) |
|-------|------------|-------------|-------|--------------|
| GPT-4o | $0.0075 | $0.015 | **$0.0225** | $22.50 |
| Claude Sonnet | $0.009 | $0.0225 | **$0.0315** | $31.50 |
| GPT-4o-mini | $0.00045 | $0.0009 | **$0.00135** | $1.35 |
| Gemini Pro | $0.00375 | $0.0075 | **$0.01125** | $11.25 |

**Winner:** GPT-4o-mini if quality sufficient, GPT-4o for best quality

---

### Example 3: Long Document Processing

**Scenario:** Processing a 50,000 token document

| Model | Input Cost | Output Cost | Total | Notes |
|-------|------------|-------------|-------|-------|
| Gemini Flash | $0.00375 | $0.003 | **$0.00675** | 1M context |
| GPT-4o-mini | $0.0075 | $0.006 | **$0.0135** | 128K context |
| Claude Haiku | $0.04 | $0.04 | **$0.08** | 200K context |
| Gemini Pro | $0.0625 | $0.05 | **$0.1125** | 2M context |

**Winner:** Gemini Flash for long documents

---

### Example 4: High-Volume Production (100K queries/month)

| Model | Monthly Cost | Annual Cost | Quality |
|-------|--------------|-------------|---------|
| Gemini Flash | **$13.50** | $162 | Good |
| GPT-4o-mini | **$27.00** | $324 | Very Good |
| DeepSeek V3 | **$48.50** | $582 | Good |
| Claude Haiku | **$156.00** | $1,872 | Good |
| GPT-4o | **$225.00** | $2,700 | Excellent |

---

## 4. Free Tier Providers

### Comparison Table

| Provider | Free Allowance | Rate Limits | Models Available | Best For |
|----------|----------------|-------------|------------------|----------|
| **Groq** | 1,000 req/day | 30 RPM, 6K TPM | Llama 3.3, Mixtral | Speed testing |
| **Mistral** | 1B tokens/month | 1-2 RPS | All Mistral models | Volume testing |
| **Google** | 1,500 req/day | 15 RPM | Gemini Flash/Pro | Prototyping |
| **Cerebras** | 1M tokens/day | 30 RPM | Llama 3.1 70B | Development |
| **OpenRouter** | ~30 free models | 20 RPM, 200/day | Various | Exploration |
| **Together** | $1 free credit | - | Llama, Mistral | Trial |
| **Fireworks** | 600 RPM free | - | Open models | Testing |

### Groq Free Tier

```
Limits:
- 1,000 requests/day
- 30 requests/minute
- 6,000 tokens/minute

Models:
- llama-3.3-70b-versatile
- llama-3.1-8b-instant
- mixtral-8x7b-32768

Speed: 300+ tokens/second (fastest available)
```

**Pros:** Blazing fast, no credit card required
**Cons:** Strict limits, only open models

---

### Mistral Free Tier

```
Limits:
- 1 billion tokens/month (generous!)
- 1-2 requests/second
- All models included

Models:
- mistral-large
- mistral-small
- mistral-embed
```

**Pros:** Huge token allowance, premium models included
**Cons:** Very slow rate limits

---

### Google AI Studio Free Tier

```
Limits:
- 1,500 requests/day
- 15 requests/minute
- 1M tokens/minute

Models:
- gemini-1.5-flash
- gemini-1.5-pro
- gemini-2.0-flash

⚠️ WARNING: Free tier data MAY be used for training
```

**Pros:** Generous limits, good models
**Cons:** Data may be used for training

---

## 5. Data Privacy & Training Policies

### Critical Question: Is Your Data Used for Training?

| Provider | API Data Used for Training? | Data Retention | Zero Retention Available? |
|----------|----------------------------|----------------|---------------------------|
| **OpenAI** | **NO** | 30 days | Yes (Enterprise) |
| **Anthropic** | **NO** | 30 days | Yes |
| **Google (Paid)** | **NO** | Varies | Yes (Vertex AI) |
| **Google (Free)** | **YES** ⚠️ | Varies | No |
| **Mistral** | **NO** | Minimal | Yes |
| **Groq** | **NO** | Minimal | Yes |
| **DeepSeek** | **UNCLEAR** ⚠️ | Unknown | Unknown |
| **Meta (Llama)** | N/A | You control | Self-hosted |

---

### OpenAI Data Policy

```
✅ API data is NOT used for training (since March 2023)
✅ 30-day retention for abuse monitoring only
✅ Zero retention available with Enterprise
✅ SOC 2 Type 2 certified
✅ HIPAA eligible (with BAA)

❌ ChatGPT (web) data MAY be used for training
```

**Key Quote:**
> "As of March 1, 2023, OpenAI does NOT use data submitted via the API to train or improve models, unless you explicitly opt in."

---

### Anthropic (Claude) Data Policy

```
✅ API data NOT used for training by default
✅ 30-day retention for safety
✅ Can request immediate deletion
✅ SOC 2 Type 2 certified
✅ HIPAA eligible (with BAA)
✅ Constitutional AI approach
```

**Privacy Features:**
- Explicit opt-in required for any training use
- Strong privacy by design
- Clear data handling documentation

---

### Google Data Policy

```
⚠️ IMPORTANT: Different policies for different tiers!

FREE TIER (AI Studio):
❌ Data MAY be used for training
❌ Not recommended for sensitive data

PAID TIER (Vertex AI):
✅ Data NOT used for training
✅ Enterprise-grade privacy
✅ Regional data residency available
```

**Recommendation:** Use Vertex AI for production, free tier only for non-sensitive development.

---

### DeepSeek Data Policy

```
⚠️ CAUTION: Limited transparency

- Chinese company
- Unclear data retention policies
- Terms of service in Chinese
- Data may be stored in China
- Unclear if used for training
```

**Recommendation:** Avoid for sensitive data until policies are clarified. Use only for non-sensitive, cost-critical applications.

---

### Self-Hosted Models (Maximum Privacy)

```
✅ 100% data control
✅ No external API calls
✅ Air-gap capable
✅ GDPR/HIPAA compliant by design

Options:
- Ollama (local)
- vLLM (server)
- Text Generation Inference (HuggingFace)
- Cloud GPU (AWS/GCP/Azure)
```

**Models Available:**
- Llama 3.3 70B/405B
- Mistral Large/Small
- Qwen 2.5 72B
- DeepSeek (open weights)

---

### Data Privacy Checklist

| Requirement | OpenAI | Claude | Gemini Free | Gemini Paid | Self-Host |
|-------------|--------|--------|-------------|-------------|-----------|
| No training on data | ✅ | ✅ | ❌ | ✅ | ✅ |
| GDPR compliant | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Delete on request | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Zero retention | ✅* | ✅ | ❌ | ✅ | ✅ |
| SOC 2 certified | ✅ | ✅ | ✅ | ✅ | You |
| HIPAA eligible | ✅ | ✅ | ❌ | ✅ | You |

*Enterprise plan required

---

### Recommendations by Data Sensitivity

| Data Type | Recommended Providers | Avoid |
|-----------|----------------------|-------|
| Public data | Any provider | - |
| Business data | OpenAI, Claude, Mistral | Gemini Free |
| Student PII | OpenAI, Claude, Azure | Gemini Free, DeepSeek |
| Healthcare (HIPAA) | OpenAI Enterprise, Claude BAA | Free tiers |
| Government | Self-hosted, Azure Gov | All public APIs |
| EU residents | Mistral, Azure EU, Self-hosted | US-only providers |

---

## 6. Model Selection Guide

### Decision Flowchart

```
START
  │
  ├─ Is budget the #1 priority?
  │   ├─ Yes → Gemini Flash ($0.075/$0.30)
  │   └─ No ↓
  │
  ├─ Do you need best quality?
  │   ├─ Yes → GPT-4o or Claude Sonnet
  │   └─ No ↓
  │
  ├─ Is speed critical?
  │   ├─ Yes → Groq (Llama 3.3) - 300 tok/s
  │   └─ No ↓
  │
  ├─ Do you need EU compliance?
  │   ├─ Yes → Mistral or Self-hosted
  │   └─ No ↓
  │
  ├─ Is this for production chatbot?
  │   ├─ Yes → GPT-4o-mini ⭐
  │   └─ No ↓
  │
  └─ Default → GPT-4o-mini (best value)
```

### Use Case Recommendations

| Use Case | Recommended Model | Monthly Cost (10K queries) |
|----------|-------------------|---------------------------|
| Customer service bot | GPT-4o-mini | $2.70 |
| Document analysis | Gemini Pro | $11.25 |
| Code generation | GPT-4o or Claude Sonnet | $22-31 |
| Translation | Mistral Large | $20.00 |
| Simple Q&A | Gemini Flash | $1.35 |
| Complex reasoning | Claude Opus or GPT-4o | $100+ |
| High-volume, budget | DeepSeek V3 | $4.85 |
| Maximum privacy | Self-hosted Llama | Hardware cost |

---

## 7. Provider API Examples

### OpenAI

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'How many students are enrolled?' }
  ],
  temperature: 0,
  max_tokens: 500,
});

console.log(response.choices[0].message.content);
// Cost: ~$0.0003 per query
```

---

### Anthropic (Claude)

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Analyze the compliance data.' }
  ],
});

console.log(response.content[0].text);
// Cost: ~$0.03 per query
```

---

### Google Gemini

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const result = await model.generateContent('Summarize this document.');
console.log(result.response.text());
// Cost: ~$0.00014 per query
```

---

### OpenRouter (Unified API)

```typescript
import OpenAI from 'openai';

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Use ANY model through one API
const response = await openrouter.chat.completions.create({
  model: 'anthropic/claude-sonnet-4', // or 'openai/gpt-4o-mini', 'google/gemini-flash-1.5'
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
});
```

---

### Groq (Fastest)

```typescript
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const response = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'user', content: 'Quick question!' }
  ],
});
// Speed: 300+ tokens/second
// Cost: ~$0.0006 per query
```

---

### LangChain Integration

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// OpenAI
const openai = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
});

// Anthropic
const claude = new ChatAnthropic({
  modelName: 'claude-sonnet-4-20250514',
});

// Google
const gemini = new ChatGoogleGenerativeAI({
  modelName: 'gemini-1.5-flash',
});

// Use with LangGraph agents
import { createReactAgent } from '@langchain/langgraph/prebuilt';

const agent = createReactAgent({
  llm: openai, // or claude, gemini
  tools: myTools,
});
```

---

## Summary

### Quick Recommendations

| Priority | Model | Cost/Query |
|----------|-------|------------|
| **Best Value** | GPT-4o-mini | $0.0003 |
| **Cheapest** | Gemini Flash | $0.00014 |
| **Best Quality** | GPT-4o / Claude Sonnet | $0.02-0.03 |
| **Fastest** | Groq (Llama 3.3) | $0.0006 |
| **EU Compliance** | Mistral | $0.001 |
| **Maximum Privacy** | Self-hosted Llama | Hardware |

### Data Privacy Quick Guide

| Provider | Safe for Production? | Data Training? |
|----------|---------------------|----------------|
| OpenAI API | ✅ Yes | No |
| Claude API | ✅ Yes | No |
| Gemini Paid | ✅ Yes | No |
| Gemini Free | ⚠️ Dev only | Yes |
| Mistral | ✅ Yes | No |
| DeepSeek | ⚠️ Caution | Unclear |
| Self-hosted | ✅ Yes | You control |

---

## Resources

- [OpenAI Pricing](https://openai.com/pricing)
- [Anthropic Pricing](https://anthropic.com/pricing)
- [Google AI Pricing](https://ai.google.dev/pricing)
- [OpenRouter Models](https://openrouter.ai/models)
- [Mistral Pricing](https://mistral.ai/pricing)
- [Groq](https://groq.com)
- [Together AI](https://together.ai)
- [LangChain Docs](https://js.langchain.com)

---

*Last updated: June 2026*
