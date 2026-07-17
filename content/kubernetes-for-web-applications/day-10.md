---
title: "Your first workload: Pods and Deployments"
day: 10
week: 2
weekName: "Kubernetes Fundamentals"
description: "Pods are replaceable execution envelopes; Deployments are the durable declaration most web services should own. The practical distinction prevents a\u2026"
tag: "Kubernetes"
---

# Day 10 — Your first workload: Pods and Deployments

Pods are replaceable execution envelopes; Deployments are the durable declaration most web services should own. The practical distinction prevents a common mistake: caring for an individual Pod when the correct operational target is the controller that can replace it.

## Pods define co-located containers

Containers in one Pod share a network namespace, IP address, and mounted volumes. They can communicate over localhost and are scheduled together. Use multiple containers only when their lifecycles are tightly coupled—for example, a proxy or telemetry helper—not merely because two services talk to each other.

Treat one container as the boundary for one primary service process. This is not a rule that a container may contain only one Unix process: Node can create worker threads or child processes, and an init process may reap children. The operational rule is to avoid bundling independently deployable services under a process manager in one container. Separate containers give each service an explicit image, resource policy, health status, logs, and restart behavior; separate Pods additionally allow independent placement and scaling.

Pod identity and writable files are ephemeral. A replacement usually receives a new name and IP. Applications should not depend on either. Stable discovery comes from Services, configuration from external resources, and durable data from external storage.

## Deployments manage stateless replicas

A Deployment declares a Pod template and replica count. It creates ReplicaSets that maintain Pods and support rolling updates. Labels tie these objects together, so selector correctness is critical. A minimal API workload is:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-api
  template:
    metadata:
      labels:
        app: web-api
    spec:
      containers:
        - name: api
          image: ghcr.io/example/web-api@sha256:REPLACE_ME
          ports:
            - name: http
              containerPort: 3000
```

The selector must match the Pod-template labels and is effectively immutable. Add descriptive labels such as application, component, and version, but keep selectors stable across releases.

## Pod phases are not application readiness

Common Pod phases include Pending, Running, Succeeded, and Failed. `Running` means the Pod is bound to a node and its required containers have been created; it does not prove the API can serve a request. Container status exposes waiting, running, and terminated state, along with restart count and reasons.

A Deployment’s `Available` condition incorporates readiness and availability timing. Later you will define probes; until then, Kubernetes considers a started container ready quickly. Always inspect both the controller rollout and individual Pod status when validating a release.

## Work through the controller

Apply desired state with `kubectl apply -f deployment.yaml`, then use `kubectl rollout status deployment/web-api`. View selected Pods with `kubectl get pods -l app=web-api -o wide`. Logs and details operate on Pods, but configuration changes belong in the Deployment template.

Deleting one Pod is a useful reconciliation test, not a deployment method. Scaling should update the Deployment: `kubectl scale deployment/web-api --replicas=3`. For repeatable environments, commit the declarative replica value or let an autoscaler own it rather than leaving an unexplained imperative change.

### The Pod template is the release boundary

Any meaningful change to `spec.template`—image, environment, labels, probes, or annotations—creates a new Deployment revision and ReplicaSet. Changing only Deployment metadata does not roll Pods. Configuration referenced indirectly by name may also change without altering the template, which is why content-hashed configuration names or checksum annotations are common rollout triggers.

Avoid setting both an HPA and a delivery manifest to fight over replica count. Decide which controller owns each field. The same principle applies to GitOps tools and imperative commands: multiple writers cause surprising reconciliation. Server-side apply can track field managers, but clear organizational ownership is still required. A reliable workload has one authoritative path for release configuration and observable controllers for runtime state.

## Try this today

Build and push a tiny Node API image to a registry your local cluster can access, replace the digest, and apply the manifest. Watch Pods with `kubectl get pods -w`, inspect logs, and use `kubectl port-forward deployment/web-api 3000:3000` to call it. Delete a Pod, scale to three, and explain which controller performed each recovery action.

## Resources

- [Kubernetes: Pods](https://kubernetes.io/docs/concepts/workloads/pods/)
- [Kubernetes: Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
