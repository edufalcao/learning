---
title: "Cost Control: Monitoring and Optimizing LLM Spend"
day: 19
week: 3
weekName: "Reliability"
description: "Cost attribution: per-user, per-feature, per-pipeline"
tag: "reliability"
---

# Day 19 — Cost Control: Monitoring and Optimizing LLM Spend

LLM costs scale linearly with usage — there's no volume discount on tokens. Without cost controls, a popular feature or a bug in a retry loop can burn through your budget in hours. Cost management isn't an afterthought; it's a core architectural concern.

## 1. Cost Attribution: Per-User, Per-Feature, Per-Pipeline

You can't optimize what you don't measure. Track cost at the granularity that lets you make decisions:

```typescript
interface CostEvent {
  timestamp: Date;
  traceId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  // Attribution dimensions
  userId?: string;
  feature: string;       // 'classification', 'chat', 'summarization'
  pipeline?: string;     // 'document-analysis-v2'
  step?: string;         // 'extract', 'analyze'
  cached: boolean;
}

class CostTracker {
  private events: CostEvent[] = [];
  private dailyBudget: number;
  private alertThreshold: number;

  constructor(dailyBudget: number, alertThreshold = 0.8) {
    this.dailyBudget = dailyBudget;
    this.alertThreshold = alertThreshold;
  }

  record(event: CostEvent): void {
    this.events.push(event);
    this.checkBudget();
  }

  private checkBudget(): void {
    const todayCost = this.getTodayCost();
    if (todayCost > this.dailyBudget * this.alertThreshold) {
      this.alert(`Daily cost ${todayCost.toFixed(2)} approaching budget ${this.dailyBudget}`);
    }
    if (todayCost > this.dailyBudget) {
      this.alert(`BUDGET EXCEEDED: ${todayCost.toFixed(2)} > ${this.dailyBudget}`);
    }
  }

  // Analytics
  costByFeature(days = 7): Record<string, number> {
    const cutoff = Date.now() - days * 86400_000;
    return this.events
      .filter(e => e.timestamp.getTime() > cutoff)
      .reduce((acc, e) => {
        acc[e.feature] = (acc[e.feature] || 0) + e.cost;
        return acc;
      }, {} as Record<string, number>);
  }

  costByUser(days = 7): { userId: string; cost: number }[] {
    const cutoff = Date.now() - days * 86400_000;
    const byUser = new Map<string, number>();
    for (const e of this.events.filter(e => e.timestamp.getTime() > cutoff)) {
      if (e.userId) {
        byUser.set(e.userId, (byUser.get(e.userId) || 0) + e.cost);
      }
    }
    return [...byUser.entries()]
      .map(([userId, cost]) => ({ userId, cost }))
      .sort((a, b) => b.cost - a.cost);
  }
}
```

## 2. Token Optimization Techniques

```typescript
// 1. Prompt compression — remove redundant instructions
const verbosePrompt = `
Please carefully analyze the following text. I would like you to identify
the main topics discussed. Please be thorough in your analysis and make sure
to consider all aspects. Format your response as JSON.
`; // ~40 tokens

const optimizedPrompt = `
Identify main topics. Return JSON array of strings.
`; // ~12 tokens — 70% savings, same output quality

// 2. Output length control
const response = await llm.complete({
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 200,  // cap output — output tokens are 3-5x more expensive
});

// 3. System prompt caching (Anthropic)
const cachedResponse = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  system: [{
    type: 'text',
    text: longSystemPrompt,        // 2000 tokens, cached
    cache_control: { type: 'ephemeral' },
  }],
  messages: [{ role: 'user', content: shortQuery }],
});
// Cached tokens: 10% of normal cost after first call

// 4. Batch similar requests into one call
async function batchClassify(items: string[]): Promise<string[]> {
  // One call for 20 items instead of 20 separate calls
  const result = await llm.complete({
    messages: [{
      role: 'user',
      content: `Classify each:\n${items.map((item, i) => `${i+1}. ${item}`).join('\n')}\n\nReturn JSON array of classifications.`
    }],
  });
  return JSON.parse(result.text);
}
```

## 3. Model Routing: Smart vs Cheap Model Selection

Not every query needs your most expensive model. Route dynamically based on complexity:

```typescript
class ModelRouter {
  private models = {
    fast:   { name: 'claude-haiku', costPer1K: 0.00025, quality: 'good' },
    smart:  { name: 'claude-sonnet', costPer1K: 0.003, quality: 'great' },
    best:   { name: 'claude-opus', costPer1K: 0.015, quality: 'best' },
  };

  async route(query: string, context: RoutingContext): Promise<string> {
    // Rule-based routing
    if (context.taskType === 'classification') return this.models.fast.name;
    if (context.taskType === 'code-generation') return this.models.smart.name;
    if (context.taskType === 'complex-reasoning') return this.models.best.name;

    // Complexity-based routing
    const complexity = this.estimateComplexity(query);
    if (complexity < 0.3) return this.models.fast.name;
    if (complexity < 0.7) return this.models.smart.name;
    return this.models.best.name;
  }

  private estimateComplexity(query: string): number {
    // Simple heuristics (could be a small classifier model)
    let score = 0;
    if (query.length > 500) score += 0.2;
    if (query.includes('explain') || query.includes('analyze')) score += 0.2;
    if (query.includes('compare') || query.includes('trade-off')) score += 0.3;
    if ((query.match(/\?/g) || []).length > 2) score += 0.2; // multi-part question
    return Math.min(score, 1);
  }
}
```

## 4. Budget Alerts and Hard Caps

```typescript
class BudgetEnforcer {
  constructor(
    private tracker: CostTracker,
    private limits: {
      dailyCap: number;
      perUserCap: number;
      perRequestCap: number;
    }
  ) {}

  async checkBefore(request: LLMRequest): Promise<BudgetDecision> {
    // Per-request estimate
    const estimatedCost = this.estimateCost(request);
    if (estimatedCost > this.limits.perRequestCap) {
      return { allow: false, reason: `Estimated cost ${estimatedCost} exceeds per-request cap` };
    }

    // Per-user daily limit
    if (request.userId) {
      const userCost = this.tracker.userCostToday(request.userId);
      if (userCost + estimatedCost > this.limits.perUserCap) {
        return { allow: false, reason: 'User daily budget exhausted', degradeTo: 'fast-model' };
      }
    }

    // Global daily limit
    const dailyCost = this.tracker.getTodayCost();
    if (dailyCost + estimatedCost > this.limits.dailyCap) {
      return { allow: false, reason: 'Daily budget exhausted', degradeTo: 'cache-only' };
    }

    return { allow: true };
  }

  private estimateCost(request: LLMRequest): number {
    const inputTokens = countTokens(JSON.stringify(request.messages));
    const estimatedOutputTokens = request.maxTokens || 1000;
    return (inputTokens * 0.003 + estimatedOutputTokens * 0.015) / 1000;
  }
}
```

## Try This Today

Add cost tracking to every LLM call in one project. After 24 hours, answer: (1) what's your total daily spend, (2) which feature costs the most, (3) which user costs the most, (4) what percentage of calls could use a cheaper model. Implement model routing for the cheapest optimization: route simple tasks to Haiku and measure the cost reduction.

## Resources

- [OpenRouter](https://openrouter.ai/docs) — Multi-provider API with built-in cost tracking and model routing
- [Anthropic Usage API](https://docs.anthropic.com/en/api/usage) — Monitor your Claude API usage and costs programmatically
