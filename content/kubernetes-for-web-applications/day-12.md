---
title: "Public traffic: Ingress and Gateway concepts"
day: 12
week: 3
weekName: "Shipping Web Applications"
description: "Public HTTP traffic needs more than a Service: it needs an implementation that accepts connections, terminates TLS, and routes hostnames or paths to\u2026"
tag: "Kubernetes"
---

# Day 12 — Public traffic: Ingress and Gateway concepts

Public HTTP traffic needs more than a Service: it needs an implementation that accepts connections, terminates TLS, and routes hostnames or paths to internal backends. Kubernetes separates route configuration from the data-plane controller that actually handles packets.

## Ingress requires a controller

An Ingress is an API object containing HTTP host and path rules. It does nothing unless an Ingress controller watches it and configures a proxy or cloud load balancer. Installing a cluster does not guarantee a controller exists; local distributions vary.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web
spec:
  ingressClassName: nginx
  tls:
    - hosts: [app.example.test]
      secretName: app-tls
  rules:
    - host: app.example.test
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

The controller’s external address receives traffic; the rule sends `/api` to the ClusterIP Service. Controller-specific annotations can add behavior, but too many make manifests nonportable and difficult to review.

## TLS terminates at an explicit boundary

The Ingress controller commonly terminates TLS using a certificate stored in a Secret. A certificate controller such as cert-manager can automate issuance and renewal. Traffic from the controller to the Service may remain plain HTTP inside the cluster or use TLS again, depending on threat model and platform support.

Decide where the original scheme and client address are trusted. Reverse proxies normally add `Forwarded` or `X-Forwarded-*` headers. Configure Node’s proxy trust only for known proxy hops; blindly trusting headers lets direct clients spoof protocol or IP. Redirect HTTP to HTTPS at the edge and ensure secure cookies are generated correctly behind the proxy.

## Gateway API offers clearer ownership

Gateway API separates infrastructure from application routing. A `GatewayClass` identifies an implementation, a `Gateway` describes listeners owned by a platform team, and an `HTTPRoute` describes application routes that attach with explicit permission. This supports shared gateways and cross-namespace delegation more cleanly than a large collection of controller annotations.

Ingress remains widely deployed and sufficient for basic host/path routing. Gateway API is the stronger default when your chosen provider supports the required features and the organization needs role separation or richer routing. The concrete capabilities still depend on the installed controller; API objects alone do not create a load balancer.

## Routing must preserve application semantics

Clarify whether `/api` is preserved or stripped before reaching Node. Different controllers and rewrite settings behave differently. Prefer applications that can operate under a configured base path or use separate hosts such as `api.example.com` when that simplifies cookies, generated URLs, and observability.

Set request and upstream timeouts deliberately. WebSockets, streaming responses, large uploads, and server-sent events may need controller configuration. Health checks for the proxy backend should use readiness behavior, while user-facing error handling should distinguish edge failures from application responses.

### Treat routing configuration as an API contract

Hostnames, paths, redirects, header handling, body-size limits, and timeouts affect clients and should be reviewed like application interfaces. Test exact and prefix matching, trailing slashes, encoded paths, and query strings. A broad `/` route can unintentionally capture traffic intended for another component, while an incorrect rewrite may bypass application authorization assumptions.

Expose a clear edge error identity so operators can distinguish a proxy-generated 502 or 504 from a Node response. Include ingress metrics and access logs in the request investigation path, with privacy controls. During migrations between controllers, run conformance and application-level tests because annotation names and subtle routing behavior rarely transfer one-for-one.

## Try this today

Install or enable one local Ingress controller. Map `app.example.test` to its address in your hosts file, route `/` to Nuxt and `/api` to Node, and verify both with `curl -v`. Add a locally trusted or self-signed TLS certificate, inspect the handshake, and confirm the application sees the intended host, scheme, and path.

## Resources

- [Kubernetes: Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Gateway API documentation](https://gateway-api.sigs.k8s.io/)
