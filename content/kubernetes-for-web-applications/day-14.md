---
title: "Persistent data and stateful dependencies"
day: 14
week: 3
weekName: "Shipping Web Applications"
description: "Containers and Pods are replaceable; business data is not. Kubernetes can attach durable storage, but a volume only solves byte persistence\u2014it does not\u2026"
tag: "Kubernetes"
---

# Day 14 — Persistent data and stateful dependencies

Containers and Pods are replaceable; business data is not. Kubernetes can attach durable storage, but a volume only solves byte persistence—it does not provide database correctness, replication, backup, or operational ownership.

## Volumes have different lifetimes

A Pod volume such as `emptyDir` lives for the Pod lifetime and can be shared by its containers. It survives a container restart but disappears when the Pod is replaced. It is appropriate for caches, temporary transforms, or shared scratch data, subject to node capacity.

A PersistentVolume represents storage available to the cluster. A PersistentVolumeClaim requests capacity and access characteristics, and a StorageClass describes dynamic provisioning behavior. Applications normally create claims; a CSI driver and infrastructure provider handle the underlying disk or filesystem.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard
```

Access modes describe supported attachment semantics, not application-level locking. `ReadWriteOnce` commonly permits write mounting from one node, which can constrain replica placement.

## Stateful workloads carry identity and ordering

A Deployment treats replicas as interchangeable. Databases often need stable identity, ordered rollout, persistent volume association, replication membership, and controlled failover. StatefulSets provide stable Pod names and per-replica claims, but they do not configure PostgreSQL replication, prevent split brain, or test restores.

Operators can encode database-specific lifecycle knowledge, yet they create another software system to understand and upgrade. Before running a database in-cluster, identify who owns patches, backups, point-in-time recovery, failover drills, capacity, and after-hours incidents.

## Managed data services are often the application choice

A managed database usually provides automated backups, monitored replication, maintenance workflows, and a support boundary. It may cost more per unit and introduce provider coupling, but it lets a small product team concentrate on schema and query behavior rather than storage orchestration.

Connectivity still needs engineering. Use private networking where possible, enforce TLS, obtain credentials through workload identity or secret delivery, configure connection timeouts, and size pools across all replicas. Ten Pods each opening 50 connections can exhaust a modest database. A pooling proxy may help, but it also requires capacity and observability.

## Data lifecycle must be explicit

Uploaded files rarely belong on a Node container filesystem. Object storage offers durable, scalable storage and direct delivery patterns. If a shared filesystem is genuinely required, understand latency, concurrency, and zone availability. For any persistent system, define retention, deletion, encryption, backup frequency, recovery objectives, and restore tests.

PVC deletion and underlying-volume deletion are separate decisions governed by reclaim policy and application workflows. Test what happens when a namespace, claim, or StatefulSet is removed. A backup that has never been restored is an assumption, not a recovery capability.

### Availability and durability are different goals

Replication can keep a service available after one instance fails, but it may faithfully replicate accidental deletion or corruption. Backups preserve recoverable history, but a backup stored in the same failure domain or protected by the same compromised credentials may not survive the incident. Define recovery point and recovery time objectives from product impact, then design both replication and backup around them.

Applications participate in recovery. Schema migrations need compatible restore procedures, object references must remain consistent, and caches should rebuild safely. Practice restoring into an isolated environment, validate application queries and counts, and record the time and manual decisions. This evidence is more valuable than a dashboard showing that scheduled backups completed.

## Try this today

Create an `emptyDir` mount in a two-container Pod and prove both containers share it; then delete the Pod and observe data loss. Create a PVC on your local cluster, mount it into a replacement Pod, and verify persistence. Finally, produce a short decision record comparing managed PostgreSQL with in-cluster PostgreSQL for ownership, recovery, cost, and latency.

## Resources

- [Kubernetes: Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Kubernetes: StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
