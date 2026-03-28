---
title: "LLMs as a Service: Latency, Cost, and Reliability Trade-offs"
day: 2
week: 1
weekName: "Foundations"
description: "Anatomy of an LLM API call: tokens, pricing, latency breakdown"
tag: "Foundations"
---

# Day 2 — LLMs as a Service: Latency, Cost, and Reliability Trade-offs

Every LLM call is an HTTP request to someone else's GPU cluster. Understanding the anatomy of that call — where time goes, where money goes, and where failures happen — is the foundation for every performance and cost decision you'll make.

## 1. Anatomy of an LLM API Call

An LLM request has a predictable cost structure that differs fundamentally from traditional APIs:

```typescript
interface LLMCallBreakdown {
  // Time to first token — dominated by prompt processing
  ttft: number;  // 200ms–2s depending on model/prompt size

  // Time per output token — sequential generation
  tpot: number;  // 20-80ms per token

  // Total latency = TTFT + (output_tokens * TPOT)
  totalLatency: number;

  // Cost = (input_tokens * input_price) + (output_tokens * output_price)
  cost: number;
}

// Real numbers (Claude Sonnet 4, March 2026):
// Input:  $3.00 / 1M tokens
// Output: $15.00 / 1M tokens
// A 2000-token prompt + 500-token response ≈ $0.0135
// 10,000 users × 20 calls/day = $2,700/day
```

The key insight: **output tokens are 3-5× more expensive than input tokens** across all major providers. This means verbose prompts that produce concise outputs are often cheaper than terse prompts that produce verbose outputs.

## 2. P50 vs P99 Latency — Why It Matters for UX

Most teams track average latency. For AI-native apps, P99 is what determines your UX quality:

```typescript
// Real-world latency distribution for a GPT-4 class model
const latencyProfile = {
  p50: 1200,   // ms — "normal" call
  p75: 2400,   // ms — longer responses
  p90: 4800,   // ms — complex reasoning
  p99: 12000,  // ms — your worst 1%
  p999: 30000, // ms — timeout territory
};

// If you have 5 sequential LLM calls in a pipeline:
// P50 total: 6s (acceptable)
// P99 total: 60s (unacceptable)

// This is why parallel execution and streaming matter
async function parallelLLMCalls(tasks: LLMTask[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await Promise.allSettled(
      tasks.map(task =>
        callLLM(task, { signal: controller.signal })
      )
    );
  } finally {
    clearTimeout(timeout);
  }
}
```

**Rule of thumb**: if your pipeline has N sequential LLM calls, your P99 latency is roughly N × single-call P99. Parallelize aggressively.

## 3. Cost Modeling: Caching and Batching

Cost grows linearly with usage — there's no economy of scale unless you architect for it:

```typescript
// Cost tracking middleware
function withCostTracking(llmClient: LLMClient): LLMClient {
  return {
    async complete(params: CompletionParams) {
      const start = Date.now();
      const result = await llmClient.complete(params);
      
      const cost = {
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        inputCost: result.usage.input_tokens * PRICE_PER_INPUT_TOKEN,
        outputCost: result.usage.output_tokens * PRICE_PER_OUTPUT_TOKEN,
        latencyMs: Date.now() - start,
        model: params.model,
        feature: params.metadata?.feature, // attribution
      };
      
      await costLogger.log(cost);
      return result;
    }
  };
}

// Batching: group similar requests
// Instead of 100 individual classification calls:
const batchPrompt = `Classify each of these ${items.length} items:\n${
  items.map((item, i) => `${i + 1}. ${item.text}`).join('\n')
}`;
// One call instead of 100 — 50-90% cost reduction
```

Provider-side prompt caching (Anthropic's cache_control, OpenAI's automatic caching) can cut input token costs by 90% for repeated system prompts. If your system prompt is >1000 tokens and reused across calls, enable caching immediately.

## 4. Reliability: Multi-Provider Strategies

LLM providers have outages. Building against a single provider is a single point of failure:

```typescript
interface ProviderConfig {
  name: string;
  client: LLMClient;
  priority: number;
  healthCheck: () => Promise<boolean>;
  costMultiplier: number;
}

async function resilientLLMCall(
  prompt: string,
  providers: ProviderConfig[]
): Promise<LLMResponse> {
  const sorted = providers.sort((a, b) => a.priority - b.priority);

  for (const provider of sorted) {
    try {
      const healthy = await provider.healthCheck();
      if (!healthy) continue;

      return await withTimeout(
        provider.client.complete(prompt),
        10000
      );
    } catch (err) {
      console.warn(`Provider ${provider.name} failed:`, err.message);
      continue; // try next provider
    }
  }

  throw new Error('All LLM providers exhausted');
}
```

## 5. When NOT to Call an LLM

The cheapest, fastest, most reliable LLM call is the one you don't make:

- **Classification with <10 categories** → Rule-based or small fine-tuned model
- **Structured data extraction from known formats** → Regex/parsers
- **Simple transformations** → String manipulation
- **Repeated identical queries** → Cache lookup
- **Latency-critical paths (<100ms)** → Pre-computed results

Every LLM call should pass the test: "Is there a deterministic solution that's good enough?"

## Try This Today

Add cost tracking to one LLM integration in your codebase. Log: model, input tokens, output tokens, calculated cost, feature name, and latency. Run it for 24 hours and calculate your per-user and per-feature costs. You'll likely find one feature consuming 60%+ of your budget.

## Resources

- [Anthropic API Pricing & Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — How prompt caching works and when to use it
- [Latency Optimization Guide (Anthropic)](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#latency) — Practical techniques to reduce LLM call latency
