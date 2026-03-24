---
title: "Evaluating Agent Performance"
day: 27
week: 4
weekName: "Production"
description: "Metrics, eval frameworks, and systematic approaches to measuring agent quality."
tag: "production"
---


## Why This Matters

You've built agents. They mostly work. But "mostly" is doing a lot of heavy lifting in that sentence. How do you know if a code change made your agent better or worse? How do you catch regression before it ships? How do you explain to a stakeholder why Agent v2 is worth the extra $0.04 per run?

Traditional software has unit tests, benchmarks, and coverage reports. Agents have... vibes. That's the gap Day 27 closes. Evaluation is what separates a toy agent from a production system you can actually trust.

---

## 1. The Three Metric Categories

Agent performance breaks down into three orthogonal dimensions:

**Task Completion Rate** — Did the agent actually accomplish the goal?

This is binary per run, averaged over N runs:

```js
const results = await runAgentBatch(testCases);
const completionRate = results.filter(r => r.success).length / results.length;
// 0.87 = 87% task completion
```

What counts as "success" is where the real work is. You need a verifier — either another LLM judge, a deterministic check (does the output compile? does the test pass?), or human labeling.

**Token Efficiency** — How much does it cost to complete the task?

```js
const efficiency = {
  inputTokens: run.usage.input_tokens,
  outputTokens: run.usage.output_tokens,
  totalCost: (run.usage.input_tokens * 0.000003) + (run.usage.output_tokens * 0.000015),
  stepsToCompletion: run.toolCallCount,
};
```

Track this per task category. A file-edit task that takes 12 tool calls when it should take 3 is a design smell — probably a context or prompt issue, not a model issue.

**Latency** — How long does the user wait?

```js
const p50 = percentile(durations, 50);
const p95 = percentile(durations, 95);
// p95 matters more than mean for UX
```

Latency is often dominated by LLM inference time, but tool execution (DB queries, API calls, file I/O) adds up. Profile each step.

---

## 2. Human Eval vs Automated Eval

You need both, used strategically.

**Automated eval** — fast, cheap, runs on every commit. Use it for:
- Deterministic checks: does the code compile? does the CLI return exit code 0?
- LLM-as-judge: feed the agent output + task description to a separate model and ask for a 1–5 score with reasoning
- Regression detection: store golden outputs and diff against them

```js
async function llmJudge(task, agentOutput) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // cheap judge is fine
    messages: [{
      role: 'user',
      content: `Task: ${task}\n\nAgent output:\n${agentOutput}\n\nRate 1-5 on: correctness, completeness, efficiency. JSON only.`
    }]
  });
  return JSON.parse(response.choices[0].message.content);
}
```

**Human eval** — slow, expensive, irreplaceable for:
- Calibrating your automated judge (is the LLM judge actually aligned with human judgment?)
- New task categories where you don't yet have baselines
- High-stakes decisions (before shipping a major prompt change)

Rule of thumb: run human eval when a metric moves >5% unexpectedly, or when releasing a significant change.

---

## 3. Building Your Eval Suite

An eval suite is a set of test cases with known-good answers or verifiers. Structure:

```js
// eval-suite/file-editor.js
export const testCases = [
  {
    id: 'add-function-simple',
    input: {
      instruction: 'Add a function `double(n)` that returns n * 2 to utils.js',
      files: { 'utils.js': 'export const add = (a, b) => a + b;\n' }
    },
    verify: (output) => {
      // Deterministic: check the actual file
      return output.files['utils.js'].includes('double') &&
             output.files['utils.js'].includes('n * 2');
    }
  },
  {
    id: 'fix-bug-null-check',
    input: {
      instruction: 'Fix the null reference error in processUser()',
      files: { 'user.js': `function processUser(user) { return user.name.toUpperCase(); }` }
    },
    verify: (output) => {
      // Run the fixed code against a null input and check it doesn't throw
      try {
        const fn = new Function('return ' + output.files['user.js'])();
        fn(null); // should not throw
        return true;
      } catch { return false; }
    }
  }
];
```

Run your agent against every test case in CI. Track metrics over time in a JSON file committed to the repo — that's your performance history.

---

## 4. The Eval-Driven Improvement Loop

This is the workflow that actually makes agents better:

1. **Identify failure cases** — look at runs where the agent failed or scored low
2. **Add them to your eval suite** — the failure is now a regression test
3. **Hypothesize the cause** — bad prompt? missing tool? context overflow?
4. **Fix the agent** — change one variable at a time
5. **Run evals before/after** — did your metric move in the right direction? Did anything regress?
6. **Ship only if green**

This loop is the agent equivalent of TDD. Without it, you're flying blind and every "improvement" might be breaking something else.

---

## Try This Today

Take one task your current agent does (or one you've built this week) and write 5 eval test cases for it:
- 2 happy path cases (straightforward inputs)
- 2 edge cases (empty input, ambiguous instruction, missing file)
- 1 adversarial case (instruction that could cause the agent to do the wrong thing)

For each case, define a `verify()` function — either deterministic (check output structure/content) or LLM-based (prompt a judge model). Run your agent against them and see what your actual success rate is. You'll almost certainly be surprised.

---

## Resources

- **Braintrust** — purpose-built eval platform for LLM apps: <https://www.braintrust.dev>
- **OpenAI Evals** — framework + public benchmark library: <https://github.com/openai/evals>
