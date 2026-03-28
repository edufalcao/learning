---
title: "Event-Driven Architecture for AI Pipelines"
day: 5
week: 1
weekName: "Foundations"
description: "Why events are a natural fit for AI workflows"
tag: "Foundations"
---

# Day 5 — Event-Driven Architecture for AI Pipelines

AI workloads are inherently asynchronous, multi-step, and failure-prone. Event-driven architecture gives you loose coupling between pipeline stages, natural retry semantics, and audit trails for free. If you're building anything beyond a single LLM call, events should be your default coordination mechanism.

## 1. Why Events Are a Natural Fit for AI Workflows

An AI pipeline is a series of transformations where each step may fail, take variable time, and produce non-deterministic output. Events decouple producers from consumers, letting each step operate independently:

```typescript
// Instead of a tightly coupled pipeline:
const extracted = await extract(doc);
const analyzed = await analyze(extracted);
const summarized = await summarize(analyzed);

// Event-driven: each step publishes and subscribes
emitter.on('document.uploaded', async (event) => {
  const extracted = await extract(event.document);
  emitter.emit('document.extracted', { ...event, extracted });
});

emitter.on('document.extracted', async (event) => {
  const analyzed = await analyze(event.extracted);
  emitter.emit('document.analyzed', { ...event, analyzed });
});

emitter.on('document.analyzed', async (event) => {
  const summary = await summarize(event.analyzed);
  emitter.emit('document.summarized', { ...event, summary });
});
```

Benefits: retry a single step without re-running the whole pipeline, add new consumers (logging, metrics, notifications) without modifying existing steps, and replay events for debugging.

## 2. Event Sourcing in Agentic Systems

For agent workflows, storing the full event history is invaluable — you can replay decisions, audit behavior, and debug non-deterministic outputs:

```typescript
interface AgentEvent {
  id: string;
  agentId: string;
  timestamp: Date;
  type: string;
  payload: Record<string, unknown>;
  parentEventId?: string;  // trace causality
}

class AgentEventStore {
  private events: AgentEvent[] = [];

  append(event: Omit<AgentEvent, 'id' | 'timestamp'>) {
    const full: AgentEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    this.events.push(full);
    return full;
  }

  // Replay: rebuild agent state from events
  replay(agentId: string): AgentState {
    return this.events
      .filter(e => e.agentId === agentId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .reduce(agentStateReducer, initialState());
  }

  // Debug: show the full decision trail
  traceDecision(eventId: string): AgentEvent[] {
    const chain: AgentEvent[] = [];
    let current = this.events.find(e => e.id === eventId);
    while (current) {
      chain.unshift(current);
      current = current.parentEventId
        ? this.events.find(e => e.id === current!.parentEventId)
        : undefined;
    }
    return chain;
  }
}
```

## 3. Message Brokers: Redis Streams vs BullMQ vs Kafka

Choose based on your scale and durability needs:

```typescript
// BullMQ (Redis-backed) — best for most Node.js AI apps
// Pro: familiar API, built-in retry/delay/priority, good for <10k events/sec
import { Queue, Worker } from 'bullmq';

const pipeline = new Queue('ai-pipeline');

// Add with dependency chain
const extractJob = await pipeline.add('extract', { docId: '123' });
await pipeline.add('analyze', { docId: '123' }, {
  parent: { id: extractJob.id!, queue: 'ai-pipeline' }
});

// Redis Streams — lower level, more control
// Pro: consumer groups, persistent, lightweight
import { Redis } from 'ioredis';
const redis = new Redis();

// Publish
await redis.xadd('ai:events', '*',
  'type', 'document.extracted',
  'payload', JSON.stringify({ docId: '123', text: '...' })
);

// Consume with consumer group
await redis.xreadgroup('GROUP', 'analyzers', 'analyzer-1',
  'COUNT', 10, 'BLOCK', 5000, 'STREAMS', 'ai:events', '>'
);
```

**Decision guide**: BullMQ for job queues with retries and scheduling. Redis Streams for high-throughput event streaming. Kafka only if you need cross-datacenter replication or >100k events/sec (you probably don't yet).

## 4. Designing Idempotent AI Pipeline Steps

LLM calls are expensive and non-deterministic. If a step retries, you don't want to pay twice for the same work:

```typescript
async function idempotentStep(
  stepId: string,
  inputHash: string,
  execute: () => Promise<unknown>
) {
  const cacheKey = `step:${stepId}:${inputHash}`;
  
  // Check if we already have a result for this exact input
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Acquire a lock to prevent duplicate execution
  const lockKey = `lock:${cacheKey}`;
  const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 300);
  if (!acquired) {
    // Another worker is already processing this — wait for result
    return waitForResult(cacheKey, 30_000);
  }

  try {
    const result = await execute();
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400);
    return result;
  } finally {
    await redis.del(lockKey);
  }
}

// Usage in pipeline
worker.on('extract', async (job) => {
  const inputHash = hashObject(job.data);
  return idempotentStep('extract', inputHash, () =>
    llm.extract(job.data.document)
  );
});
```

The combination of content-based deduplication + distributed locking ensures each unique input is processed exactly once, regardless of retries.

## Try This Today

Refactor a multi-step LLM call in your code into an event-driven pipeline using BullMQ. Define events for each step transition, add a dead letter queue for failures, and implement idempotency on at least one step. Run it with `concurrency: 1` first, then bump to 5 and verify no duplicate processing occurs.

## Resources

- [BullMQ Guide: Flows](https://docs.bullmq.io/guide/flows) — Parent-child job dependencies for multi-step AI pipelines
- [Redis Streams Introduction](https://redis.io/docs/latest/develop/data-types/streams/) — Understanding the streaming primitive behind event-driven patterns
