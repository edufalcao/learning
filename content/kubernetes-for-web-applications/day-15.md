---
title: "Resource requests, limits, and predictable capacity"
day: 15
week: 3
weekName: "Shipping Web Applications"
description: "Resource settings translate application behavior into scheduling and isolation decisions. Good initial values are measured hypotheses: enough room for\u2026"
tag: "Kubernetes"
---

# Day 15 — Resource requests, limits, and predictable capacity

Resource settings translate application behavior into scheduling and isolation decisions. Good initial values are measured hypotheses: enough room for normal Node traffic, explicit protection against runaway use, and metrics that support adjustment after deployment.

## Requests place Pods and reserve capacity

CPU and memory requests tell the scheduler how much node capacity a Pod needs. A Pod is placed only where all requests fit, even if current usage is low. Requests also influence CPU sharing during contention and form the utilization denominator for common Horizontal Pod Autoscaler configurations.

Understated requests overpack nodes and increase contention or eviction risk. Overstated requests waste allocatable capacity and can leave Pods Pending. Measure representative steady-state and peak behavior, then leave margin for traffic variance, runtime overhead, and sidecars.

## Limits enforce different behavior

CPU is measured in cores; `500m` means half a core. When a container exceeds its CPU limit, the kernel throttles it rather than killing it. Throttling can increase event-loop lag and request latency even while average CPU dashboards look acceptable.

Memory is measured in bytes with suffixes such as `Mi` and `Gi`. Exceeding a memory cgroup limit can terminate the process with an OOM kill. Node’s JavaScript heap is only part of resident memory: native buffers, code, thread stacks, and libraries also consume space. Leave headroom between any V8 heap cap and the container memory limit.

```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: "1"
    memory: 512Mi
```

These are plausible starting numbers, not universal recommendations.

## QoS and node pressure affect eviction

Kubernetes assigns a Pod a QoS class based on requests and limits. `Guaranteed` requires matching CPU and memory request/limit for every container; `Burstable` covers most partially specified workloads; `BestEffort` has none. Under node resource pressure, QoS and usage relative to requests influence eviction priority, alongside other factors.

An evicted Pod or OOM-killed container is not the same as an application exception. Inspect Pod status, container `lastState`, node conditions, and events. Repeatedly increasing limits without finding a leak or unbounded queue merely delays the incident.

## Capacity planning begins with workload behavior

Load-test the production image with realistic response sizes, downstream latency, and concurrency. Track request rate, p95/p99 latency, error rate, CPU, resident memory, heap, garbage collection, and event-loop lag. Determine a safe per-Pod throughput before saturation, then choose replicas and requests that provide failure and rollout headroom.

Remember scheduling arithmetic. During a rolling update, `maxSurge` may create extra Pods; during node maintenance, replicas must fit elsewhere. A cluster that runs at near-total requested capacity cannot self-heal smoothly. Resource policy should be paired with namespace quotas and default ranges so omissions fail early or receive intentional defaults.

### Measure Node-specific saturation

CPU alone misses important Node bottlenecks. Track event-loop delay, active handles, garbage-collection pauses, heap utilization, external memory, connection-pool wait time, and queue depth. A service can have spare CPU while every request waits on a pool, or high CPU because JSON serialization blocks the event loop. Scaling based on the wrong signal may multiply load on the constrained dependency.

Separate memory leak from legitimate cache growth. Observe resident memory after repeated garbage collection and across a sustained traffic plateau. If memory rises without stabilizing, capture bounded heap evidence in a safe environment. Resource limits contain blast radius, while profiling and application fixes address the cause.

## Try this today

Deploy a Node endpoint with the example resources and generate controlled load using a tool such as autocannon. Watch `kubectl top pods`, latency, restart count, and events. Exercise one CPU-heavy and one memory-heavy route in a disposable environment, observe throttling or OOM behavior, then document safer request, limit, concurrency, and replica values based on evidence.

## Resources

- [Kubernetes: Resource management for Pods and containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Kubernetes: Pod quality of service classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/)
