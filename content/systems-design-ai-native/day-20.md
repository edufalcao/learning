---
title: "Rate Limiting and Quota Management"
day: 20
week: 3
weekName: "Reliability"
description: "Provider-side rate limits: TPM, RPM, daily quotas"
tag: "reliability"
---

# Day 20 — Rate Limiting and Quota Management

LLM providers enforce strict rate limits (requests per minute, tokens per minute). Hit them and your entire system stalls. Rate limiting isn't just about staying under provider caps — it's about fairness across users, cost control, and graceful behavior under load.

## 1. Provider-Side Rate Limits

Every major provider has different limits that you must design around:

```typescript
interface ProviderLimits {
  rpm: number;           // requests per minute
  tpm: number;           // tokens per minute
  dailyTokens?: number;  // some providers have daily caps
  concurrent?: number;    // max concurrent requests
}

// Typical limits (vary by tier)
const providerLimits: Record<string, ProviderLimits> = {
  anthropic: { rpm: 1000, tpm: 80000, concurrent: 100 },
  openai:    { rpm: 500, tpm: 60000 },
  openrouter: { rpm: 200, tpm: 40000 },
};

// Track headers from responses
function parseRateLimitHeaders(headers: Headers): RateLimitState {
  return {
    remaining: parseInt(headers.get('x-ratelimit-remaining-requests') || '-1'),
    resetAt: headers.get('x-ratelimit-reset-requests'),
    tokensRemaining: parseInt(headers.get('x-ratelimit-remaining-tokens') || '-1'),
    tokensResetAt: headers.get('x-ratelimit-reset-tokens'),
  };
}
```

## 2. Client-Side Rate Limiting

Don't wait for 429s — proactively limit your own request rate:

```typescript
class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,   // bucket capacity
    private refillRate: number,  // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(cost = 1): Promise<void> {
    this.refill();

    if (this.tokens >= cost) {
      this.tokens -= cost;
      return;
    }

    // Wait for enough tokens
    const waitTime = ((cost - this.tokens) / this.refillRate) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.refill();
    this.tokens -= cost;
  }
}

// Dual limiter: RPM + TPM
class DualRateLimiter {
  private rpmLimiter: TokenBucketLimiter;
  private tpmLimiter: TokenBucketLimiter;

  constructor(limits: ProviderLimits) {
    this.rpmLimiter = new TokenBucketLimiter(limits.rpm, limits.rpm / 60);
    this.tpmLimiter = new TokenBucketLimiter(limits.tpm, limits.tpm / 60);
  }

  async acquire(estimatedTokens: number): Promise<void> {
    // Must satisfy both limits
    await this.rpmLimiter.acquire(1);
    await this.tpmLimiter.acquire(estimatedTokens);
  }
}
```

## 3. Priority Queues for LLM Requests

Not all requests are equal. Real-time user queries should jump ahead of background batch processing:

```typescript
import { Queue, Worker, QueueEvents } from 'bullmq';

// Define priority levels
enum Priority {
  CRITICAL = 1,    // User-facing, real-time
  HIGH = 5,        // Important but can wait 1-2s
  NORMAL = 10,     // Background processing
  LOW = 20,        // Batch jobs, can wait minutes
}

class PriorityLLMQueue {
  private queue: Queue;
  private limiter: DualRateLimiter;

  constructor(limits: ProviderLimits) {
    this.queue = new Queue('llm-requests', {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    });
    this.limiter = new DualRateLimiter(limits);
  }

  async enqueue(
    request: LLMRequest,
    priority: Priority = Priority.NORMAL
  ): Promise<string> {
    const job = await this.queue.add('llm-call', request, {
      priority,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return job.id!;
  }

  async startWorker(llm: LLMClient): Promise<Worker> {
    return new Worker('llm-requests', async (job) => {
      const request = job.data as LLMRequest;
      const estimatedTokens = countTokens(JSON.stringify(request.messages));

      // Rate limit before calling
      await this.limiter.acquire(estimatedTokens);

      return llm.complete(request);
    }, {
      concurrency: 10,
    });
  }
}

// Usage
const queue = new PriorityLLMQueue(providerLimits.anthropic);

// User chat message — highest priority
await queue.enqueue(chatRequest, Priority.CRITICAL);

// Background classification — can wait
await queue.enqueue(classifyRequest, Priority.LOW);
```

## 4. Multi-Tenant Quota Management

When multiple users share the same LLM budget, enforce per-tenant quotas:

```typescript
class TenantQuotaManager {
  private usage = new Map<string, { tokens: number; requests: number; resetAt: number }>();

  constructor(
    private quotas: {
      free: { dailyTokens: number; dailyRequests: number };
      pro: { dailyTokens: number; dailyRequests: number };
    }
  ) {}

  async checkQuota(tenantId: string, tier: 'free' | 'pro', estimatedTokens: number): Promise<QuotaResult> {
    const usage = this.getOrCreateUsage(tenantId);
    const quota = this.quotas[tier];

    // Reset daily counters
    if (Date.now() > usage.resetAt) {
      usage.tokens = 0;
      usage.requests = 0;
      usage.resetAt = this.nextMidnight();
    }

    if (usage.requests >= quota.dailyRequests) {
      return { allowed: false, reason: 'Daily request limit reached', retryAfter: usage.resetAt - Date.now() };
    }

    if (usage.tokens + estimatedTokens > quota.dailyTokens) {
      return { allowed: false, reason: 'Daily token limit reached', retryAfter: usage.resetAt - Date.now() };
    }

    return { allowed: true, remaining: { tokens: quota.dailyTokens - usage.tokens, requests: quota.dailyRequests - usage.requests } };
  }

  recordUsage(tenantId: string, actualTokens: number): void {
    const usage = this.getOrCreateUsage(tenantId);
    usage.tokens += actualTokens;
    usage.requests += 1;
  }
}
```

## 5. Graceful Degradation Under Quota Pressure

```typescript
class QuotaAwareLLM {
  async complete(request: LLMRequest, context: RequestContext): Promise<LLMResponse> {
    const quota = await this.quotaManager.checkQuota(context.tenantId, context.tier, request.estimatedTokens);

    if (!quota.allowed) {
      // Degrade instead of fail
      if (context.priority === Priority.CRITICAL) {
        // Use cheaper model for critical requests
        return this.cheapModel.complete(request);
      }
      // Return cached/pre-computed response for non-critical
      const cached = await this.cache.get(request);
      if (cached) return cached;
      
      throw new QuotaExceededError(quota.reason, quota.retryAfter);
    }

    const result = await this.primaryModel.complete(request);
    this.quotaManager.recordUsage(context.tenantId, result.usage.total_tokens);
    return result;
  }
}
```

## Try This Today

Implement a dual rate limiter (RPM + TPM) that wraps your LLM client. Log every time the limiter makes a request wait, with: wait duration, queue depth, and which limit was hit. Run a burst of 50 concurrent requests and verify the limiter smooths them out without any 429 errors from the provider.

## Resources

- [Anthropic Rate Limits Documentation](https://docs.anthropic.com/en/api/rate-limits) — Rate limit tiers and header documentation
- [BullMQ Priority Queue](https://docs.bullmq.io/guide/jobs/prioritized) — Built-in priority support for job queues in Node.js
