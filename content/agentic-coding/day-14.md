---
title: "Week 2 Review + Hands-On"
day: 14
week: 2
weekName: "Architecture"
description: "Sketch a multi-agent architecture and consolidate Week 2 concepts."
tag: "review"
---


## Why This Matters

You've spent Week 2 building a mental model of agent architecture — orchestrators, workers, tool design, context management, error handling, and MCP. Now it's time to synthesize. The gap between "understanding patterns" and "actually using them" closes here. Today's lesson forces you to apply everything by designing a real multi-agent system from scratch, think through its failure modes, and stress-test your assumptions before writing a single line of code.

This is the most important session in Week 2. Real engineering skill isn't pattern recognition — it's knowing which pattern fits which problem and why.

---

## Core Concepts

### 1. The Design Process: Problem First, Architecture Second

The most common mistake when building multi-agent systems is starting with the architecture. "I'll have an orchestrator, three worker agents, and a critic agent" — before you've even defined what success looks like.

Start with the problem decomposition:

```
1. What is the FINAL OUTPUT?
2. What are the DISCRETE STEPS to get there?
3. Which steps require LLM reasoning vs deterministic logic?
4. Which steps can run in parallel vs must be sequential?
5. Where do humans need to intervene?
```

Only after answering these do you assign agents to steps. Many "multi-agent" problems are actually single-agent problems with good tool design. Don't add agents for complexity's sake.

**Signal that you need multiple agents:**
- Steps require fundamentally different context/persona (e.g., a security reviewer shouldn't share context with the code generator)
- Parallel execution would meaningfully reduce latency
- You want isolated failure domains (agent A failing shouldn't corrupt agent B's context)
- Different steps need different models (cheap fast model for classification, powerful model for synthesis)

---

### 2. Mapping Tools to Agents

Once you have your agent roles, each agent needs a minimal toolset. The principle: **give each agent the least privilege required to complete its task.**

Consider a PR Review System as an example:

```
OrchestratorAgent
  tools: [ create_task(), assign_agent(), collect_results() ]

CodeFetcherAgent
  tools: [ gh_get_pr_diff(), gh_get_file_contents(), gh_list_changed_files() ]

SecurityReviewerAgent
  tools: [ search_vulnerability_db(), check_dependency_versions() ]
  context: only the diff, no full repo access

StyleReviewerAgent
  tools: [ run_eslint(), run_prettier_check() ]

SummarizerAgent
  tools: [ post_pr_comment() ]
  context: receives structured outputs from all reviewers
```

Notice: the `SummarizerAgent` never sees the raw code. It only receives structured review results. This keeps context focused and reduces token cost significantly.

**Tool schema quality still matters here.** A poorly described tool will be misused by workers regardless of how clean your orchestration is. Week 2's Day 10 lesson applies directly.

---

### 3. Failure Modes in Multi-Agent Systems

Single-agent failures are local. Multi-agent failures can cascade. Common failure patterns:

**Cascading context corruption:**
Agent A produces subtly wrong output → Agent B accepts it as ground truth → Agent C builds on that → final output is confidently wrong. The orchestrator never knew.

*Mitigation:* validate outputs at each handoff. Don't just pass raw text — use structured outputs (JSON schemas) and assert required fields exist before forwarding.

```javascript
// Don't do this
const result = await codeReviewAgent.run(diff);
await summarizerAgent.run(result); // blind trust

// Do this
const result = await codeReviewAgent.run(diff);
assertSchema(result, CodeReviewSchema); // throws if malformed
await summarizerAgent.run(result);
```

**Orchestrator bottleneck:**
If the orchestrator is doing too much reasoning on every step, it becomes the slowest and most expensive part of the pipeline. Orchestrators should delegate, not think.

**Silent worker failures:**
A worker agent says "I completed the task" but actually produced an empty or partial result. Always validate completion, not just acknowledgment.

**Recovery strategy:**
- Retry with same input (transient LLM error)
- Retry with reformulated prompt (model misunderstood)
- Escalate to human (repeated failure or ambiguous input)
- Checkpoint and resume from last known good state (for long pipelines)

---

### 4. Architecture Sketch as a First-Class Deliverable

Before coding, write the architecture down. A sketch doc forces clarity and catches assumptions early. It should answer:

```markdown
## Problem
[One sentence: what does this system do?]

## Agents
- OrchestratorAgent: responsibilities, tools, model
- WorkerAgent1: responsibilities, tools, model
- WorkerAgent2: ...

## Data Flow
[Step-by-step: what data moves between agents and in what format?]

## Failure Modes
- [Scenario]: [How it fails] → [Recovery strategy]

## Human Checkpoints
- [Where does a human need to approve or intervene?]

## Cost Estimate (rough)
- [How many LLM calls per run? What's the token budget?]
```

This document takes 20 minutes to write and saves hours of refactoring. Engineers skip it until they've been burned. Don't wait to be burned.

---

## Try This Today

Pick a real problem from your current work — something you've thought "this could be automated." Ideally something in your `hawkbot-mission-control` or Blu Digital workflows.

Write the architecture sketch using the template above. Specifically:

1. Identify all the discrete steps in the problem
2. Assign each step to an agent or a deterministic function (not everything needs an LLM)
3. Define the tool list for each agent (be specific — what does `search_something()` actually search?)
4. Write out 3 failure modes and how you'd recover from each
5. Mark exactly one human checkpoint — where would you NOT trust full automation?

Don't build it yet. The exercise is the design. If the design feels solid after 20 minutes, it's probably worth implementing. If you're confused about data flow between agents, that confusion will become a debugging nightmare in code.

---

## Resources

- **LangGraph — Multi-Agent Architectures:** https://langchain-ai.github.io/langgraph/concepts/multi_agent/
  Good reference for orchestrator patterns, supervisor graphs, and handoff schemas.

- **Anthropic — Building Effective Agents:** https://www.anthropic.com/research/building-effective-agents
  The section on "multi-agent networks" maps directly to today's concepts, from an agent framework perspective.
