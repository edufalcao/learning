---
title: "GitOps as an operating model"
day: 23
week: 5
weekName: "Platform Blueprint"
description: "GitOps is not \u201cCI with extra commits.\u201d It changes the authority model: Git declares what should run, while a controller inside or near the cluster\u2026"
tag: "Kubernetes"
---

# Day 23 — GitOps as an operating model

GitOps is not “CI with extra commits.” It changes the authority model: Git declares what should run, while a controller inside or near the cluster continuously reconciles actual state toward that declaration. For senior engineers, its value is a reviewable change history, bounded deployment credentials, drift detection, and a consistent recovery procedure.

## 1. Git stores desired state; reconciliation closes the loop

In a push pipeline, a workflow executes an imperative deployment and then exits. In GitOps, Argo CD or Flux repeatedly compares Git-rendered resources with live objects. If they differ, the controller reports drift and—when automated synchronization is enabled—can restore the declared state.

Suppose CI publishes `ghcr.io/acme/web-api@sha256:abc123`. Promotion can be a pull request changing one field:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  template:
    spec:
      containers:
        - name: api
          image: ghcr.io/acme/web-api@sha256:abc123
```

That commit is now the deployment request, approval record, and rollback reference. Reverting it declares the previous desired state. This is stronger than relying on a workflow log, but only if uncontrolled actors cannot mutate Git or bypass the reconciler.

Reconciliation is continuous, so distinguish legitimate controller-generated changes from drift. An HPA changing `spec.replicas`, for example, should not fight a GitOps controller. Omit fields owned by another controller or configure drift-ignore rules narrowly; broad ignores create blind spots.

## 2. Argo CD and Flux implement similar principles differently

Argo CD models an Application that points to a source repository/path and a destination cluster/namespace. It offers a strong UI, resource topology, sync health, hooks, and application grouping. Flux uses composable Kubernetes custom resources—such as `GitRepository`, `Kustomization`, and `HelmRelease`—and fits naturally into command-line and Kubernetes-native workflows.

A simplified Argo CD Application looks like this:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web-api-staging
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/acme/platform-config.git
    targetRevision: main
    path: apps/web-api/overlays/staging
  destination:
    server: https://kubernetes.default.svc
    namespace: web-staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

`prune` deletes resources removed from Git; `selfHeal` reverses live drift. Both are powerful and should first be enabled in a non-production environment. Protect the controller itself, constrain its RBAC, and define which repositories and target namespaces an application project may use.

Tool choice matters less than agreeing on ownership, repository structure, promotion rules, and emergency procedures. A poorly governed GitOps installation merely automates ambiguity.

## 3. Separate source code from deployment configuration deliberately

A common design uses an application repository for TypeScript, tests, Dockerfile, and CI, plus a configuration repository for environment manifests. CI builds the image, then opens a pull request against config. This lets application CI avoid cluster credentials and gives platform policy a separate review surface.

```text
web-api/
  src/  test/  Dockerfile  .github/workflows/ci.yml

platform-config/
  apps/web-api/base/
  apps/web-api/overlays/staging/
  apps/web-api/overlays/production/
  clusters/production/
```

The split has costs: cross-repository changes are less atomic, discoverability can suffer, and automated version bumps may generate noise. For one small team, keeping deployment configuration beside application code can be simpler. The important separation is between artifact production and environment approval, not necessarily between repositories.

Avoid one enormous “everything” application. Choose boundaries that match ownership and blast radius: one app per deployable product component or coherent stack, with separate production and non-production instances. Shared cluster add-ons should generally be managed independently from product workloads.

## 4. Auditability requires policy and an escape path

Git history is useful only when branches are protected, reviews are meaningful, commits identify actors, and secrets are absent. Store secret references or encrypted secret resources—not plaintext credentials. Controllers need read access to source repositories and write access to target resources, so scope both narrowly.

Define a break-glass process for incidents. An operator may need an emergency live patch, but reconciliation could immediately reverse it. A runbook should explain how to pause synchronization, authorize and record the manual change, back-port the fix into Git, and resume reconciliation. “Never use kubectl” is less useful than making exceptions explicit, temporary, and auditable.

GitOps also improves disaster recovery: reinstall the controller, restore access to repositories and secret systems, and reconcile. Test that claim. Stateful data, external identities, CRDs, and controller bootstrapping may not be recoverable from ordinary manifests alone.

## Try this today

On a local cluster, install Argo CD or Flux and point it at a test repository containing a Node Deployment and Service. Enable automated synchronization in a disposable namespace. First change the image or replica count in Git and observe reconciliation. Then manually edit a label with `kubectl` and see whether drift is reported or healed. Finally, revert the Git commit and confirm the previous state returns. Record which identity performed each operation.

## Resources

- [OpenGitOps principles](https://opengitops.dev/)
- [Argo CD documentation](https://argo-cd.readthedocs.io/)
