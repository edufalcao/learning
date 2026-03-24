---
title: "The Agent Mental Model"
day: 1
week: 1
weekName: "Foundations"
description: "Understand the core loop that separates an LLM from an agent: Perceive, Think, Act, Observe."
tag: "foundations"
---

## Why This Matters to a Senior Engineer

You've built systems that call APIs, process data, and run async pipelines. You know how to structure complex code. But an **agent** is something different — not because of the technology stack, but because of the **control flow**.

In traditional software, you write the control flow. Every `if`, `while`, and function call is you deciding what happens next. In agentic systems, the **model decides what happens next**. That shift — from deterministic orchestration to model-driven decision-making — is the core mental model change you need to internalize.

If you don't get this right, you'll build agents that are just fancy chatbots dressed up in tool calls.

---

## Core Concept 1: The Loop Is the Agent

An LLM by itself is a **function**: input text → output text. Stateless, single-shot. It doesn't act. It talks.

An **agent** is what happens when you wrap that function in a loop:

```
while (goal not achieved) {
  perception  = gather(context, tools, history)
  thought     = LLM(perception)         // "what should I do next?"
  action      = parse(thought)          // extract tool call or final answer
  observation = execute(action)         // run the tool, get result
  context.add(observation)              // feed result back in
}
```

That loop — **Perceive → Think → Act → Observe** — is the agent. The LLM is just the "Think" step. The rest is your infrastructure.

This is why "just call GPT-4" doesn't give you an agent. The loop, the tool execution layer, and the memory management are all on you (or your framework).

---

## Core Concept 2: Perceive → Think → Act → Observe

Let's make the cycle concrete with a real example — a coding agent asked to *"fix the failing test in auth.test.ts"*:

```
PERCEIVE:  system prompt + task description + file tree + test output
THINK:     "I need to read auth.test.ts and auth.ts before making changes"
ACT:       tool_call: read_file("src/auth.ts")
OBSERVE:   { content: "export function login(user) { ... }" }

PERCEIVE:  (add file content to context)
THINK:     "The login function isn't hashing the password. I'll fix that."
ACT:       tool_call: write_file("src/auth.ts", "...fixed content...")
OBSERVE:   { success: true }

PERCEIVE:  (add write result to context)
THINK:     "I should run the test to confirm the fix works."
ACT:       tool_call: run_command("npm test auth.test.ts")
OBSERVE:   { output: "✓ 3 tests passed" }

THINK:     "Goal achieved. Done."
ACT:       final_answer("Fixed the missing password hash in login()")
```

Notice: the agent *decided* to read the file first. You didn't write `if (need to read) { readFile() }`. The model chose that path based on context.

---

## Core Concept 3: Why This Changes Software Development

Three concrete implications for how you'll design systems:

**1. Non-determinism is a feature, not a bug.** The agent adapts to what it finds. If the file doesn't exist, it creates it. If the test still fails, it retries with a different fix. You stop specifying *how* and start specifying *what*.

**2. Your job shifts from writing logic to writing constraints.** Instead of `if (error) retry()`, you write: *"If a tool call fails, try once more with a reformulated approach before reporting the error."* You're authoring behavior policies, not algorithms.

**3. Failure modes are completely different.** Traditional bugs are deterministic — same input, same wrong output. Agent bugs are probabilistic — the model *sometimes* skips a step, *occasionally* hallucinates a file path, *sometimes* loops forever. You need different debugging tools (tracing, eval suites) and different safeguards (max iterations, tool allowlists).

---

## Core Concept 4: The Minimal Agent in Code

Here's the loop stripped to its essence in Node.js:

```javascript
async function runAgent(goal, tools, maxSteps = 20) {
  const messages = [{ role: "user", content: goal }];

  for (let step = 0; step < maxSteps; step++) {
    const response = await llm.complete({ messages, tools });

    if (response.stopReason === "end_turn") {
      return response.text; // goal achieved
    }

    if (response.stopReason === "tool_use") {
      const toolCall = response.toolUse;
      const result = await executeTool(toolCall.name, toolCall.input);

      // Feed observation back into context
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolCall.id, content: result }] });
    }
  }

  throw new Error("Max steps reached — agent did not complete the goal");
}
```

This is the entire agent. Everything else — frameworks, memory systems, multi-agent orchestration — is built on top of this loop.

---

## Try This Today

**Trace an existing agent run manually.**

Open a chat with Claude (or any LLM with tools enabled) and ask it to do a multi-step task — like *"look up the current Node.js LTS version and tell me how it compares to what I have installed."*

Now trace through *each message* in the conversation:
- What was the **perception** at each step? (What context did it have?)
- What did it **think**? (What was the reasoning or tool choice?)
- What did it **act** on? (What tool call was made?)
- What was the **observation**? (What did the tool return?)

Do this by hand. It makes the loop feel real.

---

## Resources

- [Anthropic: Build with Claude — Agents](https://docs.anthropic.com/en/docs/build-with-claude/agents) — official docs on the agentic loop and tool use patterns
- [ReAct: Synergizing Reasoning and Acting in Language Models (paper)](https://arxiv.org/abs/2210.03629) — the foundational paper behind the Perceive→Think→Act→Observe pattern most agents use today
