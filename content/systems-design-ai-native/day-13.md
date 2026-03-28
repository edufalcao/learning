---
title: "Caching Strategies for LLM Responses"
day: 13
week: 2
weekName: "Data & Context"
description: "Why caching LLM outputs is hard (and worth it)"
tag: "Data & Context"
---

# Day 13 — Caching Strategies for LLM Responses

LLM calls are expensive and slow. A well-designed cache can cut costs by 50-80% and drop latency from seconds to milliseconds for repeated queries. But LLM caching is harder than traditional caching — responses are non-deterministic and queries have semantic similarity that exact-match caching misses.

## 1. Why Caching LLM Outputs Is Hard (and Worth It)

Traditional caching assumes identical inputs produce identical outputs. LLMs break this: the same prompt can produce different text at temperature > 0. And users ask the same question in different words — "What's the weather?" and "How's the weather today?" should probably hit the same cache.

```typescript
// The naive approach — works but misses semantic duplicates
const exactCache = new Map<string, string>();

function cacheKey(prompt: string, model: string, temperature: number): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ prompt, model, temperature }))
    .digest('hex');
}

// Miss rate is high because:
// "Explain closures in JavaScript" !== "What are JavaScript closures?"
// Both should return the same cached result
```

## 2. Exact Match Caching: When It Works

Exact caching is simple and effective for: system prompts, structured tool calls, deterministic prompts (temperature=0), and template-based queries:

```typescript
class ExactLLMCache {
  constructor(private redis: Redis, private ttlSeconds = 3600) {}

  async get(params: LLMParams): Promise<string | null> {
    // Only cache deterministic calls
    if (params.temperature > 0) return null;

    const key = this.buildKey(params);
    const cached = await this.redis.get(key);

    if (cached) {
      await this.redis.hincrby('cache:stats', 'hits', 1);
      return cached;
    }
    await this.redis.hincrby('cache:stats', 'misses', 1);
    return null;
  }

  async set(params: LLMParams, response: string): Promise<void> {
    if (params.temperature > 0) return;

    const key = this.buildKey(params);
    await this.redis.set(key, response, 'EX', this.ttlSeconds);
  }

  private buildKey(params: LLMParams): string {
    // Include everything that affects the output
    return `llm:${crypto.createHash('sha256')
      .update(JSON.stringify({
        model: params.model,
        system: params.system,
        messages: params.messages,
        tools: params.tools,
        temperature: params.temperature,
      }))
      .digest('hex')}`;
  }
}
```

## 3. Semantic Caching: Embedding-Based Similarity

For user-facing queries where phrasing varies, use embedding similarity to find cache hits:

```typescript
class SemanticLLMCache {
  constructor(
    private vectorStore: VectorStore,
    private embedder: EmbeddingModel,
    private similarityThreshold = 0.95, // high threshold to avoid wrong hits
    private ttlMs = 3600_000,
  ) {}

  async get(query: string): Promise<CacheResult | null> {
    const queryVector = await this.embedder.embed(query);

    const results = await this.vectorStore.search(queryVector, 1);
    if (results.length === 0) return null;

    const best = results[0];

    // Check similarity threshold
    if (best.score < this.similarityThreshold) return null;

    // Check TTL
    const age = Date.now() - new Date(best.metadata.createdAt).getTime();
    if (age > this.ttlMs) {
      await this.vectorStore.delete(best.id);
      return null;
    }

    return {
      response: best.metadata.response,
      originalQuery: best.metadata.query,
      similarity: best.score,
      source: 'semantic-cache',
    };
  }

  async set(query: string, response: string): Promise<void> {
    const vector = await this.embedder.embed(query);

    await this.vectorStore.upsert([{
      id: crypto.randomUUID(),
      vector,
      metadata: {
        query,
        response,
        createdAt: new Date().toISOString(),
      },
    }]);
  }
}
```

**Important**: set the similarity threshold high (0.93-0.97). Too low and you'll serve wrong cached answers. Too high and you get few cache hits. Start at 0.95 and tune based on your data.

## 4. Cache Invalidation for AI Responses

The hardest problem in CS, made harder by AI:

```typescript
class SmartCacheInvalidation {
  // Time-based: simple, works for most cases
  static timeBasedTTL(contentType: string): number {
    const ttls: Record<string, number> = {
      'factual-lookup': 86400,        // 24h — facts change slowly
      'analysis': 3600,                // 1h — analysis can get stale
      'creative': 0,                   // don't cache creative outputs
      'classification': 604800,        // 7 days — categories are stable
      'user-specific': 1800,           // 30min — user context changes
    };
    return ttls[contentType] ?? 3600;
  }

  // Event-based: invalidate when underlying data changes
  static async onDataChange(
    cache: LLMCache,
    changedEntity: string
  ): Promise<number> {
    // Find all cache entries that reference this entity
    const affected = await cache.findByMetadata({
      referencedEntities: { contains: changedEntity },
    });

    let invalidated = 0;
    for (const entry of affected) {
      await cache.delete(entry.id);
      invalidated++;
    }

    return invalidated;
  }
}
```

## 5. Provider-Side Prompt Caching

Anthropic and OpenAI offer server-side caching that reduces input token costs:

```typescript
// Anthropic prompt caching — cache the system prompt and static context
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: longSystemPrompt, // 2000+ tokens
      cache_control: { type: 'ephemeral' }, // cache this block
    },
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: largeContextDocument, // RAG context
          cache_control: { type: 'ephemeral' }, // cache this too
        },
        {
          type: 'text',
          text: userQuestion, // only this varies per request
        },
      ],
    },
  ],
});

// Result: cached tokens cost 90% less
// First request: full price (+ 25% write premium)
// Subsequent requests with same prefix: 10% of normal input cost
```

**When to use**: any scenario where system prompt + context is large and reused across calls. Multi-turn conversations, RAG with the same retrieved docs, batch processing with shared instructions.

## Try This Today

Implement a two-layer cache for one LLM endpoint: exact match (Redis) as L1, semantic (embedding similarity) as L2. Log cache hit rates for each layer over 24 hours. Calculate: how much would this save in API costs at your current usage? Bonus: enable Anthropic prompt caching on your most-used system prompt and compare input token costs before/after.

## Resources

- [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — Official guide to server-side prompt caching with Claude
- [GPTCache](https://github.com/zilliztech/GPTCache) — Open-source semantic cache library for LLM responses
