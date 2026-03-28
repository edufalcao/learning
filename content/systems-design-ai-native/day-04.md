---
title: "Async-First Design: Why Sync Patterns Fail with AI"
day: 4
week: 1
weekName: "Foundations"
description: "The problem with blocking on LLM calls"
tag: "Foundations"
---

# Day 4 — Async-First Design: Why Sync Patterns Fail with AI

A typical LLM call takes 1-15 seconds. Chain three together and your user stares at a spinner for 45 seconds. Traditional request/response patterns were designed for 50ms database queries, not multi-second generative AI calls. If you don't go async-first, your UX and your server's throughput will both suffer.

## 1. The Problem with Blocking on LLM Calls

```typescript
// This looks fine but kills UX and throughput
app.post('/api/analyze', async (req, res) => {
  const extraction = await llm.extract(req.body.document);   // 3s
  const analysis = await llm.analyze(extraction);              // 5s
  const summary = await llm.summarize(analysis);               // 2s
  res.json({ summary }); // 10s later — user is gone
});
```

Problems multiply: each request holds a connection open, Node's event loop handles fewer concurrent requests, and if any step fails at second 8, you've wasted all prior work.

## 2. Async Patterns for AI Workloads

**Streaming responses** — return partial results as they generate:

```typescript
app.post('/api/analyze', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const stream = await llm.stream({
    messages: [{ role: 'user', content: req.body.prompt }],
  });

  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// Client-side with EventSource
const source = new EventSource('/api/analyze', { method: 'POST' });
source.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.done) source.close();
  else appendToUI(data.text);
};
```

**Job-based pattern** — for multi-step pipelines:

```typescript
// Submit → Poll pattern
app.post('/api/jobs', async (req, res) => {
  const jobId = crypto.randomUUID();
  await jobQueue.add('ai-pipeline', {
    jobId,
    input: req.body,
    steps: ['extract', 'analyze', 'summarize'],
  });
  res.json({ jobId, status: 'queued' });
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = await jobStore.get(req.params.id);
  res.json({
    status: job.status,            // queued | processing | completed | failed
    completedSteps: job.completed, // ['extract', 'analyze']
    result: job.status === 'completed' ? job.result : undefined,
  });
});
```

## 3. Queue-Based Architectures for AI Workloads

Queues decouple request ingestion from LLM processing, giving you backpressure control and retry capabilities:

```typescript
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({ maxRetriesPerRequest: null });

const aiQueue = new Queue('ai-tasks', { connection });

const worker = new Worker('ai-tasks', async (job) => {
  const { input, step } = job.data;

  // Update progress for the client
  await job.updateProgress({ step, status: 'processing' });

  const result = await callLLMWithRetry(step, input);

  // Chain to next step if needed
  if (job.data.nextStep) {
    await aiQueue.add(job.data.nextStep, {
      input: result,
      step: job.data.nextStep,
      jobGroup: job.data.jobGroup,
    });
  }

  return result;
}, {
  connection,
  concurrency: 5,          // max parallel LLM calls
  limiter: {
    max: 50,                // rate limit: 50 jobs
    duration: 60_000,       // per minute (match provider RPM)
  },
});
```

## 4. Backpressure and Flow Control

Without backpressure, a traffic spike queues thousands of LLM calls that take minutes to drain — and you pay for every token:

```typescript
class BackpressureController {
  private pending = 0;
  private readonly maxConcurrent: number;
  private readonly maxQueueDepth: number;

  constructor(maxConcurrent = 10, maxQueueDepth = 100) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueDepth = maxQueueDepth;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.pending >= this.maxQueueDepth) {
      throw new Error('Service overloaded — try again later');
    }

    // Wait for a slot
    while (this.pending >= this.maxConcurrent) {
      await new Promise(r => setTimeout(r, 100));
    }

    this.pending++;
    try {
      return await fn();
    } finally {
      this.pending--;
    }
  }

  get pressure(): number {
    return this.pending / this.maxConcurrent; // 0-1 scale
  }
}

// Use it to shed load gracefully
const controller = new BackpressureController(10, 100);

app.post('/api/ai', async (req, res) => {
  if (controller.pressure > 0.8) {
    // Return degraded response instead of queueing
    return res.json(await getFallbackResponse(req.body));
  }
  const result = await controller.execute(() => llm.complete(req.body));
  res.json(result);
});
```

The pattern: measure pressure → shed load → degrade gracefully → never let the queue grow unbounded.

## Try This Today

Take a synchronous LLM endpoint in your codebase and convert it to streaming using Server-Sent Events. Measure the perceived latency improvement — time-to-first-useful-content should drop from full response time to TTFT (usually 200-500ms). If you don't have an endpoint, build a minimal one: Express + Anthropic SDK streaming.

## Resources

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — SSE fundamentals for streaming AI responses
- [BullMQ Documentation](https://docs.bullmq.io/) — Production-grade job queue for Node.js, perfect for AI pipeline orchestration
