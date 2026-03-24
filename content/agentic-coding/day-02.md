---
title: "Tools & Function Calling"
day: 2
week: 1
weekName: "Foundations"
description: "How function calling bridges LLM reasoning to real-world actions through structured tool schemas."
tag: "foundations"
---

## Why This Matters

Yesterday you understood that the agent loop is what separates an LLM from an agent. But a loop that just thinks and talks to itself is still useless. Tools are what give agents **agency** — the ability to change the world outside their context window.

Function calling is the bridge between "the model produces text" and "the model executes actions." If you're building anything beyond a chatbot, you need to internalize how this mechanism works at the protocol level — not just how to call `openai.chat.completions.create()`.

---

## Core Concepts

### 1. Tools Are Just JSON Schemas

From the model's perspective, a tool is a structured description: a name, a description (critical — more on this shortly), and a JSON Schema defining the expected parameters.

```json
{
  "type": "function",
  "function": {
    "name": "read_file",
    "description": "Read the contents of a file from disk. Use this when you need to inspect existing code or data before making changes.",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Absolute or relative path to the file"
        }
      },
      "required": ["path"]
    }
  }
}
```

The model never actually calls `read_file` — it **declares intent** by returning a structured JSON object in its response. Your code is what executes the actual function. The model produces something like:

```json
{
  "role": "assistant",
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "read_file",
      "arguments": "{\"path\": \"./src/index.ts\"}"
    }
  }]
}
```

Your orchestrator receives this, runs the function, and feeds the result back as a `tool` message.

---

### 2. The Full Round-Trip

The tool call cycle is a multi-turn conversation where tool results are injected into the context:

```js
// messages always grow — this IS the agent's working memory
const messages = [
  { role: "system", content: "You are a helpful coding assistant." },
  { role: "user", content: "What does the main entry point do?" }
];

// Turn 1: model decides to call a tool
const response1 = await client.chat.completions.create({
  model: "gpt-4o",
  tools: [readFileTool],
  messages
});

const toolCall = response1.choices[0].message.tool_calls[0];
messages.push(response1.choices[0].message); // add assistant message with tool_calls

// Execute the tool
const fileContent = await readFile(JSON.parse(toolCall.function.arguments).path);

// Inject result back
messages.push({
  role: "tool",
  tool_call_id: toolCall.id,
  content: fileContent
});

// Turn 2: model now has the file content and can respond
const response2 = await client.chat.completions.create({
  model: "gpt-4o",
  tools: [readFileTool],
  messages
});
```

Notice: the model stopped and declared intent. You executed. You fed results back. The model continued. **This is the loop.**

---

### 3. The Description Is the API Contract

The `description` field isn't documentation — it's the instruction manual the model uses to decide *when* and *how* to call your tool. A bad description leads to:

- **Tool misuse:** calling the wrong tool for the job
- **Hallucinated parameters:** inventing values that don't exist
- **Missed opportunities:** the model not using a tool when it should

Compare these two descriptions for the same tool:

```
❌ "Executes a shell command"

✅ "Run a shell command on the local machine and return stdout + stderr.
    Use for: running tests, building projects, listing files, git operations.
    Do NOT use for: modifying environment variables, installing packages
    globally, or any destructive operation without explicit user approval."
```

The second version shapes model behavior. It's your tool's system prompt.

---

### 4. Parallel Tool Calls & Tool Choice

Modern LLMs can request multiple tool calls in a single response — this is how agents parallelize work:

```json
{
  "tool_calls": [
    { "id": "call_1", "function": { "name": "read_file", "arguments": "{\"path\": \"./a.ts\"}" }},
    { "id": "call_2", "function": { "name": "read_file", "arguments": "{\"path\": \"./b.ts\"}" }}
  ]
}
```

You can also control whether the model must call a tool (`tool_choice: "required"`), is forced to call a specific one (`tool_choice: { type: "function", function: { name: "..." }}`), or chooses freely (`tool_choice: "auto"`). Forcing a specific tool is useful when you need structured output — tools are actually a cleaner alternative to raw JSON mode.

```js
// Force structured output via tool call
const result = await client.chat.completions.create({
  model: "gpt-4o",
  tool_choice: { type: "function", function: { name: "extract_entities" } },
  tools: [extractEntitiesTool],
  messages: [{ role: "user", content: rawText }]
});
```

---

## Try This Today

Take any API endpoint or utility function you use daily and turn it into an agent tool:

1. Write the JSON schema for it (name, description, parameters with types and descriptions)
2. Wire it into a minimal loop: user prompt → model → tool call → execute → inject result → model responds
3. Intentionally write a **bad description** first, test it, then improve the description and observe how the model's behavior changes

The goal is to develop intuition for what descriptions make a model confident and precise. This skill compounds over the next 28 days.

---

## Resources

- **Anthropic Tool Use Guide:** https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- **OpenAI Function Calling Reference:** https://platform.openai.com/docs/guides/function-calling
