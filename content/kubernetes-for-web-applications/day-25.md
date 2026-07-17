---
title: "Network security and service boundaries"
day: 25
week: 5
weekName: "Platform Blueprint"
description: "Kubernetes networking is permissive by default: if the network plugin enforces NetworkPolicy, Pods can usually still talk to one another until policies\u2026"
tag: "Kubernetes"
---

# Day 25 — Network security and service boundaries

Kubernetes networking is permissive by default: if the network plugin enforces NetworkPolicy, Pods can usually still talk to one another until policies select them. For a senior engineer, network policy is executable architecture—an allowlist derived from real dependencies—not a substitute for authentication, TLS, or application authorization.

## 1. Model east-west traffic before writing policy

North-south traffic enters or leaves the cluster; east-west traffic moves between workloads inside it. A production-shaped web system may have an ingress controller calling a Nuxt frontend, the frontend calling a Node API, the API calling an external managed database and an internal Redis service, and all Pods querying cluster DNS.

Write those edges down with direction, port, protocol, and identity:

```text
ingress-controller -> frontend : TCP/3000
frontend           -> api      : TCP/3000
api                -> redis    : TCP/6379
api                -> db.example.com : TCP/5432
all selected pods  -> cluster DNS : UDP+TCP/53
```

This exercise often uncovers accidental coupling: a frontend directly querying a database, broad internet egress, or debug tools that quietly depend on unrestricted access. NetworkPolicy selects Pods and peers by labels and namespaces; stable labels therefore become security-sensitive API. Protect who can create or relabel Pods in controlled namespaces.

NetworkPolicy operates at layers 3 and 4. Standard policy cannot express “allow HTTP GET `/health` but deny `/admin`,” identify a DNS name reliably, or replace service-level authentication. Service meshes, API gateways, or application controls may enforce higher-layer rules, but add them only when the requirement warrants their complexity.

## 2. Start from default deny, then add explicit flows

A namespace-wide default deny establishes that no ingress or egress is allowed unless another policy permits it:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: web
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

Policies are additive. A Pod selected by this policy remains isolated for both directions until an allow policy contributes matching rules. Apply default deny in a test namespace first: DNS, telemetry, identity providers, package downloads, and external APIs are common hidden dependencies.

An API policy can permit traffic only from frontend Pods and allow DNS plus Redis egress:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allowed-flows
  namespace: web
spec:
  podSelector:
    matchLabels: { app: api }
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app: frontend }
      ports:
        - { protocol: TCP, port: 3000 }
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
    - to:
        - podSelector:
            matchLabels: { app: redis }
      ports:
        - { protocol: TCP, port: 6379 }
```

Verify the actual DNS labels in your cluster; CoreDNS labels vary by distribution. Also confirm the installed CNI supports and enforces NetworkPolicy. The API may accept policy objects even when the network implementation does nothing with them.

## 3. Understand selectors, directions, and reply traffic

A `podSelector` without a `namespaceSelector` selects Pods in the policy's namespace. To identify a peer in another namespace, combine both selectors in the same `from` or `to` item. Be careful with YAML list structure: two separate items mean logical OR, while selectors in one item are combined as AND.

Ingress isolation is evaluated at the destination; egress isolation is evaluated at the source. For a new connection to succeed, egress from the source and ingress to the destination must both permit it when both Pods are isolated. Return packets for an allowed connection are generally permitted automatically, but exact behavior can depend on the network implementation.

Ingress controllers frequently run in another namespace. Allowing “any Pod with label app=ingress” without constraining its namespace could permit an attacker to create a matching Pod elsewhere. Combine namespace and Pod selectors, and use immutable or governance-controlled namespace labels where possible.

## 4. Egress and external services need special care

Standard NetworkPolicy primarily addresses IPs, ports, Pods, and namespaces. Managed databases and third-party APIs may resolve to changing addresses, making `ipBlock` rules brittle. Some CNI implementations add DNS-aware or fully qualified domain name policies; otherwise route egress through a controlled gateway or use stable provider network ranges where appropriate.

Do not assume allowed network access means trusted access. Redis should require authentication where supported; databases should use TLS and individual credentials; APIs should authorize each request. Network policy limits reachability and blast radius, complementing—not replacing—identity controls.

Testing must include allowed and denied paths. Launch a temporary Pod with the same labels and service account as the caller, test DNS resolution and TCP connection, then test from a deliberately unauthorized Pod. Observe drops using CNI tooling, flow logs, or metrics. A policy that only passes the happy path may still be overly broad.

## Try this today

Create a namespace with three tiny workloads labeled `frontend`, `api`, and `data`. Confirm all three can initially connect. Apply a default-deny ingress-and-egress policy, then add policies allowing `frontend -> api:3000`, `api -> data:6379`, and DNS only. Prove each allowed edge works and prove `frontend -> data` fails. Save a dependency table beside the manifests so future reviewers can compare intent with policy.

## Resources

- [Kubernetes: Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [NetworkPolicy Editor by Cilium](https://editor.networkpolicy.io/)
