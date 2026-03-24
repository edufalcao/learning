---
title: "Week 1 Review + Hands-On"
day: 7
week: 1
weekName: "Foundations"
description: "Consolidate the agent loop, tools, context, prompting, memory, and planning with a real tracing exercise."
tag: "review"
---

You've covered the full conceptual foundation this week: the agent loop, tools, context, prompting, memory, and planning. Today is consolidation day — no new theory, just locking in the mental model with a real example and a practical exercise.

---

## 1. The Agent Loop, Revisited With a Real Example

Let's trace through a concrete scenario: *"Agent, find all TODO comments in this repo and create GitHub issues for them."*

Here's how the loop plays out:

**Perceive:** Agent receives the task. Context window contains the instruction + system prompt.

**Think:** Model decides: first I need to list files, then grep for TODOs, then for each match create an issue.

**Act:** Calls `list_files("/src")` → gets file list.

**Observe:** Tool returns `["auth.ts", "api.ts", "utils.ts"]`.

**Think:** Now grep each file.

**Act:** Calls `grep_file("auth.ts", "TODO")` → `["line 42: // TODO: validate token expiry"]`

**Act (parallel):** Same for api.ts, utils.ts.

**Observe:** Aggregated results.

**Think:** Now I have 3 TODOs. Create issues.

**Act:** Calls `create_github_issue(title, body)` × 3.

**Observe:** Issue URLs returned.

**Think:** Task complete. Report to user.

This is the loop. Every agentic system you'll ever build is a variation of this. The complexity is in the details — how errors are handled, how context is managed across many iterations, when to stop.

---

## 2. The Agent Design Checklist

When you're about to build or evaluate an agent, run through these:

```
[ ] GOAL — Is the task well-defined and bounded?
[ ] TOOLS — Does the agent have the minimum tools needed (no more)?
[ ] MEMORY — What state must persist across steps? Where does it live?
[ ] FAILURES — What happens when a tool fails? Does the agent retry, skip, or escalate?
[ ] EXIT — What's the termination condition? Can the agent get stuck in a loop?
[ ] COST — How many LLM calls does a typical run require? Is that acceptable?
[ ] HUMAN — At what point should a human be asked? Is there a confirmation gate?
```

This isn't bureaucracy — it's the difference between an agent that ships and one that burns tokens chasing its own tail.

---

## 3. Tracing an Open-Source Agent

Reading agent code is one of the highest-leverage learning activities you can do. The patterns become obvious fast.

Here's what to look for in any agent codebase:

```javascript
// Pattern 1: The core loop
while (!done) {
  const response = await llm.complete(messages);
  const toolCalls = extractToolCalls(response);

  if (toolCalls.length === 0) {
    done = true; // model decided it's finished
    break;
  }

  for (const call of toolCalls) {
    const result = await executeTool(call);
    messages.push({ role: "tool", content: result });
  }

  messages.push({ role: "assistant", content: response.content });
}

// Pattern 2: Tool registration
const tools = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute file path" }
      },
      required: ["path"]
    }
  }
];

// Pattern 3: Context management
if (estimateTokens(messages) > MAX_TOKENS * 0.8) {
  messages = compactMessages(messages); // summarize or truncate older entries
}
```

These three patterns appear in nearly every agent implementation, regardless of framework.

---

## 4. What Week 1 Actually Taught You

Connect the dots:

| Day | Concept | One-liner |
|-----|---------|-----------|
| 1 | Agent loop | Perceive → Think → Act → Observe, repeat |
| 2 | Tools | The model's hands — JSON schema bridges intent to execution |
| 3 | Context window | Finite RAM — everything the agent knows right now |
| 4 | Prompting | Instruction quality directly determines agent behavior quality |
| 5 | Memory | In-context is fast and ephemeral; external is persistent but adds latency |
| 6 | Planning | Decompose before executing; parallel when safe, sequential when dependent |

You now have the vocabulary. Week 2 shifts to architecture — how you compose these pieces into systems that don't collapse under real-world load.

---

## Try This Today

**Exercise: Trace a real agent.**

Pick one of these repos and spend 20–30 minutes reading the core loop:

1. **OpenAI Agents SDK** — look at `src/agents/agent.py`, specifically the `run` method
2. **OpenClaw itself** — you're running on it; trace how a heartbeat or cron task dispatches through the system
3. **Any Claude.md / AGENTS.md-driven agent** — your own workspace is an agent; read `AGENTS.md` as the system prompt, trace what happens on a heartbeat

For each, answer:
- Where is the loop?
- Where do tool calls get executed?
- Where does context accumulate?
- What's the termination condition?

Write your answers in a scratch file — the act of writing forces clarity.

---

## Resources

- **Anthropic Agents Guide:** https://docs.anthropic.com/en/docs/build-with-claude/agents — solid reference for tool use, multi-turn loops, and patterns
- **OpenAI Agents SDK source:** https://github.com/openai/openai-agents-python — clean, readable Python implementation of the core loop; worth reading even if you're in JS

---

*Week 2 starts tomorrow: architecture, orchestration, and multi-agent patterns.*
