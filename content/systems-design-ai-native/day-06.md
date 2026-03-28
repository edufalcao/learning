---
title: "State Management in Agentic Systems"
day: 6
week: 1
weekName: "Foundations"
description: "The statefulness problem: agents need memory across calls"
tag: "Foundations"
---

# Day 6 — State Management in Agentic Systems

Agents need memory across calls — that's what makes them agents instead of stateless functions. But statefulness introduces complexity: what to store, where to store it, how to recover it, and how to prevent state corruption when LLM outputs are non-deterministic. Getting state management right is the difference between a demo and a production system.

## 1. The Three Types of State

Agentic systems juggle three distinct state categories, each with different lifetimes and storage needs:

```typescript
// Conversation state — scoped to a user session
interface ConversationState {
  sessionId: string;
  messages: Message[];        // chat history
  currentIntent: string;      // what the user wants right now
  pendingActions: Action[];   // actions awaiting confirmation
  ttl: number;                // expires after inactivity
}

// Task state — scoped to an agent's current job
interface TaskState {
  taskId: string;
  agentId: string;
  status: 'planning' | 'executing' | 'blocked' | 'completed' | 'failed';
  plan: Step[];               // the agent's plan
  completedSteps: StepResult[];
  currentStep: number;
  retryCount: number;
  context: Record<string, unknown>; // accumulated intermediate results
}

// World state — shared knowledge, persists across sessions
interface WorldState {
  entities: Map<string, Entity>;      // known objects/people/concepts
  facts: Fact[];                       // verified assertions
  relationships: Relationship[];       // connections between entities
  lastUpdated: Date;
}
```

**Critical distinction**: conversation state is disposable (user can start fresh). Task state must survive crashes (partial work is expensive to redo). World state is your system's long-term memory.

## 2. State Stores: Choosing the Right Tool

```typescript
// In-memory — fast, volatile, good for conversation state
const sessions = new Map<string, ConversationState>();

// Redis — fast, persistent enough, good for task state
import { Redis } from 'ioredis';
const redis = new Redis();

class RedisTaskStore {
  async save(task: TaskState): Promise<void> {
    await redis.set(
      `task:${task.taskId}`,
      JSON.stringify(task),
      'EX', 86400 // 24h TTL
    );
  }

  async load(taskId: string): Promise<TaskState | null> {
    const data = await redis.get(`task:${taskId}`);
    return data ? JSON.parse(data) : null;
  }

  async updateStep(taskId: string, stepResult: StepResult): Promise<void> {
    const task = await this.load(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.completedSteps.push(stepResult);
    task.currentStep++;
    await this.save(task);
  }
}

// SQLite/D1 — durable, queryable, good for world state
// Perfect for Nuxt + Drizzle setups
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

const agentMemory = sqliteTable('agent_memory', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  type: text('type').notNull(),    // 'fact' | 'entity' | 'relationship'
  content: text('content').notNull(), // JSON
  embedding: text('embedding'),     // for semantic search later
  createdAt: integer('created_at').notNull(),
});
```

## 3. State Machine Patterns for Agent Workflows

Agents making arbitrary decisions is a recipe for chaos. Constrain them with explicit state machines:

```typescript
type AgentPhase = 'idle' | 'planning' | 'executing' | 'reviewing' | 'blocked' | 'done';

const transitions: Record<AgentPhase, AgentPhase[]> = {
  idle:      ['planning'],
  planning:  ['executing', 'blocked', 'done'],
  executing: ['reviewing', 'blocked', 'planning'], // can re-plan
  reviewing: ['done', 'executing', 'planning'],     // can retry or re-plan
  blocked:   ['idle', 'planning'],                   // human unblocks
  done:      ['idle'],                               // reset for next task
};

class AgentStateMachine {
  private phase: AgentPhase = 'idle';
  private history: { from: AgentPhase; to: AgentPhase; timestamp: Date }[] = [];

  transition(to: AgentPhase): void {
    const allowed = transitions[this.phase];
    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid transition: ${this.phase} → ${to}. Allowed: ${allowed.join(', ')}`
      );
    }
    this.history.push({ from: this.phase, to, timestamp: new Date() });
    this.phase = to;
  }

  get current(): AgentPhase { return this.phase; }

  // Detect stuck agents
  get isStuck(): boolean {
    if (this.history.length < 3) return false;
    const last3 = this.history.slice(-3).map(h => h.to);
    return last3[0] === last3[2] && last3[0] !== last3[1]; // oscillating
  }
}
```

This prevents agents from looping infinitely between planning and executing, a common failure mode in agentic systems.

## 4. Persisting and Replaying Agent State

When an agent crashes mid-task, you need to resume from the last checkpoint, not restart from scratch:

```typescript
class CheckpointableAgent {
  private store: RedisTaskStore;

  async execute(task: TaskState): Promise<void> {
    // Resume from last completed step
    const startFrom = task.currentStep;

    for (let i = startFrom; i < task.plan.length; i++) {
      const step = task.plan[i];

      try {
        const result = await this.executeStep(step, task.context);
        task.completedSteps.push(result);
        task.context = { ...task.context, ...result.outputs };
        task.currentStep = i + 1;

        // Checkpoint after every step
        await this.store.save(task);
      } catch (err) {
        task.status = 'failed';
        await this.store.save(task);
        throw err; // let the retry mechanism handle it
      }
    }

    task.status = 'completed';
    await this.store.save(task);
  }
}
```

**Key principle**: checkpoint after every LLM call. LLM calls are the expensive part — losing their results to a crash is wasting money and time.

## Try This Today

Add a state machine to one agent workflow in your system. Define the valid phases, enforce transitions, and log every state change. Then add checkpointing: persist task state to Redis or SQLite after each step completes. Simulate a crash (kill the process mid-pipeline) and verify the agent resumes from the correct step.

## Resources

- [XState Documentation](https://stately.ai/docs) — Production-grade state machine library for TypeScript (great for complex agent workflows)
- [Drizzle ORM with SQLite](https://orm.drizzle.team/docs/get-started/sqlite-new) — Type-safe ORM for persisting agent state in SQLite/D1
