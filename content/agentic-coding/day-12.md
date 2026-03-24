---
title: "Error Handling & Retries"
day: 12
week: 2
weekName: "Architecture"
description: "Why agents fail differently than normal software and retry strategies."
tag: "architecture"
---


## Why This Matters

In traditional software, errors are deterministic: pass bad input, get a predictable exception. You catch it, log it, maybe retry with backoff. Done.

Agents break this model in subtle ways. The same input can produce different outputs on different runs. A tool call might succeed structurally but return semantically wrong data. The LLM might decide not to use a tool at all when it should. Errors in agentic systems are probabilistic, emergent, and often delayed — you won't notice the failure until three tool calls later when the output makes no sense.

This is why error handling in agents deserves its own architectural thinking, not just a `try/catch` wrapper.

---

## Concept 1 — The Three Failure Modes

Agents fail in ways that don't map to traditional exceptions:

**1. Hard failures** — A tool throws, the API times out, the schema is invalid. These are the "easy" ones. You know something went wrong.

**2. Soft failures** — The tool returns a result, the LLM accepts it, but the result is wrong or incomplete. No exception thrown. The agent continues down a broken path.

**3. Loop failures** — The agent keeps calling the same tool with slightly different parameters, making no real progress. Or it hallucinates a result and keeps building on top of it.

```typescript
// Hard failure — obvious
const result = await callTool("search_db", { query: "..." });
// → throws NetworkError: timeout

// Soft failure — invisible
const result = await callTool("search_db", { query: "..." });
// → returns { rows: [] }  ← empty, but the agent treats it as "no results found"
//   when the actual problem was a misconfigured query

// Loop failure — expensive
// Agent retries search_db 7 times with minor variations, burning tokens
```

Your error handling needs to address all three. Most engineers only handle the first.

---

## Concept 2 — Retry Strategies

Not all retries are equal. Three patterns, each for a different failure type:

**Immediate retry** — For transient hard failures (rate limits, network hiccups). Just retry, fast.

```typescript
async function retryImmediate<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
    }
  }
  throw new Error("unreachable");
}
```

**Exponential backoff** — For APIs with rate limits. Respect `Retry-After` headers when present.

```typescript
async function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 100, 30000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}
```

**Reformulate** — The most powerful and most ignored. When a tool call fails because the LLM passed bad parameters, don't retry the same call. Feed the error back into the context and let the model try again with more information.

```typescript
// In your agent loop
const toolResult = await runTool(toolCall);

if (toolResult.error) {
  // Inject the error as a tool result, let the model self-correct
  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: `Error: ${toolResult.error}\n\nPlease try again with corrected parameters.`
  });
  // Next iteration — the model sees what went wrong
}
```

This is underused. LLMs are actually good at self-correcting when they can see their own mistakes.

---

## Concept 3 — Loop Detection & Budget Guards

Without guardrails, a stuck agent is a billing disaster. Implement hard limits at multiple levels:

```typescript
interface AgentRunConfig {
  maxIterations: number;    // Absolute ceiling on the loop
  maxToolCalls: number;     // Total tool invocations allowed
  maxTokensTotal: number;   // Token budget across the run
  timeoutMs: number;        // Wall-clock deadline
}

class AgentRunner {
  private iterations = 0;
  private toolCallCount = 0;

  async run(config: AgentRunConfig): Promise<AgentResult> {
    while (true) {
      if (++this.iterations > config.maxIterations) {
        return { status: "exceeded_iterations", reason: `Hit limit of ${config.maxIterations}` };
      }

      const step = await this.runStep();

      if (step.toolCalls) {
        this.toolCallCount += step.toolCalls.length;
        if (this.toolCallCount > config.maxToolCalls) {
          return { status: "exceeded_tool_calls" };
        }
      }

      if (step.finished) return { status: "success", output: step.output };
    }
  }
}
```

Also detect repetition — if the last N tool calls are identical, something is looping:

```typescript
function isLooping(recentCalls: ToolCall[], windowSize = 3): boolean {
  if (recentCalls.length < windowSize * 2) return false;
  const last = recentCalls.slice(-windowSize);
  const prev = recentCalls.slice(-windowSize * 2, -windowSize);
  return JSON.stringify(last) === JSON.stringify(prev);
}
```

---

## Concept 4 — Escalation to Human

Some failures shouldn't be retried at all. They need a human decision. Design explicit escalation paths:

```typescript
type AgentDecision =
  | { action: "retry"; strategy: "immediate" | "backoff" | "reformulate" }
  | { action: "escalate"; reason: string; context: unknown }
  | { action: "abort"; reason: string };

function classifyFailure(err: AgentError): AgentDecision {
  if (err.code === "RATE_LIMIT") return { action: "retry", strategy: "backoff" };
  if (err.code === "INVALID_PARAMS") return { action: "retry", strategy: "reformulate" };
  if (err.code === "PERMISSION_DENIED") return { action: "escalate", reason: "Needs authorization", context: err };
  if (err.code === "BUDGET_EXCEEDED") return { action: "escalate", reason: "Cost limit hit", context: err };
  return { action: "abort", reason: err.message };
}
```

Hard rule: if an action is irreversible (deleting data, sending a message, making a payment), and the agent is uncertain, escalate — don't guess.

---

## Try This Today

Take any agent or script you already have (even a simple one) and add three things:

1. A **max iterations guard** — set it to 10 and see if anything currently exceeds it.
2. A **reformulate retry** — instead of throwing on a failed tool call, inject the error as context and let the loop continue once.
3. A **loop detector** — log a warning if the last 3 tool calls are identical.

You'll likely discover at least one silent failure you didn't know existed.

---

## Resources

- [Anthropic — Error Handling in Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use#error-handling)
- [Exponential Backoff Patterns (AWS)](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
