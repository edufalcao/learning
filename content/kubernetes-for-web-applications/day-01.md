---
title: "From processes to infrastructure abstractions"
day: 1
week: 1
weekName: "Container Foundations"
description: "A web service is ultimately a process reading files, allocating memory, and exchanging bytes over a network. For a senior engineer, the useful\u2026"
tag: "Kubernetes"
---

# Day 1 — From processes to infrastructure abstractions

A web service is ultimately a process reading files, allocating memory, and exchanging bytes over a network. For a senior engineer, the useful infrastructure model begins there: every higher-level platform is an opinionated way to allocate, isolate, connect, and replace those basic resources.

## A process is the real unit of execution

When `node server.js` starts, the operating system creates a process with an identity, virtual memory, file descriptors, environment variables, and one or more threads. The process sees a filesystem tree and network interfaces supplied by its host. It does not inherently know whether the host is a laptop, VM, container, or Kubernetes node.

This makes application behavior the right starting point for operations. A Node HTTP server should bind to a configurable address and port, write logs to standard output, and handle termination:

```js
import http from 'node:http';

const port = Number(process.env.PORT ?? 3000);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ pid: process.pid, path: req.url }));
});

server.listen(port, '0.0.0.0');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
```

The application contract remains stable while infrastructure changes around it.

## Isolation creates reliable boundaries

Two processes on one machine can otherwise compete for CPU and memory, collide when they try to bind the same port, read each other’s files, or inherit incompatible library versions. Isolation reduces this interference. It gives a workload its own apparent filesystem, process tree, network namespace, and resource budget while retaining controlled paths for communication.

Isolation is not absolute security. Containers share a host kernel, and configuration mistakes can weaken boundaries. Treat isolation as layered risk reduction: use unprivileged processes, narrow filesystem permissions, explicit resource controls, and network policy rather than assuming the container boundary solves everything.

## Servers, VMs, containers, and managed platforms

A physical server provides maximum hardware control but has slow provisioning and coarse utilization. A VM virtualizes hardware and runs a complete guest OS, creating a strong, heavyweight boundary. A container packages application files and metadata while using the host kernel; it starts quickly and supports high workload density. A managed application platform goes further by hiding much of the machine and scheduler lifecycle behind a deployment API.

These are composable layers, not mutually exclusive products. A managed Kubernetes cluster commonly runs containers inside VMs on physical cloud hosts. Choose at the highest abstraction that preserves the control you actually need. If a managed container service satisfies networking, scaling, and compliance requirements, Kubernetes may add cost without product value.

## The operational promise of containers

Containers address build-to-runtime drift by distributing an immutable image containing the application and its runtime dependencies. They also standardize lifecycle operations: start a process, attach networking and storage, collect output, send signals, and remove the instance. This makes deployment more repeatable, but it does not make the application reliable by itself.

The image must still be correctly built, secrets must arrive at runtime, persistent data must live outside the container’s writable layer, and operators need health signals. Kubernetes builds on this contract by continuously creating and replacing container instances to match declared intent.

### Turn runtime facts into an application contract

Before choosing infrastructure, write down the service’s minimum operating contract. Include the command, listening port, startup duration, memory behavior, writable paths, outbound dependencies, shutdown deadline, and evidence emitted during failure. For example, a service that stores sessions in memory is not horizontally replaceable, while one that writes uploads beside its source cannot tolerate an immutable filesystem. These are application constraints, not platform defects.

This contract also improves design reviews. Instead of debating whether containers are “portable,” verify whether the image supports the target CPU, whether configuration is external, whether state survives replacement, and whether the process works behind a proxy. Kubernetes later expresses these requirements as Pod settings, probes, resources, Services, configuration objects, and storage choices.

## Try this today

Save the example as `server.mjs`, run it with `PORT=4000 node server.mjs`, and inspect it with `ps`, `lsof -i :4000`, and `curl localhost:4000/test`. Send `kill -TERM <pid>` and confirm that it exits cleanly. Write down which application assumptions concern processes, files, network, configuration, and shutdown; these become deployment requirements later.

## Resources

- [Node.js process documentation](https://nodejs.org/api/process.html)
- [OCI runtime specification](https://github.com/opencontainers/runtime-spec)
