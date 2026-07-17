---
title: "Cluster architecture without mystique"
day: 9
week: 2
weekName: "Kubernetes Fundamentals"
description: "A cluster is a distributed control system plus worker machines. Application engineers do not need to operate every component, but knowing who owns each\u2026"
tag: "Kubernetes"
---

# Day 9 — Cluster architecture without mystique

A cluster is a distributed control system plus worker machines. Application engineers do not need to operate every component, but knowing who owns each decision makes `kubectl` output and failure symptoms much easier to interpret.

## The API server is the front door

Clients, controllers, schedulers, and kubelets communicate through the Kubernetes API server. It authenticates and authorizes requests, runs admission logic, validates resources, and persists accepted state. `kubectl` is simply one API client; YAML is a serialization format for API objects, not the platform itself.

etcd is the strongly consistent key-value store behind API state. Application teams should not connect to it directly. On self-managed clusters it requires careful backup and recovery; managed providers usually own those mechanics. A successful write to the API records intent, while resource status later records what the system observed.

## Controllers and scheduler make decisions

The controller manager runs control loops such as Deployment, ReplicaSet, Node, and Job controllers. A Deployment controller produces a ReplicaSet; that ReplicaSet causes Pods to exist. Ownership references let Kubernetes garbage-collect dependent objects and explain the hierarchy visible through `kubectl`.

The scheduler watches for Pods with no assigned node and selects a feasible placement. It considers resource requests, node selectors, taints and tolerations, affinity, topology, and other constraints. It does not start the container. If a Pod is Pending, scheduling events usually explain whether the issue is capacity or incompatible constraints.

## Nodes execute the declared workload

Each node runs a kubelet that reconciles assigned Pod specifications with local reality. A container runtime such as containerd pulls images and creates containers. A Container Network Interface implementation configures Pod networking; a storage interface may attach and mount volumes.

This division localizes incidents. An image pull error involves registry access, credentials, or the runtime. A Pod scheduled but unable to start may involve mounts or container configuration. A Ready Pod unreachable through a Service points toward selectors, endpoints, ports, or networking rather than the scheduler.

## Read state as resources and events

Start broad, then follow ownership and status:

```bash
kubectl get nodes
kubectl get deployments,replicasets,pods -A
kubectl get pod api-abc -o yaml
kubectl describe pod api-abc
kubectl get events --sort-by=.metadata.creationTimestamp
```

`get` provides a summary, `-o yaml` exposes specification and status, and `describe` combines useful fields with related events. Events are time-limited diagnostic records, not a durable audit log. Conditions are better machine-readable indicators of current progress.

Use namespaces to narrow routine queries and labels to select application resources. Avoid editing controller-owned Pods directly: a replacement will be created from the Deployment template and discard the change. Update the owning resource instead.

### Status should guide the next question

Kubernetes resources typically separate `spec`, the submitted intent, from `status`, the controller’s observation. Metadata includes generation counters, while conditions often record an `observedGeneration`. If a controller has not observed the latest generation, its status may describe an older configuration. This distinction matters in automation that otherwise declares success too early.

Use API discovery rather than relying on memory: `kubectl api-resources`, `kubectl explain deployment.spec.strategy`, and `kubectl get --raw` expose what the current cluster supports. Managed providers and installed custom resources differ. Read-only discovery is safer than pasting manifests from another version and helps you recognize whether a field is native Kubernetes, provider-specific configuration, or a custom controller’s API.

## Try this today

Use a local cluster such as kind, minikube, or Docker Desktop. Run the commands above and locate the API server and node components appropriate to that distribution. Create a simple Deployment, then trace Deployment → ReplicaSet → Pod using `kubectl get ... -o yaml` and `ownerReferences`. Delete the Pod and watch reconciliation create a replacement.

## Resources

- [Kubernetes cluster architecture](https://kubernetes.io/docs/concepts/architecture/)
- [kubectl command reference](https://kubernetes.io/docs/reference/kubectl/)
