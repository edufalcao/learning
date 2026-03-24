---
title: "Debugging Agents"
day: 17
week: 3
weekName: "Implementation"
description: "Techniques for debugging non-deterministic agent behavior and reasoning traces."
tag: "implementation"
---


## Why This Hits Different

Debugging a regular function is straightforward: given input X, you expect output Y. You add a breakpoint, inspect state, fix the logic. Done.

Debugging an agent is fundamentally different. The "bug" might be in a prompt, in how a tool result was interpreted, in an unexpected model behavior on a specific input combination, or in an emergent interaction between three different tool calls. Traditional debugging instincts don't fully translate.

As a senior engineer, you need a new mental model: **agents fail probabilistically, not deterministically**. Understanding that shifts your entire approach.

---

## Core Concepts

### 1. The Agent Failure Taxonomy

Before you can debug an agent, you need to know what kind of failure you're looking at:

- **Reasoning failure** — The model chose the wrong next step. It had all the right information but drew the wrong conclusion. Usually a prompt or context issue.
- **Tool failure** — The model called the right tool with wrong parameters, or called the wrong tool entirely. Schema mismatches or ambiguous tool descriptions are common culprits.
- **Context drift** — Later in a long session, earlier context was effectively "forgotten" or drowned out. The model starts making decisions inconsistent with earlier instructions.
- **Loop failure** — The agent gets stuck in a retry/rethink loop, burning tokens without progress. Often triggered by a tool error the agent doesn't know how to handle.
- **Hallucinated tool call** — The model fabricates parameters or invents tool names that don't exist. Happens more with weaker models or poorly defined schemas.

Identify the category first. It determines where you look.

---

### 2. Structured Logging Is Non-Negotiable

Your agent needs to emit structured logs at every meaningful step. Not just "agent ran" but:

```typescript
interface AgentLogEntry {
  step: number;
  timestamp: string;
  type: "llm_call" | "tool_call" | "tool_result" | "error" | "final";
  input?: unknown;   // what went into the LLM or tool
  output?: unknown;  // what came back
  tokenUsage?: { prompt: number; completion: number };
  durationMs?: number;
}
```

Log every LLM call (with the full messages array), every tool invocation, and every tool result. This is your flight recorder — when the agent crashes, you replay the tape.

```typescript
async function loggedToolCall(name: string, args: unknown, fn: () => Promise<unknown>) {
  const start = Date.now();
  log({ type: "tool_call", tool: name, args });
  try {
    const result = await fn();
    log({ type: "tool_result", tool: name, result, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    log({ type: "error", tool: name, error: String(err), durationMs: Date.now() - start });
    throw err;
  }
}
```

Without this, you're debugging blind.

---

### 3. Reproducing Agent Failures Reliably

This is the hard part. Non-determinism is real — run the same agent twice and you may get different behavior. But you can make failures more reproducible:

**Lock the model version.** Always pin to a specific model version (e.g., `claude-3-5-sonnet-20241022`, not `claude-3-5-sonnet-latest`). Model updates silently change behavior.

**Set temperature to 0 for debugging.** Deterministic outputs make reproduction dramatically easier. Once fixed, restore temperature if needed.

**Snapshot the inputs.** Save the full conversation state (messages array + tool definitions) at the point of failure. This is your repro case:

```typescript
// On failure, dump the full state
if (process.env.DEBUG_AGENT) {
  fs.writeFileSync(
    `debug-repro-${Date.now()}.json`,
    JSON.stringify({ messages, tools, model, temperature: 0 }, null, 2)
  );
}
```

Now you can replay that exact scenario in a test harness without running the whole agent from scratch.

**Use seed parameters when available.** Some APIs (OpenAI) support a `seed` parameter for more deterministic outputs. Anthropic doesn't (yet), but it's worth knowing.

---

### 4. Reading the Thought Process

Modern models often expose reasoning or chain-of-thought — use it. Even without explicit CoT, you can infer a lot from tool call sequences:

```
LLM → calls read_file("package.json")          ✅ expected
LLM → calls read_file("package-lock.json")     🤔 why?
LLM → calls write_file("package.json", ...)    🚨 overwrote something
```

The sequence tells a story. If the model is reading files it shouldn't need, it's either lost context or fishing for something that should already be in the prompt.

A useful debugging trick: add a `think` tool that the agent can call to externalize its reasoning before acting:

```typescript
{
  name: "think",
  description: "Use this to reason through the current situation before acting. Does not affect state.",
  parameters: {
    type: "object",
    properties: {
      reasoning: { type: "string", description: "Your current plan and reasoning" }
    },
    required: ["reasoning"]
  }
}
```

When `think` appears in logs, you see exactly what the model believed was true before it made a decision. Gold for debugging reasoning failures.

---

## Try This Today

Take any agent you've built (or the minimal loop from Day 15) and add three things:

1. **Structured JSON logging** to a file for every LLM call and tool call
2. **A `think` tool** that logs the model's reasoning without side effects
3. **A debug dump** on error: save the full messages array as a `.json` file

Then intentionally break something — give the agent a missing file, a wrong tool parameter, a contradictory instruction. Observe how the failure propagates through the logs. Practice reading failures from the tape before trying to fix them.

If you don't have an agent handy: write a quick `replay-agent.ts` script that reads a debug dump JSON and re-submits it to the API with `temperature: 0`, so you can iterate on fixes without running the whole system.

---

## Resources

- **Langfuse** — Open-source LLM observability, designed exactly for agent tracing: <https://langfuse.com>
- **Anthropic: Tool use debugging** — Official guidance on diagnosing tool call failures: <https://docs.anthropic.com/en/docs/build-with-claude/tool-use>

---

*Day 17/30 — Debugging Agents | Agentic Coding Series*
