---
title: "Long-Running Agents"
day: 25
week: 4
weekName: "Production"
description: "Patterns for agents that run for minutes or hours: checkpointing, recovery, heartbeats."
tag: "production"
---


## Why This Matters

Most agent demos run in under 30 seconds. Real production agents don't. A code refactoring agent might need hours. A research agent could span days. An agent that monitors your inbox and dispatches tasks on your behalf has no natural end.

The moment you cross the "fits in one LLM context window" boundary, you need a fundamentally different mindset. Long-running agents aren't just fast agents that run longer — they require explicit state management, failure recovery, and async execution models. This is where agentic engineering starts to look a lot like distributed systems design.

---

## Core Concepts

### 1. Checkpointing State

A short-lived agent keeps all its state in memory. A long-running agent must externalize it.

**Checkpoint = serialized agent state at a known good point.** If the process dies, restarts, or is paused by the user, it should resume from the last checkpoint — not from scratch.

What belongs in a checkpoint:
- Current goal and sub-goals
- Completed steps (with outputs)
- Pending steps (what's left to do)
- Tool call history (so you don't re-run idempotent-sensitive actions)
- Context summary (compressed history)

```typescript
interface AgentCheckpoint {
  agentId: string;
  runId: string;
  createdAt: string;
  goal: string;
  completedSteps: Step[];
  pendingSteps: Step[];
  contextSummary: string;
  metadata: Record<string, unknown>;
}

async function saveCheckpoint(cp: AgentCheckpoint) {
  const path = `./checkpoints/${cp.runId}.json`;
  await fs.writeFile(path, JSON.stringify(cp, null, 2));
}

async function loadCheckpoint(runId: string): Promise<AgentCheckpoint | null> {
  try {
    const raw = await fs.readFile(`./checkpoints/${runId}.json`, "utf8");
    return JSON.parse(raw);
  } catch {
    return null; // No checkpoint = fresh start
  }
}
```

**Key rule:** Save a checkpoint *after* each meaningful step completes, *before* moving to the next. This minimizes the work lost on failure.

---

### 2. Resuming After Failure

A long-running agent will fail. Network timeouts, token limits, API errors, process crashes — these are inevitable over hours or days. The question isn't *if*, it's *how gracefully*.

**Resumption strategy:**
1. On startup, check for an existing checkpoint for this `runId`
2. If found, restore state and skip completed steps
3. Summarize the completed context into the prompt instead of replaying raw history

```typescript
async function runAgent(goal: string, runId: string) {
  let checkpoint = await loadCheckpoint(runId);

  const completedSteps = checkpoint?.completedSteps ?? [];
  const pendingSteps = checkpoint?.pendingSteps ?? await planSteps(goal);
  const contextSummary = checkpoint?.contextSummary ?? "";

  for (const step of pendingSteps) {
    if (completedSteps.some(s => s.id === step.id)) continue; // Skip done

    const result = await executeStep(step, contextSummary);
    completedSteps.push({ ...step, result });

    // Update context summary incrementally
    const updatedSummary = await summarizeProgress(contextSummary, step, result);

    await saveCheckpoint({
      agentId: "my-agent",
      runId,
      createdAt: new Date().toISOString(),
      goal,
      completedSteps,
      pendingSteps: pendingSteps.filter(s => !completedSteps.some(c => c.id === s.id)),
      contextSummary: updatedSummary,
      metadata: {},
    });
  }
}
```

---

### 3. Cron-Driven and Async Agent Workflows

Not all long-running agents are continuous. Many are *episodic* — they wake up, do work, sleep, repeat.

**Cron-driven agent pattern:**
- Schedule agent runs at defined intervals
- Each run reads persisted state, does incremental work, writes updated state
- No single process stays alive between runs

This is exactly how OpenClaw's scheduled lessons work: a cron job fires, an isolated agent session spins up, reads context, generates output, saves state, exits.

```
+--[Cron trigger]--+
|                  |
v                  v
[Load state]   [Load state]
    |               |
[Do work]      [Do work]
    |               |
[Save state]   [Save state]
    |               |
[Exit]         [Exit]
```

**When to use cron-driven vs continuous:**
| Approach | Use When |
|---|---|
| Continuous | Real-time reactions needed (user chat, live monitoring) |
| Cron-driven | Periodic tasks, batching, async workflows |
| Event-driven | Triggered by external events (webhooks, file changes) |

---

### 4. Context Window Bridging

A long-running agent accumulates more history than fits in any context window. You need to bridge sessions without losing important state.

**Three strategies:**

**a) Rolling summary** — At each checkpoint, summarize completed work into a paragraph. Pass the summary, not the raw history.

**b) Structured state** — Store key facts in structured format (JSON) rather than conversation history. The agent reads the JSON, not the chat log.

**c) Retrieval** — Store outputs as searchable artifacts. At the start of each session, retrieve only what's relevant to the current step.

```typescript
async function buildSessionPrompt(checkpoint: AgentCheckpoint): Promise<string> {
  return `
You are resuming work on this goal: "${checkpoint.goal}"

## What You've Done So Far
${checkpoint.contextSummary}

## Completed Steps
${checkpoint.completedSteps.map(s => `- ✅ ${s.name}: ${s.result}`).join("\n")}

## Current Task
${checkpoint.pendingSteps[0]?.name ?? "All steps complete."}

Continue from where you left off. Do not repeat completed work.
  `.trim();
}
```

The key insight: **you're not replaying conversation history** — you're injecting a compact, structured representation of past work into a fresh context.

---

## Try This Today

**Build a resumable agent runner.**

1. Pick a multi-step task (e.g., "research 5 topics and write summaries for each")
2. Implement the checkpoint save/load pattern above
3. Halfway through execution, kill the process (`Ctrl+C`)
4. Restart it — verify it picks up from the last checkpoint, not from scratch
5. Bonus: add a `--reset` flag that deletes the checkpoint and forces a fresh start

This exercise will immediately reveal edge cases in your state design (e.g., what if a step partially completed?).

---

## Resources

- **LangGraph Persistence docs** — how LangGraph handles checkpointing natively: <https://langchain-ai.github.io/langgraph/concepts/persistence/>
- **Building durable workflows with temporal.io** — production-grade approach to long-running agent workflows: <https://docs.temporal.io/develop/typescript>
