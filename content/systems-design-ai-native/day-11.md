---
title: "Memory Systems: Short-Term, Long-Term, Episodic"
day: 11
week: 2
weekName: "Data & Context"
description: "The 4 types of memory in agentic systems"
tag: "data-context"
---

# Day 11 — Memory Systems: Short-Term, Long-Term, Episodic

Human cognition uses different memory systems for different purposes. AI agents need the same architecture — a single flat message history doesn't scale. Understanding the four types of memory and when to deploy each is what separates toy agents from production systems.

## 1. The Four Types of Memory in Agentic Systems

```typescript
interface AgentMemoryArchitecture {
  // Working memory: current context window contents
  working: {
    capacity: 'limited';      // context window size
    duration: 'single-turn';  // cleared between calls
    purpose: 'immediate reasoning';
  };

  // Short-term memory: recent conversation/session state
  shortTerm: {
    capacity: 'medium';       // last N messages
    duration: 'session';      // lives for the conversation
    purpose: 'conversational continuity';
  };

  // Long-term memory: persistent knowledge across sessions
  longTerm: {
    capacity: 'large';        // vector store + database
    duration: 'permanent';    // survives restarts
    purpose: 'accumulated knowledge, user preferences';
  };

  // Episodic memory: structured records of past events
  episodic: {
    capacity: 'large';
    duration: 'permanent';
    purpose: 'learning from experience, pattern recognition';
  };
}
```

Each type serves a distinct purpose. Mixing them (e.g., stuffing long-term knowledge into short-term message history) causes context pollution and wasted tokens.

## 2. Implementing Short-Term (In-Context) Memory

Short-term memory is what fits in the context window. The challenge: keeping it relevant as conversations grow:

```typescript
class ShortTermMemory {
  private messages: Message[] = [];
  private maxTokens: number;

  constructor(maxTokens = 8000) {
    this.maxTokens = maxTokens;
  }

  add(message: Message): void {
    this.messages.push(message);
    this.compact();
  }

  private compact(): void {
    let totalTokens = this.messages.reduce((sum, m) => sum + countTokens(m.content), 0);

    while (totalTokens > this.maxTokens && this.messages.length > 2) {
      // Remove oldest non-system message
      const removed = this.messages.splice(1, 1)[0]; // keep index 0 (system)
      totalTokens -= countTokens(removed.content);
    }
  }

  // Smarter: summarize instead of dropping
  async compactWithSummary(llm: LLMClient): Promise<void> {
    if (this.messages.length < 15) return;

    const oldMessages = this.messages.slice(1, -6); // keep system + last 3 turns
    const summary = await llm.complete({
      messages: [{
        role: 'user',
        content: `Summarize this conversation, preserving key facts, decisions, and user preferences:\n${
          oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')
        }`
      }]
    });

    this.messages = [
      this.messages[0], // system prompt
      { role: 'system', content: `Conversation summary:\n${summary.text}` },
      ...this.messages.slice(-6), // recent turns
    ];
  }

  toMessages(): Message[] {
    return [...this.messages];
  }
}
```

## 3. Long-Term Memory with Vector Search

Long-term memory persists across sessions. Store facts, preferences, and knowledge as embeddings for semantic retrieval:

```typescript
class LongTermMemory {
  constructor(
    private vectorStore: VectorStore,
    private embedder: EmbeddingModel,
    private db: Database,
  ) {}

  async store(memory: {
    content: string;
    type: 'fact' | 'preference' | 'knowledge';
    source: string;
    importance: number; // 0-1
  }): Promise<void> {
    const id = crypto.randomUUID();
    const embedding = await this.embedder.embed(memory.content);

    // Store in vector DB for semantic search
    await this.vectorStore.upsert([{
      id,
      vector: embedding,
      metadata: {
        content: memory.content,
        type: memory.type,
        source: memory.source,
        importance: memory.importance,
        createdAt: new Date().toISOString(),
      },
    }]);

    // Also store in SQL for structured queries
    await this.db.insert(memories).values({
      id,
      content: memory.content,
      type: memory.type,
      importance: memory.importance,
      createdAt: new Date(),
    });
  }

  async recall(query: string, limit = 5): Promise<MemoryResult[]> {
    const queryVector = await this.embedder.embed(query);

    const results = await this.vectorStore.search(queryVector, limit * 2, {
      filter: { importance: { gte: 0.3 } }, // skip low-importance noise
    });

    // Boost recent and important memories
    return results
      .map(r => ({
        content: r.metadata.content,
        relevance: r.score,
        recency: recencyScore(r.metadata.createdAt),
        importance: r.metadata.importance,
        finalScore: r.score * 0.5 + recencyScore(r.metadata.createdAt) * 0.2 + r.metadata.importance * 0.3,
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }
}

function recencyScore(dateStr: string): number {
  const age = Date.now() - new Date(dateStr).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);
  return Math.exp(-daysOld / 30); // exponential decay over 30 days
}
```

## 4. Episodic Memory: Structured Event Logs

Episodic memory records *what happened* so agents can learn from experience:

```typescript
interface Episode {
  id: string;
  timestamp: Date;
  trigger: string;           // what initiated this episode
  actions: ActionRecord[];   // what the agent did
  outcome: 'success' | 'failure' | 'partial';
  feedback?: string;         // human or automated feedback
  lessons: string[];         // extracted insights
}

class EpisodicMemory {
  private episodes: Episode[] = [];

  record(episode: Episode): void {
    this.episodes.push(episode);
  }

  // Find similar past episodes for learning
  async findSimilar(currentSituation: string, limit = 3): Promise<Episode[]> {
    // Could use vector search here, or simple keyword matching
    const scored = this.episodes.map(ep => ({
      episode: ep,
      similarity: jaccardSimilarity(currentSituation, ep.trigger),
    }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.episode);
  }

  // Generate context for "learning from the past"
  async getRelevantLessons(situation: string): Promise<string> {
    const similar = await this.findSimilar(situation);
    if (similar.length === 0) return '';

    return `Relevant past experiences:\n${
      similar.map(ep =>
        `- Task: ${ep.trigger}\n  Outcome: ${ep.outcome}\n  Lessons: ${ep.lessons.join('; ')}`
      ).join('\n')
    }`;
  }
}
```

Episodic memory is how agents avoid repeating mistakes. If an agent failed with a particular approach before, it should know that without being explicitly told.

## Try This Today

Implement a dual-memory system for an agent: short-term (sliding window with summarization) + long-term (simple vector store). Have the agent automatically extract and store "facts" from conversations (user preferences, decisions, etc.) into long-term memory, and recall them in new sessions. Test: tell the agent your preference in session 1, end the session, start a new one, and verify it remembers.

## Resources

- [MemGPT: Towards LLMs as Operating Systems (Paper)](https://arxiv.org/abs/2310.08560) — Foundational paper on hierarchical memory management for LLM agents
- [LangChain Memory Documentation](https://python.langchain.com/docs/concepts/memory/) — Practical patterns for different memory types in agent systems
