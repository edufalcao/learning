---
title: "Virtual machines: the right amount of knowledge"
day: 2
week: 1
weekName: "Container Foundations"
description: "You do not need to administer hypervisors to operate web apps on Kubernetes, but you should understand the boundary beneath the cluster. VM behavior\u2026"
tag: "Kubernetes"
---

# Day 2 — Virtual machines: the right amount of knowledge

You do not need to administer hypervisors to operate web apps on Kubernetes, but you should understand the boundary beneath the cluster. VM behavior explains node capacity, failure domains, startup time, and why a “managed” cluster still exposes infrastructure decisions.

## Hypervisors and guest operating systems

A hypervisor presents virtual CPU, memory, storage, and network devices to a guest operating system. Type 1 hypervisors run directly on server hardware; hosted hypervisors run through another OS. In both cases, the guest boots its own kernel and manages its own processes, users, packages, and network stack.

A VM image is a bootable disk template, not the same artifact as a container image. It usually includes an entire operating system and may be customized at startup with cloud-init. Provisioning a VM therefore involves selecting hardware shape, attaching disks and network interfaces, booting the guest, and configuring services. That lifecycle is measured in seconds or minutes rather than the milliseconds or seconds typical for containers.

## VM and container isolation differ

VMs isolate through virtual hardware and separate kernels. A kernel failure or exploit inside one guest normally remains separated from another guest. Containers isolate processes through facilities provided by a shared host kernel. They package far less and start faster, but their security boundary depends more directly on that kernel and runtime configuration.

The comparison is about trade-offs, not superiority. VMs are useful boundaries for different tenants, security zones, kernels, and operating systems. Containers are effective units for packaging and scheduling application processes. Many platforms deliberately combine them: VMs supply a durable infrastructure boundary, while containers provide application-level density and consistency.

## Kubernetes nodes are usually VMs

In a managed cluster, each worker node is often a cloud VM with a fixed CPU and memory shape. Kubernetes schedules Pods onto the allocatable capacity of those nodes. A Pod request does not create hardware; it reserves part of a node that already exists. If no existing node fits, a cluster autoscaler may request another VM, whose boot time becomes part of application scale-up latency.

Node loss also becomes a web-app concern. Kubernetes can recreate a Pod on another node, but only if capacity exists and state is externalized. Spreading replicas across nodes and cloud availability zones reduces correlated failure. A Deployment with three replicas all placed on one VM is three process copies but only one infrastructure failure domain.

## Virtual networks and storage survive at the edges

Cloud VMs attach to virtual networks with subnets, routes, firewall rules, and security groups. Kubernetes adds Pod and Service networking, but traffic eventually crosses these cloud primitives. Likewise, a PersistentVolume often maps to a cloud block disk whose zone and attachment constraints affect where a Pod can run.

This layered model helps during incidents. If a Service has endpoints but clients still time out, investigate Kubernetes policy, node routes, cloud firewall rules, and load balancer health rather than treating “the network” as one component. If a stateful Pod is pending, check whether its disk can attach in the node’s zone.

### Design for node replacement

Assume a node will disappear during upgrades, scaling, or hardware failure. Stateless replicas should start elsewhere from the same image and retrieve configuration without depending on node-local files. Give the scheduler enough spare capacity to place replacements, and use topology constraints when correlated node or zone loss matters to the service objective.

Node-local caches can still be valuable, but treat them as accelerators. Rebuilding a cache should affect latency, not correctness. Likewise, a `hostPath` volume couples a Pod to one node and is rarely appropriate for application data. This reasoning is more useful to an application engineer than memorizing hypervisor brands: it directly shapes whether a rollout, drain, or autoscaling event is routine.

## Try this today

On any VM or cloud instance you can inspect safely, run `uname -a`, `cat /proc/cpuinfo`, `free -h`, `ip route`, and `lsblk`. Identify which outputs describe virtualized hardware and which describe the guest OS. Then sketch your likely Kubernetes stack as physical host → VM/node → Pod → container process and mark where CPU, network, and disk limits are applied.

## Resources

- [Kubernetes: Nodes](https://kubernetes.io/docs/concepts/architecture/nodes/)
- [Red Hat: What is a hypervisor?](https://www.redhat.com/en/topics/virtualization/what-is-a-hypervisor)
