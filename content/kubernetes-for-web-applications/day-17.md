---
title: "Deployments, rollouts, and safe rollback"
day: 17
week: 4
weekName: "Reliable Operations"
description: "A Deployment can replace replicas gradually, but safety depends on readiness, capacity, and compatibility across versions. A successful rollout is not\u2026"
tag: "Kubernetes"
---

# Day 17 — Deployments, rollouts, and safe rollback

A Deployment can replace replicas gradually, but safety depends on readiness, capacity, and compatibility across versions. A successful rollout is not merely “new Pods started”; it is a controlled transition that preserves user-visible behavior and remains reversible.

## Rolling updates balance availability and capacity

`maxUnavailable` limits how many desired replicas may be unavailable during an update. `maxSurge` limits temporary replicas above the desired count. For a four-replica API, `maxUnavailable: 0` and `maxSurge: 1` preserve ready capacity but require room for a fifth Pod.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
minReadySeconds: 10
progressDeadlineSeconds: 600
revisionHistoryLimit: 5
```

Percentages round differently for surge and unavailable counts, so small replica sets deserve explicit review. PodDisruptionBudgets do not control Deployment rollouts; they constrain certain voluntary disruptions such as node drains.

## Observe the controller, Pods, and service signals

Use `kubectl rollout status deployment/api` and inspect `kubectl describe deployment/api`. Watch new ReplicaSet Pods become ready and old ones terminate. A progress deadline marks a stalled rollout as failed but does not automatically roll it back.

Platform status is necessary but insufficient. Watch request errors, latency, saturation, and business indicators during release. A syntactically valid container can return incorrect responses. Record the image digest and configuration revision so the observed regression maps to an exact artifact.

## Rollback has limits

`kubectl rollout undo deployment/api` restores an earlier Pod template revision if retained. It does not reverse database migrations, external API changes, deleted data, or mutated shared caches. A reliable rollback plan therefore begins in application design.

Use backward-compatible “expand and contract” database changes. First add nullable columns or new tables that old code tolerates. Deploy code that can work across both schemas and backfill safely. Only after all old code is gone should a later release remove obsolete structures. Run migrations as an explicit, observable Job rather than having every replica race at startup.

## Release behavior should be automated and bounded

Set image by immutable digest in version-controlled configuration, wait for rollout completion, and fail the pipeline on deadline or health regression. Avoid `kubectl apply` from a developer laptop as the primary production path. The same release action should produce an auditable change and predictable status.

For higher-risk changes, progressive delivery controllers can send a fraction of traffic to a canary and evaluate metrics before continuing. They add value only when health signals and abort thresholds are trustworthy. A canary of one Pod behind ordinary random Service routing is not controlled exposure.

### Revisions capture Pod templates, not complete releases

A Deployment creates a new revision when its Pod template changes; scaling replicas alone does not create one. Revision history can recover an earlier image, command, environment reference, or annotation embedded in that template, but it is not a snapshot of mutable ConfigMap or Secret contents. If rollback must restore configuration, use versioned configuration objects and change their names in the Pod template.

Use `kubectl rollout history deployment/api` to correlate revisions with change records, but keep the authoritative release identity in source control and deployment telemetry. You can pause a Deployment while making several template edits and resume it to roll them out together; do not leave production paused without an alert or runbook, because updates will be accepted without progressing. Before relying on undo, verify that the required revision remains within `revisionHistoryLimit` and that its external dependencies are still compatible.

### Termination behavior determines rollout quality

During a rolling update, old Pods receive termination while new Pods join endpoints. If the application continues accepting work after removal starts, or exits before proxies update, users may see resets. Combine readiness-based draining, Node’s SIGTERM handler, a suitable grace period, and proxy connection-drain settings. Test long requests and WebSockets separately.

Capacity also shapes safety. With no surge room and a slow-starting replacement, rollout may reduce effective capacity enough to breach latency targets. Conversely, surge Pods can exhaust database connections. A release plan should account for temporary replica count, downstream pools, and node capacity, not only the steady state. Verify these assumptions under representative load.

## Try this today

Run three replicas under continuous requests. Deploy a version whose readiness succeeds after 20 seconds and watch surge behavior. Then deploy a version that never becomes ready, observe the progress deadline, and perform a rollback. Finally, write an expand-and-contract sequence for one real schema change and identify the last point where application rollback remains safe.

## Resources

- [Kubernetes: Updating a Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#updating-a-deployment)
- [Kubernetes: Roll back a Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment)
