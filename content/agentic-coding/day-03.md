---
title: "Context Window Is RAM"
day: 3
week: 1
weekName: "Foundations"
description: "The context window is your agent's only working memory — learn to manage it like a budget."
tag: "foundations"
---

## Why This Matters

In traditional software, state lives in memory, databases, and variables — all under your control. In an agent, the only "working memory" that matters to the LLM is what's inside the context window at the moment of inference. That's it. There's no cache, no background process, no RAM that persists between calls. If it's not in the context, the model doesn't know it.

Senior engineers who don't internalize this early end up debugging bizarre agent behavior that makes perfect sense once you realize: **the model is only as smart as what you put in front of it**.

---

## Core Concepts

### 1. What the Context Window Actually Is

A context window is the maximum number of tokens a model can "see" in one inference call. This includes:

- The system prompt
- The entire conversation history (user messages + assistant messages)
- Tool call results (each tool response is another chunk of text)
- The current user input

Models like Claude Sonnet 4 have a 200K token context (~150K words). That sounds huge — until your agent has been running for an hour, read 10 files, made 20 tool calls, and is now hitting the wall.

**Tokens ≈ 0.75 words.** A 200-line TypeScript file ≈ ~1,500 tokens. A full repo? You'll burn through context fast.

```
[System Prompt ~2k tokens]
[Turn 1: user + assistant + tool call + tool result ~500 tokens]
[Turn 2: ...~800 tokens]
[Turn N: ...]
------> Context fills up. Next call: model can't see Turn 1 anymore (or errors out).
```

---

### 2. How Agents Accumulate State (and Lose It)

Every tool call adds tokens. In a naive agentic loop:

```javascript
const messages = [];

while (!done) {
  const response = await llm.chat(messages); // sends EVERYTHING every time
  messages.push({ role: "assistant", content: response.content });

  if (response.tool_calls) {
    for (const call of response.tool_calls) {
      const result = await runTool(call);
      messages.push({ role: "tool", content: result }); // grows unbounded
    }
  }
}
```

This is correct for short tasks. But for long-running agents, `messages` grows without bound. When you hit the context limit, you get either:
- A hard error (`context_length_exceeded`)
- Silent truncation (the model drops early messages, losing important context)
- Degraded performance (the model "forgets" earlier decisions)

The subtle failure is the worst: the agent keeps working but starts contradicting its own earlier decisions. You won't notice until QA — or the user does.

---

### 3. Practical Context Budget Management

Think of your context window as a **budget**. Allocate it deliberately:

| Slot | Purpose | Typical Budget |
|---|---|---|
| System prompt | Agent identity + instructions | 1–3k tokens |
| Recent turns | Conversational state | 10–40k tokens |
| Tool results | Current task data | 20–80k tokens |
| Working memory | Injected summaries/files | 10–50k tokens |
| Reserve | Model's output space | 4–8k tokens |

**Strategies to stay in budget:**

**a) Summarize old turns instead of keeping them raw:**
```javascript
if (estimateTokens(messages) > CONTEXT_LIMIT * 0.7) {
  const summary = await summarize(messages.slice(0, -10));
  messages = [
    { role: "system", content: `[Previous context summary]\n${summary}` },
    ...messages.slice(-10) // keep recent turns verbatim
  ];
}
```

**b) Truncate tool results aggressively:**
```javascript
function truncateToolResult(result, maxTokens = 2000) {
  const text = JSON.stringify(result);
  if (estimateTokens(text) > maxTokens) {
    return text.slice(0, maxTokens * 4) + "\n[...truncated]";
  }
  return text;
}
```

**c) Use a "scratchpad" pattern for agent memory:**

Instead of keeping full conversation history, write important decisions to a structured file and inject only that:
```javascript
const systemPrompt = `
You are a coding agent.

## Memory (from previous steps)
${await readFile("scratchpad.md")}

## Current task
${userTask}
`;
```

This is exactly what OpenClaw does with MEMORY.md — it's not magic, it's budget management.

---

### 4. Estimating Token Count Without Calling the API

You can't wait for the API to tell you you've exceeded the limit. Estimate inline:

```javascript
// Rough but fast: ~4 chars per token for English/code
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// More accurate: use tiktoken (OpenAI) or Anthropic's tokenizer
import { encoding_for_model } from "tiktoken";
const enc = encoding_for_model("gpt-4o");
const tokenCount = enc.encode(text).length;
```

For production agents, check token count **before** each API call. If you're over 80% of the limit, compact first.

---

## Try This Today

Take any agentic loop you've written (or imagine a simple one), and add **context budget logging**:

1. Before each LLM call, log the estimated token count of the full `messages` array.
2. Set a threshold (e.g., 60% of the model's context limit).
3. When exceeded, implement a simple compaction: summarize turns older than the last 5, replace them with the summary, and re-run.

You'll immediately see how fast context fills up with real tool outputs — and you'll have a working compaction baseline you can refine over the next few weeks.

---

## Resources

- [Anthropic: Context window guidance](https://docs.anthropic.com/en/docs/build-with-claude/agents#managing-context-in-extended-thinking)
- [tiktoken (OpenAI tokenizer — works well as a proxy for most models)](https://github.com/openai/tiktoken)

---

*Day 3 of 30 — tomorrow: Prompt Engineering for Agents.*
