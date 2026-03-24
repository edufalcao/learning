---
title: "Human-in-the-Loop Patterns"
day: 24
week: 4
weekName: "Production"
description: "When and how to involve humans in agent decision-making loops."
tag: "production"
---


## Why This Matters

Full autonomy is a trap. The most dangerous bugs in agentic systems aren't crashes — they're silent, confident wrong actions. An agent that can send emails, push code, or delete records needs to know when to stop and ask. But an agent that asks too often is just a slow, expensive chatbot.

HITL is the discipline of drawing that line correctly. For a senior engineer, the challenge isn't understanding _why_ you need human checkpoints — it's designing them so they're precise, not paranoid.

---

## Core Concepts

### 1. The Three Interrupt Triggers

There are three rational reasons for an agent to pause and request human input:

**Confidence threshold breach** — the model doesn't know the right answer and knows it. Good agents can express uncertainty. Build a check: if the reasoning involves hedged language ("I assume", "probably", "not sure"), treat it as a soft trigger.

**Irreversibility** — an action that can't be undone cheaply. File deletion, sending a message, writing to production, financial transactions. These are hard stops. You can model this as a flag on each tool:

```typescript
const tools = [
  {
    name: "delete_file",
    description: "Permanently delete a file",
    irreversible: true,   // custom flag
    parameters: { path: { type: "string" } }
  },
  {
    name: "read_file",
    description: "Read a file",
    irreversible: false,
    parameters: { path: { type: "string" } }
  }
];

function shouldRequireApproval(tool: Tool): boolean {
  return tool.irreversible === true;
}
```

**Scope escalation** — the agent starts doing something you didn't ask it to do. This is hard to catch programmatically, but you can add a scope manifest at the start of each run: "This agent is authorized to do X and Y. If a tool call falls outside this scope, halt and confirm."

---

### 2. Approval Flows: Inline vs Async

Two patterns dominate:

**Inline (synchronous)** — agent halts, presents the pending action, waits for input, then continues. Simple, predictable. Works well in CLI tools and chat interfaces.

```typescript
async function executeWithApproval(agent: Agent, action: AgentAction) {
  if (requiresApproval(action)) {
    const confirmed = await promptUser(
      `Agent wants to: ${action.description}\nApprove? (y/n)`
    );
    if (!confirmed) {
      return { status: "rejected", feedback: "User denied." };
    }
  }
  return agent.execute(action);
}
```

**Async (queue-based)** — agent submits an approval request to a queue (Telegram, Slack, email), parks its state, and resumes when the human responds. More complex, but essential for long-running agents.

```typescript
// Agent side
async function requestApproval(action: AgentAction): Promise<string> {
  const requestId = uuid();
  await db.approvals.insert({ id: requestId, action, status: "pending" });
  await notify(`Approval needed [${requestId}]: ${action.description}`);
  
  // Park state and wait
  return await pollForApproval(requestId, { timeoutMs: 24 * 60 * 60 * 1000 });
}

// Human side responds via webhook/bot → updates db.approvals → agent resumes
```

The async pattern maps directly to what you see in tools like Devin or in OpenClaw's own approval flows.

---

### 3. Review Gates vs Confirmation Prompts

These are different UX patterns with different friction levels:

| Pattern | Use When | User Action |
|---|---|---|
| **Confirmation prompt** | Single risky action, clear scope | Yes/No |
| **Review gate** | Batch of changes, structured output | Edit/Approve/Reject |
| **Summary + approve** | Long autonomous run with many actions | Review log, then approve |

Review gates are particularly useful for coding agents. Instead of interrupting per file, the agent produces a diff and presents it as a single checkpoint:

```
Agent completed:
  ✏️  Modified: src/api/users.ts (+12 / -3)
  ✏️  Modified: src/api/auth.ts (+5 / -1)
  ➕  Created: src/middleware/rateLimit.ts

Approve changes? [y/n/show diff]
```

---

### 4. Balancing Autonomy with Oversight

Too many interrupts = you're not getting value from the agent. Too few = risk exposure. The right calibration depends on:

- **Task novelty**: first time the agent does X → more gates. Tenth time → fewer.
- **Reversibility cost**: cheap to undo → let it run. Expensive to undo → confirm.
- **Trust score**: agents that have a track record can be granted higher autonomy gradually.

One practical approach: start every agent workflow in **supervised mode** (gates on all irreversible actions), then promote specific action types to **trusted mode** after N successful confirmations.

```typescript
const autonomyLevel = await getTrustLevel(agent.id, action.type);
// "supervised" | "trusted" | "auto"

if (autonomyLevel !== "auto") {
  await requestApproval(action);
}
```

---

## Try This Today

Take any tool in an agent you've built or used (or OpenClaw itself) that performs an **irreversible action** — deleting, sending, posting, writing to a DB.

1. Add an `irreversible: true` flag to that tool definition.
2. In your agent loop, intercept any tool call where `irreversible === true`.
3. Print a dry-run summary of what _would_ happen and prompt for confirmation before executing.

Even if you just mock it in a script, this exercise makes the approval gate pattern concrete and forces you to think about what "irreversible" actually means for each tool.

---

## Resources

- **Anthropic — Building agents with human oversight:** https://docs.anthropic.com/en/docs/build-with-claude/agents#human-in-the-loop
- **LangGraph — Human-in-the-loop walkthrough:** https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/
