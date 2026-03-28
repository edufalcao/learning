---
title: "Week 3 Synthesis: Your Reliability Playbook"
day: 21
week: 3
weekName: "Reliability"
description: "SLO definition for AI-native apps"
tag: "reliability"
---

# Day 21 — Week 3 Synthesis: Your Reliability Playbook

You've spent a week on the hardest part of AI systems: making them work when things go wrong. Today we synthesize failure handling, retries, observability, evals, cost control, and rate limiting into a practical reliability playbook you can apply to any AI-native system.

## 1. SLO Definition for AI-Native Apps

Service Level Objectives for AI systems need AI-specific metrics alongside traditional ones:

```typescript
interface AISLOs {
  // Traditional SLOs
  availability: {
    target: number;     // 99.5% — AI systems can't hit 99.99%
    measurement: 'successful_responses / total_requests';
  };
  latency: {
    p50Target: number;  // 2000ms
    p99Target: number;  // 10000ms — AI tail latency is long
    measurement: 'end_to_end_ms';
  };

  // AI-specific SLOs
  quality: {
    evalPassRate: number;     // 92% — target eval pass rate
    hallucinationRate: number; // <3% — max acceptable hallucination
    measurement: 'continuous_eval_sampling';
  };
  cost: {
    maxPerRequest: number;    // $0.05
    maxDaily: number;         // $50
    measurement: 'cost_tracking_middleware';
  };
  degradation: {
    fallbackRate: number;     // <10% — how often fallbacks fire
    cacheHitRate: number;     // >30% — minimum cache effectiveness
  };
}

const productionSLOs: AISLOs = {
  availability: { target: 0.995, measurement: 'successful_responses / total_requests' },
  latency: { p50Target: 2000, p99Target: 10000, measurement: 'end_to_end_ms' },
  quality: { evalPassRate: 0.92, hallucinationRate: 0.03, measurement: 'continuous_eval_sampling' },
  cost: { maxPerRequest: 0.05, maxDaily: 50, measurement: 'cost_tracking_middleware' },
  degradation: { fallbackRate: 0.10, cacheHitRate: 0.30 },
};
```

## 2. On-Call Runbook for AI System Incidents

```typescript
const aiIncidentRunbook = {
  'high_error_rate': {
    symptoms: ['Error rate >5%', 'Circuit breakers opening'],
    steps: [
      '1. Check provider status pages (status.anthropic.com, status.openai.com)',
      '2. Check rate limit headers in recent responses',
      '3. Verify circuit breaker states — which providers are open?',
      '4. If provider outage: confirm fallback chain is active',
      '5. If our bug: check recent deployments, rollback if needed',
    ],
    escalation: 'If all providers down >15min, switch to cached/rule-based responses',
  },

  'quality_regression': {
    symptoms: ['Eval pass rate dropped', 'User complaints increased', 'Validation failure rate up'],
    steps: [
      '1. Check: was there a prompt change? (git log --diff-filter=M -- "*.prompt.ts")',
      '2. Check: did the provider update the model? (check changelogs)',
      '3. Run regression eval suite against last known good version',
      '4. Compare: current vs baseline outputs on failing cases',
      '5. If prompt change: revert and re-run evals',
      '6. If model change: pin to previous model version',
    ],
    escalation: 'Pin model version + alert on eval drift > 5%',
  },

  'cost_spike': {
    symptoms: ['Daily cost >120% of normal', 'Per-request cost anomaly'],
    steps: [
      '1. Check cost attribution: which feature/user/pipeline spiked?',
      '2. Check for retry loops (retryCount > 3 on failed calls)',
      '3. Check for context size growth (input tokens trending up?)',
      '4. Check for missing cache hits (cache hit rate dropped?)',
      '5. If retry loop: fix root cause, add max retry budget',
      '6. If traffic spike: activate budget caps',
    ],
    escalation: 'Enable hard budget cap + degrade to cheaper model',
  },

  'latency_spike': {
    symptoms: ['P99 latency >2x baseline', 'Streaming TTFT increased'],
    steps: [
      '1. Check provider latency (are they slow or are we slow?)',
      '2. Check context size — did prompt/context grow?',
      '3. Check queue depth — backlog building up?',
      '4. Check: new pipeline steps added recently?',
      '5. If provider slow: switch to faster model or fallback provider',
      '6. If our issue: profile pipeline, find bottleneck step',
    ],
    escalation: 'Route to faster model + reduce context window temporarily',
  },
};
```

