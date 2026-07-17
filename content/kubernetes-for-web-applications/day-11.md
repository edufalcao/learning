---
title: "Services and internal application networking"
day: 11
week: 3
weekName: "Shipping Web Applications"
description: "Pods are disposable and their IP addresses change, so callers need a stable abstraction that represents a logical backend rather than an instance.\u2026"
tag: "Kubernetes"
---

# Day 11 — Services and internal application networking

Pods are disposable and their IP addresses change, so callers need a stable abstraction that represents a logical backend rather than an instance. Kubernetes Services provide that stable name and virtual endpoint, allowing frontend, API, and worker components to evolve independently.

## A Service selects a changing backend set

A ClusterIP Service receives a stable virtual IP and DNS name inside the cluster. Its selector matches Pod labels, and Kubernetes maintains EndpointSlices containing the currently eligible Pod addresses. Clients connect to the Service; cluster networking forwards each connection to one backend.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: web-api
  ports:
    - name: http
      port: 80
      targetPort: http
```

Here `port` is the Service port and `targetPort` resolves the named container port, such as 3000. Naming ports prevents duplicated numbers and makes intent clearer. A Service selector must match the Deployment’s Pod labels, not the Deployment metadata alone.

## DNS is the normal discovery mechanism

Within the same namespace, a frontend can call `http://api`. The complete name is `api.<namespace>.svc.cluster.local`, though code should rarely hard-code the cluster domain. A Service in another namespace can be reached as `api.backend` or by its fully qualified name.

Service DNS resolves infrastructure location, not application configuration. Keep the base URL configurable so the same image works locally and in each cluster. For server-side Node code:

```js
const apiBase = process.env.API_BASE_URL ?? 'http://api';
const response = await fetch(`${apiBase}/v1/products`, {
  signal: AbortSignal.timeout(2000)
});
if (!response.ok) throw new Error(`API returned ${response.status}`);
```

Browser JavaScript cannot normally resolve cluster-internal names. A Nuxt server may call the internal Service during server rendering, while browser requests must use a public route or same-origin proxy.

## Readiness controls membership

EndpointSlices normally include only Pods considered ready. When a readiness probe fails, Kubernetes removes that Pod from ordinary Service routing without necessarily restarting it. This is the key link between health checks and safe traffic management.

A Service with no endpoints usually indicates a selector mismatch or no ready Pods. Diagnose with `kubectl get service api -o yaml`, `kubectl get endpointslice -l kubernetes.io/service-name=api`, and `kubectl get pods --show-labels`. If endpoints exist, test DNS, ports, NetworkPolicies, and application binding. The app must listen on `0.0.0.0`, not only loopback.

## Service types solve different exposure problems

ClusterIP is the default for internal dependencies. NodePort exposes a port on every node and is usually an implementation building block or development convenience. LoadBalancer asks an integration to provision an external load balancer. ExternalName returns a DNS alias and provides no proxying or health checking.

For web applications, prefer ClusterIP behind Ingress or Gateway so HTTP routing, certificates, and a shared load balancer stay centralized. Do not make an internal database publicly reachable merely because `type: LoadBalancer` is easy to add.

### Connections are balanced, not individual requests

Service routing normally chooses a backend when a connection is established. HTTP keep-alive, HTTP/2 multiplexing, WebSockets, and database pools can therefore keep traffic on one Pod longer than a simple request-by-request model suggests. A small number of long-lived connections may distribute unevenly even when the Service is functioning correctly.

Do not solve this immediately with client affinity, which can worsen hotspots and complicate replacement. First measure connection patterns and configure reasonable keep-alive, maximum connection age, and drain behavior at the client or proxy. If the application relies on sticky in-memory sessions, externalize the session instead. A stable Service endpoint removes Pod identity from discovery; the application should preserve that independence at the protocol layer too.

## Try this today

Deploy two API replicas and create the Service above. From a temporary `node:22` Pod, resolve `api` with `getent hosts api` if available and fetch it repeatedly. Compare the Service address with EndpointSlice addresses. Break the selector, observe the empty backend set, then repair it. Finally, mark one Pod unready and watch it disappear from eligible endpoints.

## Resources

- [Kubernetes: Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes: DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
