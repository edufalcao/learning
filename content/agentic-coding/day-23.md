---
title: "Cost Management & Optimization"
day: 23
week: 4
weekName: "Production"
description: "Token budgets, model routing, caching strategies, and cost-per-task tracking."
tag: "production"
---


## Why This Matters

You can ship a working agent in a weekend. Running it profitably at scale is a different problem entirely. Agentic workflows consume tokens aggressively — multi-step reasoning, tool call results injected back into context, retry loops, parallel sub-agents. Without deliberate cost management, a single overnight run can burn your monthly budget. A senior engineer needs to think about this upfront, not after the first invoice arrives.

---

## Core Concepts

### 1. How to Actually Calculate Agent Run Costs

Every agent turn has a cost formula:

```
cost = (input_tokens × input_price) + (output_tokens × output_price)
```

But agentic runs are multi-turn. The full cost is:

```
total = Σ (input_tokens_N × price_in + output_tokens_N × price_out)
```

For Claude Sonnet 4.6 (example pricing):
- Input: ~$3 / 1M tokens
- Output: ~$15 / 1M tokens

An agent that does 10 turns, each with 5K input and 1K output:
- Input: 50K × $0.000003 = **$0.15**
- Output: 10K × $0.000015 = **$0.15**
- Total: **$0.30 per run**

Run that 1,000 times/month = **$300**. Multiply by a few agents running in parallel and it adds up fast.

**Instrument this.** Log token usage on every API response:

```javascript
const response = await anthropic.messages.create({ ... });

console.log({
  turn: turnCount,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  cost: (
    response.usage.input_tokens * 0.000003 +
    response.usage.output_tokens * 0.000015
  ).toFixed(6),
});
```

Accumulate across turns. Log totals per run. You'll immediately see where money is being wasted.

---

### 2. Caching and Prompt Compression

**Prompt caching** is the single most impactful optimization for agents with large, stable system prompts. Anthropic supports cache breakpoints that let you cache the system prompt across turns:

```javascript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  system: [
    {
      type: "text",
      text: largeSystemPrompt,
      cache_control: { type: "ephemeral" }, // cached for 5 min
    },
  ],
  messages: conversationHistory,
});
```

Cache hits are **90% cheaper** on input tokens. For a 10K-token system prompt repeated across 20 turns, that's 180K tokens saved per run.

**Prompt compression** is the manual version: trim your system prompt ruthlessly. Remove redundant instructions, consolidate examples, use bullet points instead of prose. Every token in the system prompt is paid on every turn.

**Tool result compression**: when a tool returns 50KB of JSON, don't inject the whole thing. Summarize or filter before it goes back into context:

```javascript
function compressToolResult(result, maxTokens = 500) {
  const json = JSON.stringify(result);
  if (json.length > maxTokens * 4) {
    // rough char-to-token ratio
    return JSON.stringify({
      truncated: true,
      preview: JSON.parse(json).slice?.(0, 10) ?? json.slice(0, 2000),
    });
  }
  return json;
}
```

---

### 3. Model Tiering

Not every step in your agent pipeline needs your best (and most expensive) model. A practical tiering strategy:

| Task | Model tier |
|------|-----------|
| Complex reasoning, code generation | Sonnet / GPT-4o |
| Routing, classification, simple extraction | Haiku / GPT-4o-mini |
| Embedding, similarity search | text-embedding-3-small |
| Summarization of tool results | Haiku |

In a multi-agent system, the orchestrator might need the big model. Workers doing mechanical tasks (format a JSON, classify a label, check a condition) don't.

```javascript
async function routeTask(task) {
  if (task.complexity === "high" || task.requiresReasoning) {
    return callModel("claude-sonnet-4-5", task);
  }
  return callModel("claude-haiku-3-5", task); // ~20x cheaper
}
```

This alone can cut costs by 60–80% on workflows where heavy reasoning is only needed at decision points.

---

### 4. Retry Budgets and Short-Circuit Logic

Agents that retry indefinitely on failure can spiral into runaway costs. Set hard budgets:

```javascript
const RUN_CONFIG = {
  maxTurns: 20,
  maxCostUsd: 0.50, // hard stop
  maxRetries: 3,
};

class AgentRunner {
  #turns = 0;
  #totalCost = 0;

  async step(messages) {
    if (this.#turns >= RUN_CONFIG.maxTurns) throw new Error("Max turns reached");
    if (this.#totalCost >= RUN_CONFIG.maxCostUsd) throw new Error("Cost budget exceeded");

    const response = await callModel(messages);
    this.#turns++;
    this.#totalCost += computeCost(response.usage);

    return response;
  }
}
```

Short-circuit on obvious failures early (e.g., missing required input data) before spending tokens on reasoning that will fail anyway. Validate preconditions before the agent loop starts.

---

## Try This Today

Pick one of your agents (or the simple loop from Day 15) and add cost tracking:

1. Log `input_tokens`, `output_tokens`, and computed cost per turn
2. Log the cumulative total at the end of each run
3. Run the agent 3–5 times on representative tasks
4. Identify which turns are most expensive — is it the planning step? A specific tool result being injected?

Bonus: replace one step that uses your primary model with Haiku and verify the output quality is still acceptable.

---

## Resources

- **Anthropic Prompt Caching:** https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- **Token counting and cost estimation:** https://docs.anthropic.com/en/docs/resources/model-deprecations (includes pricing tables per model)
