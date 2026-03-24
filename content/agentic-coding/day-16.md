---
title: "Code Generation Agents"
day: 16
week: 3
weekName: "Implementation"
description: "Patterns for agents that write, test, and iterate on code autonomously."
tag: "implementation"
---


> *How coding agents actually work under the hood — and what makes them fail.*

---

## Why This Matters

You've probably used GitHub Copilot, Cursor, or Codeium. But there's a difference between autocomplete and a true code generation agent. The latter can read your codebase, plan a change, write it, run tests, and iterate — all without you touching the keyboard. Understanding the internals of this loop will help you build better agents, debug them when they go wrong, and design systems that actually work in production.

---

## 1. The Core Loop: Read → Plan → Write → Verify

A coding agent isn't magic — it's a structured loop over well-defined steps:

```
┌─────────────┐
│   Read      │  ← Understand the codebase context
│             │
│   Plan      │  ← Decide what to change and how
│             │
│   Write     │  ← Produce the actual code
│             │
│   Verify    │  ← Run tests, linters, type-checkers
│             │
│   ↺ Iterate │  ← On failure, re-enter the loop
└─────────────┘
```

Each step is powered by a tool call. The agent reads files, writes patches, executes shell commands, and reads back the output. The LLM is the brain; the tools are the hands.

```js
const tools = [
  { name: "read_file",    description: "Read a file by path" },
  { name: "write_file",   description: "Write content to a file" },
  { name: "run_command",  description: "Execute a shell command and return stdout/stderr" },
  { name: "list_dir",     description: "List files in a directory" },
  { name: "search_code",  description: "Search codebase for a pattern (grep)" },
];
```

The model decides which tool to call at each step. This is why tool design matters so much (Day 10) — bad tool schemas produce broken loops.

---

## 2. Scaffolding vs Editing: Two Fundamentally Different Tasks

Coding agents operate in two modes, and conflating them is a common design mistake.

**Scaffolding** — generating new files from scratch:
- Low risk of breaking existing code
- Agent can be more creative and verbose
- Example: "Create a new Nuxt page for the /dashboard route"

**Editing** — modifying existing files:
- High risk: one wrong character breaks things
- Agent needs to understand the existing code deeply before touching it
- Requires precise context: the full file or at least the relevant region

For editing, always give the agent the current file content *before* asking it to change it. Never ask it to "add a function to utils.ts" without showing it what's already in utils.ts. The agent will hallucinate what's there.

```js
// Bad — agent doesn't know what's in the file
const prompt = "Add a debounce utility to src/utils/helpers.ts";

// Good — agent has full context
const fileContent = await fs.readFile("src/utils/helpers.ts", "utf8");
const prompt = `Here is the current content of src/utils/helpers.ts:\n\n${fileContent}\n\nAdd a debounce utility function at the bottom.`;
```

---

## 3. Diff-Based vs Full-Rewrite Approaches

When the agent writes code, it needs a strategy for *how* to express the change. Two main approaches:

### Full Rewrite
The agent outputs the entire file content. Simple to implement, easy to parse. Works well for small files. Breaks down when files are long — the agent might forget early sections, introduce subtle regressions, or hit token limits.

### Diff-Based (Patch)
The agent outputs only the changed lines in a structured format. More token-efficient, less destructive, but harder for the model to produce correctly.

A common pattern is a custom diff format (not `git diff`, which models often misformat):

```
<<<<<<< ORIGINAL
function fetchUser(id) {
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}
=======
function fetchUser(id: number): Promise<User> {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}
>>>>>>> UPDATED
```

This is exactly what tools like Aider use. The model is fine-tuned to output these markers reliably. If you roll your own agent, consider implementing a simple search-and-replace patch format instead — it's far easier to parse and less error-prone for the model to generate:

```json
{
  "file": "src/utils/db.ts",
  "search": "return db.query(`SELECT * FROM users WHERE id = ${id}`);",
  "replace": "return db.query('SELECT * FROM users WHERE id = ?', [id]);"
}
```

---

## 4. The Verification Step Is Non-Negotiable

A coding agent that writes code but never verifies it is just a fancy autocomplete. The loop *must* close. After writing, the agent should:

1. Run the linter (ESLint, Biome)
2. Run the type-checker (tsc --noEmit)
3. Run the relevant test suite
4. Read stdout/stderr and decide: done or iterate?

```js
async function verify(projectPath) {
  const lint = await runCommand("npx eslint src/ --max-warnings=0", projectPath);
  if (lint.exitCode !== 0) return { ok: false, error: lint.stderr };

  const types = await runCommand("npx tsc --noEmit", projectPath);
  if (types.exitCode !== 0) return { ok: false, error: types.stdout };

  const tests = await runCommand("npm test -- --passWithNoTests", projectPath);
  if (tests.exitCode !== 0) return { ok: false, error: tests.stdout };

  return { ok: true };
}
```

If verification fails, feed the error back into the context and let the agent try again. Cap retries (3 is usually enough — after 3 failures, the problem likely needs human intervention).

---

## Try This Today

Take a simple task you'd normally write by hand:

> *"Add input validation to an existing API route in your project."*

Design — don't necessarily run — the agent loop for it:
1. What files does the agent need to read first?
2. What tool calls happen in what order?
3. What does the "done" condition look like?
4. What could go wrong at each step, and how would you handle it?

Sketching this on paper (or in a markdown file) will sharpen your intuition for agent design faster than reading any framework docs.

---

## Resources

- **Aider's diff format explained:** <https://aider.chat/docs/benchmarks.html> — great breakdown of why diff format matters for coding agents
- **SWE-bench:** <https://swe-bench.github.io> — the benchmark that tests real coding agents on real GitHub issues; invaluable for calibrating what "good" looks like

---

*Day 16/30 — Tomorrow: Debugging Agents (why they're hard to debug and how to trace their thought process).*
