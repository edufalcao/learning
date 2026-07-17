---
title: "Kubernetes security for application teams"
day: 24
week: 5
weekName: "Platform Blueprint"
description: "Application teams do not need to administer every control-plane security feature, but they do control most workload-level risk: image contents, runtime\u2026"
tag: "Kubernetes"
---

# Day 24 — Kubernetes security for application teams

Application teams do not need to administer every control-plane security feature, but they do control most workload-level risk: image contents, runtime identity, permissions, secret handling, and Pod configuration. A senior engineer should make secure behavior the default in reusable manifests rather than depending on reviewers to catch every dangerous field.

## 1. Give workloads a narrow identity with RBAC

Every Pod receives a Kubernetes service account identity unless token mounting is disabled. That identity should not inherit broad permissions or use the namespace's default service account. If an API does not call the Kubernetes API, disable token mounting entirely:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web-api
  namespace: web
automountServiceAccountToken: false
```

When a service genuinely needs access, grant specific verbs on specific resource types in one namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: config-reader
  namespace: web
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["runtime-flags"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: web-api-config-reader
  namespace: web
subjects:
  - kind: ServiceAccount
    name: web-api
    namespace: web
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: config-reader
```

Avoid wildcard verbs and resources, and do not grant application service accounts permission to read all Secrets. Test authorization with `kubectl auth can-i get configmap/runtime-flags --as=system:serviceaccount:web:web-api -n web` and also test actions that should be denied.

## 2. Harden the Pod and container runtime

A secure Node image runs as a known non-root UID, drops Linux capabilities, prevents privilege escalation, and uses a read-only root filesystem where possible. Apply controls at both Pod and container levels:

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: api
      image: ghcr.io/acme/web-api@sha256:abc123
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
      volumeMounts:
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir: {}
```

Node frameworks or libraries may write caches and temporary files. Discover those paths in tests and mount only the required writable directories. Do not “fix” permission errors by running as root or making the whole filesystem writable.

Pod Security Admission can enforce the Kubernetes Pod Security Standards at namespace level. Aim for the `restricted` profile for normal application namespaces. Test enforcement in staging first, because older charts and operational agents may need changes. Exceptions should be isolated to dedicated namespaces and justified, not silently weaken every workload.

## 3. Secure the image supply chain

Pin deployments to digests, use minimal maintained base images, and remove compilers, package managers, test dependencies, and source maps not required at runtime. In Node projects, build production artifacts in one stage and copy only required output and production dependencies into the runtime stage. Run scanners against both dependencies and the final image; they reveal different classes of risk.

Image provenance asks more than “does it scan clean?” Sign images or publish build attestations, restrict production to trusted registries, and eventually enforce provenance with an admission policy. Protect the CI workflow and its OIDC permissions because a trusted build pipeline is part of the security boundary. A perfectly hardened Pod running an attacker-produced image is still compromised.

Use immutable references and define a patch process for base images. Digest pinning prevents surprise changes, so automation must deliberately open upgrades when a patched base is available.

## 4. Treat secrets as exposure minimization

A Kubernetes Secret is base64-encoded, not inherently encrypted. Cluster configuration may encrypt Secret data at rest, but application teams should still prevent values from entering Git, images, logs, command arguments, or broad environment dumps. Prefer an external secret manager integrated through a controller or workload identity where available.

Environment variables are convenient but are commonly exposed by debug output and cannot update inside a running process. Mounted secret files can be rotated by Kubernetes, although the Node process must reread them or restart safely. Choose based on application behavior rather than assuming one mechanism guarantees safety.

Never return configuration objects from diagnostics endpoints. Redact authorization headers, cookies, tokens, connection strings, and personal data from structured logs. Limit who can `exec` into Pods, read Secrets, or view logs. Secret rotation is an operational workflow: test replacement, overlap, reload, revocation, and rollback.

## Try this today

Harden one Node Deployment. Give it a dedicated service account with token automount disabled, add the restricted security context above, use a read-only root filesystem with an `emptyDir` at `/tmp`, and pin the image by digest. Run the service's smoke tests, then use `kubectl auth can-i` to prove its service account cannot list Secrets. Finally, inspect logs and health responses for accidental configuration leakage.

## Resources

- [Kubernetes: Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Kubernetes: Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
