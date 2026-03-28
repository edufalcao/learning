---
title: "What Makes an App \"AI-Native\"?"
day: 1
week: 1
weekName: "Foundations"
description: "Mental model shift: LLM as infrastructure, not a feature"
tag: "Foundations"
---

# Day 1 — What Makes an App "AI-Native"?

Most production systems today bolt LLMs onto existing architectures — a chat endpoint here, a summarization job there. AI-native systems treat the LLM as core infrastructure, not a feature toggle. This distinction changes everything: data flow, error handling, state management, and UX design.

## 1. Mental Model Shift: LLM as Infrastructure

In a traditional app, your business logic is deterministic code. In an AI-native app, the LLM *is* the business logic for significant portions of your system. This is the same leap we made from monoliths to microservices — the unit of computation changes.

```typescript
// AI-augmented: LLM bolted onto existing flow
async function processOrder(order: Order) {
  const result = await validateOrder(order);      // deterministic
  const summary = await llm.summarize(order);      // nice-to-have
  await saveOrder({ ...result, summary });
}

// AI-native: LLM drives the core decision
async function processOrder(order: Order, context: UserContext) {
  const plan = await llm.planFulfillment(order, context); // LLM decides HOW
  const validated = await executeWithGuardrails(plan);     // code validates
  await saveOrder(validated);
}
```

The second pattern means your architecture must handle non-determinism at the core, not at the edges.

## 2. The Three Pillars: Context, Latency, Non-Determinism

Every AI-native architecture decision revolves around these three constraints:

**Context** — LLMs have finite context windows. How you select, compress, and prioritize information directly determines output quality. This is your most scarce resource.

**Latency** — A GPT-4 class call takes 2-15 seconds. Chain three calls and you're at 45 seconds. Traditional request/response patterns collapse. You must design for async, streaming, and speculative execution from day one.

**Non-determinism** — The same input can produce different outputs. This breaks caching, testing, and debugging assumptions. You need statistical validation (evals) instead of assertion-based tests.

```typescript
// These three pillars shape every architectural decision
interface AIArchitectureConstraints {
  context: {
    windowSize: number;        // tokens available
    costPerToken: number;      // $ per input/output token
    retrievalStrategy: 'rag' | 'summary' | 'sliding-window';
  };
  latency: {
    p50Ms: number;             // typical response time
    p99Ms: number;             // tail latency
    streamingEnabled: boolean; // can we stream partial results?
  };
  determinism: {
    temperature: number;
    evalPassRate: number;      // % of evals passing (not 100%!)
    fallbackStrategy: 'retry' | 'cache' | 'rule-based';
  };
}
```

## 3. AI-Native vs AI-Augmented: Key Architectural Differences

| Dimension | AI-Augmented | AI-Native |
|-----------|-------------|-----------|
| Error handling | Try/catch, retry | Fallback chains, graceful degradation, eval gates |
| Testing | Unit tests pass/fail | Statistical evals, LLM-as-judge |
| State | Request-scoped | Persistent context, memory systems |
| Data flow | Synchronous pipelines | Event-driven, streaming |
| UX | Loading spinners | Progressive disclosure, streaming UI |
| Cost | Fixed infra | Variable per-request, needs budgeting |

The biggest mistake teams make: applying AI-augmented patterns to AI-native problems. If your system depends on LLM output for correctness, you need AI-native architecture from the start.

## 4. Your First Design Lens: Reversibility and Fallback

In deterministic systems, you can predict failure modes. With LLMs, you can't — hallucinations, refusals, and format violations happen unpredictably. Design every AI-driven step to be **reversible** or have a **fallback**:

```typescript
async function aiNativeStep<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  validate: (result: T) => boolean
): Promise<T> {
  try {
    const result = await primary();
    if (validate(result)) return result;
    console.warn('Primary LLM output failed validation, using fallback');
    return fallback();
  } catch (err) {
    console.error('Primary LLM call failed:', err);
    return fallback();
  }
}

// Usage: every AI step has a non-AI escape hatch
const classification = await aiNativeStep(
  () => llm.classify(document),
  () => ruleBasedClassifier(document),  // deterministic fallback
  (result) => VALID_CATEGORIES.includes(result.category)
);
```

This pattern — validate-or-fallback — is the single most important habit in AI-native engineering. Build it into every LLM interaction from the start.

## Try This Today

Audit one of your existing projects (hawkbot-mission-control is a great candidate). List every LLM interaction and classify each as:
1. **Augmentation** — system works without it, just worse
2. **Core** — system breaks without it

For each "core" interaction, write down: what's the fallback if the LLM fails? If there's no answer, that's your first reliability gap.

## Resources

- [Building LLM-Powered Applications (Chip Huyen)](https://huyenchip.com/2025/01/16/ai-engineering.html) — Comprehensive overview of AI engineering patterns
- [Anthropic's Guide to Building with Claude](https://docs.anthropic.com/en/docs/build-with-claude/overview) — Practical patterns from an LLM provider's perspective
