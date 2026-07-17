---
title: "Autoscaling and resilience"
day: 18
week: 4
weekName: "Reliable Operations"
description: "Autoscaling is a feedback loop that adds replicas when observed demand exceeds a target. It works only when the service is horizontally replicable,\u2026"
tag: "Kubernetes"
---

# Day 18 — Autoscaling and resilience

Autoscaling is a feedback loop that adds replicas when observed demand exceeds a target. It works only when the service is horizontally replicable, resource requests and metrics are credible, and scale-up arrives before the workload has already failed.

## HPA turns metrics into desired replicas

The Horizontal Pod Autoscaler periodically compares a metric with a target and adjusts a scalable resource such as a Deployment. For CPU utilization, the target is a percentage of requested CPU—not a percentage of the CPU limit or node. Missing or unrealistic requests therefore make the signal unusable.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
```

Resource metrics normally come from Metrics Server. Custom request-rate or queue-depth metrics require an adapter or external metrics integration.

## Scaling requires stateless instances

Any replica should be able to handle any request. Store sessions in signed cookies or a shared, appropriately secured store rather than process memory. Put uploaded assets in object storage. Coordinate scheduled work so adding replicas does not duplicate jobs. Use idempotency keys when clients or workers may retry side effects.

Connection pools multiply with replicas, so cap per-Pod pool size and compare the maximum replica count with downstream capacity. Autoscaling an API from 3 to 20 Pods can overwhelm a database even while protecting API CPU. Concurrency limits and backpressure should reject excess work predictably instead of allowing unbounded queues.

## Graceful shutdown is part of elasticity

Scale-down terminates Pods just like a rollout. On SIGTERM, stop readiness, cease accepting work, finish or safely abandon in-flight operations, and close clients before the grace deadline. Workers should make jobs visible again or extend leases according to queue semantics.

HPA behavior rules can stabilize scale-down and limit how rapidly replicas change. This avoids oscillation when traffic is bursty. Keep a nonzero minimum replica count when cold startup or node provisioning is slower than acceptable request latency.

## Autoscaling is not performance engineering

HPA reacts after metrics change. It cannot repair a slow query, memory leak, serialized critical section, or downstream quota. Establish a safe per-Pod operating point with load tests, optimize bottlenecks, and then use scaling to stay within that region.

Cluster capacity must also follow. HPA can create Pending Pods if nodes are full; a cluster autoscaler may add nodes, but VM provisioning and image pulling add delay. Monitor desired versus available replicas, scheduling latency, throttling, and downstream saturation—not only HPA’s current replica number.

### Match the metric to the work

CPU is useful for CPU-bound, proportionally scaling request handlers. Request concurrency or arrival rate may represent I/O-heavy APIs better, provided each replica has similar capacity. Queue depth or age is often the right worker signal because it captures outstanding work. The metric pipeline must be timely and available during stress; a delayed signal creates delayed capacity.

Define a stabilization and failure strategy. If custom metrics disappear, understand how the HPA behaves and alert on the loss. Keep a minimum capacity that meets baseline availability. Scheduled pre-scaling can complement reactive scaling for known events, but it should remain a measured operational decision rather than masking slow startup or poor performance.

## Try this today

Install Metrics Server if your local cluster needs it, set realistic requests, and apply the HPA. Generate sustained CPU-producing HTTP load and watch `kubectl get hpa -w` alongside Pods. Stop load and observe stabilized scale-down. Repeat with an artificially slow downstream and explain why adding replicas helps, hurts, or has no effect.

## Resources

- [Kubernetes: Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Kubernetes autoscaling API reference](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/horizontal-pod-autoscaler-v2/)
