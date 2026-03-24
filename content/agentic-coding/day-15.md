---
title: "Building Your First Agent"
day: 15
week: 3
weekName: "Implementation"
description: "Build a raw agent loop wired to an LLM API with tools, no frameworks."
tag: "implementation"
---


You've spent two weeks understanding what agents are, how they're architected, and the patterns that make them work. Today you stop reading about agents and start building one. No frameworks, no abstractions — just a raw agent loop wired to an LLM API with tools.

This matters because every framework (LangChain, CrewAI, OpenAI Agents SDK) is just sugar on top of this core loop. If you understand the loop from scratch, you can debug any framework, swap providers, or strip the whole thing out when the abstraction leaks.

---

## 1. The Minimal Agent Loop

An agent is a while loop. That's it. The structure:

```
while (not done) {
  response = llm.chat(messages)
  if response has tool_calls → execute them, append results
  else → done, return response
}
```

Here's the real thing in Node.js using the Anthropic SDK:

```javascript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const tools = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
];

// This is your tool implementation
function executetool(name, input) {
  if (name === "get_weather") {
    // In reality, call an API. Hardcoded for demonstration.
    return JSON.stringify({ temp: 28, condition: "sunny", city: input.city });
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

async function runAgent(userMessage) {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "You are a helpful assistant. Use tools when needed.",
      tools,
      messages,
    });

    // Append assistant response to conversation
    messages.push({ role: "assistant", content: response.content });

    // Check if the model wants to use tools
    const toolUses = response.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      // No tool calls — agent is done
      const text = response.content.find((b) => b.type === "text");
      return text?.text ?? "";
    }

    // Execute each tool and feed results back
    const toolResults = toolUses.map((tu) => ({
      type: "tool_result",
      tool_use_id: tu.id,
      content: executeeTool(tu.name, tu.input),
    }));

    messages.push({ role: "user", content: toolResults });
  }
}

// Run it
const answer = await runAgent("What's the weather in Fortaleza?");
console.log(answer);
```

**Key insight:** The `messages` array is the agent's entire state. Every tool call and result gets appended. The model sees the full history on each iteration — that's how it "remembers" what it already tried.

---

## 2. Wiring Real Tools

The hardcoded weather example is fine for structure, but real agents need a tool registry pattern:

```javascript
const toolRegistry = new Map();

function registerTool(name, schema, handler) {
  toolRegistry.set(name, { schema, handler });
}

function executeTool(name, input) {
  const tool = toolRegistry.get(name);
  if (!tool) return JSON.stringify({ error: `Unknown tool: ${name}` });
  return tool.handler(input);
}

// Get tool definitions for the API call
function getToolDefinitions() {
  return [...toolRegistry.entries()].map(([name, { schema }]) => ({
    name,
    description: schema.description,
    input_schema: schema.input_schema,
  }));
}

// Register tools
registerTool(
  "read_file",
  {
    description: "Read contents of a file",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  ({ path }) => {
    try {
      return fs.readFileSync(path, "utf-8");
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }
);

registerTool(
  "write_file",
  {
    description: "Write content to a file",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  ({ path, content }) => {
    fs.writeFileSync(path, content);
    return "File written successfully";
  }
);
```

With `read_file` and `write_file`, you already have a primitive coding agent. The model can read code, reason about it, and write changes. Add `exec_command` and you've got something genuinely useful.

---

## 3. The 50-Line Agent That Works

Strip away everything non-essential and you get an agent in ~50 lines. The critical pieces:

1. **System prompt** — tells the model its role and constraints
2. **Tool definitions** — what actions are available
3. **The loop** — call LLM → check for tool use → execute → repeat
4. **Tool result formatting** — each result must reference the `tool_use_id`

Common mistakes at this stage:
- **Forgetting to append the assistant message** before tool results (the API requires alternating user/assistant turns)
- **Not handling errors in tools** — if a tool throws, the agent gets stuck. Always return an error message the model can reason about.
- **Infinite loops** — add a max iteration count (10-20 is reasonable for most tasks)

```javascript
const MAX_ITERATIONS = 15;
let iteration = 0;

while (iteration++ < MAX_ITERATIONS) {
  // ... agent loop
}

if (iteration >= MAX_ITERATIONS) {
  console.warn("Agent hit max iterations — possible loop");
}
```

---

## 4. OpenAI vs Anthropic: API Shape Differences

If you're switching between providers, the core difference is in tool call structure:

| Aspect | Anthropic | OpenAI |
|--------|-----------|--------|
| Tool call in response | `content[].type === "tool_use"` | `message.tool_calls[]` |
| Tool result format | `{ type: "tool_result", tool_use_id }` | `{ role: "tool", tool_call_id }` |
| Stop reason | `stop_reason === "tool_use"` | `finish_reason === "tool_calls"` |

The loop logic is identical. Only the serialization changes. This is why understanding the raw loop matters — you can port between providers in 15 minutes.

---

## Try This Today

Build a minimal agent with 2-3 tools that does something useful for you. Suggestions:
- A file organizer that reads a directory and renames/moves files based on content
- A git log summarizer that reads recent commits and writes a changelog
- A note-taker that reads a URL (via fetch) and saves key points to a file

Use the raw loop above — no frameworks. Keep it under 100 lines. The constraint forces you to understand every piece.

---

## Resources

- [Anthropic: Tool Use documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- [Building effective agents — Anthropic](https://docs.anthropic.com/en/docs/build-with-claude/agents)
