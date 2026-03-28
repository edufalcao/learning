---
title: "Multi-Agent Orchestration Patterns"
day: 22
week: 4
weekName: "Multi-Agent & Production"
description: "Supervisor, pipeline, peer-to-peer, and marketplace patterns"
tag: "multi-agent"
---

# Day 22 — Multi-Agent Orchestration Patterns

When a single LLM call isn't enough, you need multiple agents coordinating. The orchestration pattern you choose — supervisor, pipeline, peer-to-peer, or marketplace — determines your system's reliability, latency, and cost profile. Getting this wrong creates systems that are expensive, fragile, and impossible to debug.

## 1. The Four Orchestration Patterns

```typescript
// Pattern 1: Supervisor — one agent delegates to others
class SupervisorOrchestrator {
  private agents: Map<string, Agent>;
  private supervisor: Agent;

  async execute(task: Task): Promise<Result> {
    // Supervisor plans and delegates
    const plan = await this.supervisor.plan(task);

    const results: StepResult[] = [];
    for (const step of plan.steps) {
      const agent = this.agents.get(step.agentId);
      if (!agent) throw new Error(`Unknown agent: ${step.agentId}`);

      const result = await agent.execute(step.input, {
        context: results, // previous step results
        budget: step.tokenBudget,
      });
      results.push(result);

      // Supervisor reviews and decides next step
      const review = await this.supervisor.review(result, plan);
      if (review.action === 'retry') continue;
      if (review.action === 'abort') break;
    }

    return this.supervisor.synthesize(results);
  }
}

// Pattern 2: Pipeline — fixed sequence, each agent hands off to next
class PipelineOrchestrator {
  constructor(private stages: Agent[]) {}

  async execute(input: unknown): Promise<unknown> {
    let current = input;
    for (const stage of this.stages) {
      current = await stage.execute(current);
    }
    return current;
  }
}

// Pattern 3: Peer-to-peer — agents communicate directly
class PeerToPeerOrchestrator {
  private agents: Map<string, Agent>;
  private messagebus: EventEmitter;

  constructor() {
    this.messagebus = new EventEmitter();
  }

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
    // Agent can send messages to other agents
    agent.onMessage = (target: string, message: AgentMessage) => {
      this.messagebus.emit(`agent:${target}`, message);
    };
    // Agent receives messages
    this.messagebus.on(`agent:${agent.id}`, (msg) => agent.handleMessage(msg));
  }
}

// Pattern 4: Marketplace — agents bid on tasks
class MarketplaceOrchestrator {
  private agents: Agent[];

  async execute(task: Task): Promise<Result> {
    // Broadcast task, collect bids
    const bids = await Promise.all(
      this.agents.map(async (agent) => ({
        agent,
        bid: await agent.bid(task), // confidence, estimated cost, time
      }))
    );

    // Select best agent
    const winner = bids
      .filter(b => b.bid.canHandle)
      .sort((a, b) => b.bid.confidence - a.bid.confidence)[0];

    return winner.agent.execute(task);
  }
}
```

## 2. When to Use Each Pattern

```typescript
const patternGuide = {
  supervisor: {
    useWhen: [
      'Tasks require dynamic planning (steps not known upfront)',
      'Need quality control between steps',
      'Complex multi-domain tasks',
    ],
    avoid: 'Simple, predictable workflows — supervisor adds latency and cost',
    example: 'Research agent that plans, delegates research to specialists, synthesizes',
  },
  pipeline: {
    useWhen: [
      'Fixed, well-defined sequence of transformations',
      'Each step has a single responsibility',
      'Output format of each step is stable',
    ],
    avoid: 'Dynamic tasks where step order or count varies',
    example: 'Document processing: extract → classify → enrich → store',
  },
  peerToPeer: {
    useWhen: [
      'Agents need to collaborate iteratively',
      'No single agent has authority/oversight',
      'Problem requires negotiation or debate',
    ],
    avoid: 'Most production systems — hard to debug and control',
    example: 'Code review: author agent and reviewer agent iterate on feedback',
  },
  marketplace: {
    useWhen: [
      'Multiple agents can handle the same task differently',
      'Want to route to the best agent dynamically',
      'Task specialization varies',
    ],
    avoid: 'When only one agent can handle the task',
    example: 'Customer support: route to specialist agent based on ticket type',
  },
};
```

