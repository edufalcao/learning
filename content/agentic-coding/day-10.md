---
title: "Tool Design Principles"
day: 10
week: 2
weekName: "Architecture"
description: "What makes a good tool: atomic, descriptive, safe. Designing schemas agents use correctly."
tag: "architecture"
---


## Why This Matters

Tools are the hands of your agent. The model itself can reason, plan, and write — but it can only affect the world through tools. And here's the brutal truth: **a poorly designed tool will reliably produce a poorly behaving agent**, no matter how good your prompt is.

Most engineers building agents focus on prompts, models, and orchestration. Tools get treated as an afterthought. That's the wrong priority. Once you've internalized the agent loop (Day 1) and architecture patterns (Days 8–9), tool design is the highest-leverage place to spend your time.

---

## Core Concept 1 — Atomic Tools Do One Thing

A tool should do exactly one thing, predictably, every time. If you find yourself writing a tool that "creates or updates" or "searches and downloads", split it.

**Why this matters:** LLMs are not great at handling multi-path tools. A tool like `manage_file(action: "read" | "write" | "delete")` looks elegant but forces the model to make an extra decision *inside* the tool call — one it can get wrong.

```ts
// ❌ Overloaded — model must infer which action to pick
function manageFile(action: "read" | "write" | "delete", path: string, content?: string) { ... }

// ✅ Atomic — one tool, one job
function readFile(path: string): string { ... }
function writeFile(path: string, content: string): void { ... }
function deleteFile(path: string): void { ... }
```

Atomic tools are also easier to test, audit, and sandbox independently.

---

## Core Concept 2 — Descriptions Are Part of the Interface

The JSON schema name and description are not documentation — **they are the model's only interface to your tool**. The model cannot read your source code. It reads the name, the description, and the parameter descriptions. That's it.

Treat them with the same care you'd give a public API contract.

```ts
const tools = [
  {
    name: "search_codebase",
    description:
      "Search the local codebase for files containing a specific text pattern. " +
      "Use this when you need to find where a function, variable, or string is used. " +
      "Returns a list of matching file paths with line numbers. " +
      "Do NOT use this to read file content — use read_file for that.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The text or regex pattern to search for."
        },
        directory: {
          type: "string",
          description: "Root directory to search within. Defaults to the project root."
        }
      },
      required: ["pattern"]
    }
  }
]
```

Notice the explicit "Do NOT use this to read file content" line. Boundary-setting in descriptions prevents tool misuse more reliably than any prompt instruction.

---

## Core Concept 3 — Safe Defaults, Explicit Danger

Every tool that can modify state or cause irreversible effects should be designed with caution baked in — not bolted on after the agent misbehaves.

Practical patterns:

- **Dry-run mode:** Add a `dryRun: boolean` parameter that previews what would happen without executing. The model can confirm intent before committing.
- **Require explicit confirmation parameters:** Instead of `deleteDatabase(name)`, use `deleteDatabase(name, confirm: "DELETE")` — the model must pass the literal string to proceed.
- **Return impact summaries, not silent voids:** Don't return `void` from writes. Return `{ written: number, path: string }` so the model (and your logs) can verify intent matched execution.

```ts
async function deleteRecords(
  table: string,
  where: Record<string, unknown>,
  confirm: "DELETE_CONFIRMED" // model must explicitly set this
): Promise<{ deleted: number }> {
  if (confirm !== "DELETE_CONFIRMED") {
    return { deleted: 0 }; // no-op if model forgot
  }
  // ... execute delete
}
```

---

## Core Concept 4 — Fail Loudly, Not Silently

When a tool fails, the error message the agent receives is its only signal to correct course. Vague errors like `"Error: operation failed"` leave the model guessing. Specific, actionable errors let it self-correct.

```ts
// ❌ Unhelpful — agent doesn't know what to fix
throw new Error("File operation failed");

// ✅ Actionable — agent can retry with correct parameters
throw new Error(
  `read_file: path '${path}' does not exist. ` +
  `Use list_directory() first to verify the correct path.`
);
```

Think of error messages as **instructions to the model's next thought step**. Good errors make agents smarter; bad errors cause loops.

---

## Try This Today

Take one tool you've already built (or pick a hypothetical: `send_email`, `query_db`, `create_pr`).

1. Write its JSON schema from scratch — name, description, every parameter with its own description.
2. Try to "fool" it: what happens if the model calls it with wrong types, missing fields, or in the wrong sequence?
3. Add one safeguard you don't currently have: a dry-run param, a stricter description, or a more useful error message.

The exercise is quick (~15 min) and will immediately surface gaps in tool contracts you thought were solid.

---

## Resources

- [Anthropic — Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — canonical reference for tool/function calling with Claude, including schema best practices
- [OpenAI — Function Calling Best Practices](https://platform.openai.com/docs/guides/function-calling) — similar principles, useful comparison of naming conventions and schema patterns
