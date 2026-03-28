---
title: "Deployment Patterns: Edge vs Cloud vs Hybrid"
day: 26
week: 4
weekName: "Multi-Agent & Production"
description: "When to run inference at the edge"
tag: "multi-agent"
---

# Day 26 — Deployment Patterns: Edge vs Cloud vs Hybrid

Where you run AI inference affects latency, cost, privacy, and availability. The choices range from running everything in the cloud to pushing inference to the edge. Understanding the trade-offs lets you make deliberate architectural decisions instead of defaulting to "just use the API."

## 1. When to Run Inference at the Edge

Edge inference means the model runs on the user's device or a CDN edge node. Good for:

```typescript
// Edge inference is worth it when:
const EDGE_INFERENCE_BENEFITS = {
  latencyCritical: true,     // <100ms required — network roundtrip too slow
  offlineNeeded: true,       // must work without internet
  privacySensitive: true,   // data can't leave the device
  highVolume: true,         // millions of requests, cloud costs prohibitive
};

// Tools: WebLLM, llama.cpp, Transformers.js, Chrome's built-in AI APIs
// Trade-offs: model size limited (~7B params for consumer hardware), quality vs size
```

## 2. Cloudflare Workers + AI: Patterns and Limits

Cloudflare Workers AI lets you run inference at Cloudflare's edge (~300 locations). Great for low-latency access globally:

```typescript
// Cloudflare Workers AI — inference at the edge
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { prompt } = await request.json();

    // Uses serverless GPU inference at the nearest edge location
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 512,
    });

    return Response.json({ response: response.response });
  },
};

// Limitations to know:
// - Model selection is limited (Anthropic/GPT not available)
// - Context window limited (~4K-8K depending on model)
// - Cold starts ~200-500ms on first request
// - No streaming yet (Workers limitation)
// - Cost: per-token pricing similar to standard API
```

## 3. Hybrid Architectures: Edge Routing, Cloud Inference

The best pattern for most AI-native apps: edge handles routing and simple tasks, cloud handles complex inference:

```typescript
class HybridAIArchitecture {
  constructor(
    private edgeClient: EdgeAIClient,    // Cloudflare Workers or similar
    private cloudClient: CloudAIClient, // Anthropic/OpenAI
    private router: RequestRouter,
  ) {}

  async complete(request: AIRequest): Promise<AIResponse> {
    // Route at the edge
    const route = this.router.route(request);

    switch (route.destination) {
      case 'edge':
        // Fast path: edge inference for simple tasks
        return this.edgeClient.complete(request);

      case 'cloud':
        // Cloud inference for complex tasks
        return this.cloudClient.complete(request);

      case 'cache':
        // Edge cache hit — return immediately
        return this.getCached(request);

      case 'reject':
        // Too expensive or risky — return fallback
        return this.getFallback(request);
    }
  }
}

// Routing logic — decides where to process
class RequestRouter {
  route(request: AIRequest): RouteDecision {
    // Simple tasks: edge
    if (request.taskType === 'classification' && request.estimatedTokens < 1000) {
      return { destination: 'edge', model: 'edge-classifier' };
    }

    // Complex reasoning: cloud
    if (request.requiresDeepReasoning) {
      return { destination: 'cloud', model: 'claude-sonnet' };
    }

    // Check cache first
    const cacheKey = this.buildCacheKey(request);
    if (this.cache.has(cacheKey)) {
      return { destination: 'cache', cacheKey };
    }

    // Default to cloud
    return { destination: 'cloud', model: 'claude-haiku' };
  }
}
```

## 4. Cold Start Mitigation for AI Workloads

Serverless GPU inference has cold starts. Mitigate with:

```typescript
class ColdStartMitigation {
  private warmInstances = 0;
  private readonly minWarm = 2;
  private readonly maxWarm = 10;

  constructor(private provider: CloudAIProvider) {
    // Keep minimum instances warm
    this.scheduleWarming();
  }

  private async scheduleWarming(): Promise<void> {
    // Run a dummy inference every 5 minutes to keep GPU warm
    setInterval(async () => {
      if (this.warmInstances < this.minWarm) {
        await this.provider.warm();
        this.warmInstances++;
      }
    }, 5 * 60 * 1000);

    // Scale down during off-hours
    schedule('0 22 * * *', () => this.warmInstances = 0); // scale to zero at 10pm
    schedule('0 8 * * *', () => this.warmInstances = this.minWarm); // warm up at 8am
  }
}

// Alternative: keep a long-running inference server (not serverless)
// Trade-off: pay for idle, but no cold starts
```

## Try This Today

Deploy a simple Cloudflare Worker that uses Workers AI to run a small model at the edge. Compare latency to your cloud API for the same task. If latency to your current provider is >100ms, the edge might be worth it for real-time features.

## Resources

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) — Serverless AI inference at the edge
- [WebLLM](https://webllm.mlc.ai/) — Run LLMs in the browser using WebGPU — no server needed for certain models
