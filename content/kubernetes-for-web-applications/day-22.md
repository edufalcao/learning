---
title: "CI/CD into Kubernetes"
day: 22
week: 5
weekName: "Platform Blueprint"
description: "A Kubernetes pipeline should create one verifiable artifact and move that exact artifact through environments. For a senior engineer, the hard part is\u2026"
tag: "Kubernetes"
---

# Day 22 — CI/CD into Kubernetes

A Kubernetes pipeline should create one verifiable artifact and move that exact artifact through environments. For a senior engineer, the hard part is not writing workflow YAML; it is establishing trust boundaries, immutable identity, useful quality gates, and a deployment result that can be observed and rolled back.

## 1. Build once, verify before publishing

A practical pipeline has distinct stages: install dependencies, lint and test, build the application, construct the image, scan it, publish it, and update or apply deployment configuration. Failures should stop before credentials with greater privileges are introduced.

For Node, deterministic installation starts with a committed lockfile:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm run lint
- run: npm test
- run: npm run build
```

A multi-stage Docker build should repeat only the compilation necessary to produce the runtime image. CI tests and image construction serve different purposes: tests give fast feedback; the Docker build proves the deployable artifact can be assembled. Add a vulnerability scanner such as Trivy, but define policy deliberately. Blocking every low-severity finding creates alert fatigue; blocking fixable critical vulnerabilities is a defensible initial gate.

Do not pass cloud keys or registry passwords to untrusted pull-request jobs. GitHub environments can require approval before production, while OpenID Connect (OIDC) lets workflows exchange short-lived identity tokens for cloud access instead of storing long-lived credentials.

## 2. Treat the digest as the release identity

Tags are convenient aliases, not immutable identities. `web-api:1.8.0` can be overwritten; a digest such as `web-api@sha256:abc...` identifies exact image content. Publish useful tags for humans, but deploy and promote by digest.

With Docker Buildx, GitHub Actions can capture the pushed digest:

```yaml
- id: build
  uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ghcr.io/acme/web-api:${{ github.sha }}

- run: echo "digest=${{ steps.build.outputs.digest }}"
```

The production release should refer to that output, not rebuild from the production branch. Rebuilding can change dependencies, base images, timestamps, or toolchain output. Promotion means moving a known digest through deployment configuration: development observes it first, then staging, then production.

Also attach provenance where your platform permits it. Build attestations and signed images make it possible to answer: Which repository and workflow produced this image? Which commit was used? Was the build altered after publication? These controls become meaningful when admission policy or deployment review verifies them.

## 3. Separate artifact CI from deployment CD

CI answers “is this commit releasable?” CD answers “should this known release be placed in this environment?” Keeping them logically separate reduces accidental privilege escalation and makes retries safer. A failed deployment should not require rebuilding the image.

Two common CD models are valid. Push-based delivery runs `helm upgrade` or `kubectl apply` from the workflow. It is simple but gives CI direct cluster credentials. Pull-based GitOps changes a configuration repository; a cluster-side reconciler performs deployment. The latter improves auditability and narrows cluster access, which Day 23 explores.

A push-based job might be:

```yaml
- name: Deploy staging
  run: |
    helm upgrade --install web-api ./deploy/chart \
      --namespace web-staging --create-namespace \
      --set image.repository=ghcr.io/acme/web-api \
      --set image.digest=${{ needs.image.outputs.digest }} \
      --wait --timeout 5m
    kubectl rollout status deployment/web-api \
      -n web-staging --timeout=120s
```

`--wait` is useful, but readiness only proves Kubernetes considers Pods ready. Follow it with a smoke test against the real route, checking a user-relevant path and a dependency-backed operation if safe.

## 4. Design failure and rollback explicitly

Deployments must expose enough information to diagnose failure: commit SHA, image digest, workflow URL, timestamps, and rollout events. Set workflow concurrency so two production deploys cannot race:

```yaml
concurrency:
  group: production
  cancel-in-progress: false
```

Automated rollback is attractive but can conceal a persistent defect. A safer first design stops on failed rollout, preserves logs and events, and offers an explicit rollback job to the previous digest. Database changes require expand-and-contract compatibility: deploy additive schema changes first, release code compatible with old and new shapes, migrate data, and remove obsolete fields later. Kubernetes rollback cannot reverse destructive data migration.

## Try this today

Create a GitHub Actions workflow for a small Node API that runs `npm ci`, tests, builds an image, and pushes it on commits to `main`. Capture the digest as a job output. Add a staging deployment job protected by a GitHub environment and use the digest in Helm or Kustomize configuration. Finish with `kubectl rollout status` and a `curl --fail` smoke test. On paper, document the exact command or config change needed to redeploy the previous digest.

## Resources

- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Kubernetes: Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)
