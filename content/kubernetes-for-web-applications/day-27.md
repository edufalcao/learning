---
title: "Managed Kubernetes and cloud primitives"
day: 27
week: 5
weekName: "Platform Blueprint"
description: "Managed Kubernetes removes much of the control-plane toil, but it does not turn a cluster into a complete application platform. Senior engineers still\u2026"
tag: "Kubernetes"
---

# Day 27 — Managed Kubernetes and cloud primitives

Managed Kubernetes removes much of the control-plane toil, but it does not turn a cluster into a complete application platform. Senior engineers still need to understand the cloud resources behind Services, Ingress, storage, identity, and scaling because those integrations determine reliability, security, and cost.

## 1. Know what the provider manages

In EKS, GKE, or AKS, the provider operates the API server and etcd, handles control-plane availability, and usually offers integrated upgrades and backups. Your team still owns application manifests, workload security, node strategy unless using a serverless mode, add-ons, policies, observability, and incident response.

The shared-responsibility line is easy to misread. A healthy managed control plane does not prevent:

- unschedulable Pods caused by insufficient node capacity;
- an incompatible CNI or ingress-controller upgrade;
- overly broad RBAC or leaked application credentials;
- a bad Deployment, destructive migration, or exhausted database;
- unexpected egress, load-balancer, log-ingestion, and storage costs.

Record Kubernetes and add-on versions, define an upgrade cadence, and test upgrades in non-production. “Managed” should reduce undifferentiated work, not remove operational ownership.

## 2. Kubernetes objects often provision billable cloud resources

A `Service` of type `LoadBalancer` is an infrastructure request. A cloud controller may create a load balancer, public IP, health checks, and firewall rules. An Ingress or Gateway may then configure listeners and routes. DNS and certificate controllers can automate records and TLS, but each controller needs carefully scoped cloud permissions.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ingress-public
  annotations:
    # Exact annotation is provider/controller specific.
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
spec:
  type: LoadBalancer
  selector:
    app: ingress-controller
  ports:
    - name: https
      port: 443
      targetPort: 8443
```

Prefer one shared ingress or Gateway where isolation requirements allow it, rather than one load balancer per small service. Use `external-dns`-style automation and cert-manager deliberately: automation increases consistency, but a compromised controller can alter a large DNS zone or request certificates broadly.

PersistentVolumeClaims similarly trigger provider behavior through a StorageClass. Understand zone binding, expansion, snapshots, performance tiers, and reclaim policy. A zonal disk can constrain Pod scheduling; deleting a claim with the wrong reclaim policy can destroy data.

## 3. Use workload identity instead of long-lived cloud keys

Cloud providers offer a way to map a Kubernetes ServiceAccount to a cloud IAM principal. The mechanism differs—such as IAM Roles for Service Accounts or Workload Identity—but the design is consistent: a Pod receives short-lived, scoped credentials without storing an access key in a Secret.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: invoice-worker
  namespace: production
  annotations:
    # Example only; use your provider's identity integration.
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/invoice-worker
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: invoice-worker
spec:
  template:
    spec:
      serviceAccountName: invoice-worker
      containers:
        - name: worker
          image: ghcr.io/acme/invoice-worker@sha256:abc123
```

Grant that cloud role only the specific queue, bucket prefix, or secret it needs. Keep Kubernetes RBAC separate from cloud IAM: one governs access to the Kubernetes API; the other governs provider resources.

## 4. Compare platforms using workload needs and total ownership

Do not choose managed Kubernetes merely because it is the most flexible option. Compare at least three paths:

- **Local Kubernetes:** ideal for learning and some integration tests; not a production availability strategy.
- **Managed Kubernetes:** useful for multiple services, specialized controllers, portability requirements, or teams that can own a platform.
- **Serverless containers/application platforms:** often better for a small stateless Node service when rapid delivery and low operational burden matter more than control.

Estimate total cost, not just compute. Include cluster fees, idle node headroom, load balancers, NAT and cross-zone traffic, disks and snapshots, observability ingestion, engineering time, and incident burden. Autoscaling reduces some waste but cannot eliminate baseline capacity or poorly designed traffic paths.

For a Nuxt application, separate static assets onto an object store/CDN when appropriate. Keep APIs close to their database to reduce latency and egress. Measure whether Kubernetes-only capabilities—custom networking, controllers, scheduling, or a common multi-service platform—actually create product value.

## Try this today

Pick one cloud provider and sketch the complete path for `https://app.example.com/api`: DNS record, certificate, public load balancer, ingress/Gateway, Service, Pod, and managed database. Beside each component, name its owner, failure signal, monthly cost driver, and credential boundary. Then compare that design with the provider’s serverless container offering using five criteria: deployment effort, scaling, networking, observability, and estimated idle cost. Write a short recommendation with the conditions that would cause you to revisit it.

## Resources

- [Kubernetes: Cloud Controller Manager](https://kubernetes.io/docs/concepts/architecture/cloud-controller/)
- [Kubernetes: Service type LoadBalancer](https://kubernetes.io/docs/concepts/services-networking/service/#loadbalancer)
