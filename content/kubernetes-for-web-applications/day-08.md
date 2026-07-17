---
title: "Why Kubernetes exists"
day: 8
week: 2
weekName: "Kubernetes Fundamentals"
description: "Kubernetes is valuable when many application instances must be placed, replaced, connected, and updated across a pool of machines. Its central idea is\u2026"
tag: "Kubernetes"
---

# Day 8 — Why Kubernetes exists

Kubernetes is valuable when many application instances must be placed, replaced, connected, and updated across a pool of machines. Its central idea is not containers or YAML; it is a control loop that continuously drives observed state toward declared desired state.

## Desired state and reconciliation

You submit resources to the Kubernetes API: for example, a Deployment declaring three replicas of an image. Controllers observe that declaration and current cluster state, then create or remove subordinate resources until they converge. If a Pod disappears, the Deployment’s controller causes a replacement to be created without a human restart command.

Reconciliation is asynchronous and level-based. The API accepting a Deployment does not mean the application is ready. Status conditions, events, and child resources show progress. This model rewards declarative changes: state what should be true, then let controllers repeatedly handle ordinary drift.

## Scheduling and self-healing have boundaries

The scheduler chooses a node for each unscheduled Pod using resource requests, constraints, affinities, and available capacity. The kubelet on that node asks the container runtime to start containers and continually reports status. Failed containers may restart; failed Pods may be replaced; failed nodes eventually cause workloads to be scheduled elsewhere.

Kubernetes restores declared process topology, not business correctness. It cannot determine that an endpoint returns subtly incorrect prices, recover data never backed up, or make a stateful service safe to replicate. Probes and metrics must express useful health, and the architecture must tolerate replacement.

## Mapping a web stack to resources

A stateless Node API typically becomes a Deployment plus a Service. A public Nuxt server may use another Deployment and Service, with an Ingress or Gateway routing external traffic. Configuration enters through ConfigMaps and Secrets. Batch tasks become Jobs or CronJobs. Persistent storage uses claims, though managed databases and object stores are often preferable.

This mapping keeps application concerns visible. Deployments own replaceable processes; Services provide stable discovery; configuration remains external; data has explicit durability. Do not place every container from a Compose file into one Pod. Containers in a Pod share lifecycle and network identity and should be tightly coupled helpers, not independently scalable services.

## Kubernetes has a break-even point

Kubernetes earns its complexity when a team needs consistent deployment across multiple services, automated rollouts, policy, workload portability, or an internal platform across a fleet. It is often overkill for one small service with modest availability needs, especially when a managed application platform supplies builds, TLS, scaling, logs, and rollback.

Account for the operating system around Kubernetes: ingress, DNS, certificates, secrets, observability, image governance, upgrades, and cost allocation. Managed control planes remove some cluster administration but not application-platform ownership. Adopt Kubernetes for explicit capabilities, not as a proxy for architectural maturity.

### Controllers favor replaceable, declarative applications

The reconciliation model works best when replacement is ordinary. An API instance should obtain identity from configuration, register no irreplaceable local state, and become useful through a readiness signal. Background jobs should make side effects idempotent because controllers and queues can retry work. Migrations need explicit coordination because multiple replicas may overlap during rollout.

This model also changes intervention. Editing a live Pod is ineffective because the controller recreates it from the template. The durable fix updates the owning resource or its source repository. During incidents, temporary actions can still be necessary, but operators must understand whether reconciliation will undo them and how desired state will be corrected afterward. Kubernetes rewards systems whose intended behavior can be stated, observed, and safely repeated.

## Try this today

Take one real web application and list its processes, public routes, internal dependencies, configuration, secrets, background work, and durable data. Map each to a Kubernetes resource or external managed service. Then write three concrete capabilities Kubernetes would add and three ongoing costs; if the benefits are vague, compare a managed container platform before committing.

## Resources

- [Kubernetes concepts overview](https://kubernetes.io/docs/concepts/overview/)
- [Kubernetes API conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md)
