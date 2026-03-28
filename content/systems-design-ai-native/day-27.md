---
title: "Versioning and Rollback for AI-Native Systems"
day: 27
week: 4
weekName: "Multi-Agent & Production"
description: "Versioning prompts, models, and pipelines together"
tag: "multi-agent"
---

# Day 27 — Versioning and Rollback for AI-Native Systems

AI systems have three moving parts that can each change independently: the prompt, the model, and the pipeline. Each has different versioning and rollback requirements. Getting this wrong means a bad prompt change breaks users, or a model update silently degrades quality, with no way to go back.

## 1. Versioning Prompts, Models, and Pipelines Together

```typescript
// Bundle related versions together as a "release"
interface AIRelease {
  id: string;
  version: string;           // semver: 2.1.0
  pipelineVersion: string;   // which pipeline code
  promptVersions: Record<string, string>; // prompt name → version
  modelConfig: {
    model: string;           // 'claude-sonnet-4-20250514'
    temperature: number;
    maxTokens: number;
  };
  createdAt: Date;
  createdBy: string;
  changelog: string;
}

class ReleaseManager {
  async createRelease(changes: Partial<AIRelease>): Promise<AIRelease> {
    const release: AIRelease = {
      id: crypto.randomUUID(),
      version: this.bumpVersion(changes.previousVersion),
      pipelineVersion: changes.pipelineVersion || this.currentPipelineVersion(),
      promptVersions: changes.promptVersions || this.currentPromptVersions(),
      modelConfig: changes.modelConfig || this.currentModelConfig(),
      createdAt: new Date(),
      createdBy: changes.createdBy || 'system',
      changelog: changes.changelog || '',
    };

    await this.db.insert(releases).values(release);
    return release;
  }

  // Deploy a specific release to a percentage of traffic
  async deploy(releaseId: string, trafficPercent: number): Promise<void> {
    const release = await this.db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
    if (!release) throw new Error(`Release not found: ${releaseId}`);

    await this.featureFlag.set('ai-release', {
      value: release.version,
      rolloutPercent: trafficPercent,
    });
  }

  async rollback(releaseId: string): Promise<void> {
    const release = await this.db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
    if (!release) throw new Error(`Release not found: ${releaseId}`);

    // Full rollback: 100% traffic to previous release
    await this.featureFlag.set('ai-release', {
      value: release.version,
      rolloutPercent: 100,
    });

    await this.auditLog.log({ action: 'rollback', releaseId });
  }
}
```

## 2. Blue/Green and Canary Deployments for AI

For prompts and models, gradual rollout is critical — you can't fully predict quality impact:

```typescript
class AIDeploymentStrategy {
  // Canary: start at 5%, monitor, gradually increase
  async canaryDeploy(releaseId: string): Promise<void> {
    const release = await this.getRelease(releaseId);

    // Step 1: 5% traffic for 1 hour
    await this.setTraffic(release, 5);
    await this.monitor(3600);

    // Step 2: 25% if metrics look good
    const metrics = await this.getMetrics(releaseId);
    if (metrics.quality.ok && metrics.errorRate < 0.05) {
      await this.setTraffic(release, 25);
      await this.monitor(7200);
    }

    // Step 3: 100% if still good
    if (await this.stillHealthy(releaseId)) {
      await this.setTraffic(release, 100);
    } else {
      await this.rollback(releaseId);
    }
  }

  private async monitor(durationMs: number): Promise<void> {
    const start = Date.now();
    const samples: MetricSample[] = [];

    while (Date.now() - start < durationMs) {
      const sample = await this.collectMetrics();
      samples.push(sample);

      // Alert if metrics degrade during canary
      if (sample.errorRate > 0.10 || sample.quality.score < 0.80) {
        await this.alert('Canary metrics degraded', { sample });
      }

      await sleep(30000); // sample every 30s
    }
  }
}
```

## 3. Feature Flags for Model Rollouts

```typescript
// Feature flag for model selection — instant rollback possible
class ModelFeatureFlag {
  async setModelForUser(userId: string, model: string): Promise<void> {
    await this.flags.set(`model:${userId}`, model);
  }

  async getModelForRequest(request: AIRequest): Promise<string> {
    // User-specific override
    const userFlag = await this.flags.get(`model:${request.userId}`);
    if (userFlag) return userFlag;

    // Feature flag rollout
    const rollout = await this.flags.get('model-rollout');
    if (rollout) {
      // Hash userId for consistent bucketing
      const bucket = this.bucketUser(request.userId, 100);
      if (bucket < rollout.percent) return rollout.model;
    }

    return 'claude-haiku'; // default
  }
}

// Usage: roll out a new model to 10% of users without code deploy
await flags.set('model-rollout', { model: 'claude-sonnet-4-20250514', percent: 10 });
// Monitor for 24h, then increase to 50%, etc.
```

## 4. Rollback Triggers

```typescript
const ROLLBACK_TRIGGERS = {
  latencySpike: {
    metric: 'p99_latency',
    threshold: 1.5,      // 1.5x baseline
    window: '5m',
    action: 'auto_rollback',
  },
  evalRegression: {
    metric: 'eval_pass_rate',
    threshold: 0.90,      // below 90% pass rate
    window: '1h',
    action: 'alert_then_auto_rollback',
  },
  errorRateSpike: {
    metric: 'error_rate',
    threshold: 0.05,      // >5% errors
    window: '2m',
    action: 'auto_rollback',
  },
  costAnomaly: {
    metric: 'cost_per_request',
    threshold: 2.0,       // 2x baseline
    window: '30m',
    action: 'alert',
  },
};

class RollbackMonitor {
  async checkTriggers(): Promise<void> {
    for (const [name, trigger] of Object.entries(ROLLBACK_TRIGGERS)) {
      const current = await this.metrics.get(trigger.metric, trigger.window);
      const baseline = await this.metrics.getBaseline(trigger.metric);

      if (current > baseline * trigger.threshold) {
        if (trigger.action === 'auto_rollback') {
          await this.autoRollback(name, current, baseline);
        } else {
          await this.alert(`${name} trigger hit: ${current} vs baseline ${baseline}`);
        }
      }
    }
  }
}
```

## Try This Today

Implement feature flags for model selection in one AI call. Create a flag that routes 0% of traffic to a new model (baseline), then switch to 10%, verify metrics look good, and increase to 50%. Set up rollback triggers for error rate and eval pass rate. Practice a rollback.

## Resources

- [Flagsmith: Feature Flags for AI Systems](https://flagsmith.com/) — Open-source feature flag platform with percentage rollouts and user targeting
- [Progressive Delivery with LaunchDarkly](https://launchdarkly.com/) — Enterprise feature flags with built-in canary deployment patterns
