---
title: "Case Study: Designing hawkbot-mission-control as an AI-Native System"
day: 29
week: 4
weekName: "Multi-Agent & Production"
description: "Apply everything: architecture review of hawkbot-mission-control"
tag: "multi-agent"
---

# Day 29 — Case Study: Designing hawkbot-mission-control as an AI-Native System

This is where theory meets your actual code. hawkbot-mission-control is a personal task watcher and HawkBot control center — a real AI-native app that you're actively building. Today we apply everything from the past 28 days to review its architecture, identify gaps, and propose concrete improvements.

## 1. Current Architecture Assessment

Based on the known stack (Nuxt 3 + TanStack + Drizzle/SQLite), here's a baseline assessment against the AI-native design principles we've covered:

**What likely exists:**
- HTTP request/response for triggering agent tasks
- SQLite via Drizzle for task state persistence
- Direct LLM calls from the backend API layer
- Manual triggering of agent runs

**What's likely missing or underdeveloped:**

| Concern | Gap | Risk |
|---|---|---|
| Observability | No structured logs for LLM calls | Silent failures, no cost visibility |
| Resilience | No retry/fallback chain | Single provider outage = broken app |
| Context management | No explicit context budget tracking | Token overruns, degraded output |
| Async pipeline | Sync LLM calls blocking request/response | Poor UX on long tasks |
| Evals | No behavioral regression testing | Prompt changes break silently |

This isn't criticism — it's the normal state of most early AI-native apps. The goal is to close these gaps deliberately.

## 2. Proposed Improvements with Implementation Steps

### Improvement 1: Structured LLM Client Wrapper

Wrap every Anthropic/OpenAI call in a single client class that handles logging, retries, and fallbacks automatically.

```typescript
// lib/llm-client.ts
export class LLMClient {
  private providers = [
    { name: 'anthropic', client: anthropicClient },
    { name: 'openrouter', client: openrouterClient },
  ];

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const traceId = crypto.randomUUID();

    for (const [index, provider] of this.providers.entries()) {
      try {
        const start = Date.now();
        const result = await withRetry(() => provider.client.complete(params), {
          maxAttempts: 3,
          backoff: 'exponential',
        });

        this.log({ traceId, provider: provider.name, latencyMs: Date.now() - start, ...result.usage });
        return result;
      } catch (err) {
        if (index === this.providers.length - 1) throw err;
        this.log({ traceId, provider: provider.name, error: String(err), fallback: true });
      }
    }
    throw new Error('All providers failed');
  }

  private log(data: Record<string, unknown>) {
    console.log(JSON.stringify({ event: 'llm_call', timestamp: new Date().toISOString(), ...data }));
  }
}
```

**Implementation steps:**
1. Create `lib/llm-client.ts` with the wrapper
2. Replace all direct provider calls with `LLMClient`
3. Add cost calculation per provider/model

### Improvement 2: Async Task Execution with Status Polling

Long-running agent tasks shouldn't block HTTP requests. Use a queue + polling pattern.

```typescript
// Current (problematic)
app.post('/api/tasks/run', async (req, res) => {
  const result = await runAgent(req.body.taskId); // blocks for 30s+
  res.json(result);
});

// Improved
app.post('/api/tasks/run', async (req, res) => {
  const jobId = await taskQueue.enqueue(req.body.taskId);
  res.json({ jobId, status: 'queued' }); // returns immediately
});

app.get('/api/tasks/:jobId/status', async (req, res) => {
  const status = await taskQueue.getStatus(req.params.jobId);
  res.json(status); // client polls this
});
```

TanStack Query handles the polling on the frontend naturally:

```typescript
// Frontend
const { data } = useQuery({
  queryKey: ['task-status', jobId],
  queryFn: () => fetchTaskStatus(jobId),
  refetchInterval: (data) => data?.status === 'done' ? false : 2000,
});
```

### Improvement 3: Context Budget Tracking

Before each agent run, calculate available context and trim accordingly.

```typescript
// lib/context-manager.ts
const MODEL_LIMITS: Record<string, number> = {
  'claude-sonnet-4-6': 200_000,
  'claude-opus-4-6': 200_000,
};

export function buildContext(model: string, parts: ContextPart[]): string {
  const limit = MODEL_LIMITS[model] ?? 100_000;
  const budget = Math.floor(limit * 0.7); // keep 30% for output
  let tokens = 0;
  const selected: ContextPart[] = [];

  // Priority order: system > recent messages > history > background
  for (const part of parts.sort((a, b) => b.priority - a.priority)) {
    const partTokens = estimateTokens(part.content);
    if (tokens + partTokens > budget) break;
    selected.push(part);
    tokens += partTokens;
  }

  return selected.map(p => p.content).join('\n\n');
}
```

## 3. Documenting Architectural Decisions (ADRs)

ADRs are short documents that capture *why* a decision was made — invaluable when you come back to code 6 months later or when HawkBot needs context.

```markdown
# ADR-001: Use SQLite via Drizzle for task state

**Status:** Accepted
**Date:** 2026-03-27

## Context
hawkbot-mission-control needs to persist task state, agent outputs, and run history.

## Decision
Use SQLite via Drizzle ORM. Single-user app on local machine — no need for a server database.

## Consequences
- ✅ Zero infrastructure, instant setup, works offline
- ✅ Drizzle gives type-safe queries with migrations
- ⚠️ Not suitable for multi-user or distributed deployment
- ⚠️ File-based — backup strategy needed
```

Store ADRs in `docs/adr/` in the repo. One file per decision.

## Try This Today

Pick one of the three improvements above and implement it in hawkbot-mission-control. The LLM client wrapper is the highest leverage — it unlocks observability and resilience in one shot. Start there: create `lib/llm-client.ts`, migrate one API route to use it, and verify the structured logs appear on the next agent run.

## Resources

- [ADR GitHub repo — Michael Nygard's original format](https://github.com/joelparkerhenderson/architecture-decision-record)
- [TanStack Query — polling with refetchInterval](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
