---
title: "Health checks that support real rollouts"
day: 16
week: 4
weekName: "Reliable Operations"
description: "Probes are control inputs, not decorative endpoints. A good health design delays traffic until an instance can serve it, stops traffic during\u2026"
tag: "Kubernetes"
---

# Day 16 — Health checks that support real rollouts

Probes are control inputs, not decorative endpoints. A good health design delays traffic until an instance can serve it, stops traffic during degradation or shutdown, and restarts only processes that cannot recover without intervention.

## Startup, readiness, and liveness answer different questions

A startup probe asks whether slow initialization has completed. Until it succeeds, Kubernetes does not run liveness or readiness checks, preventing premature restarts. A readiness probe asks whether the Pod should receive Service traffic now. A liveness probe asks whether restarting the container is likely to restore progress.

Do not make all three call one comprehensive endpoint. A temporary database outage should often make an API unready while allowing it to remain alive and reconnect. If liveness depends on the database, every replica may restart simultaneously during a shared dependency incident, adding load and obscuring evidence.

## Readiness is traffic control

Readiness should reflect the ability to serve the class of requests routed to that Pod. It may check that startup is complete, required clients are initialized, and the instance is not draining. Keep it fast, bounded, and inexpensive. Deep queries against every dependency can amplify outages because probes run frequently across every replica.

During SIGTERM, set readiness false before closing listeners, allowing endpoint propagation to reduce new traffic. Continue in-flight work within `terminationGracePeriodSeconds`. The exact sequence depends on the ingress data plane, so test it under real rollout traffic rather than assuming zero failed requests.

## Design explicit Node endpoints

```js
import express from 'express';

const app = express();
let ready = false;
app.get('/health/live', (_req, res) => res.sendStatus(204));
app.get('/health/ready', (_req, res) =>
  ready ? res.sendStatus(204) : res.status(503).json({ status: 'not-ready' })
);

const server = app.listen(3000, '0.0.0.0', async () => {
  await initializeRequiredClients();
  ready = true;
});

process.on('SIGTERM', () => {
  ready = false;
  server.close(() => process.exit(0));
});
```

Do not return stack traces, dependency URLs, or secret-bearing errors from unauthenticated health routes. Detailed diagnostics belong in telemetry.

## Tune probes from measured timing

Configure `timeoutSeconds`, `periodSeconds`, and `failureThreshold` according to startup and recovery measurements. Liveness should allow enough time to avoid restart loops during short event-loop stalls. Readiness can react faster, but overly aggressive settings cause endpoint flapping.

Prefer HTTP probes for HTTP applications, TCP only when connection acceptance is meaningful, and exec probes when no protocol endpoint exists. Exec probes create processes and can add overhead. Probe the application port directly rather than routing through public ingress; edge health is a separate concern.

### Probe failures need observability

Kubelet events show that a probe failed, but the application should expose enough internal telemetry to explain why. Count readiness state transitions, record a bounded reason code internally, and graph ready replicas beside errors and dependency health. Do not log every successful probe; frequent access logs add noise and cost.

Protect health endpoints from ordinary middleware surprises. They should not require user authentication, remote feature-flag calls, or rate-limit capacity intended for users. At the same time, keep them narrow and avoid publishing detailed diagnostics through public ingress. A separate authenticated diagnostic endpoint may help operators, but it should not become a probe dependency.

## Try this today

Add separate live and ready endpoints to your Node service and configure all three probe types with a deliberately slow startup. Watch Pod conditions and EndpointSlices. Simulate a recoverable downstream outage and confirm the container is not restarted. Then deploy under continuous traffic, send SIGTERM to a Pod, and count any failed requests while tuning shutdown and readiness timing.

## Resources

- [Kubernetes: Configure liveness, readiness, and startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Kubernetes: Pod lifecycle and termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
