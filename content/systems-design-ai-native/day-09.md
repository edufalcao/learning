---
title: "RAG Architecture Deep Dive"
day: 9
week: 2
weekName: "Data & Context"
description: "Why RAG exists and when to use it"
tag: "data-context"
---

# Day 9 — RAG Architecture Deep Dive

Retrieval-Augmented Generation (RAG) is the most common pattern for grounding LLM responses in your own data. But "just add RAG" hides enormous architectural complexity. The difference between a RAG demo and a production RAG system is in the details: chunking, retrieval quality, reranking, and knowing when RAG is the wrong tool entirely.

## 1. When to Use RAG (and When Not To)

RAG shines when: your knowledge base is large (>context window), changes frequently, or you need source attribution. RAG is wrong when: the knowledge fits in context, you need deep reasoning over the full corpus, or retrieval errors are unacceptable.

```typescript
function shouldUseRAG(requirements: DataRequirements): boolean {
  // Fits in context? Just stuff it in — simpler, more reliable
  if (requirements.totalTokens < 50_000) return false;

  // Needs full-corpus reasoning? RAG retrieves fragments, not wholes
  if (requirements.needsGlobalReasoning) return false;

  // Static, small dataset? Fine-tune instead
  if (!requirements.updatesFrequently && requirements.totalTokens < 100_000) return false;

  return true; // RAG is the right call
}
```

## 2. RAG Pipeline Anatomy

```
Ingest → Chunk → Embed → Index → [user query] → Retrieve → Rerank → Generate
```

```typescript
// Full RAG pipeline implementation
class RAGPipeline {
  constructor(
    private chunker: Chunker,
    private embedder: EmbeddingModel,
    private vectorStore: VectorStore,
    private reranker: Reranker,
    private llm: LLMClient,
  ) {}

  // Ingestion (offline)
  async ingest(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      const chunks = this.chunker.chunk(doc);
      const embeddings = await this.embedder.embedBatch(
        chunks.map(c => c.text)
      );

      await this.vectorStore.upsert(
        chunks.map((chunk, i) => ({
          id: `${doc.id}-${i}`,
          vector: embeddings[i],
          metadata: {
            docId: doc.id,
            chunkIndex: i,
            source: doc.source,
            text: chunk.text,
          },
        }))
      );
    }
  }

  // Query (online)
  async query(question: string, topK = 10): Promise<RAGResponse> {
    // 1. Embed the query
    const queryVector = await this.embedder.embed(question);

    // 2. Retrieve candidates (cast a wide net)
    const candidates = await this.vectorStore.search(queryVector, topK * 3);

    // 3. Rerank (narrow to the best)
    const reranked = await this.reranker.rerank(question, candidates, topK);

    // 4. Generate with retrieved context
    const context = reranked.map(r => r.metadata.text).join('\n---\n');
    const response = await this.llm.complete({
      system: 'Answer based on the provided context. Cite sources.',
      messages: [{
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      }],
    });

    return {
      answer: response.text,
      sources: reranked.map(r => ({ docId: r.metadata.docId, text: r.metadata.text })),
    };
  }
}
```

## 3. Chunking Strategies and Their Trade-offs

Chunking is where most RAG systems fail silently. Bad chunks → bad retrieval → bad answers:

```typescript
// Fixed-size chunking — simple, but splits sentences/concepts
function fixedSizeChunk(text: string, size = 512, overlap = 50): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

// Semantic chunking — split on natural boundaries
function semanticChunk(text: string): string[] {
  // Split on paragraph boundaries, then merge small paragraphs
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (countTokens(current + para) > 500) {
      if (current) chunks.push(current.trim());
      current = para;
    } else {
      current += '\n\n' + para;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// Hierarchical chunking — parent chunks for context, child chunks for precision
interface HierarchicalChunk {
  parent: string;          // larger context (e.g., full section)
  children: string[];      // smaller, precise chunks
  parentId: string;
}

// Retrieve on children (precise), but pass parent to LLM (context-rich)
```

**Rule of thumb**: 200-500 tokens per chunk for retrieval precision. Include the parent section as metadata for context when generating. Overlap 10-20% between chunks to avoid losing boundary information.

## 4. Advanced RAG: Reranking and Multi-Hop

Vector similarity alone has ~70% precision. Reranking bumps it to ~90%:

```typescript
// Cross-encoder reranking — much more accurate than vector similarity
class CrossEncoderReranker {
  async rerank(
    query: string,
    candidates: SearchResult[],
    topK: number
  ): Promise<SearchResult[]> {
    // Score each candidate against the query with a cross-encoder
    const scored = await Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        rerankerScore: await this.score(query, candidate.metadata.text),
      }))
    );

    return scored
      .sort((a, b) => b.rerankerScore - a.rerankerScore)
      .slice(0, topK);
  }
}

// HyDE: Hypothetical Document Embeddings
// Generate a hypothetical answer, embed THAT, then search
async function hydeSearch(question: string, pipeline: RAGPipeline) {
  // Step 1: LLM generates a hypothetical answer
  const hypothetical = await llm.complete({
    messages: [{ role: 'user', content: `Write a short answer to: ${question}` }],
  });

  // Step 2: Embed the hypothetical answer (not the question)
  const vector = await embedder.embed(hypothetical.text);

  // Step 3: Search — hypothetical answer is closer to real answers in embedding space
  return pipeline.vectorStore.search(vector, 10);
}
```

HyDE works because a generated answer is semantically closer to actual documents than a short question is.

## Try This Today

Build a minimal RAG pipeline: take 5-10 markdown files from a project, chunk them semantically (paragraph-based), embed with OpenAI's `text-embedding-3-small`, store in an in-memory array, and query with cosine similarity. No vector DB needed — just arrays and math. Measure retrieval quality: does the top-3 results contain the right answer for 5 test questions?

## Resources

- [RAG from Scratch (LangChain)](https://github.com/langchain-ai/rag-from-scratch) — Step-by-step RAG implementation, great for understanding each component
- [Chunking Strategies for LLM Applications (Pinecone)](https://www.pinecone.io/learn/chunking-strategies/) — Comprehensive comparison of chunking approaches with benchmarks
