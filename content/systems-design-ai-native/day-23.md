---
title: "Agent Communication: Tools, Handoffs, Shared Memory"
day: 23
week: 4
weekName: "Multi-Agent & Production"
description: "Tool use as the agent communication primitive"
tag: "multi-agent"
---

# Day 23 — Agent Communication: Tools, Handoffs, Shared Memory

Agents don't exist in isolation — they need to talk to each other, share context, and coordinate work. The communication mechanism you choose (tool calls, handoffs, shared memory) determines whether your multi-agent system is debuggable and reliable or an opaque mess. This is where most multi-agent architectures silently fail.

## 1. Tool Use as the Communication Primitive

In modern LLM architectures, tool calls are the primary way agents interact with the world — and with each other. An agent doesn't "call" another agent directly; it invokes a tool that happens to route to another agent.

```typescript
// Tools as the inter-agent interface
interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

class AgentToolRouter {
  private agents = new Map<string, Agent>();

  // Register an agent as a callable tool
  registerAgent(agent: Agent): AgentTool {
    this.agents.set(agent.id, agent);
    return {
      name: `delegate_to_${agent.id}`,
      description: agent.capability,
      parameters: agent.inputSchema,
      execute: async (params) => {
        const result = await agent.execute(params);
        return {
          success: result.status === 'completed',
          output: result.output,
          tokensUsed: result.tokensUsed,
          // Structured metadata for the calling agent
          metadata: { agentId: agent.id, duration: result.durationMs },
        };
      },
    };
  }

  // Give an agent access to other agents as tools
  getToolsFor(agentId: string): AgentTool[] {
    return [...this.agents.entries()]
      .filter(([id]) => id !== agentId) // can't call yourself
      .map(([, agent]) => this.registerAgent(agent));
  }
}
```

The key insight: tools are a **typed, validated boundary**. Each agent declares what it accepts and what it returns. This is fundamentally better than free-form message passing because the LLM's tool-call mechanism enforces schema compliance.

## 2. Handoff Protocols: Passing Context Between Agents

When Agent A finishes and Agent B takes over, what context gets passed? Too little and B hallucinates; too much and you blow the context window and waste tokens.

```typescript
interface HandoffPayload {
  taskId: string;
  fromAgent: string;
  toAgent: string;
  // Structured summary, not raw conversation history
  contextSummary: string;
  // Only the data the next agent needs
  relevantData: Record<string, unknown>;
  // Constraints and instructions for the receiving agent
  instructions: string;
  // Budget remaining
  tokenBudget: number;
  // Trace ID for distributed tracing
  traceId: string;
}

class HandoffManager {
  async handoff(payload: HandoffPayload): Promise<AgentResult> {
    // Validate the receiving agent can handle this task
    const target = this.agents.get(payload.toAgent);
    if (!target) throw new Error(`Agent ${payload.toAgent} not found`);

    // Build the receiving agent's context
    const context = this.buildHandoffContext(payload);

    // Log the handoff for observability
    this.logger.info('agent.handoff', {
      traceId: payload.traceId,
      from: payload.fromAgent,
      to: payload.toAgent,
      contextTokens: this.countTokens(context),
      budgetRemaining: payload.tokenBudget,
    });

    return target.execute({
      systemPrompt: context.systemPrompt,
      messages: context.messages,
      tools: context.tools,
      maxTokens: payload.tokenBudget,
    });
  }

  private buildHandoffContext(payload: HandoffPayload) {
    // Don't pass raw history — summarize and structure
    return {
      systemPrompt: `You are continuing a task started by ${payload.fromAgent}.\n` +
        `Context: ${payload.contextSummary}\n` +
        `Instructions: ${payload.instructions}`,
      messages: [
        { role: 'user' as const, content: JSON.stringify(payload.relevantData) },
      ],
      tools: this.getToolsFor(payload.toAgent),
    };
  }
}
```

**Key rule:** Never pass raw conversation history between agents. Always summarize. The receiving agent doesn't need 50 turns of dialogue — it needs the distilled state.

## 3. Shared Memory Architectures

When multiple agents need access to the same evolving state, shared memory beats message passing. The pattern: a central store that agents read from and write to, with clear read/write semantics.

```typescript
class SharedAgentMemory {
  private store: Map<string, MemoryEntry> = new Map();
  private locks: Map<string, string> = new Map(); // key → agentId

  async read(key: string, agentId: string): Promise<MemoryEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Track reads for conflict detection
    entry.lastReadBy = agentId;
    entry.readCount++;
    return structuredClone(entry); // return a copy, not a reference
  }

  async write(key: string, value: unknown, agentId: string): Promise<void> {
    const existing = this.store.get(key);

    // Optimistic concurrency: check version
    if (existing && this.locks.get(key) && this.locks.get(key) !== agentId) {
      throw new ConflictError(`Key ${key} is locked by ${this.locks.get(key)}`);
    }

    this.store.set(key, {
      value,
      version: (existing?.version || 0) + 1,
      updatedBy: agentId,
      updatedAt: Date.now(),
      lastReadBy: existing?.lastReadBy || null,
      readCount: 0,
    });
  }

  // Scoped views — agent only sees what it needs
  scopeFor(agentId: string, allowedKeys: string[]): ScopedMemory {
    return {
      read: (key: string) => {
        if (!allowedKeys.includes(key)) throw new AccessError(`Agent ${agentId} cannot read ${key}`);
        return this.read(key, agentId);
      },
      write: (key: string, value: unknown) => {
        if (!allowedKeys.includes(key)) throw new AccessError(`Agent ${agentId} cannot write ${key}`);
        return this.write(key, value, agentId);
      },
    };
  }
}

// Usage: research team with shared findings
const memory = new SharedAgentMemory();
const researchScope = memory.scopeFor('researcher', ['findings', 'sources', 'status']);
const writerScope = memory.scopeFor('writer', ['findings', 'sources', 'draft']);

// Researcher writes findings, writer reads them to produce draft
await researchScope.write('findings', { key_points: [...], sources: [...] }, 'researcher');
const findings = await writerScope.read('findings', 'writer');
```

## 4. MCP (Model Context Protocol) as an Emerging Standard

MCP standardizes how agents discover and invoke tools across process boundaries. Instead of each agent framework inventing its own tool protocol, MCP provides a universal interface.

```typescript
// MCP server exposes tools that any MCP-compatible agent can call
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'data-agent', version: '1.0.0' });

// Any MCP client (another agent, CLI, IDE) can discover and call this
server.tool(
  'query_database',
  'Run a read-only SQL query against the analytics database',
  { query: z.string().describe('SQL SELECT query') },
  async ({ query }) => {
    const results = await db.query(query);
    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
  }
);

// This makes the agent's capabilities composable and discoverable
// across any MCP-compatible orchestrator
```

The value of MCP isn't the protocol itself — it's the **decoupling**. Your agent's tools become portable across frameworks, IDEs, and orchestrators.

## Try This Today

Build a two-agent system with shared memory: a "researcher" agent that writes findings to shared memory and a "writer" agent that reads findings and produces a summary. Use a simple in-memory Map as the store. Add version tracking and log every read/write. Bonus: add a scoped view so each agent can only access its allowed keys.

## Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/) — The official MCP spec and SDKs
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) — Foundational reference for tool-use patterns in LLM agents