## 3. Agent Lifecycle Management

Agents need explicit lifecycle management — spawning, monitoring, and cleanup:

```typescript
class AgentManager {
  private active = new Map<string, AgentInstance>();
  private maxConcurrent = 10;

  async spawn(config: AgentConfig): Promise<AgentInstance> {
    if (this.active.size >= this.maxConcurrent) {
      // Evict least recently active agent
      const lru = [...this.active.values()]
        .sort((a, b) => a.lastActive - b.lastActive)[0];
      await this.terminate(lru.id);
    }

    const instance: AgentInstance = {
      id: crypto.randomUUID(),
      config,
      state: 'initializing',
      startedAt: Date.now(),
      lastActive: Date.now(),
      tokensBurned: 0,
      maxTokenBudget: config.tokenBudget || 50000,
    };

    this.active.set(instance.id, instance);
    instance.state = 'running';
    return instance;
  }

  async terminate(agentId: string): Promise<void> {
    const instance = this.active.get(agentId);
    if (!instance) return;

    instance.state = 'terminated';
    // Save state for potential resume
    await this.saveCheckpoint(instance);
    this.active.delete(agentId);
  }

  // Monitor for stuck or expensive agents
  async healthCheck(): Promise<AgentHealthReport[]> {
    return [...this.active.values()].map(instance => ({
      id: instance.id,
      runtime: Date.now() - instance.startedAt,
      tokensBurned: instance.tokensBurned,
      budgetRemaining: instance.maxTokenBudget - instance.tokensBurned,
      isStuck: Date.now() - instance.lastActive > 60_000, // no activity for 60s
      isOverBudget: instance.tokensBurned > instance.maxTokenBudget,
    }));
  }
}
```

## 4. Deadlock and Livelock in Multi-Agent Systems

Multi-agent systems can deadlock (agents waiting for each other) or livelock (agents endlessly retrying without progress):

```typescript
class DeadlockDetector {
  private waitGraph = new Map<string, Set<string>>(); // agent → waiting-for agents

  registerWait(agentId: string, waitingFor: string): void {
    if (!this.waitGraph.has(agentId)) this.waitGraph.set(agentId, new Set());
    this.waitGraph.get(agentId)!.add(waitingFor);

    if (this.hasCycle(agentId)) {
      throw new DeadlockError(`Deadlock detected involving agent ${agentId}`);
    }
  }

  private hasCycle(start: string, visited = new Set<string>()): boolean {
    if (visited.has(start)) return true;
    visited.add(start);
    for (const dep of this.waitGraph.get(start) || []) {
      if (this.hasCycle(dep, new Set(visited))) return true;
    }
    return false;
  }
}

// Livelock prevention: detect repeated state oscillation
class LivelockDetector {
  private stateHistory = new Map<string, string[]>();

  recordState(agentId: string, state: string): void {
    const history = this.stateHistory.get(agentId) || [];
    history.push(state);
    if (history.length > 20) history.shift();
    this.stateHistory.set(agentId, history);

    if (this.detectOscillation(history)) {
      throw new LivelockError(`Agent ${agentId} is oscillating: ${history.slice(-6).join(' → ')}`);
    }
  }

  private detectOscillation(history: string[]): boolean {
    if (history.length < 6) return false;
    const last6 = history.slice(-6);
    // A-B-A-B-A-B pattern
    return last6[0] === last6[2] && last6[2] === last6[4] &&
           last6[1] === last6[3] && last6[3] === last6[5];
  }
}
```

## Try This Today

Implement a supervisor orchestrator for a multi-step task: the supervisor plans 3 steps, delegates each to a worker agent, reviews the output, and decides whether to continue or retry. Add a token budget and deadlock timeout (kill if no progress in 30s). Test with a real task: "research X, analyze findings, write summary."

## Resources

- [AutoGen: Multi-Agent Conversation Framework](https://microsoft.github.io/autogen/) — Microsoft's framework for multi-agent orchestration patterns
- [CrewAI Documentation](https://docs.crewai.com/) — Production multi-agent framework with role-based orchestration
