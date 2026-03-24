---
title: "Observability: Inside Your Agent"
day: 22
week: 4
weekName: "Production"
description: "Making the entire reasoning-action chain inspectable, queryable, and alertable."
tag: "production"
---


Agents are black boxes by default. An LLM receives a prompt, thinks in tokens you might never see, picks a tool, gets a result, and loops. When things go wrong — and they will — you're staring at the output wondering *where* it went sideways. Traditional logging (`console.log` the request, `console.log` the response) doesn't cut it. Agent observability is about making the entire reasoning-action chain inspectable, queryable, and alertable. Without it, you're flying blind at scale.

---

## 1. What to Capture: The Agent Trace

An agent run is a **trace** — a tree of nested steps. Every trace should capture:

- **Input**: the user message or trigger event
- **System prompt**: the full prompt sent to the model (including injected context)
- **LLM calls**: each model invocation with tokens in/out, latency, model ID
- **Tool calls**: name, parameters sent, result received, duration
- **Reasoning/thinking**: if using extended thinking, capture the `thinking` block
- **Final output**: what the agent returned to the user
- **Metadata**: session ID, user ID, cost, total tokens, error flag

A single "agent run" might involve 5–15 LLM calls and dozens of tool invocations. Without structured traces, debugging is archaeology.

```typescript
// Minimal trace structure
interface AgentTrace {
  traceId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  input: string;
  steps: AgentStep[];
  output: string;
  totalTokens: { input: number; output: number };
  totalCostUsd: number;
  error?: string;
}

interface AgentStep {
  type: 'llm_call' | 'tool_call';
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  tokens?: { input: number; output: number };
}
```

**Key insight**: log at the *step* level, not just the run level. When an agent fails on step 11 of 14, you need to see exactly which tool call returned garbage and how the model reacted.

---

## 2. Tracing Tools: Langfuse, LangSmith, OpenTelemetry

Three main approaches, each with different trade-offs:

### Langfuse (open-source, self-hostable)
Best fit for teams that want control. Drop-in SDKs for JS/Python. Captures traces, scores, and costs automatically.

```typescript
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});

// Wrap an agent run
const trace = langfuse.trace({ name: 'agent-run', userId: 'eduardo' });

// Each LLM call becomes a "generation"
const generation = trace.generation({
  name: 'planning-step',
  model: 'claude-sonnet-4-6',
  input: messages,
});

const response = await anthropic.messages.create({ ... });

generation.end({ output: response, usage: {
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
}});

// Each tool call becomes a "span"
const span = trace.span({ name: 'tool:web_search', input: { query: '...' } });
const result = await webSearch(query);
span.end({ output: result });
```

### LangSmith (LangChain ecosystem)
Tightly integrated if you use LangChain/LangGraph. Auto-traces chains and agents with minimal code. Less useful outside that ecosystem.

### OpenTelemetry (OTel)
The industry standard for distributed tracing. More setup work, but integrates with your existing infrastructure (Grafana, Datadog, Jaeger). Best for production systems where agents are one piece of a larger architecture.

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('agent-service');

async function agentLoop(input: string) {
  return tracer.startActiveSpan('agent.run', async (span) => {
    span.setAttribute('agent.input', input);
    
    // Each tool call gets its own child span
    const result = await tracer.startActiveSpan('tool.call', async (toolSpan) => {
      toolSpan.setAttribute('tool.name', 'read_file');
      const r = await readFile(path);
      toolSpan.end();
      return r;
    });
    
    span.end();
    return result;
  });
}
```

**Recommendation**: Start with Langfuse for agent-specific observability (it understands LLM concepts natively). Add OTel later when you need to correlate agent traces with the rest of your system.

---

## 3. Dashboards and Alerts

Raw traces are useful for debugging. Dashboards are useful for *operating*. Key metrics to track:

| Metric | Why It Matters |
|--------|---------------|
| **Task completion rate** | % of agent runs that succeed without human intervention |
| **Avg tokens per run** | Cost proxy — spikes mean loops or verbose prompts |
| **Avg latency per run** | User experience — agents that take 2 min lose trust |
| **Tool error rate** | Broken tools = broken agent, even if the LLM is fine |
| **Loop detection** | Agent calling the same tool >3x with same params = stuck |

Set alerts on:
- Token usage >2x the 7-day average (likely a loop or prompt regression)
- Tool error rate >10% (something broke in your infrastructure)
- Completion rate drops below baseline (model degradation or prompt issue)

---

## 4. Practical: Structured Logging Without a Platform

Not ready for Langfuse or OTel? Start with structured JSON logs:

```typescript
function logStep(traceId: string, step: AgentStep) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId,
    type: step.type,
    name: step.name,
    durationMs: step.durationMs,
    tokens: step.tokens,
    inputPreview: JSON.stringify(step.input).slice(0, 200),
    outputPreview: JSON.stringify(step.output).slice(0, 200),
    error: step.error ?? null,
  }));
}
```

Pipe these to a file or log aggregator. You can query them with `jq`, load them into SQLite, or feed them into any dashboard later. The point is: **capture the data now**, worry about the visualization layer later.

---

## Try This Today

Add step-level logging to any agent or automation you're running. For each LLM call and tool invocation, log: name, duration, token count, and a truncated preview of input/output. Run the agent 5 times and review the logs. Look for: which steps take the longest, which use the most tokens, and whether any steps are redundant. You'll immediately see optimization opportunities.

---

## Resources

- [Langfuse Docs — Tracing](https://langfuse.com/docs/tracing) — best starting point for agent-native observability
- [OpenTelemetry JS SDK](https://opentelemetry.io/docs/languages/js/) — for integrating agent traces into broader system observability
