---
title: "Human-in-the-Loop Design Patterns"
day: 24
week: 4
weekName: "Multi-Agent & Production"
description: "When to interrupt for human input"
tag: "multi-agent"
---

# Day 24 — Human-in-the-Loop Design Patterns

Fully autonomous AI sounds great until it sends an email to your CEO with hallucinated numbers. Human-in-the-loop (HITL) isn't a limitation — it's a design pattern that makes AI systems trustworthy enough for production. The challenge is knowing *where* to interrupt and how to make the interruption seamless rather than annoying.

## 1. When to Interrupt for Human Input

Not every action needs approval. The key is a risk-based classification:

```typescript
enum ActionRisk {
  LOW = 'low',       // Read-only, internal, reversible
  MEDIUM = 'medium', // External but reversible, or internal writes
  HIGH = 'high',     // Irreversible, external-facing, financial
  CRITICAL = 'critical', // Security-sensitive, legal, public-facing
}

class ActionClassifier {
  classify(action: AgentAction): ActionRisk {
    // Irreversible external actions = always high+
    if (action.isExternal && !action.isReversible) return ActionRisk.CRITICAL;
    if (action.isExternal) return ActionRisk.HIGH;
    if (action.mutatesState && !action.isReversible) return ActionRisk.MEDIUM;
    return ActionRisk.LOW;
  }

  requiresApproval(action: AgentAction, policy: ApprovalPolicy): boolean {
    const risk = this.classify(action);
    return policy.approvalThreshold.includes(risk);
  }
}

// Policy configuration — adjustable per user/environment
const defaultPolicy: ApprovalPolicy = {
  approvalThreshold: [ActionRisk.HIGH, ActionRisk.CRITICAL],
  autoApproveAfterN: 5, // auto-approve after 5 similar approved actions
  timeoutMs: 300_000,   // 5 min timeout, then fallback
  fallbackAction: 'skip', // skip | queue | use-cached
};
```

**The spectrum:** Don't think binary (approve/deny). Think in tiers: auto-approve, notify-and-proceed, wait-for-approval, block-until-reviewed.

## 2. Approval Gates and Escalation Paths

An approval gate pauses the agent pipeline and waits for human decision. The implementation must handle timeouts, delegation, and audit logging.

```typescript
class ApprovalGate {
  private pending = new Map<string, PendingApproval>();

  async requestApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
    const id = crypto.randomUUID();

    const pending: PendingApproval = {
      id,
      request,
      requestedAt: Date.now(),
      status: 'pending',
      notifiedChannels: [],
    };
    this.pending.set(id, pending);

    // Notify through configured channels (Telegram, Slack, email)
    await this.notify(pending);

    // Wait for response with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pending.status = 'timed_out';
        resolve({
          approved: false,
          reason: 'timeout',
          action: request.fallbackAction || 'skip',
        });
      }, request.timeoutMs);

      // Human responds via callback
      pending.resolve = (decision: ApprovalDecision) => {
        clearTimeout(timeout);
        pending.status = decision.approved ? 'approved' : 'rejected';
        pending.decidedAt = Date.now();
        pending.decidedBy = decision.userId;

        // Log for audit trail
        this.auditLog.write({
          type: 'approval_decision',
          requestId: id,
          action: request.actionDescription,
          decision: decision.approved ? 'approved' : 'rejected',
          reason: decision.reason,
          userId: decision.userId,
          latencyMs: Date.now() - pending.requestedAt,
        });

        resolve(decision);
      };
    });
  }

  // Escalation: if primary approver doesn't respond, escalate
  private async escalate(pending: PendingApproval): Promise<void> {
    const escalationChain = ['primary_user', 'team_lead', 'admin'];
    const currentLevel = pending.escalationLevel || 0;

    if (currentLevel < escalationChain.length - 1) {
      pending.escalationLevel = currentLevel + 1;
      await this.notify(pending, escalationChain[currentLevel + 1]);
    }
  }
}
```

## 3. Async Human Feedback Loops

Not all human input is synchronous approval. Sometimes you need humans to provide feedback that improves future behavior — ratings, corrections, preferences.

