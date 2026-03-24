---
title: "Week 3 Review + Hands-On"
day: 21
week: 3
weekName: "Implementation"
description: "Consolidate implementation patterns and build a complete agent project."
tag: "review"
---


> Week 3 wrapped up agents in implementation mode: building loops from scratch, debugging thought traces, testing evaluations, adding RAG, and locking down safety. Today is the integration checkpoint — you don't just review, you build something real.

---

## Why This Day Matters

Theory compounds slowly. Muscle memory compounds fast.

You've covered the full implementation layer — code generation agents, debugging patterns, eval frameworks, RAG pipelines, and security guardrails. If you haven't wired any of this together into a real agent yet, today is the forcing function. If you have, today is about hardening what exists: one useful tool, proper error handling, and logging you'll actually read when things go wrong.

Senior engineers don't need more concepts. They need clean systems they trust.

---

## Core Concepts Recap

### 1. The Minimal Viable Agent is 50 Lines

Week 3, Day 15 showed that the core loop is embarrassingly small:

```js
async function runAgent(userInput) {
  const messages = [{ role: "user", content: userInput }];

  while (true) {
    const response = await llm.chat({ messages, tools });

    if (response.stop_reason === "end_turn") {
      return response.content;
    }

    // Execute tool calls, push results back
    for (const toolCall of response.tool_calls) {
      const result = await executeTool(toolCall);
      messages.push({ role: "tool", content: result, tool_use_id: toolCall.id });
    }

    messages.push({ role: "assistant", content: response.content });
  }
}
```

That loop is the skeleton. Everything else — error handling, logging, retries, memory — is flesh on that skeleton. Don't let frameworks obscure what's happening here.

---

### 2. One Tool Done Right Beats Five Done Poorly

If you're adding tools to your agent today, resist the urge to add many. Pick **one tool that solves a real problem**, and do it properly:

```js
const readFileTool = {
  name: "read_file",
  description: "Read the contents of a file at the given path. Returns file content as a string. Returns an error message if the file doesn't exist or is not readable.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Absolute or relative path to the file"
      }
    },
    required: ["path"]
  }
};

async function executeReadFile({ path }) {
  try {
    const content = await fs.readFile(path, "utf-8");
    return { success: true, content };
  } catch (err) {
    // Return structured error — never throw. The agent needs to read this.
    return { success: false, error: err.message };
  }
}
```

Key principle: **tool errors should return, not throw**. The agent needs to read the error and decide what to do. An uncaught exception breaks the loop; a structured error message lets the agent retry, reframe, or escalate.

---

### 3. Logging You'll Actually Use

Debugging agents without traces is archaeology. Add structured logging at the points that matter:

```js
function logAgentEvent(event) {
  const entry = {
    ts: new Date().toISOString(),
    type: event.type,           // "llm_call" | "tool_call" | "tool_result" | "loop_end"
    data: event.data,
  };
  console.log(JSON.stringify(entry));
  // Or: append to a file, send to Langfuse, etc.
}

// Usage in the loop:
logAgentEvent({ type: "llm_call", data: { messageCount: messages.length } });
logAgentEvent({ type: "tool_call", data: { name: toolCall.name, input: toolCall.input } });
logAgentEvent({ type: "tool_result", data: { name: toolCall.name, success: result.success } });
```

You want to answer these questions from logs alone:
- What tools did it call, in what order?
- What inputs did it pass?
- Did the tool succeed or fail?
- How many LLM turns did the run take?

If you can't answer those from your logs, your logging is incomplete.

---

### 4. Error Handling Taxonomy

Not all agent errors are equal. The three classes you saw in Day 12:

| Class | Example | Strategy |
|---|---|---|
| **Tool failure** | File not found, API 500 | Return error to agent, let it retry with different params |
| **LLM misbehavior** | Hallucinated tool args, infinite loop | Detect via schema validation or turn counter, break + escalate |
| **Systemic failure** | Network down, token budget exceeded | Hard stop, persist state if possible, notify human |

Add a turn counter as your last line of defense:

```js
let turns = 0;
const MAX_TURNS = 20;

while (true) {
  if (++turns > MAX_TURNS) {
    throw new Error(`Agent exceeded ${MAX_TURNS} turns — likely stuck in a loop`);
  }
  // ... rest of loop
}
```

---

## Try This Today

Build or extend an agent with these three things working together:

1. **One real tool** — something that touches your actual stack (read a file, query a DB, call an API you own)
2. **Error handling** — tool errors return structured `{ success, error }`, never throw
3. **Structured logging** — every LLM call, every tool call, every result logged as JSON

Run it on a real task. Then open the logs and trace exactly what happened. Can you reconstruct the agent's "reasoning" from the log alone? If yes, your observability is solid.

Bonus: add the turn counter guard and intentionally trigger it by giving the agent an impossible task. Confirm it exits cleanly instead of running forever.

---

## Resources

- [Anthropic Tool Use Guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — the definitive reference for tool schemas, results, and error patterns
- [Langfuse Self-Hosted](https://langfuse.com/docs/deployment/self-host) — if you want a real trace UI without sending data externally; worth 30 minutes of setup

---

> Week 4 starts tomorrow: observability at scale, cost management, human-in-the-loop patterns, and production deployment. The shift is from "does it work" to "can I trust it in production."
