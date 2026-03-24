---
title: "Single vs Multi-Agent Systems"
day: 8
week: 2
weekName: "Architecture"
description: "Know when to use one agent vs many — the highest-leverage architecture decision in agent design."
tag: "architecture"
---

## Why This Matters

Most production agent failures aren't LLM failures — they're architecture failures. Engineers reach for multi-agent systems too early, paying enormous coordination overhead for problems a single focused agent could handle. Or they stay with one agent too long, watching it hallucinate and lose context trying to juggle a dozen responsibilities simultaneously.

Knowing *when* to split is one of the highest-leverage decisions in agent system design.

---

## Core Concept 1: What a Single Agent Actually Is

A single agent is one context window, one LLM, one tool-calling loop. That's it. Everything it knows lives in its context, and every decision goes through one model call.

**Single agents excel when:**
- The task has a clear, bounded scope
- Required tools are few (< ~8) and don't overlap conceptually
- The context window is sufficient for the full task
- Failure handling is simple (retry the same agent)

```js
// A single agent that reads a file, finds bugs, and writes a fix
const agent = new Agent({
  system: "You are a bug-fixing agent. Read files, identify bugs, write patches.",
  tools: [readFile, writeFile, runTests],
  model: "claude-sonnet-4-5",
});

await agent.run("Fix the type errors in src/api/users.ts");
```

If `src/api/users.ts` is 200 lines and the fix is isolated, this is exactly the right approach. No orchestration needed.

---

## Core Concept 2: When One Agent Breaks Down

Single agents start failing predictably in a few scenarios:

**Context saturation:** The agent needs to process a 5,000-line codebase, run tests, read docs, and track 20 errors simultaneously. Its context fills up and it starts forgetting earlier observations — the classic "anterograde amnesia" failure.

**Role confusion:** When one agent must be simultaneously a planner, a coder, a tester, and a reviewer, its system prompt becomes a blob of competing instructions. Agents are better at *one job done well* than *many jobs done adequately*.

**Serialized bottleneck:** Task A must finish before Task B starts, even if they're independent. A single agent processes sequentially. If you have 10 files to refactor in parallel, a single agent takes 10x longer.

**Trust boundaries:** Some actions require confirmation before execution (deleting records, deploying). You can't split "thinking" from "acting" inside a single agent loop without awkward hacks.

---

## Core Concept 3: Multi-Agent Architecture Fundamentals

Multi-agent systems work by splitting *concerns* across agents with different contexts, capabilities, and permissions.

The three most common topologies:

**Pipeline (sequential):**
```
PlannerAgent → CoderAgent → TestAgent → ReviewAgent
```
Each agent receives the previous agent's output as its input. Clean, auditable, predictable.

**Parallel (fan-out/fan-in):**
```
OrchestratorAgent
  ├── WorkerAgent(file1)
  ├── WorkerAgent(file2)
  └── WorkerAgent(file3)
         ↓
  AggregatorAgent
```
Independent subtasks run concurrently. The orchestrator collects results and synthesizes.

**Hierarchical (supervisor → specialist):**
```
SupervisorAgent
  ├── CodebaseAnalystAgent
  ├── SecurityAuditAgent
  └── DocumentationAgent
```
The supervisor delegates based on task type, specialization routes the work.

---

## Core Concept 4: The Real Cost of Coordination

Multi-agent sounds powerful — and it is — but it's not free. Every agent boundary adds:

- **Latency:** You're making N sequential or parallel LLM calls instead of one
- **Tokens:** Passing context between agents means re-sending it each time (or summarizing it, which loses fidelity)
- **Failure surface:** If any agent in a pipeline fails, the whole chain fails unless you build recovery logic
- **Debug complexity:** Tracing a bug across 4 agents is substantially harder than tracing it in one

A rough heuristic: **start with one agent, split when you hit a concrete problem** (context overflow, role confusion, parallelization bottleneck, trust boundary). Don't split speculatively.

```js
// Bad: Premature multi-agent for a simple code review
const orchestrator = new Agent({ ... }); // spawns 3 sub-agents
const styleAgent = new Agent({ ... });
const logicAgent = new Agent({ ... });
const securityAgent = new Agent({ ... });

// This adds 3x latency and 4x cost for a task a single agent handles in one pass

// Good: One agent, focused system prompt, review checklist in tools
const reviewer = new Agent({
  system: `Review code for: style (ESLint rules), logic errors, and basic security.
           Output structured JSON with findings per category.`,
  tools: [readFile, runLinter],
});
```

---

## Try This Today

Take a task you'd normally think "this needs multiple agents" and architect it two ways:

1. **Single agent version:** What system prompt + tool set would you give it? What are the failure modes?
2. **Multi-agent version:** Where exactly is the split? What does each agent receive as input? What does it output?

Then ask yourself: *What specific, concrete problem does the multi-agent version solve that the single agent version can't?* If you can't answer that in one sentence, the single agent is probably the right call.

Bonus: open any multi-agent framework (LangGraph, CrewAI, OpenAI Swarm) and look at one of their example architectures. Identify which topology they're using and why.

---

## Resources

- [Anthropic — Building effective agents](https://www.anthropic.com/research/building-effective-agents) — Covers the exact tradeoffs discussed today, with Anthropic's own recommendations on when to go multi-agent
- [LangGraph — Multi-agent architectures](https://langchain-ai.github.io/langgraph/concepts/multi_agent/) — Practical walkthrough of the topologies above with runnable examples
