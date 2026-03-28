---
title: "Context Windows as a Resource: Strategies and Patterns"
day: 8
week: 2
weekName: "Data & Context"
description: "Context window economics: cost vs quality vs latency"
tag: "data-context"
---

# Day 8 — Context Windows as a Resource: Strategies and Patterns

Context windows are the RAM of AI-native systems. Every token you put in costs money, adds latency, and competes with other information for the model's attention. Managing context is not an afterthought — it's a core architectural concern that directly determines output quality.

## 1. Context Window Economics

```typescript
// The math that drives every context decision
interface ContextBudget {
  windowSize: number;        // e.g., 200K tokens for Claude Sonnet
  systemPrompt: number;      // 500-2000 tokens (fixed cost)
  conversationHistory: number; // grows with each turn
  retrievedContext: number;   // RAG results, docs, etc.
  userMessage: number;       // the actual request
  reservedForOutput: number; // must leave room for the response
}

function calculateAvailable(budget: ContextBudget): number {
  return budget.windowSize
    - budget.systemPrompt
    - budget.reservedForOutput
    - budget.userMessage;
  // This remainder is your budget for history + retrieved context
}

// Example: 200K window
// System prompt: 1,500 tokens
// Reserved output: 4,000 tokens
// User message: 500 tokens
// Available for context: 194,000 tokens
// BUT: quality degrades well before you fill 194K
```

**Critical insight**: just because you *can* fill 200K tokens doesn't mean you *should*. Research shows LLM attention degrades in the middle of long contexts ("lost in the middle" effect). Shorter, more relevant context consistently outperforms longer, comprehensive context.

## 2. Context Stuffing Anti-Patterns

```typescript
// ❌ Anti-pattern: dump everything and hope the model finds what it needs
const response = await llm.complete({
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: `
      Here is the entire codebase: ${entireCodebase}
      Here is all documentation: ${allDocs}
      Here is the user's question: ${question}
    `}
  ]
});

// ❌ Anti-pattern: keep full conversation history forever
const messages = conversationHistory; // grows unbounded
// After 50 turns, you're spending $0.50 per message on input tokens alone

// ✅ Better: selective, prioritized context
const response = await llm.complete({
  system: systemPrompt,
  messages: [
    ...summarizedHistory,           // compressed older turns
    ...recentMessages.slice(-6),    // last 3 exchanges verbatim
    { role: 'user', content: question }
  ]
});
```

## 3. Context Management Strategies

**Sliding window** — keep only the N most recent messages:

```typescript
class SlidingWindowContext {
  private maxTurns: number;

  constructor(maxTurns = 10) {
    this.maxTurns = maxTurns;
  }

  trim(messages: Message[]): Message[] {
    if (messages.length <= this.maxTurns * 2) return messages;
    // Always keep system message + last N exchanges
    return messages.slice(-(this.maxTurns * 2));
  }
}
```

**Summarization** — compress older context into summaries:

```typescript
class SummarizingContext {
  private summaryThreshold = 20; // messages before summarizing

  async manage(messages: Message[], llm: LLMClient): Promise<Message[]> {
    if (messages.length < this.summaryThreshold) return messages;

    const oldMessages = messages.slice(0, -10);
    const recentMessages = messages.slice(-10);

    const summary = await llm.complete({
      system: 'Summarize this conversation concisely, preserving key decisions and context.',
      messages: [{ role: 'user', content: formatMessages(oldMessages) }],
    });

    return [
      { role: 'system', content: `Previous conversation summary:\n${summary}` },
      ...recentMessages,
    ];
  }
}
```

**Selective retrieval** — only pull in what's relevant to the current query:

```typescript
class SelectiveContext {
  async build(
    query: string,
    sources: ContextSource[],
    tokenBudget: number
  ): Promise<string> {
    // Score each source by relevance
    const scored = await Promise.all(
      sources.map(async (s) => ({
        source: s,
        relevance: await this.scoreRelevance(query, s),
        tokens: countTokens(s.content),
      }))
    );

    // Greedy knapsack: fill budget with most relevant first
    scored.sort((a, b) => b.relevance - a.relevance);

    let used = 0;
    const selected: ContextSource[] = [];
    for (const item of scored) {
      if (used + item.tokens > tokenBudget) continue;
      selected.push(item.source);
      used += item.tokens;
    }

    return selected.map(s => s.content).join('\n---\n');
  }
}
```

## 4. Hierarchical Context: System, Session, Turn

Structure your context in layers with clear priority:

```typescript
interface ContextHierarchy {
  // Layer 1: System prompt — always present, cached
  system: {
    content: string;
    cacheControl: 'ephemeral'; // Anthropic prompt caching
    tokens: number;
  };

  // Layer 2: Session context — user preferences, task state
  session: {
    userProfile: string;
    taskContext: string;
    tokens: number;
  };

  // Layer 3: Retrieved context — RAG results, relevant docs
  retrieved: {
    chunks: RankedChunk[];
    tokens: number;
  };

  // Layer 4: Conversation — recent messages
  conversation: {
    summary?: string;
    recentMessages: Message[];
    tokens: number;
  };

  // Layer 5: Current turn
  currentMessage: {
    content: string;
    tokens: number;
  };
}

function assembleContext(hierarchy: ContextHierarchy, maxTokens: number): AssembledContext {
  // Priority order: system > current > conversation > session > retrieved
  // Trim from lowest priority if over budget
  let budget = maxTokens - hierarchy.system.tokens - hierarchy.currentMessage.tokens;

  const conversation = trimToFit(hierarchy.conversation, Math.min(budget, budget * 0.4));
  budget -= conversation.tokens;

  const session = trimToFit(hierarchy.session, Math.min(budget, budget * 0.3));
  budget -= session.tokens;

  const retrieved = trimToFit(hierarchy.retrieved, budget);

  return { system: hierarchy.system, session, retrieved, conversation, currentMessage: hierarchy.currentMessage };
}
```

## Try This Today

Add token counting to one LLM call in your codebase. Use `tiktoken` (for OpenAI models) or the Anthropic token counting API. Log the token breakdown: system prompt, context, user message, output. Calculate what percentage of your context window you're actually using and whether you're paying for wasted space.

## Resources

- [Lost in the Middle: How Language Models Use Long Contexts (Paper)](https://arxiv.org/abs/2307.03172) — Key research on attention degradation in long contexts
- [Anthropic Token Counting](https://docs.anthropic.com/en/docs/build-with-claude/token-counting) — API for accurate token counting with Claude models
