---
title: "Retry Strategies, Fallbacks, and Circuit Breakers for LLMs"
day: 16
week: 3
weekName: "Reliability"
description: "Retry logic: exponential backoff, jitter, max attempts"
tag: "reliability"
---

# Day 16 — Retry Strategies, Fallbacks, and Circuit Breakers for LLMs

LLM providers have transient failures, rate limits, and variable latency. A production AI system needs the same resilience patterns you'd use for any critical external dependency — but tuned for AI-specific constraints like token costs and non-deterministic outputs.

## 1. Retry Logic: Exponential Backoff with Jitter

```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];  // error codes/types worth retrying
  costAware: boolean;         // avoid retrying expensive calls blindly
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['rate_limit', 'overloaded', 'timeout', '529', '503'],
    costAware: true,
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      // Don't retry non-retryable errors
      if (!isRetryable(err, config.retryableErrors)) throw err;

      // Don't retry if we're on the last attempt
      if (attempt === config.maxAttempts - 1) throw err;

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * exponentialDelay * 0.5;
      const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);

      // Respect Retry-After header if present
      const retryAfter = getRetryAfterMs(err);
      const actualDelay = retryAfter ? Math.max(delay, retryAfter) : delay;

      console.warn(
        `LLM call failed (attempt ${attempt + 1}/${config.maxAttempts}), ` +
        `retrying in ${actualDelay}ms: ${err.message}`
      );

      await sleep(actualDelay);
    }
  }

  throw lastError!;
}

function isRetryable(err: unknown, retryableCodes: string[]): boolean {
  if (err instanceof Error) {
    // Rate limits are always retryable
    if (err.message.includes('rate_limit') || err.message.includes('429')) return true;
    // Server errors are usually transient
    if (err.message.includes('500') || err.message.includes('503')) return true;
    return retryableCodes.some(code => err.message.includes(code));
  }
  return false;
}
```

## 2. Fallback Chains: Multi-Provider Strategy

When your primary provider fails, fall back gracefully through alternatives:

```typescript
interface LLMProvider {
  name: string;
  client: LLMClient;
  costPerToken: number;
  avgLatencyMs: number;
  priority: number;  // lower = preferred
}

class FallbackChain {
  constructor(private providers: LLMProvider[]) {
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const errors: { provider: string; error: string }[] = [];

    for (const provider of this.providers) {
      try {
        const result = await retryWithBackoff(
          () => provider.client.complete(params),
          { maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 5000, retryableErrors: ['429', '503'], costAware: true }
        );

        return {
          ...result,
          provider: provider.name,
          wasFallback: provider.priority > 0,
        };
      } catch (err) {
        errors.push({ provider: provider.name, error: (err as Error).message });
        continue;
      }
    }

    // All providers failed — try cached response
    const cached = await this.getCachedResponse(params);
    if (cached) {
      return { ...cached, provider: 'cache', wasFallback: true };
    }

    throw new AggregateError(
      errors.map(e => new Error(`${e.provider}: ${e.error}`)),
      'All LLM providers failed'
    );
  }
}

// Usage
const chain = new FallbackChain([
  { name: 'anthropic', client: anthropicClient, costPerToken: 0.003, avgLatencyMs: 1500, priority: 0 },
  { name: 'openai', client: openaiClient, costPerToken: 0.005, avgLatencyMs: 2000, priority: 1 },
  { name: 'openrouter', client: openrouterClient, costPerToken: 0.004, avgLatencyMs: 2500, priority: 2 },
]);
```

## 3. Circuit Breaker Pattern for LLM Providers

Stop sending requests to a provider that's consistently failing — protect your latency and avoid wasting money on doomed calls:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,     // failures before opening
    private readonly resetMs: number = 60_000,  // time before trying again
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if enough time passed to try again
      if (Date.now() - this.lastFailure > this.resetMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  isOpen(): boolean { return this.state === 'open'; }
}

// Wrap each provider with its own circuit breaker
class ResilientLLMClient {
  private breakers = new Map<string, CircuitBreaker>();

  constructor(private providers: LLMProvider[]) {
    for (const p of providers) {
      this.breakers.set(p.name, new CircuitBreaker(5, 60_000));
    }
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    for (const provider of this.providers) {
      const breaker = this.breakers.get(provider.name)!;
      if (breaker.isOpen()) continue; // skip broken providers

      try {
        return await breaker.execute(() => provider.client.complete(params));
      } catch {
        continue;
      }
    }
    throw new Error('All providers unavailable');
  }
}
```

## 4. Timeout Budgets Across Pipeline Steps

In a multi-step pipeline, allocate time budgets to each step so one slow step doesn't consume the entire timeout:

```typescript
class TimeoutBudget {
  private remaining: number;
  private started = Date.now();

  constructor(totalMs: number) {
    this.remaining = totalMs;
  }

  allocate(stepName: string, fraction: number): number {
    const allocation = Math.floor(this.remaining * fraction);
    console.log(`${stepName}: allocated ${allocation}ms`);
    return allocation;
  }

  consume(ms: number): void {
    this.remaining -= ms;
  }

  get elapsed(): number { return Date.now() - this.started; }
  get left(): number { return Math.max(0, this.remaining - this.elapsed); }
}

// Usage in a pipeline
const budget = new TimeoutBudget(10_000); // 10s total

const extract = await withTimeout(llm.extract(doc), budget.allocate('extract', 0.3)); // 3s
budget.consume(extractTime);

const analyze = await withTimeout(llm.analyze(extract), budget.allocate('analyze', 0.5)); // ~3.5s
budget.consume(analyzeTime);

const summarize = await withTimeout(llm.summarize(analyze), budget.left); // whatever's left
```

## Try This Today

Build a resilient LLM client that combines: (1) exponential backoff with jitter, (2) circuit breaker per provider, (3) fallback to a secondary provider when the primary is down. Test it by simulating failures (add random `throw` in 30% of calls) and verify: the circuit breaker opens after 5 failures, falls back to the secondary, and the primary recovers after the reset window.

## Resources

- [Microsoft: Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker) — Definitive guide to circuit breakers in distributed systems
- [Anthropic Rate Limits](https://docs.anthropic.com/en/api/rate-limits) — Understanding rate limit headers and retry strategies for Claude
