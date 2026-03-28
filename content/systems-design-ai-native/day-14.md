---
title: "Week 2 Synthesis: Designing Your Data Layer"
day: 14
week: 2
weekName: "Data & Context"
description: "Decision tree: RAG vs fine-tuning vs in-context learning"
tag: "Data & Context"
---

# Day 14 — Week 2 Synthesis: Designing Your Data Layer

You've spent a week on data and context management — the layer that determines whether your AI gives brilliant answers or hallucinates confidently. Today we synthesize into a decision framework for designing the complete data architecture of any AI-native application.

## 1. Decision Tree: RAG vs Fine-Tuning vs In-Context Learning

The most common architectural question: how should the model access my data?

```typescript
type DataStrategy = 'in-context' | 'rag' | 'fine-tuning' | 'hybrid';

function chooseDataStrategy(requirements: {
  dataSize: 'small' | 'medium' | 'large';    // <50K / 50K-1M / >1M tokens
  updateFrequency: 'static' | 'daily' | 'realtime';
  needsAttribution: boolean;                   // must cite sources?
  domainSpecific: boolean;                     // specialized vocabulary/reasoning?
  latencyBudget: number;                       // ms for data retrieval
}): DataStrategy {

  // Small, static data → just put it in the prompt
  if (requirements.dataSize === 'small' && requirements.updateFrequency === 'static') {
    return 'in-context';
  }

  // Domain-specific patterns the model can't learn from examples → fine-tune
  if (requirements.domainSpecific && requirements.updateFrequency === 'static') {
    return 'fine-tuning'; // teach the model HOW to think about your domain
  }

  // Dynamic data, needs attribution → RAG
  if (requirements.updateFrequency !== 'static' || requirements.needsAttribution) {
    return 'rag';
  }

  // Large static data + domain expertise → fine-tune + RAG for freshness
  if (requirements.dataSize === 'large' && requirements.domainSpecific) {
    return 'hybrid'; // fine-tuned model + RAG for recent data
  }

  return 'rag'; // safe default
}
```

**Reality check**: fine-tuning is rarely the right first choice. It's expensive, slow to iterate, and loses flexibility. Start with in-context or RAG. Fine-tune only when you have clear evidence that the model needs to learn new *patterns*, not just new *facts*.

## 2. Data Architecture Review Template

```typescript
interface AIDataArchitecture {
  // Context management (Day 8)
  contextStrategy: {
    windowManagement: 'sliding' | 'summarization' | 'selective';
    tokenBudget: {
      system: number;
      session: number;
      retrieved: number;
      reserved: number;
    };
    promptCaching: boolean;
  };

  // Retrieval layer (Days 9-10)
  retrieval: {
    strategy: 'none' | 'rag' | 'hybrid-search';
    vectorDB: string;
    embeddingModel: string;
    chunkingStrategy: 'fixed' | 'semantic' | 'hierarchical';
    reranking: boolean;
    indexUpdateFrequency: 'realtime' | 'hourly' | 'daily';
  };

  // Memory layer (Day 11)
  memory: {
    shortTerm: {
      store: 'in-memory' | 'redis';
      maxMessages: number;
      compaction: 'drop' | 'summarize';
    };
    longTerm: {
      store: 'vector-db' | 'sqlite' | 'both';
      retrievalStrategy: 'semantic' | 'keyword' | 'hybrid';
    };
    episodic: {
      enabled: boolean;
      store: 'sqlite' | 'postgres';
    };
  };

  // Streaming (Day 12)
  streaming: {
    enabled: boolean;
    pattern: 'micro-batch' | 'per-event' | 'windowed';
    windowType?: 'tumbling' | 'session' | 'sliding';
  };

  // Caching (Day 13)
  caching: {
    l1: 'exact-match-redis' | 'none';
    l2: 'semantic' | 'none';
    providerCaching: boolean;
    invalidation: 'time-based' | 'event-based' | 'both';
  };
}
```

## 3. Applying It: Personal AI Assistant Data Layer

Let's design the data layer for a personal AI assistant — the exact kind of system Eduardo builds:

```typescript
const personalAssistantDataLayer: AIDataArchitecture = {
  contextStrategy: {
    windowManagement: 'summarization',
    tokenBudget: {
      system: 1500,      // personality, tools, rules
      session: 4000,     // recent conversation + summary of older
      retrieved: 6000,   // memories, docs, calendar
      reserved: 4000,    // response budget
    },
    promptCaching: true, // system prompt reused every turn
  },

  retrieval: {
    strategy: 'rag',
    vectorDB: 'sqlite-vec',  // embedded, no extra infra
    embeddingModel: 'text-embedding-3-small',
    chunkingStrategy: 'semantic',
    reranking: false,         // overkill for personal use
    indexUpdateFrequency: 'realtime', // memories stored as they happen
  },

  memory: {
    shortTerm: {
      store: 'in-memory',
      maxMessages: 20,
      compaction: 'summarize',
    },
    longTerm: {
      store: 'both', // vector for semantic search + sqlite for structured queries
      retrievalStrategy: 'hybrid',
    },
    episodic: {
      enabled: true,
      store: 'sqlite', // "what worked last time I tried this"
    },
  },

  streaming: {
    enabled: false, // personal assistant, no high-throughput needs
    pattern: 'per-event',
  },

  caching: {
    l1: 'exact-match-redis',
    l2: 'none',               // queries are too varied for semantic cache
    providerCaching: true,     // always cache system prompt
    invalidation: 'time-based',
  },
};
```

## 4. Common Pitfalls and How to Avoid Them

```typescript
const pitfalls = [
  {
    mistake: 'Stuffing everything into context "just in case"',
    symptom: 'High cost, slow responses, lower quality (lost in the middle)',
    fix: 'Selective retrieval with relevance scoring. Less is more.',
  },
  {
    mistake: 'No token budget — context grows unbounded',
    symptom: 'Sudden context window errors, cost spikes',
    fix: 'Define explicit token budgets per layer. Monitor and alert.',
  },
  {
    mistake: 'Caching with temperature > 0',
    symptom: 'Users get stale/wrong cached responses',
    fix: 'Only cache temperature=0 calls, or cache with short TTL + low threshold.',
  },
  {
    mistake: 'RAG without evaluation',
    symptom: '"RAG works" but answers are wrong 30% of the time',
    fix: 'Build a retrieval eval: golden queries → expected chunks. Measure recall@K.',
  },
  {
    mistake: 'Single memory type for everything',
    symptom: 'Short-term clutter in long-term store, or vice versa',
    fix: 'Separate memory types with different TTLs and storage backends.',
  },
];
```

## Try This Today

Design the complete data layer for a personal AI assistant (or for hawkbot-mission-control). Use the `AIDataArchitecture` template above and fill in every field with a concrete choice. For each decision, write a one-line justification. This should take 30-45 minutes and give you a complete data architecture document you can reference during implementation.

## Resources

- [AI Engineer's Guide to Data Architecture (Chip Huyen)](https://huyenchip.com/2025/01/16/ai-engineering.html) — Comprehensive data layer patterns for AI-native systems
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — Vector search extension for SQLite — perfect for embedded AI apps without extra infrastructure
