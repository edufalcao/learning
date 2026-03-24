---
title: "Building a Production Agent"
day: 28
week: 4
weekName: "Production"
description: "End-to-end walkthrough of building a production-grade agent system."
tag: "production"
---


## Why This Matters

There's a significant gap between "an agent that works in a demo" and "an agent that runs reliably in production." Most agents fail in production not because the LLM is bad, but because the scaffolding around it is fragile: no retries, no logging, no version control for prompts, no incident response. As a senior engineer, your job isn't just to make it work once — it's to make it work at 3 AM on a Sunday when you're not watching.

---

## 1. Architecture Checklist for Production

Before shipping an agent to production, run through this checklist:

**Identity & Scope**
- Does the agent have a clearly scoped task? (Avoid "do everything" agents)
- Is the system prompt versioned and stored in source control?
- Is there a human-readable description of what it should and shouldn't do?

**Tools**
- Are all tools idempotent or do they have explicit retry semantics?
- Is there a read-only / dry-run mode for dangerous tools?
- Do tool schemas have strict required fields (no loose `any` types)?

**State & Persistence**
- Where does agent state live? (Database, file, in-context only?)
- What happens if the agent crashes mid-run? Can it resume?
- Is there a checkpointing strategy for long-running tasks?

**Failure Modes**
- Is there a max-iteration limit to prevent infinite loops?
- Does the agent escalate to human-in-the-loop on repeated failure?
- Are tool errors surfaced back to the model with enough context to recover?

```typescript
const MAX_ITERATIONS = 20;

async function runAgent(task: string, tools: Tool[]) {
  const messages: Message[] = [{ role: "user", content: task }];
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    const response = await llm.call({ messages, tools });

    if (response.stop_reason === "end_turn") {
      return response.content;
    }

    if (response.stop_reason === "tool_use") {
      const toolResults = await executeTools(response.tool_calls);
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
  }

  // Escalate after max iterations
  await notifyHuman(`Agent hit max iterations on task: ${task}`);
  throw new Error("Agent exceeded max iterations");
}
```

---

## 2. Deployment Patterns

**Stateless workers (recommended for most tasks):**
Agent receives a task, runs to completion, emits a result. No internal state between invocations. Easy to scale horizontally, easy to retry.

```typescript
// Lambda / Worker pattern
export async function handler(event: AgentTaskEvent) {
  const { taskId, input, config } = event;

  await db.updateTask(taskId, { status: "running", startedAt: Date.now() });

  try {
    const result = await runAgent(input, config);
    await db.updateTask(taskId, { status: "done", result });
  } catch (err) {
    await db.updateTask(taskId, { status: "failed", error: err.message });
    throw err; // Let the worker queue handle retry
  }
}
```

**Persistent sessions (for long-running / iterative agents):**
Agent maintains state across turns (e.g., a coding assistant in an IDE). Requires explicit session management and checkpointing.

**Cron-triggered agents:**
Use a scheduler (like OpenClaw cron or Temporal) to fire agents on a schedule. Keep runs isolated — each cron fire should be a fresh agent invocation, not a continuation of the last.

---

## 3. Versioning Agent Prompts and Tools

Agent behavior is a function of:
1. The model version
2. The system prompt
3. The tool definitions
4. The few-shot examples

Any of these can change behavior. Treat them like code:

```
/agent-configs
  /v1.0.0
    system-prompt.md
    tools.json
    config.json
  /v1.1.0
    system-prompt.md
    tools.json
    config.json
  /current -> v1.1.0  (symlink or pointer)
```

**Git-tag your agent releases.** When something breaks in production, you need to be able to diff prompt v1.0.0 vs v1.1.0 just like you'd diff code.

**Never modify the system prompt in production directly.** Stage → test on evals → promote. Even small prompt changes can cause regression in tool use patterns.

---

## 4. Monitoring and Incident Response

Once deployed, you need visibility:

**What to alert on:**
- Error rate > threshold (tool failures, LLM errors)
- Run duration > p99 expected time
- Cost per run spiking unexpectedly
- Repeated invocation of same tool in a loop (sign of agent stuck)

**Incident runbook (keep this written down):**
1. Identify the run that failed (via trace ID)
2. Replay the exact input with the same model/prompt version
3. Check tool error logs — did an external service fail?
4. Was it a model regression? (compare with previous model version)
5. Roll back prompt version if a recent prompt change caused it

```typescript
// Structured logging for every agent run
logger.info({
  event: "agent_run_complete",
  taskId,
  duration_ms: Date.now() - startTime,
  iterations,
  tool_calls: toolCallLog,
  cost_usd: estimateCost(tokenUsage),
  model: config.model,
  prompt_version: config.promptVersion,
});
```

---

## Try This Today

Take any agent you've built during this series and put it through the **production checklist from section 1**. For each unchecked item, either:
- Add the missing safeguard (max iterations, error escalation, prompt versioning), or
- Consciously decide it's out of scope and document why.

The goal isn't to gold-plate everything — it's to know exactly where your agent will break under stress, and make sure the important guardrails are in place before someone depends on it.

---

## Resources

- [Temporal.io — Durable workflows for long-running agents](https://temporal.io/blog/ai-agents)
- [Langfuse — Prompt versioning + observability in one tool](https://langfuse.com/docs/prompts/get-started)
