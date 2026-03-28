---
title: "Vector Databases: Choosing, Indexing, and Querying"
day: 10
week: 2
weekName: "Data & Context"
description: "How vector similarity search works (HNSW, IVF)"
tag: "data-context"
---

# Day 10 — Vector Databases: Choosing, Indexing, and Querying

Vector databases are the storage layer for RAG and semantic search. They turn "find documents similar to this query" from an O(n) brute-force scan into a millisecond lookup. Understanding how they work under the hood helps you make better choices about indexing, querying, and when you don't need one at all.

## 1. How Vector Similarity Search Works

At the core, vector search finds the nearest neighbors in high-dimensional space (768-3072 dimensions for modern embeddings). Two dominant index types:

```typescript
// Conceptual: brute-force similarity (what vector DBs optimize away)
function bruteForceSearch(
  query: number[],
  vectors: { id: string; vector: number[] }[],
  topK: number
): { id: string; score: number }[] {
  return vectors
    .map(v => ({
      id: v.id,
      score: cosineSimilarity(query, v.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**HNSW (Hierarchical Navigable Small World)** — the most common index type. Builds a multi-layer graph where each node connects to its nearest neighbors. Query time: O(log n). Trade-off: high memory usage (stores the full graph in RAM).

**IVF (Inverted File Index)** — partitions vectors into clusters, then only searches relevant clusters. Query time: depends on `nprobe` (clusters to search). Trade-off: less accurate than HNSW but lower memory.

## 2. Comparing Options

```typescript
// Decision matrix for vector DB selection
const vectorDBComparison = {
  pgvector: {
    bestFor: 'Already using PostgreSQL, <1M vectors',
    hosting: 'Self-hosted or managed Postgres',
    performance: 'Good for small-medium datasets',
    advantage: 'No new infrastructure — just an extension',
    limitation: 'Slower at scale, limited filtering',
  },
  pinecone: {
    bestFor: 'Managed service, fast setup, serverless',
    hosting: 'Fully managed (cloud)',
    performance: 'Excellent at any scale',
    advantage: 'Zero ops, built-in metadata filtering',
    limitation: 'Vendor lock-in, cost at scale',
  },
  qdrant: {
    bestFor: 'Self-hosted, advanced filtering, Rust performance',
    hosting: 'Self-hosted or Qdrant Cloud',
    performance: 'Excellent, especially filtered search',
    advantage: 'Rich filtering, payload storage, open source',
    limitation: 'Need to manage infrastructure',
  },
  chromadb: {
    bestFor: 'Local dev, prototyping, small datasets',
    hosting: 'Embedded (in-process) or client-server',
    performance: 'Fine for <100K vectors',
    advantage: 'Zero config, pip/npm install and go',
    limitation: 'Not production-grade for large scale',
  },
};

// My recommendation for most Node.js AI-native apps:
// - Dev/prototype: Chroma or in-memory arrays
// - Production <1M vectors with Postgres: pgvector
// - Production any scale: Qdrant (self-hosted) or Pinecone (managed)
```

## 3. Metadata Filtering and Hybrid Search

Pure vector similarity misses structured constraints. Combine vector search with metadata filters:

```typescript
// Qdrant example: vector search + metadata filtering
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

// Upsert with rich metadata
await qdrant.upsert('documents', {
  points: [{
    id: 'doc-123-chunk-0',
    vector: embedding,
    payload: {
      docId: 'doc-123',
      source: 'engineering-wiki',
      category: 'architecture',
      updatedAt: '2026-03-15',
      accessLevel: 'internal',
    },
  }],
});

// Search: similar vectors BUT only from specific category, recent docs
const results = await qdrant.search('documents', {
  vector: queryEmbedding,
  limit: 10,
  filter: {
    must: [
      { key: 'category', match: { value: 'architecture' } },
      { key: 'accessLevel', match: { value: 'internal' } },
    ],
    should: [
      { key: 'updatedAt', range: { gte: '2026-01-01' } },
    ],
  },
});

// Hybrid search: combine vector similarity with keyword (BM25)
// Some DBs support this natively; otherwise, combine scores:
function hybridScore(
  vectorScore: number,
  keywordScore: number,
  alpha = 0.7 // weight toward semantic
): number {
  return alpha * vectorScore + (1 - alpha) * keywordScore;
}
```

## 4. Embedding Models: Quality vs Cost vs Speed

```typescript
const embeddingModels = {
  'text-embedding-3-small': {
    dimensions: 1536,
    costPer1M: 0.02,    // $0.02 per 1M tokens
    quality: 'good',     // fine for most use cases
    speed: 'fast',
    provider: 'OpenAI',
  },
  'text-embedding-3-large': {
    dimensions: 3072,
    costPer1M: 0.13,
    quality: 'excellent',
    speed: 'fast',
    provider: 'OpenAI',
  },
  'voyage-3': {
    dimensions: 1024,
    costPer1M: 0.06,
    quality: 'excellent', // especially for code
    speed: 'fast',
    provider: 'Voyage AI',
  },
};

// Practical tip: you can reduce dimensions for cost savings
// text-embedding-3-large supports native dimension reduction
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: 'Your text here',
  dimensions: 1024, // reduced from 3072 — 67% storage savings, minimal quality loss
});
```

**Key trade-off**: larger embeddings = better quality but more storage and slower search. For most applications, `text-embedding-3-small` at 1536 dimensions is the sweet spot. Use `voyage-3` if your corpus is code-heavy.

## Try This Today

Set up a local Qdrant instance with Docker (`docker run -p 6333:6333 qdrant/qdrant`), embed 50-100 chunks from a project's documentation using `text-embedding-3-small`, and run 5 test queries. Compare: (1) pure vector search, (2) vector search + metadata filter, (3) brute-force cosine similarity on raw arrays. Measure latency and retrieval quality for each.

## Resources

- [Qdrant Documentation](https://qdrant.tech/documentation/) — Comprehensive guide to a production vector DB with excellent filtering support
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard) — Benchmark for comparing embedding model quality across tasks
