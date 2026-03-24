---
title: "Context Management & Compaction"
day: 11
week: 2
weekName: "Architecture"
description: "Token limits, summarization, compaction, and rolling window strategies."
tag: "architecture"
---


## Why This Matters

For a senior engineer, the context window is the most deceptive constraint in agentic systems. It looks like a simple number (128K tokens, 200K tokens), so you assume it's just "big enough." It rarely is — not in production, not in long-running tasks, and not when your agent is doing real work across dozens of tool calls.

The context window is your agent's working memory. When it fills up, the agent doesn't gracefully pause — it either halts with an error, starts hallucinating as the model struggles with a truncated prompt, or silently forgets the beginning of its own conversation. All three are silent killers in production. Knowing how to manage this proactively separates toy agents from reliable ones.

---

## Core Concepts

### 1. What Actually Lives in the Context Window

Every token counts against the limit: system prompt, user messages, tool call results, assistant responses, and the growing history of everything the agent has done. A complex multi-step agent can burn through tokens fast:

- **System prompt:** 500–2000 tokens (often underestimated)
- **Each tool result:** 200–5000+ tokens (file reads, API responses)
- **Conversation history:** grows linearly with each turn
- **Thinking/reasoning blocks:** if using extended thinking, these can be enormous

A 10-turn agent session with moderate tool use can easily hit 50K–80K tokens. At 128K context, you have maybe 15–20 real turns before things get uncomfortable.

```javascript
// Rough token estimation (OpenAI-style, ~4 chars per token)
function estimateTokens(messages) {
  const text = messages.map(m => m.content || '').join(' ');
  return Math.ceil(text.length / 4);
}

const contextUsed = estimateTokens(conversationHistory);
const contextLimit = 128_000;
const contextLeft = contextLimit - contextUsed;

if (contextLeft < 10_000) {
  // Time to compact before the next turn
  await compactHistory(conversationHistory);
}
```

---

### 2. Truncation vs Summarization vs Retrieval

When you're about to overflow, you have three basic strategies. Each has a different risk profile:

**Truncation (naive, dangerous):**  
Drop the oldest messages. Fast, but the agent loses early context — the initial goal, established facts, prior decisions. This is the default behavior of many naive implementations and it silently breaks task continuity.

```javascript
// Naive truncation — don't do this
function truncateHistory(messages, maxTokens) {
  while (estimateTokens(messages) > maxTokens) {
    messages.shift(); // Drops the oldest message — loses context
  }
  return messages;
}
```

**Summarization (better):**  
When the context grows large, ask the model to summarize what has happened so far into a compact block, then replace the history with that summary + recent messages.

```javascript
async function summarizeHistory(messages, client) {
  const summaryPrompt = {
    role: 'user',
    content: `Summarize the following conversation history concisely, 
preserving: the original goal, key decisions made, important findings, 
and current state. Be brief but complete.\n\n${JSON.stringify(messages)}`
  };

  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022', // use a cheap model for compression
    max_tokens: 1024,
    messages: [summaryPrompt]
  });

  return {
    role: 'assistant',
    content: `[CONTEXT SUMMARY — earlier turns compacted]\n${response.content[0].text}`
  };
}

async function compactHistory(messages, client, keepRecentN = 6) {
  const recent = messages.slice(-keepRecentN);
  const toSummarize = messages.slice(0, -keepRecentN);

  if (toSummarize.length === 0) return messages;

  const summary = await summarizeHistory(toSummarize, client);
  return [summary, ...recent];
}
```

**Retrieval (scalable):**  
Instead of keeping all history in context, persist it to a vector store or file system, and retrieve only the relevant chunks as needed. This is the right architecture for agents that run over hours or days.

```javascript
// Store tool results externally, retrieve on demand
async function storeResult(id, content, vectorStore) {
  await vectorStore.upsert({ id, content, embedding: await embed(content) });
}

async function retrieveRelevant(query, vectorStore, topK = 3) {
  const results = await vectorStore.query({ query, topK });
  return results.map(r => r.content).join('\n---\n');
}
```

---

### 3. Rolling Window Patterns

A rolling window keeps the last N turns always in context, plus a summary of everything before. This is a practical middle ground — cheaper than full retrieval, safer than pure truncation.

```javascript
class RollingContextManager {
  constructor({ windowSize = 10, maxTokens = 100_000, client }) {
    this.windowSize = windowSize;
    this.maxTokens = maxTokens;
    this.client = client;
    this.summary = null;
    this.recentMessages = [];
  }

  async add(message) {
    this.recentMessages.push(message);

    if (this.recentMessages.length > this.windowSize ||
        estimateTokens(this.buildContext()) > this.maxTokens * 0.85) {
      await this.compact();
    }
  }

  async compact() {
    const overflow = this.recentMessages.slice(0, -Math.floor(this.windowSize / 2));
    const summaryText = await summarizeHistory(
      [this.summary, ...overflow].filter(Boolean),
      this.client
    );
    this.summary = summaryText;
    this.recentMessages = this.recentMessages.slice(-Math.floor(this.windowSize / 2));
  }

  buildContext() {
    return [
      ...(this.summary ? [this.summary] : []),
      ...this.recentMessages
    ];
  }
}
```

---

### 4. Proactive Budget Management

Don't wait for an overflow — manage the budget actively. Reserve headroom for the model's output, and set thresholds to trigger compaction before you hit the wall.

```javascript
const CONTEXT_BUDGET = {
  total: 128_000,
  systemPrompt: 2_000,    // reserved
  toolResults: 20_000,    // reserved for upcoming tool calls
  modelOutput: 8_000,     // reserved for response
  get available() {
    return this.total - this.systemPrompt - this.toolResults - this.modelOutput;
  }
};

// Before each agent turn:
const currentUsage = estimateTokens(history);
const utilizationPct = (currentUsage / CONTEXT_BUDGET.available) * 100;

if (utilizationPct > 75) {
  console.log(`[context] ${utilizationPct.toFixed(1)}% used — compacting`);
  history = await compactHistory(history, client);
}
```

---

## Try This Today

Take any agent you've written (or a simple one you can build in 30 min) and add a context monitor:

1. After each agent turn, log the estimated token count of your full message history.
2. Add a compaction trigger at 75% of your model's context limit.
3. Implement the simple summarization compaction from above.
4. Run a long task (10+ turns) and observe how the context evolves — watch what information survives compaction and what gets lost.

The goal isn't to build something perfect — it's to *see* the problem viscerally. Once you watch your agent forget its own initial goal because of a naive truncation, you'll never ship without context management again.

---

## Resources

- [Anthropic — Context windows and token counting](https://docs.anthropic.com/en/docs/build-with-claude/tokens)
- [LangGraph — Conversation summarization pattern](https://langchain-ai.github.io/langgraph/how-tos/memory/add-summary-conversation-history/)
