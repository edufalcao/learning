---
title: "MCP: Model Context Protocol"
day: 13
week: 2
weekName: "Architecture"
description: "What MCP is, servers, clients, tool discovery, and standardized agent communication."
tag: "architecture"
---


## Why This Matters

Every agent you build eventually needs to talk to the outside world: read files, query databases, call APIs, run shell commands. Without a standard interface, you end up hardcoding integration glue for every new agent-service pair. MCP is the answer — it's a protocol designed specifically to standardize how AI agents discover and invoke capabilities exposed by external services. Think of it as USB-C for agents. Once you internalize MCP's architecture, building extensible, composable agent systems becomes dramatically simpler.

---

## Core Concept 1: What MCP Is (and Isn't)

MCP (Model Context Protocol) is an open protocol created by Anthropic that defines how **clients** (AI agents, coding assistants, orchestrators) communicate with **servers** (services exposing capabilities). It's not a framework — it's a spec. Any compliant client can talk to any compliant server.

The key insight: MCP separates *capability definition* from *capability consumption*. The server declares what it can do; the client decides when and how to use it. The agent doesn't need to know whether it's talking to a database tool or a filesystem tool — it just calls whatever the server advertises.

**Transport layer:** MCP communicates over `stdio` (local) or HTTP + SSE (remote). The client spawns or connects to the server, and they exchange JSON-RPC messages.

---

## Core Concept 2: Servers, Clients, and Tool Discovery

An **MCP server** exposes three types of primitives:
- **Tools** — callable functions (e.g., `read_file`, `run_query`, `send_email`)
- **Resources** — readable data sources (e.g., a file, a database table)
- **Prompts** — reusable prompt templates

A **client** (your agent) connects, calls `tools/list` to discover available tools, then calls `tools/call` to invoke them. This is automatic — the agent doesn't need hardcoded knowledge of what tools exist.

```json
// Agent → MCP Server: discover tools
{ "method": "tools/list" }

// Server → Agent: here's what I have
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read a file from the filesystem",
      "inputSchema": {
        "type": "object",
        "properties": {
          "path": { "type": "string", "description": "Absolute file path" }
        },
        "required": ["path"]
      }
    }
  ]
}

// Agent → Server: call a tool
{
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": { "path": "/etc/hosts" }
  }
}
```

This is the same JSON schema pattern you know from OpenAI function calling — but now it's protocol-level and standardized.

---

## Core Concept 3: Building an MCP Server (Node.js)

Using the official `@modelcontextprotocol/sdk`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "my-tools", version: "1.0.0" });

// Register a tool
server.tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name") },
  async ({ city }) => {
    const data = await fetchWeather(city); // your logic
    return {
      content: [{ type: "text", text: JSON.stringify(data) }]
    };
  }
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
```

That's the full server. The client (Claude Desktop, OpenClaw, your custom agent) connects to this process, discovers `get_weather`, and calls it when appropriate. No coupling. No custom integration code.

---

## Core Concept 4: How Agents Consume MCP

On the client side, an agent with MCP support works like this:

1. **Spawn/connect** to one or more MCP servers at startup
2. **Aggregate** all discovered tools into the LLM's tool list
3. **Route** tool calls to the correct server transparently
4. **Return** results back into the context as tool output

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "my-agent", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: ["./my-mcp-server.js"]
});

await client.connect(transport);

// List tools
const { tools } = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: "get_weather",
  arguments: { city: "Fortaleza" }
});

console.log(result.content[0].text);
```

The agent's LLM sees the tool schemas, decides to call `get_weather`, and the client handles the MCP routing. The model never needs to know the transport layer.

---

## Try This Today

**Build a minimal MCP server** that exposes one useful tool from your daily workflow. Options:

- A `read_notion_page` tool that calls Notion's API
- A `query_db` tool that runs a safe read-only SQL query
- A `get_pr_status` tool that wraps GitHub's API

Then connect it to Claude Desktop (edit `~/Library/Application Support/Claude/claude_desktop_config.json`) and verify the tool shows up and works.

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["/path/to/my-mcp-server.js"]
    }
  }
}
```

This gets you from "I understand MCP" to "I have a working MCP server" in one session.

---

## Resources

- **MCP Spec & Docs:** https://modelcontextprotocol.io — the canonical reference, includes server/client quickstarts
- **MCP SDK (TypeScript):** https://github.com/modelcontextprotocol/typescript-sdk — the official implementation you'll use in Node.js projects

---

*Day 13/30 — Agentic Coding Series*