## 3. The Complete Reliability Stack

```typescript
// Wire everything together
class ReliableAISystem {
  constructor(
    private llm: FallbackChain,           // Day 16: multi-provider fallbacks
    private circuitBreakers: Map<string, CircuitBreaker>, // Day 16
    private rateLimiter: DualRateLimiter,  // Day 20: RPM + TPM limits
    private costTracker: CostTracker,      // Day 19: cost monitoring
    private budgetEnforcer: BudgetEnforcer,// Day 19: hard caps
    private cache: SemanticLLMCache,       // Day 13: caching
    private logger: AILogger,              // Day 17: structured logging
    private evalMonitor: ContinuousEval,   // Day 18: quality monitoring
  ) {}

  async complete(request: LLMRequest, context: RequestContext): Promise<LLMResponse> {
    const traceId = generateTraceId();

    // 1. Budget check
    const budgetCheck = await this.budgetEnforcer.checkBefore(request);
    if (!budgetCheck.allow) {
      if (budgetCheck.degradeTo) {
        return this.degrade(request, budgetCheck.degradeTo);
      }
      throw new BudgetExceededError(budgetCheck.reason);
    }

    // 2. Cache check
    const cached = await this.cache.get(request);
    if (cached) {
      this.logger.log({ traceId, cacheHit: true });
      return cached;
    }

    // 3. Rate limit
    await this.rateLimiter.acquire(countTokens(request));

    // 4. Call with fallbacks + circuit breakers
    const response = await this.llm.complete(request);

    // 5. Log everything
    this.logger.log({ traceId, ...response.usage, cost: response.cost });
    this.costTracker.record({ ...response.cost, feature: context.feature });

    // 6. Cache the response
    await this.cache.set(request, response);

    // 7. Sample for continuous eval (1% of requests)
    if (Math.random() < 0.01) {
      this.evalMonitor.sample(request, response);
    }

    return response;
  }
}
```

## 4. Monitoring Checklist

```markdown
## Daily Monitoring
- [ ] Error rate < 5% across all providers
- [ ] P99 latency within SLO
- [ ] Daily cost within budget
- [ ] Cache hit rate > 30%
- [ ] Fallback rate < 10%
- [ ] No circuit breakers stuck open

## Weekly Monitoring
- [ ] Eval pass rate stable (no regression >2%)
- [ ] Cost trend (growing, stable, or optimized?)
- [ ] Rate limit headroom (>20% of quota unused)
- [ ] Top 5 most expensive features reviewed

## Monthly Review
- [ ] SLO compliance report
- [ ] Cost optimization opportunities
- [ ] Eval suite coverage audit
- [ ] Prompt version inventory
- [ ] Provider performance comparison
```

## Try This Today

Add structured logging and a fallback chain to one existing AI call in your codebase. Specifically: (1) wrap the LLM call with the logging middleware from Day 17, (2) add a fallback to a cheaper model if the primary fails, (3) add a circuit breaker with 5-failure threshold. Deploy it and monitor the logs for 24 hours. You now have a reliability baseline.

## Resources

- [Google SRE Book — Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) — The definitive guide to SLO definition and management
- [Anthropic Production Best Practices](https://docs.anthropic.com/en/docs/build-with-claude/develop-tests) — Official reliability patterns for Claude in production
