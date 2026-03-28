---
title: "Prompt as Code: Versioning, Testing, and Deployment"
day: 3
week: 1
weekName: "Foundations"
description: "Treating prompts as first-class artifacts"
tag: "foundations"
---

# Day 3 — Prompt as Code: Versioning, Testing, and Deployment

Prompts are the business logic of AI-native systems. Treating them as casual strings buried in source code is like hardcoding SQL queries with no migrations. Once your system depends on prompt quality, you need the same rigor you apply to any other critical code artifact.

## 1. Treating Prompts as First-Class Artifacts

Prompts should live in dedicated files with clear ownership, versioning, and review processes:

```
src/
  prompts/
    classify-ticket.prompt.ts
    summarize-thread.prompt.ts
    plan-fulfillment.prompt.ts
    _shared/
      system-context.ts
      output-schemas.ts
```

```typescript
// classify-ticket.prompt.ts
import { z } from 'zod';

export const CLASSIFY_TICKET_PROMPT = {
  version: '2.1.0',
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
  maxTokens: 200,

  system: `You are a support ticket classifier. Classify into exactly one category.
Output valid JSON matching the schema. No explanation.`,

  template: (ticket: { subject: string; body: string; history?: string }) => `
Subject: ${ticket.subject}
Body: ${ticket.body}
${ticket.history ? `Previous tickets from this user:\n${ticket.history}` : ''}

Classify this ticket.`,

  outputSchema: z.object({
    category: z.enum(['billing', 'technical', 'feature-request', 'account', 'other']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
  }),
} as const;
```

This gives you: type safety, version tracking, co-located schema validation, and model pinning — all in one artifact.

## 2. Prompt Versioning Strategies

**Git-based versioning** (simplest, works for most teams): prompts live in code, changes go through PRs. Tag releases with the prompt version.

**Prompt registry** (for rapid iteration): a separate key-value store where prompts can be updated without code deploys.

```typescript
// Simple prompt registry with version tracking
class PromptRegistry {
  private store: Map<string, PromptVersion[]> = new Map();

  register(name: string, version: string, prompt: PromptConfig) {
    const versions = this.store.get(name) || [];
    versions.push({ version, prompt, createdAt: new Date(), active: false });
    this.store.set(name, versions);
  }

  activate(name: string, version: string) {
    const versions = this.store.get(name);
    if (!versions) throw new Error(`Unknown prompt: ${name}`);
    versions.forEach(v => v.active = (v.version === version));
  }

  resolve(name: string): PromptConfig {
    const versions = this.store.get(name);
    const active = versions?.find(v => v.active);
    if (!active) throw new Error(`No active version for prompt: ${name}`);
    return active.prompt;
  }
}
```

**When to use which**: Git-based for prompts that change with features (coupled to code). Registry for prompts you tune independently (A/B testing, rapid iteration).

## 3. Parameterized Prompts and Template Engines

Raw string interpolation breaks fast with complex prompts. Build a minimal template layer:

```typescript
type PromptTemplate<TParams> = {
  name: string;
  version: string;
  render: (params: TParams) => { system: string; user: string };
  validate: (params: TParams) => boolean;
};

// Factory for type-safe prompt templates
function definePrompt<TParams>(config: PromptTemplate<TParams>) {
  return {
    ...config,
    call: async (params: TParams, llm: LLMClient) => {
      if (!config.validate(params)) {
        throw new Error(`Invalid params for prompt ${config.name}`);
      }
      const { system, user } = config.render(params);
      return llm.complete({ system, messages: [{ role: 'user', content: user }] });
    }
  };
}

const classifyPrompt = definePrompt<{ text: string; categories: string[] }>({
  name: 'classify',
  version: '1.0.0',
  validate: (p) => p.text.length > 0 && p.categories.length > 0,
  render: (p) => ({
    system: 'Classify the text into one of the given categories.',
    user: `Categories: ${p.categories.join(', ')}\n\nText: ${p.text}`,
  }),
});
```

## 4. Testing Prompts: Deterministic and Statistical

Prompt testing requires two layers:

```typescript
// Layer 1: Deterministic — test the template, not the LLM
describe('classifyTicket prompt', () => {
  it('includes ticket subject in rendered prompt', () => {
    const rendered = CLASSIFY_TICKET_PROMPT.template({
      subject: 'Billing error',
      body: 'I was charged twice',
    });
    expect(rendered).toContain('Billing error');
  });

  it('omits history section when no history provided', () => {
    const rendered = CLASSIFY_TICKET_PROMPT.template({
      subject: 'Test',
      body: 'Test body',
    });
    expect(rendered).not.toContain('Previous tickets');
  });
});

// Layer 2: Statistical evals — test the LLM output
// Run nightly or on prompt change, not on every commit
describe('classifyTicket eval', () => {
  const testCases = loadEvalDataset('classify-ticket-golden.json');

  it('achieves >90% accuracy on golden dataset', async () => {
    let correct = 0;
    for (const tc of testCases) {
      const result = await classifyTicket(tc.input);
      if (result.category === tc.expected.category) correct++;
    }
    expect(correct / testCases.length).toBeGreaterThan(0.9);
  });
});
```

**Key insight**: deterministic tests run on every PR (fast, cheap). Statistical evals run on prompt changes or nightly (slow, costs money, but catches regressions).

## Try This Today

Take one prompt from your codebase that's currently a raw string. Refactor it into a typed prompt artifact with: version, parameter validation, output schema (Zod), and one deterministic test for the template rendering. Commit it as a `.prompt.ts` file.

## Resources

- [Promptfoo: Test and Evaluate LLM Prompts](https://www.promptfoo.dev/docs/intro/) — Open-source eval framework that integrates with CI/CD
- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview) — Best practices for structuring and testing prompts
