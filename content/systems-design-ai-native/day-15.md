---
title: "Failure Modes in AI Systems"
day: 15
week: 3
weekName: "Reliability"
description: "Taxonomy of AI failures: hallucination, refusals, regressions, timeouts"
tag: "reliability"
---

# Day 15 — Failure Modes in AI Systems

Traditional systems fail in predictable ways: timeouts, null pointers, network errors. AI systems fail in all those ways *plus* novel ones: hallucinations, subtle regressions, confident wrong answers, and cascading failures across non-deterministic pipeline steps. Understanding the taxonomy of AI failures is the first step to building resilient systems.

## 1. Taxonomy of AI Failures

```typescript
type AIFailureMode =
  | 'hallucination'       // confident but factually wrong
  | 'refusal'             // model refuses a valid request
  | 'format_violation'    // output doesn't match expected schema
  | 'regression'          // worked yesterday, broken today (model update)
  | 'timeout'             // LLM call exceeds time budget
  | 'rate_limit'          // provider throttles requests
  | 'context_overflow'    // input exceeds window
  | 'cascade'             // one step's bad output corrupts downstream
  | 'drift'               // gradual quality degradation over time
  | 'safety_trigger'      // false positive on content filters;

// Each failure type needs a different mitigation
const mitigations: Record<AIFailureMode, string[]> = {
  hallucination:    ['output validation', 'RAG grounding', 'confidence scoring'],
  refusal:          ['prompt engineering', 'fallback provider', 'rephrasing'],
  format_violation: ['structured output (JSON mode)', 'retry with correction', 'Zod validation'],
  regression:       ['eval suite', 'model pinning', 'canary deployment'],
  timeout:          ['timeout budgets', 'streaming', 'circuit breaker'],
  rate_limit:       ['queue + backoff', 'multi-provider', 'priority queue'],
  context_overflow: ['token counting', 'context management', 'summarization'],
  cascade:          ['step validation', 'circuit breaker per step', 'fallback chains'],
  drift:            ['continuous eval monitoring', 'alerting on quality metrics'],
  safety_trigger:   ['input sanitization', 'prompt wrapping', 'appeal/retry'],
};
```

## 2. Non-Determinism as a Reliability Challenge

The same prompt can produce different quality outputs across calls. This means "it works" isn't a permanent state:

```typescript
// Demonstrating non-determinism impact
async function measureReliability(
  prompt: string,
  llm: LLMClient,
  validator: (output: string) => boolean,
  trials = 100
): Promise<ReliabilityReport> {
  const results = await Promise.all(
    Array(trials).fill(null).map(async () => {
      const start = Date.now();
      try {
        const response = await llm.complete({ messages: [{ role: 'user', content: prompt }] });
        return {
          success: validator(response.text),
          latencyMs: Date.now() - start,
          outputLength: response.text.length,
        };
      } catch (err) {
        return { success: false, latencyMs: Date.now() - start, error: err.message };
      }
    })
  );

  const successes = results.filter(r => r.success).length;
  return {
    successRate: successes / trials,
    p50Latency: percentile(results.map(r => r.latencyMs), 50),
    p99Latency: percentile(results.map(r => r.latencyMs), 99),
    failureModes: categorizeFailures(results.filter(r => !r.success)),
  };
}

// A "working" prompt with 95% success rate still fails 1 in 20 requests
// At 1000 RPM, that's 50 failures per minute
```

## 3. Cascading Failures in Multi-Step Pipelines

When step N produces slightly wrong output, step N+1 amplifies the error:

```typescript
class ResilientPipeline {
  private steps: PipelineStep[];

  async execute(input: unknown): Promise<PipelineResult> {
    let current = input;
    const stepResults: StepResult[] = [];

    for (const step of this.steps) {
      try {
        const output = await step.execute(current);

        // Validate output before passing to next step
        if (!step.validate(output)) {
          // Don't cascade bad output — use fallback or stop
          if (step.fallback) {
            current = await step.fallback(current);
            stepResults.push({ step: step.name, source: 'fallback' });
          } else {
            return {
              status: 'partial',
              completedSteps: stepResults,
              failedAt: step.name,
              reason: 'validation_failed',
            };
          }
        } else {
          current = output;
          stepResults.push({ step: step.name, source: 'primary' });
        }
      } catch (err) {
        // Circuit breaker: if this step has failed too many times, skip it
        if (step.circuitBreaker.isOpen()) {
          if (step.optional) continue; // skip optional steps
          return { status: 'failed', failedAt: step.name, reason: 'circuit_open' };
        }
        step.circuitBreaker.recordFailure();
        throw err;
      }
    }

    return { status: 'completed', result: current, steps: stepResults };
  }
}
```

## 4. Graceful Degradation Patterns

Design for failure at every level — the user should always get *something* useful:

```typescript
class GracefulDegradation {
  // Level 1: Full AI response (ideal)
  // Level 2: Cached AI response (slightly stale)
  // Level 3: Small/fast model response (lower quality)
  // Level 4: Rule-based response (deterministic)
  // Level 5: Transparent failure message

  async respond(query: string): Promise<DegradedResponse> {
    // Try each level, return first success
    const levels = [
      { name: 'primary', fn: () => this.primaryLLM(query) },
      { name: 'cached', fn: () => this.cachedResponse(query) },
      { name: 'fast-model', fn: () => this.fastModel(query) },
      { name: 'rule-based', fn: () => this.ruleBased(query) },
    ];

    for (const level of levels) {
      try {
        const result = await withTimeout(level.fn(), 5000);
        return {
          answer: result,
          degradationLevel: level.name,
          isFullQuality: level.name === 'primary',
        };
      } catch {
        continue;
      }
    }

    return {
      answer: 'I\'m having trouble processing this right now. Please try again.',
      degradationLevel: 'failure',
      isFullQuality: false,
    };
  }
}
```

**Key principle**: the user should never see a raw error. Always have a degradation path that produces *something* useful, even if it's a transparent "I can't do this right now."

## Try This Today

Run a reliability test on one of your critical prompts: call it 50 times with the same input (temperature=0.7) and measure: (1) what percentage produces valid, correct output, (2) what are the failure modes when it doesn't, (3) what's the P99 latency. This gives you a baseline reliability number you can track over time.

## Resources

- [Failures in AI Systems (Microsoft Research)](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/failure-modes) — Taxonomy of AI failure modes in production
- [Netflix Chaos Engineering for AI](https://netflixtechblog.com/) — Principles of chaos engineering applied to ML systems
