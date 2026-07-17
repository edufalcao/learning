---
title: "Linux primitives behind containers"
day: 3
week: 1
weekName: "Container Foundations"
description: "A container is not a miniature VM. It is a process whose view of the Linux system has been constrained and whose filesystem has been assembled from\u2026"
tag: "Kubernetes"
---

# Day 3 — Linux primitives behind containers

A container is not a miniature VM. It is a process whose view of the Linux system has been constrained and whose filesystem has been assembled from image layers; understanding that statement makes debugging and security decisions far less mysterious.

## Namespaces change what a process can see

Linux namespaces provide separate views of system resources. A PID namespace gives a process its own process numbering; a network namespace supplies interfaces, routes, and ports; mount, UTS, IPC, user, and cgroup namespaces isolate other views. The process still executes through the host kernel.

This explains common surprises. `localhost` inside a container refers to that container’s network namespace, not the developer laptop or another Pod. PID 1 inside the namespace has special signal and child-reaping behavior, even though the process has a different PID on the host. A Node service should therefore listen on `0.0.0.0`, avoid daemonizing, and respond correctly to termination signals.

## Cgroups control resource consumption

Control groups account for and constrain CPU, memory, process count, and other resources. A CPU limit generally throttles execution; a memory limit is a hard boundary that can cause an out-of-memory kill. These controls are behind Kubernetes resource requests and limits, although requests primarily influence scheduling while limits configure enforcement.

Node’s defaults can interact poorly with constrained memory because the runtime may infer limits differently across versions and environments. Set realistic Kubernetes resources, observe heap and resident memory, and use a deliberate `--max-old-space-size` only when measurements justify it. Application-level concurrency limits are also important: a cgroup cannot make an unbounded work queue healthy.

## Capabilities divide root privilege

Linux capabilities split traditionally all-powerful root operations into narrower permissions such as binding low ports or administering networks. Container runtimes can drop capabilities even when a process has user ID 0 inside its namespace. Production web services usually need no added capabilities.

Run Node as a non-root user, bind to an unprivileged port such as 3000, drop all capabilities where supported, and make the root filesystem read-only when the app permits it. A process that needs to write temporary data should use an explicitly mounted temporary directory rather than broad filesystem access.

## Layered filesystems assemble the root tree

An image contains immutable filesystem layers. At runtime, the container receives a thin writable layer on top. Reads see a merged view; writes go to the ephemeral top layer. Deleting a file from a later image layer does not remove its bytes from earlier layers, which matters for secrets accidentally copied during a build.

The writable layer is not durable application storage. When Kubernetes replaces a Pod, that layer disappears. Logs should go to standard streams, uploaded files should go to object storage or a persistent volume, and mutable business data should live in an external data system.

### The primitives compose into one runtime boundary

A runtime creates namespaces, attaches cgroups, applies capabilities and seccomp policy, mounts an image root filesystem, then executes the configured process. Kubernetes does not replace these mechanisms; it describes how they should be configured and repeatedly asks the node runtime to realize them. This is why a Pod security setting can ultimately change kernel enforcement.

Debug at the correct layer. A process that cannot bind a port may lack a capability or may already have a listener in its network namespace. A write failure may come from Unix permissions, a read-only mount, or a missing volume. CPU latency may be cgroup throttling rather than Node computation alone. Connecting the symptom to the primitive produces a narrower, testable hypothesis.

## Try this today

Run `docker run --rm -it --memory=128m --cpus=0.5 node:22-bookworm-slim sh`. Inside it, inspect `/proc/1/status`, `/proc/self/mountinfo`, and `/sys/fs/cgroup`, then run `ps` and `ip addr` if available. Compare those views with the host. Start a Node process that logs `process.pid`, send it SIGTERM, and confirm how PID 1 and signal handling behave.

## Resources

- [Linux namespaces manual](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [Docker: Runtime resource constraints](https://docs.docker.com/engine/containers/resource_constraints/)
