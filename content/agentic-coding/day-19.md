---
title: "RAG for Agents"
day: 19
week: 3
weekName: "Implementation"
description: "Retrieval-augmented generation patterns to give agents access to external knowledge."
tag: "implementation"
---


## Why This Matters

An agent's context window is finite — and knowledge has a cutoff. When your agent needs to reason over a large codebase, a documentation corpus, or a live dataset, you can't just stuff it all into the prompt. RAG solves this by making retrieval itself a tool: the agent asks for what it needs, gets relevant chunks back, and reasons on top of them. Senior engineers need to understand this not as a magic trick, but as a data pipeline with well-defined trade-offs.

---

## Core Concepts

### 1. The RAG Pipeline

RAG has two phases: **indexing** (offline) and **retrieval** (runtime).

**Indexing:**
```
raw documents → chunking → embedding → vector store
```

**Retrieval (at agent runtime):**
```
query → embed query → similarity search → top-k chunks → inject into context
```

The key insight: you're not doing full-text search. You're finding *semantically similar* content. "What does the `useAuth` composable do?" retrieves code about auth even if it doesn't contain those exact words.

---

### 2. Chunking Strategy

How you split documents is as important as the model you use. Bad chunking = bad retrieval.

**Fixed-size chunking** — simplest, often good enough:
```javascript
function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap; // overlap preserves context across boundaries
  }
  return chunks;
}
```

**Semantic chunking** — split on meaningful boundaries (paragraphs, function definitions, headings). Better for code and structured docs.

**Gotchas:**
- Too small: chunks lose context ("the function" — which function?)
- Too large: you burn tokens and dilute the relevant signal
- No overlap: you split important context across chunk boundaries

For code specifically, consider chunking at the function/class level rather than by character count.

---

### 3. Embedding & Vector Stores

Embeddings convert text into a dense vector. The closer two vectors are in space, the more semantically similar the texts are.

**Minimal example with OpenAI + in-memory store:**
```javascript
import OpenAI from "openai";

const client = new OpenAI();

async function embed(text) {
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (magA * magB);
}

async function retrieve(query, index, topK = 3) {
  const queryVec = await embed(query);
  return index
    .map((item) => ({ ...item, score: cosineSimilarity(queryVec, item.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

**Production vector stores** to know:
- **pgvector** — Postgres extension, great if you're already on Postgres
- **Qdrant** — purpose-built, fast, easy to self-host
- **Pinecone** — managed, no ops, scales well
- **Chroma** — local dev-friendly, good for prototyping

For most Node.js projects starting out, pgvector is the pragmatic choice — it keeps your stack simple.

---

### 4. Wiring RAG as an Agent Tool

This is the architectural move: retrieval isn't a preprocessing step, it's a **tool the agent can call**. The agent decides *when* to retrieve and *what* to query.

```javascript
const tools = [
  {
    name: "search_knowledge_base",
    description:
      "Search the project documentation and codebase for relevant context. " +
      "Use when you need to understand how a feature works, find relevant examples, " +
      "or locate existing implementations before writing new code.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query",
        },
        top_k: {
          type: "number",
          description: "Number of results to return (default: 3)",
        },
      },
      required: ["query"],
    },
  },
];

// Tool handler
async function handleToolCall(toolName, toolInput) {
  if (toolName === "search_knowledge_base") {
    const results = await retrieve(toolInput.query, vectorIndex, toolInput.top_k ?? 3);
    return results
      .map((r, i) => `[Result ${i + 1}] (score: ${r.score.toFixed(3)})\n${r.text}`)
      .join("\n\n---\n\n");
  }
}
```

The agent now autonomously decides to call `search_knowledge_base` before answering questions, exactly like a developer who knows to `grep` the codebase before guessing.

**Key design decision:** Don't force retrieval on every turn. Let the agent decide. If the question is about general TypeScript syntax, retrieval adds noise. If the question is "how does our auth middleware work?", it's essential.

---

## Try This Today

**Build a minimal RAG tool for your own codebase:**

1. Pick 5–10 files from `hawkbot-mission-control` (or any project).
2. Chunk them at the function level using a simple parser or regex.
3. Embed each chunk with `text-embedding-3-small`.
4. Store vectors in memory (a plain array works for this exercise).
5. Write a `retrieve(query)` function and test it with 3 real questions you'd ask about the codebase.
6. Observe: which queries return relevant chunks? Which ones fail? Tune your chunking.

The goal is to feel the pipeline end-to-end — not to ship it yet.

---

## Resources

- **OpenAI Embeddings docs:** https://platform.openai.com/docs/guides/embeddings — covers models, dimensions, and best practices
- **pgvector README:** https://github.com/pgvector/pgvector — if you're already on Postgres, this is the lowest-friction path to a production vector store
