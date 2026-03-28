---
title: "Streaming Data Pipelines for Real-Time AI Features"
day: 12
week: 2
weekName: "Data & Context"
description: "Stream processing vs batch processing for AI"
tag: "data-context"
---

# Day 12 — Streaming Data Pipelines for Real-Time AI Features

Batch processing works for offline analysis, but real-time AI features — live classification, content moderation, dynamic recommendations — need streaming architectures. The challenge: LLM calls are slow and expensive, so you can't naively process every event through a model.

## 1. Stream Processing vs Batch Processing for AI

```typescript
// Batch: process accumulated data periodically
// ✅ Good for: daily reports, embedding updates, bulk classification
async function batchProcess() {
  const documents = await db.getUnprocessed({ limit: 1000 });
  const results = await Promise.all(
    documents.map(doc => llm.classify(doc)) // 1000 LLM calls = $$$
  );
  await db.saveResults(results);
}

// Stream: process each event as it arrives
// ✅ Good for: real-time moderation, live alerts, interactive features
async function streamProcess(event: IncomingEvent) {
  // But you can't call an LLM for every event at high throughput
  // Need: filtering, batching, and smart routing
}
```

The key insight: streaming AI pipelines need a **filter → batch → process → emit** pattern, not a naive per-event LLM call.

## 2. Real-Time Feature Extraction with LLMs

```typescript
import { Queue, Worker } from 'bullmq';

// Micro-batching: collect events, process in batches
class StreamingAIPipeline {
  private buffer: Event[] = [];
  private flushInterval: NodeJS.Timer;

  constructor(
    private queue: Queue,
    private batchSize = 10,
    private flushMs = 2000, // flush every 2s even if batch not full
  ) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }

  async ingest(event: Event): Promise<void> {
    // Pre-filter: skip events that don't need AI processing
    if (!this.needsAI(event)) {
      await this.emitDirect(event); // pass through without LLM
      return;
    }

    this.buffer.push(event);
    if (this.buffer.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);
    await this.queue.add('process-batch', { events: batch });
  }

  private needsAI(event: Event): boolean {
    // Rule-based pre-filter: only send ambiguous cases to LLM
    if (event.type === 'known-safe') return false;
    if (event.confidence && event.confidence > 0.95) return false;
    return true;
  }
}

// Worker processes batches efficiently
const worker = new Worker('process-batch', async (job) => {
  const { events } = job.data;

  // Single LLM call for the batch (cheaper than N individual calls)
  const batchPrompt = events.map((e: Event, i: number) =>
    `Item ${i + 1}: ${e.content}`
  ).join('\n');

  const result = await llm.complete({
    system: 'Classify each item. Return JSON array with classifications.',
    messages: [{ role: 'user', content: batchPrompt }],
  });

  const classifications = JSON.parse(result.text);
  // Emit results to downstream consumers
  for (let i = 0; i < events.length; i++) {
    await emitResult({ ...events[i], classification: classifications[i] });
  }
});
```

## 3. Windowing Strategies

When processing time-series data with AI, windowing determines what data the model sees:

```typescript
class WindowManager {
  // Tumbling window: fixed, non-overlapping time periods
  tumbling(events: TimestampedEvent[], windowMs: number): TimestampedEvent[][] {
    const windows = new Map<number, TimestampedEvent[]>();
    for (const event of events) {
      const windowKey = Math.floor(event.timestamp / windowMs) * windowMs;
      if (!windows.has(windowKey)) windows.set(windowKey, []);
      windows.get(windowKey)!.push(event);
    }
    return [...windows.values()];
  }

  // Session window: groups events with gaps < threshold
  // Perfect for user activity sessions
  session(events: TimestampedEvent[], gapMs: number): TimestampedEvent[][] {
    if (events.length === 0) return [];

    const sessions: TimestampedEvent[][] = [[]];
    let lastTime = events[0].timestamp;

    for (const event of events) {
      if (event.timestamp - lastTime > gapMs) {
        sessions.push([]);  // new session
      }
      sessions[sessions.length - 1].push(event);
      lastTime = event.timestamp;
    }
    return sessions;
  }

  // Sliding window: overlapping windows for smooth analysis
  sliding(events: TimestampedEvent[], windowMs: number, slideMs: number): TimestampedEvent[][] {
    const start = Math.min(...events.map(e => e.timestamp));
    const end = Math.max(...events.map(e => e.timestamp));
    const windows: TimestampedEvent[][] = [];

    for (let windowStart = start; windowStart < end; windowStart += slideMs) {
      const windowEnd = windowStart + windowMs;
      windows.push(events.filter(e =>
        e.timestamp >= windowStart && e.timestamp < windowEnd
      ));
    }
    return windows;
  }
}
```

**Session windows** are the most natural fit for AI-native apps — they group user activity into logical sessions, then summarize or classify each session as a whole.

## 4. Building a Real-Time Classification Pipeline

Putting it all together — a production-ready streaming classifier:

```typescript
class RealtimeClassifier {
  private pipeline: StreamingAIPipeline;
  private cache: Map<string, { result: string; expiry: number }> = new Map();

  constructor(private llm: LLMClient, private queue: Queue) {
    this.pipeline = new StreamingAIPipeline(queue);
  }

  async classify(content: string): Promise<ClassificationResult> {
    // Layer 1: Check cache (exact match)
    const cacheKey = hashContent(content);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return { classification: cached.result, source: 'cache' };
    }

    // Layer 2: Rule-based fast path
    const ruleResult = this.applyRules(content);
    if (ruleResult.confidence > 0.95) {
      return { classification: ruleResult.label, source: 'rules' };
    }

    // Layer 3: Small model for medium confidence
    const smallModelResult = await this.smallModel.classify(content);
    if (smallModelResult.confidence > 0.85) {
      this.cache.set(cacheKey, {
        result: smallModelResult.label,
        expiry: Date.now() + 3600_000,
      });
      return { classification: smallModelResult.label, source: 'small-model' };
    }

    // Layer 4: Full LLM for hard cases only
    const llmResult = await this.llm.classify(content);
    this.cache.set(cacheKey, {
      result: llmResult.label,
      expiry: Date.now() + 3600_000,
    });
    return { classification: llmResult.label, source: 'llm' };
  }
}
```

This tiered approach means 80%+ of classifications never hit the LLM — huge cost and latency savings.

## Try This Today

Build a micro-batching pipeline: accept individual events via an API endpoint, buffer them, and flush to a single batched LLM call every 2 seconds or every 5 events (whichever comes first). Measure: (1) average latency per event, (2) LLM calls saved vs per-event processing, (3) cost difference. Use BullMQ for the queue and a simple Express server for ingestion.

## Resources

- [Apache Kafka Streams Concepts](https://kafka.apache.org/documentation/streams/core-concepts) — Windowing and stream processing fundamentals (concepts apply to any stream system)
- [BullMQ Rate Limiting](https://docs.bullmq.io/guide/rate-limiting) — Built-in rate limiting for controlling LLM call throughput in streaming pipelines
