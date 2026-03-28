---
title: "Week 1 Synthesis: Your AI-Native Architecture Checklist"
day: 7
week: 1
weekName: "Foundations"
description: "Review: the 6 core decisions of any AI-native system"
tag: "Foundations"
---

# Day 7 — Week 1 Synthesis: Your AI-Native Architecture Checklist

You've spent six days building mental models for AI-native design. Today we synthesize everything into a practical decision framework — something you can pull out at the start of any AI-native project and use to make fast, informed architectural decisions.

## 1. The 6 Core Decisions of Any AI-Native System

Every AI-native system requires you to explicitly decide on these six dimensions. Leaving any of them implicit is where production incidents come from:

```typescript
interface AIArchitectureDecisions {
  // Day 1: How central is the LLM?
  aiCriticality: {
    classification: 'augmented' | 'native';
    fallbackStrategy: 'rule-based' | 'cached' | 'graceful-degradation' | 'none';
    // If 'native' + 'none' → you have an unmitigated risk
  };

  // Day 2: What are your cost/latency constraints?
  performanceBudget: {
    maxLatencyP99Ms: number;
    maxCostPerRequest: number;
    monthlyBudgetCap: number;
    providers: { primary: string; fallback?: string };
  };

  // Day 3: How do you manage prompts?
  promptManagement: {
    storage: 'inline' | 'file-based' | 'registry';
    versionStrategy: 'git' | 'semver-registry';
    testingApproach: 'deterministic-only' | 'deterministic+evals';
  };

  // Day 4: What's your async strategy?
  asyncPattern: {
    userFacing: 'streaming' | 'polling' | 'webhook' | 'sync';
    internal: 'queue-based' | 'event-driven' | 'direct';
    backpressure: 'shed-load' | 'degrade' | 'queue-unbounded';
  };

  // Day 5: How do pipeline steps communicate?
  pipelineDesign: {
    coordination: 'sequential' | 'event-driven' | 'dag';
    idempotency: boolean;
    retryStrategy: 'exponential-backoff' | 'fixed' | 'none';
    deadLetterQueue: boolean;
  };

  // Day 6: How do you handle state?
  stateManagement: {
    conversationState: 'memory' | 'redis' | 'database';
    taskState: 'redis' | 'database';
    worldState: 'database' | 'vector-db';
    checkpointing: boolean;
  };
}
```

## 2. Building a Decision Framework

Not every project needs the same rigor on every dimension. Use this quick triage:

```typescript
function triageProject(project: ProjectDescription): Priority[] {
  const priorities: Priority[] = [];

  // High traffic + user-facing → latency & cost first
  if (project.expectedRPM > 100 && project.isUserFacing) {
    priorities.push('performanceBudget', 'asyncPattern', 'pipelineDesign');
  }

  // Multi-step agent → state & events first
  if (project.hasAgents || project.pipelineSteps > 2) {
    priorities.push('stateManagement', 'pipelineDesign', 'asyncPattern');
  }

  // Rapid prompt iteration → prompt management first
  if (project.promptChangeFrequency === 'daily') {
    priorities.push('promptManagement');
  }

  // Mission-critical → everything matters, but especially fallbacks
  if (project.aiCriticality === 'native') {
    priorities.unshift('aiCriticality'); // always first
  }

  return [...new Set(priorities)];
}
```

## 3. Architecture Review Template

Use this template when reviewing any AI-native system design:

```markdown
## AI-Native Architecture Review

### 1. LLM Dependency Map
- [ ] Every LLM call identified and classified (augmented vs native)
- [ ] Fallback defined for every native-critical call
- [ ] Maximum chain depth documented (how many sequential LLM calls?)

### 2. Performance Budget
- [ ] P99 latency target defined per endpoint
- [ ] Cost per request estimated (input + output tokens)
- [ ] Monthly cost projection at target scale
- [ ] Provider fallback chain defined

### 3. Prompt Lifecycle
- [ ] Prompts stored as versioned artifacts (not inline strings)
- [ ] Output schemas defined (Zod or similar)
- [ ] Deterministic template tests exist
- [ ] Eval suite exists for critical prompts

### 4. Async Strategy
- [ ] User-facing responses are streamed (where applicable)
- [ ] Multi-step pipelines use queues/events (not sequential awaits)
- [ ] Backpressure mechanism defined
- [ ] Timeout budgets set per pipeline step

### 5. Pipeline Resilience
- [ ] Each step is idempotent
- [ ] Dead letter queue configured
- [ ] Retry policy defined with max attempts
- [ ] Poison pill detection (infinite retry prevention)

### 6. State Management
- [ ] State types identified (conversation / task / world)
- [ ] Storage backend chosen per state type
- [ ] Checkpointing enabled for multi-step tasks
- [ ] State machine constraints defined (valid transitions)
```

## 4. Applying It: hawkbot-mission-control

Let's sketch how these decisions apply to Eduardo's actual project:

```typescript
const hawkbotArchitecture: AIArchitectureDecisions = {
  aiCriticality: {
    classification: 'native',  // AI drives task dispatch and decisions
    fallbackStrategy: 'rule-based', // basic rule engine when LLM unavailable
  },
  performanceBudget: {
    maxLatencyP99Ms: 5000,     // background dispatch can tolerate more
    maxCostPerRequest: 0.05,   // ~$0.05 per dispatch decision
    monthlyBudgetCap: 50,      // personal project budget
    providers: { primary: 'anthropic', fallback: 'openrouter' },
  },
  promptManagement: {
    storage: 'file-based',
    versionStrategy: 'git',
    testingApproach: 'deterministic+evals',
  },
  asyncPattern: {
    userFacing: 'streaming',   // Nuxt SSE for real-time updates
    internal: 'queue-based',   // BullMQ for task dispatch
    backpressure: 'degrade',   // skip non-critical AI enrichment under load
  },
  pipelineDesign: {
    coordination: 'event-driven',
    idempotency: true,
    retryStrategy: 'exponential-backoff',
    deadLetterQueue: true,
  },
  stateManagement: {
    conversationState: 'memory',
    taskState: 'database',      // SQLite via Drizzle
    worldState: 'database',
    checkpointing: true,
  },
};
```

This isn't a final architecture — it's a starting point that forces explicit decisions on every dimension.

## Try This Today

Take the architecture review template above and run it against hawkbot-mission-control (or any AI-native project you're building). For each unchecked item, write a one-line note: "Needed: yes/no" and "Effort: trivial/medium/hard." This gives you a prioritized improvement backlog in 20 minutes.

## Resources

- [Thoughtworks Technology Radar — AI-Assisted Development](https://www.thoughtworks.com/radar) — Industry trends on AI tooling and architecture patterns
- [Architecture Decision Records (ADRs)](https://adr.github.io/) — Lightweight format for documenting architectural decisions — essential for AI-native systems where decisions have non-obvious trade-offs
