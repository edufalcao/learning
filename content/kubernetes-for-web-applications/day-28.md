---
title: "Common failure modes and anti-patterns"
day: 28
week: 5
weekName: "Platform Blueprint"
description: "Kubernetes failures are often design failures expressed through YAML. Senior engineers create more leverage by removing unnecessary complexity and\u2026"
tag: "Kubernetes"
---

# Day 28 — Common failure modes and anti-patterns

Kubernetes failures are often design failures expressed through YAML. Senior engineers create more leverage by removing unnecessary complexity and clarifying ownership than by memorizing another controller. The recurring anti-patterns below are signals that the platform is compensating for weak application or organizational boundaries.

## 1. Treating a Pod like a long-lived VM

A Pod is replaceable. Its name, IP, writable container filesystem, and node placement are temporary. SSH-style patching, writing important files beside the application, or depending on one replica’s local memory fights the reconciliation model.

A Node service should externalize durable state and terminate cleanly:

```ts
import http from "node:http";

let ready = true;
const server = http.createServer(async (req, res) => {
  if (req.url === "/ready") {
    res.writeHead(ready ? 200 : 503).end();
    return;
  }
  // Handle request without assuming this replica owns durable session state.
  res.writeHead(200).end("ok");
});

server.listen(3000);

process.on("SIGTERM", () => {
  ready = false;
  server.close((error) => process.exit(error ? 1 : 0));
  setTimeout(() => process.exit(1), 25_000).unref();
});
```

Use a PersistentVolume only when the workload genuinely needs filesystem semantics. For uploads, object storage is usually easier to scale and back up. For sessions, use signed cookies or an external store. Debug through logs, metrics, traces, `kubectl debug`, and reproducible images—not manual mutation.

## 2. Confusing encoded configuration with secret management

A Kubernetes Secret is base64-encoded and access-controlled through the API; it is not automatically encrypted end to end, safe to commit, or invisible to a process that receives it. This is unsafe:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: production-db
stringData:
  DATABASE_URL: postgres://admin:password@db/prod
```

The syntax is valid; committing it to Git is not. Prefer an external secret manager with workload identity and a controller or CSI integration. If encrypted secrets are stored in Git, define who can decrypt them, how keys rotate, and how access is audited. Limit Secret reads with namespace-scoped RBAC, avoid exposing values in command-line arguments and logs, and restart or reload workloads intentionally when values rotate.

Also keep ordinary configuration disciplined. A giant shared ConfigMap couples unrelated services and creates accidental blast radius. Give each application a small, validated configuration contract.

## 3. Splitting into microservices without independent reasons

Kubernetes makes deploying many services possible; it does not make distributed systems cheap. Each new service introduces versioning, network failure, authentication, observability, deployment coordination, on-call ownership, and data consistency problems.

A modular Node monolith is often a stronger starting point:

```ts
// Explicit internal boundaries without a network hop.
export interface BillingPort {
  createInvoice(orderId: string): Promise<{ invoiceId: string }>;
}

export class CheckoutService {
  constructor(private readonly billing: BillingPort) {}
  async complete(orderId: string) {
    return this.billing.createInvoice(orderId);
  }
}
```

Extract a service when there is evidence: independent scaling, distinct security isolation, a separate release cadence, specialized runtime needs, or clear team ownership. “We use Kubernetes” is not evidence. A queue-backed worker can be a useful separate workload while still sharing a repository and release process.

## 4. Running stateful systems without accepting operational ownership

A database Deployment plus a PVC is not a database service. Production ownership includes replication, point-in-time recovery, tested restores, upgrades, failover, capacity, encryption, monitoring, and an on-call response. Operators automate procedures, but they do not supply missing expertise or accountability.

Use managed databases and queues by default for a small product unless cost, regulation, performance, or specialized capability justifies in-cluster ownership. If you do run stateful software, define recovery point and recovery time objectives, schedule restore drills, use Pod disruption and topology controls, and understand storage-zone behavior.

Other warning signs deserve the same scrutiny: privileged containers used to avoid fixing permissions; unlimited CPU/memory; `latest` image tags; broad `cluster-admin` access; one giant namespace; liveness probes that call every dependency and trigger restart storms; and Helm templates so abstract that nobody can predict the rendered manifests.

Complexity needs a budget. Every controller, custom resource, policy engine, and service mesh should have an owner, upgrade path, failure model, and measurable benefit.

## Try this today

Audit one existing web application or a representative design. Make four columns: “VM assumption,” “secret exposure,” “unnecessary distribution,” and “stateful ownership.” Add every concrete example you find, then choose one high-leverage correction. For a local exercise, run the Node server above in a Deployment with two replicas, send requests continuously, and delete one Pod. Confirm traffic continues and observe graceful termination during `kubectl rollout restart deployment/<name>`. Record any state or shutdown assumption that breaks.

## Resources

- [Kubernetes: Configuration best practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Kubernetes: Considerations for large clusters](https://kubernetes.io/docs/setup/best-practices/cluster-large/)
