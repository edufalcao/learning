---
title: "Capstone: deploy a production-shaped web application"
day: 29
week: 5
weekName: "Platform Blueprint"
description: "The capstone is not about producing the largest manifest set. It is about connecting build, runtime, traffic, security, observability, and recovery\u2026"
tag: "Kubernetes"
---

# Day 29 — Capstone: deploy a production-shaped web application

The capstone is not about producing the largest manifest set. It is about connecting build, runtime, traffic, security, observability, and recovery decisions into one deployable system. A production-shaped design should be understandable by another engineer and survive routine failures without manual repair.

## 1. Define a topology with explicit boundaries

Use four workloads: a Nuxt frontend, a Node API, a queue-consuming worker, and an external managed database. The frontend and API receive HTTP traffic; the worker has no Service because it consumes jobs. Keep the database outside the cluster unless you deliberately accept its operational burden.

Choose a simple request path:

```text
Internet -> Gateway/Ingress -> frontend Service -> Nuxt Pods
                         \--> api Service      -> API Pods -> managed PostgreSQL
                                                        \-> managed queue -> worker Pods
```

Give each workload its own Deployment and ServiceAccount. Use ClusterIP Services for internal routing, and expose only the required frontend and API routes. Put static assets behind a CDN if that matches the application. Store configuration in per-workload ConfigMaps and source credentials from an external secret manager.

Pin every image by digest. Add labels such as `app.kubernetes.io/name`, `component`, and `version` consistently so dashboards, policies, and operational queries agree.

## 2. Encode deployability in the workloads

A useful API Deployment includes replicas, probes, resources, rollout policy, a security context, and graceful termination:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  strategy:
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }
  selector:
    matchLabels: { app: api }
  template:
    metadata:
      labels: { app: api }
    spec:
      serviceAccountName: api
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: ghcr.io/acme/api@sha256:0123456789abcdef
          ports: [{ name: http, containerPort: 3000 }]
          readinessProbe:
            httpGet: { path: /ready, port: http }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /live, port: http }
            periodSeconds: 15
          resources:
            requests: { cpu: 200m, memory: 256Mi }
            limits: { memory: 512Mi }
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            capabilities: { drop: ["ALL"] }
```

Mount a writable `emptyDir` only for required temporary paths. Make `/live` check process health and `/ready` indicate traffic readiness; avoid turning a transient database issue into a liveness restart storm. Give the worker a shutdown handler that stops polling, finishes or safely returns its current job, and exits within the grace period.

Add a PodDisruptionBudget and topology spread where availability warrants them. Configure an HPA only after metrics exist and requests reflect observed usage.

## 3. Make observability part of the release

Emit structured JSON logs to stdout with timestamp, severity, service, version, trace ID, and request ID. Instrument inbound HTTP, database calls, and queue processing with OpenTelemetry. A minimal dashboard should show:

- request rate, error rate, and latency percentiles by route;
- Pod restarts, readiness, CPU, memory, and throttling;
- database pool saturation and query latency;
- queue depth, oldest-message age, and worker failures;
- current deployed image digest and rollout status.

Define at least one user-oriented objective, such as “99.9% of API requests succeed over 30 days, excluding valid 4xx responses.” Alert on sustained symptoms that threaten that objective, not every noisy infrastructure fluctuation.

## 4. Build release and rollback as executable procedures

A delivery pipeline should test code, build once, scan the image, publish it, update the deployment repository with the digest, and let GitOps reconcile. Before promotion, validate manifests and run integration tests. Database changes must be backward compatible with both old and new application versions.

Your runbook should include commands and decision points:

```bash
kubectl -n production rollout status deployment/api --timeout=5m
kubectl -n production get pods -l app=api
kubectl -n production logs deployment/api --since=10m
kubectl -n production rollout history deployment/api
kubectl -n production rollout undo deployment/api
```

With GitOps, rollback normally means reverting the digest commit rather than leaving Git and the cluster divergent. State what happens if the release includes a migration that cannot be reversed. Prefer forward fixes and expand/contract migrations; never imply `rollout undo` restores data.

Include stop conditions: elevated error rate, failed readiness, latency regression, worker backlog growth, or migration failure. Name who decides to continue, pause, or roll back, and verify service health after the action.

## Try this today

Create a repository directory with `base/` manifests for frontend, API, and worker plus a `production/` Kustomize overlay. Add Services, Gateway or Ingress, ConfigMaps, probes, resources, security contexts, and a default-deny NetworkPolicy with explicit dependency access. Render it using `kubectl kustomize production/`, apply it to a local cluster with substitute local dependencies, and run a rollout. Intentionally deploy a broken readiness endpoint, observe the stalled rollout, execute your rollback runbook, and capture the evidence you used to decide.

## Resources

- [Kubernetes: Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [OpenTelemetry JavaScript documentation](https://opentelemetry.io/docs/languages/js/)