```typescript
class FeedbackCollector {
  async collectInline(response: AgentResponse): Promise<void> {
    // Present response with feedback controls
    await this.channel.send({
      text: response.content,
      buttons: [
        [
          { text: '👍 Good', callback_data: `feedback:${response.id}:good` },
          { text: '👎 Bad', callback_data: `feedback:${response.id}:bad` },
          { text: '✏️ Edit', callback_data: `feedback:${response.id}:edit` },
        ],
      ],
    });
  }

  async processFeedback(feedbackId: string, type: string, detail?: string): Promise<void> {
    const feedback: FeedbackRecord = {
      responseId: feedbackId,
      type, // 'good' | 'bad' | 'edit'
      detail, // optional correction text
      timestamp: Date.now(),
    };

    // Store for eval datasets and fine-tuning
    await this.feedbackStore.insert(feedback);

    // If negative feedback, update agent instructions dynamically
    if (type === 'bad' && detail) {
      await this.updateAgentGuidance(feedbackId, detail);
    }
  }

  private async updateAgentGuidance(responseId: string, correction: string): Promise<void> {
    // Add to agent's "learned corrections" context
    const existing = await this.guidanceStore.get('corrections');
    const corrections = existing || [];
    corrections.push({
      original: await this.getOriginalResponse(responseId),
      correction,
      learnedAt: Date.now(),
    });

    // Keep only recent corrections (sliding window)
    if (corrections.length > 50) corrections.shift();
    await this.guidanceStore.set('corrections', corrections);
  }
}
```

## 4. Audit Trails and Explainability

Every AI decision in a HITL system must be explainable. When something goes wrong, you need to reconstruct *why* the agent did what it did and *who* approved it.

```typescript
interface AuditEntry {
  id: string;
  timestamp: number;
  traceId: string;
  agentId: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string; // agent's chain-of-thought or plan
  riskLevel: ActionRisk;
  approvalRequired: boolean;
  approvedBy?: string;
  approvalLatencyMs?: number;
  modelId: string;
  promptVersion: string;
  tokensUsed: number;
}

class AuditTrail {
  private entries: AuditEntry[] = [];

  async log(entry: AuditEntry): Promise<void> {
    // Immutable append-only log
    await this.store.append(entry);

    // Real-time alerting on anomalies
    if (entry.riskLevel === ActionRisk.CRITICAL && !entry.approvalRequired) {
      await this.alertOps('Critical action executed without approval gate', entry);
    }
  }

  // Reconstruct decision chain for incident review
  async getDecisionChain(traceId: string): Promise<AuditEntry[]> {
    return this.store.query({ traceId }, { orderBy: 'timestamp', direction: 'asc' });
  }

  // Compliance: who approved what, when
  async getApprovalReport(dateRange: DateRange): Promise<ApprovalReport> {
    const entries = await this.store.query({
      timestamp: { gte: dateRange.start, lte: dateRange.end },
      approvalRequired: true,
    });

    return {
      total: entries.length,
      approved: entries.filter(e => e.approvedBy).length,
      rejected: entries.filter(e => !e.approvedBy && e.approvalLatencyMs).length,
      timedOut: entries.filter(e => !e.approvedBy && !e.approvalLatencyMs).length,
      avgLatencyMs: avg(entries.map(e => e.approvalLatencyMs).filter(Boolean)),
    };
  }
}
```

The audit trail isn't optional overhead — it's what makes AI systems viable in regulated environments and what lets you debug failures after the fact.

## Try This Today

Add an approval gate to an existing AI workflow. Classify 3-5 common actions by risk level (read file = low, send message = high, delete data = critical). Implement the gate so that HIGH+ actions pause and send a notification (console.log is fine). Track: how long approval takes, what gets approved vs rejected, and what times out. Run the pipeline with a 30-second timeout and a "skip" fallback.

## Resources

- [Anthropic: Building Effective Agents](https://docs.anthropic.com/en/docs/build-with-claude/agent-patterns) — Patterns for human oversight in agentic systems
- [LangGraph Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) — Practical HITL implementation patterns with breakpoints and approval flows
