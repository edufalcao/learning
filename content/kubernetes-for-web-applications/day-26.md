---
title: "Multi-environment platform design"
day: 26
week: 5
weekName: "Platform Blueprint"
description: "A senior engineer should treat environment topology as an explicit risk and ownership decision, not as a folder-naming convention. The right design\u2026"
tag: "Kubernetes"
---

# Day 26 — Multi-environment platform design

A senior engineer should treat environment topology as an explicit risk and ownership decision, not as a folder-naming convention. The right design makes production hard to damage, keeps staging useful, and gives developers fast feedback without multiplying platform work.

## 1. Namespaces are boundaries, but not complete isolation

A namespace scopes names and many policies. It lets `web` exist in both `staging` and `production`, and gives you a natural target for RBAC, quotas, default resource limits, and NetworkPolicies. It is not a security sandbox by itself: nodes, cluster-scoped resources, the control plane, and often ingress controllers are shared.

Start each namespace with guardrails rather than adding them after an incident:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    pod-security.kubernetes.io/enforce: restricted
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: workload-budget
  namespace: staging
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "30"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: container-defaults
  namespace: staging
spec:
  limits:
    - type: Container
      defaultRequest: { cpu: 100m, memory: 128Mi }
      default: { cpu: 500m, memory: 512Mi }
```

Also scope service accounts and deployment permissions per namespace. A CI identity that can update staging should not automatically update production.

## 2. Decide where a cluster boundary is worth the cost

A separate cluster gives a stronger failure, access, and change boundary. A broken cluster-wide admission policy, CNI upgrade, or privileged workload in development cannot take down production if production has its own cluster. The cost is duplicated infrastructure, upgrades, observability, ingress, and operational attention.

A pragmatic small-product strategy is often:

- one non-production cluster with namespaces for development and staging;
- one production cluster with stricter access and change controls;
- ephemeral preview environments as namespaces, with quotas and automatic expiry;
- separate cloud accounts or projects for production when billing and identity isolation matter.

Do not create one cluster per developer unless a concrete isolation or testing requirement justifies it. Local `kind` or `minikube` clusters usually serve experimentation better. Conversely, do not place production in the same cluster as unrestricted experiments merely to save a modest control-plane fee.

## 3. Promote artifacts; do not rebuild per environment

Environment parity does not mean identical capacity. It means the same application artifact, deployment structure, and behavioral assumptions. Build the Node image once, identify it by digest, and promote that digest:

```yaml
# production kustomization.yaml
images:
  - name: ghcr.io/acme/api
    newName: ghcr.io/acme/api
    digest: sha256:4a1f...c92b
patches:
  - path: replicas.yaml
  - path: production-resources.yaml
```

Runtime configuration varies: database endpoints, replica counts, domain names, and external secret references. The executable image must not. Rebuilding `api:production` from the same commit can still produce a different dependency tree or base layer, invalidating staging evidence.

For Node.js, validate required runtime configuration at startup:

```ts
import { z } from "zod";

export const config = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.string().url(),
  PUBLIC_ORIGIN: z.string().url()
}).parse(process.env);
```

A missing value should fail deployment readiness immediately, not surface as a malformed request hours later.

## 4. Define promotion and data policies explicitly

Staging is valuable only if its purpose is clear. Use it for release-candidate verification, integration with realistic dependencies, migration rehearsal, and operational checks. It should not become an unstable shared development dump.

Write down answers to these questions:

- Who may deploy to each environment, and through which path?
- Does production require approval, a pull request, or a deployment window?
- How are schema migrations tested and ordered relative to application rollout?
- Is production data prohibited outside production, or sanitized before copying?
- What is the rollback mechanism, and who owns it?
- How are preview namespaces expired and their DNS, secrets, and databases removed?

Prefer backward-compatible database migrations: expand the schema, deploy code that supports old and new forms, migrate data, then contract later. This keeps promotion and rollback viable across independently changing application replicas.

## Try this today

Create a one-page environment decision record for a small Nuxt frontend and Node API. Choose namespace, cluster, and cloud-account boundaries for local, preview, staging, and production. Add a table with deployment authority, data classification, artifact source, capacity, expiry, and rollback strategy. Then create a `staging` namespace locally with the Pod Security label, `ResourceQuota`, and `LimitRange` above. Deploy a pod without resource settings and inspect the defaults with `kubectl get pod -n staging -o yaml`.

## Resources

- [Kubernetes: Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Kubernetes: Multi-tenancy](https://kubernetes.io/docs/concepts/security/multi-tenancy/)
