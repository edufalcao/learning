---
title: "Packaging manifests with Helm and Kustomize"
day: 21
week: 5
weekName: "Platform Blueprint"
description: "For a senior engineer, packaging is less about avoiding repeated YAML and more about preserving understandable change boundaries. Kubernetes\u2026"
tag: "Kubernetes"
---

# Day 21 — Packaging manifests with Helm and Kustomize

For a senior engineer, packaging is less about avoiding repeated YAML and more about preserving understandable change boundaries. Kubernetes configuration becomes production code: it needs reviewable defaults, explicit environment differences, deterministic rendering, and an escape hatch when abstractions leak.

## 1. Raw YAML establishes the contract

Start with plain manifests because they expose the Kubernetes API without another language in between. A Deployment and Service can be applied directly, diffed easily, and understood with standard tooling. The cost appears when several environments or services repeat the same structures and drift independently.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  replicas: 2
  selector:
    matchLabels: { app: web-api }
  template:
    metadata:
      labels: { app: web-api }
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/web-api@sha256:REPLACE_ME
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
```

Raw YAML is a good baseline for a small workload with few variants. Avoid copying whole directories for `dev`, `staging`, and `production`; copies hide whether a difference is intentional. Regardless of packaging tool, inspect the final objects before applying them. The rendered YAML—not a template or patch—is what the API server receives.

## 2. Helm packages reusable applications

Helm is a chart format plus a Go-template rendering engine. A chart normally contains `Chart.yaml`, default configuration in `values.yaml`, and templates under `templates/`. Values represent supported configuration knobs; templates turn those values into Kubernetes objects.

```yaml
# values.yaml
replicaCount: 2
image:
  repository: ghcr.io/acme/web-api
  digest: "sha256:REPLACE_ME"
resources:
  requests: { cpu: 100m, memory: 128Mi }
```

```yaml
# templates/deployment.yaml (excerpt)
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: api
          image: "{{ .Values.image.repository }}@{{ .Values.image.digest }}"
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

Render before deployment with `helm template web-api ./chart -f values-staging.yaml`. Validate the result, then install with `helm upgrade --install web-api ./chart --namespace web --create-namespace`. `upgrade --install` is convenient, but Helm release state does not replace Git history or a deployment review.

Keep the values interface narrow and meaningful. A chart exposing every field as a value becomes an undocumented second Kubernetes API. Prefer values such as `replicaCount`, `image.digest`, and `ingress.host`; do not turn arbitrary template fragments into configuration. Use helpers for repeated labels and names, quote strings defensively, and fail early with Helm's `required` function for mandatory settings. Never place secret values in committed values files.

## 3. Kustomize patches concrete manifests

Kustomize uses ordinary YAML as a base and applies declarative transformations. It is built into `kubectl`, has no template syntax, and works especially well when environments share nearly identical resources.

```yaml
# base/kustomization.yaml
resources:
  - deployment.yaml
  - service.yaml
images:
  - name: ghcr.io/acme/web-api
    newTag: "1.8.0"
```

```yaml
# overlays/production/kustomization.yaml
resources:
  - ../../base
namePrefix: prod-
replicas:
  - name: web-api
    count: 4
patches:
  - path: resources.yaml
```

```yaml
# overlays/production/resources.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  template:
    spec:
      containers:
        - name: api
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits: { memory: 512Mi }
```

Run `kubectl kustomize overlays/production` to inspect output and `kubectl apply -k overlays/production` to apply it. Prefer targeted patches over large replacements. If overlays accumulate dozens of patches, the base may represent too many applications or environments at once.

## 4. Choose based on ownership and variation

Use raw YAML when there is one deployment shape and repetition is minimal. Use Kustomize when your team owns concrete manifests and needs a few environment-specific patches. Use Helm when distributing a reusable application package, installing third-party software, or supporting a deliberate values-based interface. They can be combined—some GitOps repositories inflate Helm charts and then patch output—but composition adds debugging cost.

For a small product team, a strong default is Kustomize for first-party applications and Helm for external platform components such as ingress controllers or Prometheus. If multiple teams consume the same internal application chart, Helm may also be justified. Whichever approach you select, pin image digests, render in CI, validate schemas, and show reviewers the rendered diff.

## Try this today

Take an existing Node Deployment and Service. Put them in `base/`, then create `overlays/dev` with one replica and `overlays/production` with three replicas plus production resource requests. Run both `kubectl kustomize` commands and compare the rendered output. Then model the same three knobs in a tiny Helm chart and run `helm template`. Write down which representation makes intentional differences easiest to review; keep only that approach.

## Resources

- [Helm documentation](https://helm.sh/docs/)
- [Kubernetes: Declarative Management with Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
