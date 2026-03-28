---
title: "Evaluations (Evals): Testing AI Behavior at Scale"
day: 18
week: 3
weekName: "Reliability"
description: "Why traditional testing is insufficient for AI"
tag: "reliability"
---

# Day 18 — Evaluations (Evals): Testing AI Behavior at Scale

Traditional tests assert exact outputs. AI outputs are non-deterministic — the same prompt can produce different but equally correct answers. Evals bridge this gap: they measure AI behavior statistically, catching regressions that unit tests can't detect. Without evals, you're shipping prompt changes blind.

## 1. Types of Evals

```typescript
type EvalType =
  | 'unit'           // Deterministic checks on output format/structure
  | 'integration'    // End-to-end pipeline correctness
  | 'human'          // Manual review by domain experts
  | 'llm-as-judge'   // Another LLM scores the output
  | 'reference'       // Compare against golden answers
  | 'comparative';    // A vs B — which is better?

// Each type has different cost/speed/accuracy profiles
const evalProfiles = {
  unit:           { speed: 'fast', cost: 'free', accuracy: 'limited', frequency: 'every-commit' },
  integration:    { speed: 'slow', cost: 'medium', accuracy: 'good', frequency: 'daily' },
  human:          { speed: 'very-slow', cost: 'high', accuracy: 'best', frequency: 'weekly' },
  'llm-as-judge': { speed: 'medium', cost: 'medium', accuracy: 'good', frequency: 'daily' },
  reference:      { speed: 'fast', cost: 'low', accuracy: 'good', frequency: 'on-change' },
  comparative:    { speed: 'medium', cost: 'medium', accuracy: 'good', frequency: 'on-change' },
};
```

## 2. Building an Eval Harness

```typescript
interface EvalCase {
  id: string;
  input: unknown;
  expected?: unknown;            // for reference evals
  criteria: EvalCriterion[];     // what to check
  tags: string[];                // for filtering/grouping
}

interface EvalCriterion {
  name: string;
  type: 'exact' | 'contains' | 'schema' | 'llm-judge' | 'custom';
  check: (output: unknown, expected?: unknown) => Promise<EvalScore>;
}

interface EvalScore {
  pass: boolean;
  score: number;    // 0-1
  reason?: string;
}

class EvalHarness {
  constructor(
    private pipeline: AIPipeline,
    private logger: EvalLogger,
  ) {}

  async run(
    cases: EvalCase[],
    options: { concurrency?: number; model?: string } = {}
  ): Promise<EvalReport> {
    const results: EvalResult[] = [];

    // Process with controlled concurrency
    const batches = chunk(cases, options.concurrency || 5);
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (evalCase) => {
          const start = Date.now();
          const output = await this.pipeline.run(evalCase.input, { model: options.model });

          const scores = await Promise.all(
            evalCase.criteria.map(c => c.check(output, evalCase.expected))
          );

          return {
            caseId: evalCase.id,
            tags: evalCase.tags,
            output,
            scores,
            latencyMs: Date.now() - start,
            pass: scores.every(s => s.pass),
          };
        })
      );
      results.push(...batchResults);
    }

    return this.generateReport(results);
  }

  private generateReport(results: EvalResult[]): EvalReport {
    const total = results.length;
    const passed = results.filter(r => r.pass).length;

    return {
      passRate: passed / total,
      totalCases: total,
      passed,
      failed: total - passed,
      byTag: this.groupByTag(results),
      byCriterion: this.groupByCriterion(results),
      avgLatencyMs: results.reduce((s, r) => s + r.latencyMs, 0) / total,
      failures: results.filter(r => !r.pass).map(r => ({
        caseId: r.caseId,
        failedCriteria: r.scores.filter(s => !s.pass).map(s => s.reason),
      })),
    };
  }
}
```

## 3. LLM-as-Judge: Automated Quality Scoring

When you can't define exact expected outputs, use another LLM to judge quality:

```typescript
async function llmJudge(
  input: string,
  output: string,
  criteria: string,
  judge: LLMClient
): Promise<EvalScore> {
  const response = await judge.complete({
    system: `You are an evaluation judge. Score the assistant's response on the given criteria.
Return JSON: { "score": 0-10, "pass": true/false, "reason": "brief explanation" }`,
    messages: [{
      role: 'user',
      content: `## Criteria
${criteria}

## User Input
${input}

## Assistant Response
${output}

## Evaluation
Score this response on the criteria above.`
    }],
    temperature: 0,
  });

  return JSON.parse(response.text);
}

// Build reusable criteria functions
const criteria = {
  factualAccuracy: (context: string) =>
    `Is the response factually accurate based on this context?\n${context}\nScore 0 for hallucination, 10 for perfect accuracy.`,

  relevance:
    'Does the response directly address the user\'s question? Score 0 for irrelevant, 10 for perfectly relevant.',

  conciseness:
    'Is the response appropriately concise? Score 0 for extremely verbose or too brief, 10 for optimal length.',

  formatCompliance: (schema: string) =>
    `Does the response match this expected format?\n${schema}\nScore 0 for wrong format, 10 for perfect compliance.`,
};
```

## 4. Regression Testing for Prompt Changes

The most critical eval: does this prompt change make things worse?

```typescript
class PromptRegressionTest {
  async compare(
    cases: EvalCase[],
    currentPrompt: PromptConfig,
    newPrompt: PromptConfig,
    harness: EvalHarness
  ): Promise<RegressionReport> {
    // Run eval suite with both prompts
    const [currentResults, newResults] = await Promise.all([
      harness.run(cases, { prompt: currentPrompt }),
      harness.run(cases, { prompt: newPrompt }),
    ]);

    const regressions = cases.filter((_, i) =>
      currentResults.results[i].pass && !newResults.results[i].pass
    );

    const improvements = cases.filter((_, i) =>
      !currentResults.results[i].pass && newResults.results[i].pass
    );

    return {
      currentPassRate: currentResults.passRate,
      newPassRate: newResults.passRate,
      regressions: regressions.length,
      improvements: improvements.length,
      recommendation: newResults.passRate >= currentResults.passRate
        ? 'APPROVE'
        : regressions.length > cases.length * 0.05
          ? 'REJECT'   // >5% regression
          : 'REVIEW',   // minor regression, human review
      details: { regressions, improvements },
    };
  }
}
```

**CI integration**: run regression tests on every PR that modifies a `.prompt.ts` file. Block merge if pass rate drops by >5%.

## Try This Today

Create an eval suite for one critical prompt: define 10-20 test cases with expected behavior, implement at least two criteria types (schema validation + LLM-as-judge for quality), and run the suite. Baseline the pass rate. Then make one small change to the prompt and re-run — does it regress? This is your first prompt regression test.

## Resources

- [Promptfoo Documentation](https://www.promptfoo.dev/docs/intro/) — Open-source eval framework with CI/CD integration, LLM-as-judge, and comparison views
- [Braintrust AI Evals](https://www.braintrust.dev/docs) — Production eval platform with tracing, scoring, and regression detection
