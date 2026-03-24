---
title: "Planning & Task Decomposition"
day: 6
week: 1
weekName: "Foundations"
description: "How agents break complex goals into executable steps using plan-then-execute and ReAct strategies."
tag: "foundations"
---

## Why This Matters

Most LLMs, when prompted with a complex goal, will try to do everything in one shot — and fail somewhere in the middle. Planning changes this. A senior engineer doesn't start coding a feature without understanding the scope; an agent shouldn't either. The difference between an agent that hallucinated its way to a broken result and one that actually shipped is almost always in how it decomposed the task.

---

## Core Concepts

### 1. What Planning Actually Means for Agents

Planning isn't about generating a Gantt chart. It's about **reducing a complex goal into steps small enough to execute reliably**, where each step has a clear success condition.

Two broad styles:

- **Plan-then-execute:** The agent reasons upfront and produces a step list, then executes each one. Good for structured tasks with known shape (e.g., "migrate this schema").
- **React as you go (ReAct):** The agent picks the next action based on current state, without a fixed plan. Better for exploratory or ambiguous tasks (e.g., "debug this flaky test").

Neither is universally better. Most production agents blend both.

```
Goal: "Add OAuth login to the app"

Plan-then-execute would produce:
  1. Read existing auth code
  2. Identify entry points
  3. Install oauth library
  4. Implement callback route
  5. Update session logic
  6. Write tests
  7. Update docs

ReAct would start with:
  → read auth directory
  → see it uses JWT
  → look for existing /auth routes
  → decide next step based on what's there
```

### 2. Sequential vs Parallel Execution

Breaking a task down into steps is only the start. The next question is: **which steps depend on each other?**

Independent steps can (and should) run in parallel — this is where multi-agent systems really shine. Dependent steps must be serialized.

```js
// Sequential (forced order)
await readFile('auth.js');
await analyzeCode(content);
await writeFix(analysis);

// Parallel where possible
const [authCode, configCode, routesCode] = await Promise.all([
  readFile('auth.js'),
  readFile('config.js'),
  readFile('routes/index.js'),
]);
const analysis = await analyzeAll([authCode, configCode, routesCode]);
```

For agents, this translates directly: an orchestrator that dispatches multiple worker agents in parallel for independent subtasks will be dramatically faster than one that serializes everything.

### 3. Task Decomposition Strategies

There are practical heuristics for decomposing well:

**Horizontal decomposition** — break by phase:
```
Research → Design → Implement → Test → Document
```

**Vertical decomposition** — break by domain slice:
```
Auth feature → DB layer / API layer / Frontend / Tests
```

**Recursive decomposition** — each subtask can itself be decomposed until it hits "atomic" (small enough for one tool call or one agent turn):
```
"Ship feature"
  → "Implement backend"
      → "Create migration"
      → "Add API endpoint"
  → "Implement frontend"
      → "Add form component"
      → "Wire API call"
```

The atomic unit rule: **if a step requires more than one tool call to verify completion, decompose further.**

### 4. When to Plan Upfront vs React

The practical heuristic:

| Situation | Prefer |
|-----------|--------|
| Well-defined scope, known steps | Plan-then-execute |
| Exploratory, many unknowns | ReAct |
| Long task that might drift | Plan + checkpoints |
| Short, low-stakes task | Just execute |

For code tasks specifically: start with a quick read pass (ReAct) to understand the codebase, then switch to plan-then-execute for the actual implementation. This is how senior engineers work too.

A common pattern: generate a `PLAN.md` at the start of a task, commit to it, then execute step by step with the ability to revise if something unexpected emerges.

```js
// Agent generates plan before acting
const plan = await llm.generate({
  system: "You are a planning agent. Given a task, output a numbered JSON plan.",
  user: task
});

// Then executes each step, updating state
for (const step of plan.steps) {
  const result = await executeStep(step);
  context.push({ step, result });
  // Could re-plan here if result was unexpected
}
```

---

## Try This Today

Take one real task you're working on — a feature, a refactor, anything with multiple moving parts. Write a decomposition for it as if you were instructing an agent:

1. List every step as a concrete, verifiable action (not "handle auth", but "read `auth/session.ts` and identify where JWT is validated")
2. Draw the dependency graph: which steps can run in parallel?
3. Mark the atomic steps — small enough that one tool call could complete them

This exercise will change how you think about both agent design and your own work.

---

## Resources

- **ReAct: Synergizing Reasoning and Acting in Language Models** — the original paper behind the pattern most agents use: https://arxiv.org/abs/2210.03629
- **LangGraph planning patterns** (concrete code examples of plan-and-execute vs react): https://langchain-ai.github.io/langgraph/tutorials/plan-and-execute/plan-and-execute/
