---
title: "Prompt Engineering for Agents"
day: 4
week: 1
weekName: "Foundations"
description: "Write system prompts that agents reliably follow — with clear instructions, constraints, and stopping conditions."
tag: "foundations"
---

> "Your system prompt is your agent's constitution. Get it wrong and everything downstream suffers."

## Why This Matters to a Senior Engineer

You already know that LLMs are sensitive to phrasing. But agents amplify that sensitivity by 10x. A poorly written system prompt doesn't just produce a bad answer — it causes your agent to loop indefinitely, refuse valid tasks, hallucinate tool parameters, or silently do the wrong thing across dozens of tool calls before you notice. Prompt engineering for agents isn't about clever hacks; it's about writing clear contracts that a reasoning system can reliably follow under uncertainty.

---

## Core Concept 1: System Prompt vs User Prompt vs Tool Results

These three layers form the agent's world. Confusing them is the root cause of most agent misbehavior.

| Layer | Role | Who writes it |
|---|---|---|
| **System prompt** | Defines the agent's identity, rules, constraints, and tools | You (the engineer) |
| **User prompt** | The task or message for this turn | Your app / the human |
| **Tool results** | Observations returned after an action | The tool execution layer |

The system prompt sets the frame. Everything else fills into that frame. If your system prompt is vague, the model will fill gaps with its training priors — which may not match your intent at all.

**Pattern:** Keep your system prompt focused on behavior, not content. Don't paste documentation into the system prompt. Instead, give the agent tools to look up documentation when needed.

```
// Bad: stuffing context into the system prompt
SYSTEM: You are a coding assistant. Here is our entire API spec: [5000 tokens of JSON]...

// Good: give the agent a tool instead
SYSTEM: You are a coding assistant. When you need API details, use the `lookup_api_spec` tool.
```

---

## Core Concept 2: Writing Instructions Agents Actually Follow

Agents don't read prompts the way humans do — they pattern-match against their training while trying to satisfy your instructions. Three rules that consistently improve compliance:

**Be explicit about format.** If you want JSON, say "respond ONLY with valid JSON, no prose." If you want a tool call before answering, say "always call `check_context` before responding."

**Specify stopping conditions.** Agents in a loop need to know when to stop. "Continue until you have a passing test suite" is better than "fix the bug." Without a stopping condition, the agent may loop on ambiguous success criteria.

**Separate constraints from instructions.** Put hard rules (things the agent must never do) in a clearly labeled section. Models tend to respect explicit constraint blocks better than inline prohibitions.

```typescript
const systemPrompt = `
You are a code review agent. Your job is to review pull requests.

## Instructions
1. Read the diff using the \`get_diff\` tool.
2. Analyze for: bugs, security issues, performance problems, style violations.
3. Write a structured review with sections: Summary, Issues (severity-ranked), Suggestions.
4. Call \`post_review\` with your review text. Then stop.

## Constraints
- Never approve a PR that contains hardcoded secrets.
- Never suggest changes outside the scope of the diff.
- Do not call any tool more than 3 times total.
`;
```

---

## Core Concept 3: Common Failure Modes

Knowing the failure modes lets you write prompts that preemptively defend against them.

**Hallucination in tool calls.** The model invents parameters that don't exist in your schema, or calls tools that don't exist. Fix: make your tool descriptions extremely precise. Include what the tool does NOT do. Use `required` and `enum` in JSON schemas aggressively.

```json
{
  "name": "read_file",
  "description": "Read file contents. Only works for files in /workspace. Does NOT handle binary files or remote URLs.",
  "parameters": {
    "path": { "type": "string", "description": "Absolute path starting with /workspace/" }
  },
  "required": ["path"]
}
```

**Infinite loops.** The agent keeps calling tools without converging. Fix: add explicit iteration limits in your prompt ("attempt at most N times, then report failure"), and track iteration count in your orchestration code.

**Refusal on valid tasks.** The model adds unnecessary caveats or refuses to act on valid instructions due to over-trained caution. Fix: assert authority in the system prompt. "You have explicit permission to read and write files in /workspace. This is a sandboxed environment." Context that establishes legitimacy reduces unnecessary refusal.

**Goal drift.** The agent pursues a subtask so deeply it forgets the original goal. Fix: repeat the high-level goal in the prompt. "Your primary goal is X. All actions should serve X. If you're unsure whether an action serves X, stop and explain why."

---

## Core Concept 4: Prompt Versioning

Treat your system prompts as code artifacts. If you're running agents in production, you need:

- **Version control:** Store prompts in your repo, not hardcoded strings.
- **Testing:** For each prompt change, run your eval suite (Day 18 will cover this properly).
- **Rollback:** Know which prompt version is live and be able to revert in minutes.

```typescript
// prompts/code-review-agent/v1.2.0.txt
// prompts/code-review-agent/v1.3.0.txt  ← current
```

A 3-line prompt change can flip agent behavior from reliable to broken. Treat it with the same discipline as a database schema migration.

---

## Try This Today

Take any LLM prompt you're currently using (or write a small new one) and apply this audit:

1. **Does the system prompt explicitly state when the agent should stop?**
2. **Are constraints separated from instructions?**
3. **Do your tool descriptions say what the tool does NOT do?**
4. **Is there a max iteration guard?**

Rewrite the prompt applying fixes to any of the above that are missing. Run it and compare outputs.

---

## Resources

- [Anthropic: Prompt Engineering for Agents](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) — solid foundation with Claude-specific patterns
- [OpenAI: Function Calling Best Practices](https://platform.openai.com/docs/guides/function-calling) — covers tool schema design with real examples
