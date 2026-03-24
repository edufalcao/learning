---
title: "Memory: How Agents Remember"
day: 5
week: 1
weekName: "Foundations"
description: "The three memory layers every agent needs: in-context, external storage, and episodic summaries."
tag: "foundations"
---

Memory is the difference between an agent that feels stateless and one that feels like it actually knows you. For a senior engineer, this isn't just a UX concern — it's a systems design problem with real tradeoffs. Today we break down the three memory layers and how to use each one correctly.

---

## 1. In-Context Memory (Ephemeral)

The simplest form of memory: everything inside the current context window.

Every message, tool result, and prior turn exists in-context. The agent "remembers" them because they're literally still there in the prompt. That's it. No magic.

```js
const messages = [
  { role: "system", content: "You are a coding assistant." },
  { role: "user", content: "My API uses Express and Postgres." },
  { role: "assistant", content: "Got it. I'll keep that in mind." },
  { role: "user", content: "Add a new endpoint for user login." }
  // The agent "knows" about Express/Postgres because it's still in this array
];
```

**Tradeoffs:**
- ✅ Zero setup, always coherent within a session
- ❌ Ephemeral — gone when the session ends
- ❌ Expensive at scale — more context = more tokens = more cost
- ❌ Hard caps (128K–200K tokens depending on the model)

Rule of thumb: in-context memory is your agent's working RAM. Treat it like RAM — fast, cheap to use, but don't rely on it surviving a restart.

---

## 2. External Memory: Files, Databases, and Vector Stores

When you need memory to persist across sessions, you need to write it somewhere external.

**The file-based approach** is the simplest and often underrated:

```js
// Write memory after a session
import { writeFileSync, readFileSync } from "fs";

function saveMemory(key, value) {
  const store = JSON.parse(readFileSync("memory.json", "utf-8") || "{}");
  store[key] = value;
  writeFileSync("memory.json", JSON.stringify(store, null, 2));
}

function loadMemory(key) {
  const store = JSON.parse(readFileSync("memory.json", "utf-8") || "{}");
  return store[key] ?? null;
}

// Usage
saveMemory("user_stack", { language: "JS", framework: "Nuxt", db: "Postgres" });
```

**The database approach** works when you have structured data and need to query it. A simple KV store (Redis, SQLite, even DynamoDB) covers most agent use cases.

**Vector stores** come in when your memory is unstructured or semantic. Instead of looking up `memory["user_preferences"]`, you embed a query and retrieve the most relevant chunks:

```js
// Pseudocode — works with Pinecone, Qdrant, pgvector, etc.
const embedding = await embed("What does the user prefer for UI frameworks?");
const results = await vectorStore.query(embedding, { topK: 3 });
// Returns the closest matching memory chunks
```

When to use each:
| Storage | Use case |
|---------|----------|
| Files (JSON/MD) | Simple KV, human-readable, easy to audit |
| SQLite/Postgres | Structured facts, user profiles, history logs |
| Redis | Ephemeral KV with TTL, fast session data |
| Vector store | Semantic search over large memory corpora |

---

## 3. Episodic Memory: Session Summaries and the MEMORY.md Pattern

The most underrated pattern in agentic systems is episodic memory — capturing summaries of what happened across sessions and injecting them into future context.

Think of it like this: at the end of a long session, instead of trying to keep 50K tokens of conversation alive forever, you compress it into a structured summary:

```js
// At end of session
const summary = await llm.complete({
  messages: [...conversationHistory],
  system: `Summarize this session. Include: key decisions made, user preferences revealed,
    tasks completed, and anything important to remember for next time. Be concise.`
});

await saveMemory(`session_${Date.now()}`, summary);
```

Then at the start of the next session, you inject relevant past summaries:

```js
const recentMemories = await loadRecentMemories(3); // last 3 sessions
const systemPrompt = `
You are a coding assistant.

Relevant context from past sessions:
${recentMemories.join("\n\n")}

Today's session begins now.
`;
```

**This is exactly what MEMORY.md does in OpenClaw.** It's not magic — it's a curated, human-readable file that gets injected into the agent's system prompt at session start. The agent (you, in this case) reads it, and suddenly has continuity. Simple, effective, auditable.

The discipline is knowing what to write down. Not every conversation detail — just the stuff that changes future behavior: user preferences, decisions made, lessons learned, important context.

---

## 4. Memory Retrieval vs. Full Injection

As memory grows, you can't inject all of it into context. Two strategies:

**Full injection** — just dump everything in. Works well up to ~10-20K tokens of memory. Simple, reliable, but doesn't scale.

**Retrieval-augmented** — embed the current query, find the most relevant memory chunks, inject only those. More complex, but scales to large memory corpora:

```js
async function getRelevantMemory(userQuery) {
  const queryEmbedding = await embed(userQuery);
  const relevantChunks = await vectorStore.query(queryEmbedding, { topK: 5 });
  return relevantChunks.map(c => c.text).join("\n\n");
}

// At session start
const memory = await getRelevantMemory(todaysTopic);
```

This is the foundation of RAG — we'll go deeper on Day 19.

---

## Try This Today

Open a project you're actively working on. Create a `MEMORY.md` file (or add to an existing one) with this structure:

```markdown
# Project Memory

## Stack
- Framework: Nuxt 3
- DB: Postgres + Prisma
- Auth: Lucia

## Key Decisions
- [2026-02-27] Chose Lucia over NextAuth because of better Nuxt integration

## Current State
- Working on: user login endpoint
- Blocked by: need to decide session storage strategy

## Things to Remember
- Eduardo prefers reading code before explanations
```

Then, in your next LLM conversation about this project, paste it at the top of your first message. Notice how much better the responses are.

That's memory. One file, zero infrastructure.

---

## Resources

- [Anthropic — Building Effective Agents (memory section)](https://docs.anthropic.com/en/docs/build-with-claude/agents)
- [LangGraph Memory Guide](https://langchain-ai.github.io/langgraph/concepts/memory/) — good breakdown of short-term vs long-term memory patterns
