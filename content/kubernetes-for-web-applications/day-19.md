---
title: "Debugging production workloads"
day: 19
week: 4
weekName: "Reliable Operations"
description: "Production debugging should narrow the failing layer without introducing new state. Kubernetes provides enough evidence to distinguish scheduling,\u2026"
tag: "Kubernetes"
---

# Day 19 — Debugging production workloads

Production debugging should narrow the failing layer without introducing new state. Kubernetes provides enough evidence to distinguish scheduling, image, process, health, networking, and application failures if you follow a consistent sequence.

## Start with scope and recent change

Confirm the user-visible symptom, affected routes, environment, start time, and blast radius. Check recent deployments, configuration updates, dependency incidents, certificate changes, and node events. Preserve exact timestamps and image digests; “the current version” changes during an incident.

Then inspect controller and Pods:

```bash
kubectl get deployment,pods -n shop -l app=api -o wide
kubectl rollout status deployment/api -n shop
kubectl describe pod <pod> -n shop
kubectl get events -n shop --sort-by=.metadata.creationTimestamp
```

Events help explain recent decisions but expire and may be aggregated. Use centralized logs and metrics for durable timelines.

## Recognize common status patterns

`Pending` often means insufficient requested resources, an unsatisfied node constraint, an unbound PVC, or an untolerated taint. Read scheduling events. `ImagePullBackOff` points toward a wrong image reference, missing registry credentials, authorization, rate limits, or node-to-registry connectivity.

`CrashLoopBackOff` means the container repeatedly exits and restart attempts are delayed. Inspect current and previous logs with `kubectl logs <pod> -c api --previous`, container exit code, reason, command, and configuration. Exit code 137 commonly accompanies SIGKILL, including memory enforcement, but validate `lastState.terminated.reason` and metrics rather than assuming.

## Follow request flow layer by layer

For connectivity incidents, verify Pod readiness and application binding, then EndpointSlices, Service ports and selectors, in-cluster DNS, NetworkPolicies, ingress routes, and external DNS/load balancer state. Test from an origin similar to the failed caller. A successful laptop request through public ingress does not prove an internal worker can reach the Service.

Use a temporary diagnostic Pod with only approved tools. Minimal production images may intentionally lack a shell or curl. `kubectl exec` is useful when the process is running, but avoid editing files or installing packages. Ephemeral containers can attach a debugging image to an existing Pod’s namespaces where the cluster supports them; they still require appropriate authorization and may not expose every filesystem view.

## Make application evidence correlatable

Search logs by request or trace ID, compare failing and healthy replicas, and align application timestamps with deployment events. Obtain thread, heap, or CPU profiles only when safe and with bounded duration; diagnostics can increase load and contain sensitive data.

Keep a hypothesis log: observation, possible explanation, next discriminating test, and result. Change one variable at a time. Once service is restored, save the minimal evidence needed for follow-up and remove temporary access or debug resources.

### Distinguish mitigation from repair

Scaling replicas, rolling back, disabling a feature, or raising a limit may restore service without proving root cause. Label the action as mitigation, record its exact time, and watch whether symptoms change. This prevents the incident narrative from turning correlation into certainty.

After stabilization, reproduce under controlled conditions where possible and fix desired state, code, or platform configuration through the normal path. Add a regression test or observable guardrail that would catch recurrence. A useful follow-up explains why existing controls failed, not only which engineer ran which command. Review whether access, documentation, or telemetry slowed diagnosis and address the smallest systemic gap.

## Try this today

Create three failures in a disposable namespace: an invalid image tag, a missing required environment variable, and a request that exceeds a small memory limit. Diagnose each without modifying the running container. Then break a Service selector and use a written flow from ingress to endpoint to find it. Record the exact command that first proved each root cause.

## Resources

- [Kubernetes: Debug running Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/)
- [Kubernetes: Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
