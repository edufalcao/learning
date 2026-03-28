---
title: "Building for Observability from Day 1"
day: 28
week: 4
weekName: "Multi-Agent & Production"
description: "The observability stack for AI: logs, metrics, traces, evals"
tag: "Multi-Agent & Production"
---

# Day 28 — Building for Observability from Day 1

Observability in AI systems isn't the same as in traditional software. You're not just watching latency and error rates — you're watching for semantic drift, token budget overruns, hallucination patterns, and model regressions that no HTTP status code will ever surface. Bolting observability on after the fact is painful; building it in from the start changes how you architect everything.

## 1. The Four Pillars: Logs, Metrics, Traces, Evals

Classic observability is three pillars (logs, metrics, traces). AI adds a fourth: **evals** — continuous behavioral assertions about model output quality.

| Pillar | What it captures | AI-specific examples |
|---|---|---|
| Logs | Discrete events | Prompt text, raw response, model used, finish reason |
| Metrics | Aggregated measurements | Token usage, latency P50/P99, cost/request, cache hit rate |
| Traces | Request flow across components | Prompt → retrieval → LLM → post-processing → response |
| Evals | Output quality over time | Hallucination rate, format compliance, task success rate |

In practice: logs answer "what happened?", metrics answer "how often / how much?", traces answer "where did it slow down?", evals answer "is it still working correctly?"

```typescript
// Structured log entry for every LLM call
interface LLMCallLog {
  traceId: string;
  spanId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  cached: boolean;
  costUsd: number;
  error?: string;
}

function logLLMCall(log: LLMCallLog) {
  console.log(JSON.stringify({ level: 'info', event: 'llm_call', ...log }));
}
```

---

## 2. Instrumentation Patterns for LLM Calls

Wrap your LLM client at the lowest level so instrumentation is automatic and can't be skipped.

```typescript
import Anthropic from '@anthropic-ai/sdk';

class InstrumentedAnthropicClient {
  private client: Anthropic;
  private tracer: Tracer; // OpenTelemetry tracer

  constructor() {
    this.client = new Anthropic();
    this.tracer = trace.getTracer('llm-client');
  }

  async complete(params: Anthropic.MessageCreateParams): Promise<Anthropic.Message> {
    const span = this.tracer.startSpan('llm.complete', {
      attributes: {
        'llm.model': params.model,
        'llm.max_tokens': params.max_tokens,
        'llm.system_prompt_length': params.system?.length ?? 0,
      }
    });

    const start = Date.now();
    try {
      const response = await this.client.messages.create(params);
      const latency = Date.now() - start;

      span.setAttributes({
        'llm.input_tokens': response.usage.input_tokens,
        'llm.output_tokens': response.usage.output_tokens,
        'llm.finish_reason': response.stop_reason,
        'llm.latency_ms': latency,
      });

      logLLMCall({
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        model: params.model,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        latencyMs: latency,
        finishReason: response.stop_reason as any,
        cached: false,
        costUsd: calculateCost(params.model, response.usage),
      });

      return response;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  }
}
```

Every LLM call automatically captures latency, token counts, cost, and trace context. No manual instrumentation per feature.

## 3. Real User Monitoring (RUM) for AI Features

RUM for AI means capturing the user's actual experience — not just whether the LLM responded, but whether the response was useful.

**What to capture at the UI layer:**
- Time to first token (TTFT) — the perceived latency for streaming responses
- Time to complete — full response duration
- User feedback signals — thumbs up/down, edit/regenerate actions, abandonment
- Feature usage — which AI features are used, which are ignored

```typescript
// Client-side: track streaming response experience
async function streamWithRUM(prompt: string) {
  const start = performance.now();
  let firstTokenAt: number | null = null;
  let tokenCount = 0;

  const stream = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

  const reader = stream.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (firstTokenAt === null) {
      firstTokenAt = performance.now();
      analytics.track('ai.ttft', { ms: firstTokenAt - start });
    }
    tokenCount++;
  }

  analytics.track('ai.stream_complete', {
    ttft_ms: firstTokenAt! - start,
    total_ms: performance.now() - start,
    token_count: tokenCount,
  });
}
```

## 4. Alerting: What to Alert On, What Not To

**Alert on:**
- Latency P99 > threshold (e.g., >10s for non-streaming)
- Error rate spike (5xx from LLM provider > 1% over 5min)
- Token cost anomaly (daily spend > 2x rolling average)
- Eval regression (task success rate drops >5% from baseline)
- Context length warnings (approaching model limit consistently)

**Don't alert on:**
- Individual slow requests (alert on P99, not P100)
- Every hallucination (track rate trends, not individual events)
- Token count fluctuations (normal variance — alert on sustained trends)
- Provider latency blips under 30 seconds

```typescript
// Example: cost anomaly detection
async function checkCostAnomaly(currentHourlyCost: number) {
  const rollingAvg = await getRolling7DayHourlyAverage();
  const threshold = rollingAvg * 2.5;

  if (currentHourlyCost > threshold) {
    await alert({
      severity: 'warning',
      title: 'LLM cost anomaly detected',
      message: `Current hourly cost $${currentHourlyCost.toFixed(2)} is ${(currentHourlyCost / rollingAvg).toFixed(1)}x the 7-day average`,
    });
  }
}
```

## Try This Today

Pick one LLM call in your codebase and add a thin instrumentation wrapper around it: log the model name, latency, input/output token counts, and finish reason as structured JSON. Then run it and verify the log output. This single change will give you more visibility than most teams have across their entire AI stack.

## Resources

- [OpenTelemetry for LLM observability — semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Honeycomb: Observability for AI applications](https://www.honeycomb.io/blog/observability-for-ai-applications)
