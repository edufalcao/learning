---
title: "Orchestrator/Worker Pattern"
day: 9
week: 2
weekName: "Architecture"
description: "How to split roles between agents using supervisor delegation patterns."
tag: "architecture"
---


## Why This Matters

Yesterday you drew the line between single-agent and multi-agent systems. Today you learn the most common pattern for crossing that line: the **orchestrator/worker** split. This isn't academic — it's the exact architecture behind Devin, GitHub Copilot Workspace, and yes, OpenClaw itself. Understanding it at a mechanical level will change how you design any automation that involves more than one step and more than one concern.

---

## Core Concepts

### 1. Role Separation: What the Orchestrator Actually Does

The orchestrator is not a "smarter" agent — it's a **coordinator**. Its job is to:
- Understand the high-level goal
- Decompose it into tasks
- Delegate tasks to workers
- Collect results, check coherence, decide what's next
- Know when the goal is complete (or failed)

Crucially, the orchestrator **doesn't do the work itself**. It reasons about the work. This separation keeps its context clean and focused. An orchestrator that starts writing code is an orchestrator that loses track of the big picture.

```js
// Orchestrator prompt (simplified)
const ORCHESTRATOR_SYSTEM = `
You are a task coordinator. Given a high-level goal:
1. Break it into discrete tasks.
2. Assign each to the appropriate worker (coder, tester, reviewer).
3. Pass results between workers as needed.
4. Return a final summary when done.

You do NOT write code. You delegate.
`;
```

### 2. Workers Are Specialists

Each worker has a **narrow, well-defined responsibility** and a context tuned for it. The coding worker only sees the file it needs to edit. The test worker only sees the code diff and test suite. The review worker only sees the PR.

This specialization matters for two reasons:
- **Token efficiency:** each worker gets a smaller, denser context → better focus, lower cost
- **Replaceability:** you can swap a worker (e.g., use a cheaper model for tests) without touching the orchestrator

```js
const workers = {
  coder: {
    model: 'claude-sonnet-4-6',
    system: 'You are a senior JS engineer. Given a task description and file context, write or modify the code. Return only the updated file.',
  },
  tester: {
    model: 'claude-haiku',
    system: 'You are a test engineer. Given a code change, write Jest unit tests covering the changed behavior. Return only the test file.',
  },
  reviewer: {
    model: 'claude-sonnet-4-6',
    system: 'You are a code reviewer. Given a diff, return structured feedback: [APPROVE], [REQUEST_CHANGES], or [BLOCK] with reasoning.',
  },
};
```

### 3. The Delegation Protocol

How does the orchestrator talk to workers? This is where most implementations go wrong. The handoff must include:
- **Clear task description** — what to do, not how
- **Necessary context** — exactly what the worker needs, nothing extra
- **Expected output format** — structured responses prevent the orchestrator from playing text parser

A clean pattern is to have the orchestrator emit structured task objects:

```js
// Orchestrator output (parsed by the harness)
const task = {
  worker: 'coder',
  description: 'Add input validation to the `createUser` function in src/users.js',
  context: {
    file: fs.readFileSync('src/users.js', 'utf8'),
    requirements: 'Email must be valid format. Username must be 3–20 alphanumeric chars.',
  },
  outputFormat: 'Return only the updated src/users.js file, no explanation.',
};
```

The **harness** (your orchestration runtime) is responsible for routing task objects to workers, calling their respective LLM sessions, and feeding results back to the orchestrator.

### 4. Real Example: Coding → Test → Review Pipeline

Here's the flow for a typical agentic PR workflow:

```
User: "Add email validation to createUser"
        │
        ▼
[Orchestrator]
  - Decompose: [task: edit code] → [task: write tests] → [task: review]
        │
        ▼
[Coder Worker]
  - Reads src/users.js
  - Adds validation logic
  - Returns updated file
        │
        ▼
[Tester Worker]
  - Receives updated file + diff
  - Generates test cases
  - Returns test file
        │
        ▼
[Reviewer Worker]
  - Receives diff + tests
  - Returns: [APPROVE] "validation covers edge cases, tests are solid"
        │
        ▼
[Orchestrator]
  - All tasks complete, no issues flagged
  - Returns summary to user
```

Each agent in that pipeline had a single responsibility and clean inputs/outputs. The orchestrator never touched a file — it only moved information between agents and decided what came next.

---

## One Thing to Watch Out For

**Avoid the "god orchestrator" trap.** If your orchestrator starts doing real work (parsing code, making decisions that belong to the reviewer, etc.), it degrades fast. Its context fills up with task-irrelevant details, it starts making errors, and debugging becomes a nightmare. Keep it thin and strategic.

---

## Try This Today

Design (on paper or in a file) an orchestrator/worker system for a task you actually have. Pick something real — a feature from hawkbot-mission-control, a refactor you've been postponing, anything. Answer these questions:

1. What is the orchestrator's responsibility? (Write its system prompt in one paragraph.)
2. What are the workers? (Name each one and write its one-line purpose.)
3. What does each worker receive as input? What does it return?
4. How does the orchestrator know when the pipeline is done?

You don't have to implement it today. The design exercise alone will surface assumptions you didn't know you had.

---

## Resources

- **LangGraph — Multi-Agent Architectures:** https://langchain-ai.github.io/langgraph/concepts/multi_agent/
  Solid visual explanation of orchestrator/worker, supervisor, and handoff patterns with code examples.

- **Anthropic — Building Effective Agents (Orchestration section):** https://docs.anthropic.com/en/docs/build-with-claude/agents
  The "agents as workflows" framing maps directly to today's pattern and is worth re-reading with this mental model in mind.
