---
title: "Structured Logging and Tracing for AI Pipelines"
day: 17
week: 3
weekName: "Reliability"
description: "What to log in an AI system (and what not to)"
tag: "reliability"
---

# Day 17 — Structured Logging and Tracing for AI Pipelines

When an AI system produces a bad answer, you need to know: which model, which prompt version, what context was retrieved, how long each step took, and what the intermediate outputs were. Without structured logging and tracing, debugging AI systems is guesswork.

## 1. What to Log in an AI System

```typescript
interface AICallLog {
  // Identity
  traceId: string;         // correlates all steps in one request
  spanId: string;          // unique to this step
  parentSpanId?: string;   // for nested calls

  // What happened
  model: string;           // 'claude-sonnet-4-20250514'
  promptVersion: string;   // 'classify-v2.1.0'
  temperature: number;
  
  // Input (be careful with PII)
  inputTokens: number;
  systemPromptHash: string;  // don't log full prompts in prod — hash them
  contextSources: string[];  // which RAG docs were included
  
  // Output
  outputTokens: number;
  finishReason: string;      // 'end_turn' | 'max_tokens' | 'stop_sequence'
  
  // Performance
  latencyMs: number;
  ttftMs: number;            // time to first token
  
  // Cost
  estimatedCost: number;
  
  // Quality signals
  validationPassed: boolean;
  fallbackUsed: boolean;
  cacheHit: boolean;
  retryCount: number;
}
```

**What NOT to log**: full prompts containing user PII, API keys, raw user content in high-volume systems (use hashes + sampling).

## 2. Structured Logging Implementation

```typescript
import { randomUUID } from 'crypto';

class AILogger {
  private baseContext: Record<string, unknown>;

  constructor(context: { service: string; environment: string }) {
    this.baseContext = context;
  }

  logAICall(log: AICallLog): void {
    const entry = {
      ...this.baseContext,
      ...log,
      timestamp: new Date().toISOString(),
      level: log.fallbackUsed ? 'warn' : 'info',
    };
    
    // Structured JSON output — parseable by any log aggregator
    console.log(JSON.stringify(entry));
  }

  // Middleware pattern for automatic logging
  wrapLLMClient(client: LLMClient, promptVersion: string): LLMClient {
    return {
      complete: async (params) => {
        const traceId = getActiveTrace() || randomUUID();
        const spanId = randomUUID();
        const start = Date.now();

        try {
          const result = await client.complete(params);

          this.logAICall({
            traceId,
            spanId,
            model: params.model,
            promptVersion,
            temperature: params.temperature ?? 1,
            inputTokens: result.usage.input_tokens,
            outputTokens: result.usage.output_tokens,
            systemPromptHash: hashString(params.system || ''),
            contextSources: params.metadata?.sources || [],
            finishReason: result.stop_reason,
            latencyMs: Date.now() - start,
            ttftMs: result.metrics?.ttft || 0,
            estimatedCost: calculateCost(result.usage, params.model),
            validationPassed: true, // set by caller after validation
            fallbackUsed: false,
            cacheHit: false,
            retryCount: 0,
          });

          return result;
        } catch (err) {
          this.logAICall({
            traceId,
            spanId,
            model: params.model,
            promptVersion,
            temperature: params.temperature ?? 1,
            inputTokens: 0,
            outputTokens: 0,
            systemPromptHash: hashString(params.system || ''),
            contextSources: [],
            finishReason: 'error',
            latencyMs: Date.now() - start,
            ttftMs: 0,
            estimatedCost: 0,
            validationPassed: false,
            fallbackUsed: false,
            cacheHit: false,
            retryCount: 0,
          });
          throw err;
        }
      }
    };
  }
}
```

## 3. Distributed Tracing with OpenTelemetry

For multi-step pipelines, OpenTelemetry traces show the full request flow:

```typescript
import { trace, SpanStatusCode, context } from '@opentelemetry/api';

const tracer = trace.getTracer('ai-pipeline');

async function tracedPipeline(input: PipelineInput): Promise<PipelineOutput> {
  return tracer.startActiveSpan('ai-pipeline', async (rootSpan) => {
    rootSpan.setAttribute('input.type', input.type);
    rootSpan.setAttribute('pipeline.version', '2.1.0');

    try {
      // Each step gets its own span
      const extracted = await tracer.startActiveSpan('extract', async (span) => {
        span.setAttribute('model', 'claude-haiku');
        span.setAttribute('prompt.version', 'extract-v1.0');
        
        const result = await llm.extract(input.document);
        
        span.setAttribute('tokens.input', result.usage.input_tokens);
        span.setAttribute('tokens.output', result.usage.output_tokens);
        span.setAttribute('cost', calculateCost(result.usage));
        span.end();
        return result;
      });

      const analyzed = await tracer.startActiveSpan('analyze', async (span) => {
        span.setAttribute('model', 'claude-sonnet');
        span.setAttribute('context.chunks', extracted.chunks.length);
        
        const result = await llm.analyze(extracted);
        span.end();
        return result;
      });

      rootSpan.setStatus({ code: SpanStatusCode.OK });
      return analyzed;
    } catch (err) {
      rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      rootSpan.recordException(err);
      throw err;
    } finally {
      rootSpan.end();
    }
  });
}
```

This produces a trace tree you can visualize in Jaeger, Grafana Tempo, or any OTEL-compatible backend:

```
ai-pipeline (10.2s)
├── extract (2.1s) — model: claude-haiku, tokens: 500→200, cost: $0.001
├── analyze (5.8s) — model: claude-sonnet, tokens: 2000→800, cost: $0.018
└── summarize (2.3s) — model: claude-haiku, tokens: 800→150, cost: $0.002
```

## 4. Useful Dashboards for AI Systems

```typescript
// Key metrics to track and alert on
const aiDashboardMetrics = {
  // Latency
  'ai.latency.p50': 'Median LLM call latency',
  'ai.latency.p99': 'Tail latency — UX impact',
  'ai.ttft.p50': 'Time to first token (streaming UX)',

  // Quality
  'ai.validation.pass_rate': 'Output validation success rate',
  'ai.fallback.rate': 'How often fallbacks are used',
  'ai.retry.rate': 'Retry frequency (provider health signal)',

  // Cost
  'ai.cost.per_request': 'Average cost per LLM call',
  'ai.cost.daily_total': 'Total daily spend',
  'ai.tokens.input_per_call': 'Context size trends',

  // Provider health
  'ai.provider.error_rate': 'Per-provider error rates',
  'ai.provider.circuit_breaker_state': 'Which providers are currently open',
};
```

## Try This Today

Add structured logging to one LLM call in your codebase. Log: traceId, model, prompt version, input/output tokens, latency, cost, and whether validation passed. Run it for a few hours and query the logs to answer: what's my average cost per call? What's my P99 latency? How often does validation fail? These three numbers are your AI system's vital signs.

## Resources

- [OpenTelemetry JS Documentation](https://opentelemetry.io/docs/languages/js/) — Comprehensive guide to instrumenting Node.js applications with OTEL
- [Langfuse: LLM Observability Platform](https://langfuse.com/docs) — Open-source observability specifically designed for LLM applications
