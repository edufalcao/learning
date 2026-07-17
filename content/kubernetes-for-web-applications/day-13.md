---
title: "Configuration, secrets, and the twelve-factor boundary"
day: 13
week: 3
weekName: "Shipping Web Applications"
description: "One image should move through environments while configuration changes around it. Kubernetes provides ConfigMaps and Secrets as delivery mechanisms,\u2026"
tag: "Kubernetes"
---

# Day 13 — Configuration, secrets, and the twelve-factor boundary

One image should move through environments while configuration changes around it. Kubernetes provides ConfigMaps and Secrets as delivery mechanisms, but application teams still own validation, exposure risk, and a workable rotation strategy.

## Separate build output from deploy-time configuration

Configuration includes service URLs, feature flags, log levels, and tuning values that differ by environment. Secrets include credentials, signing keys, and tokens whose disclosure has security impact. Neither belongs in the image, source repository, or browser bundle.

Nuxt makes this boundary especially important: values exposed through public runtime configuration can reach the browser. Server-only credentials must remain in server runtime configuration. Treat every value shipped to client JavaScript as public, regardless of its environment-variable name.

## Environment variables are simple but static

ConfigMaps and Secrets can populate individual environment variables or all keys with `envFrom`:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: api-database
        key: url
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: api-config
        key: logLevel
```

Environment values are captured when the container starts. Updating the source object does not change existing process environments, so a rollout is required. Also, environment variables may appear in diagnostic output and child processes. Never dump the complete environment into logs.

Validate configuration once at startup with a schema. A Node service should fail with a precise message for a missing variable, invalid URL, or unsupported enum. Avoid silently defaulting security-relevant values such as cookie signing secrets.

## Mounted files support updates with caveats

ConfigMaps and Secrets can be mounted as files. Kubelet updates projected volume contents eventually, which can support certificate or policy reloads. Mounting a single key with `subPath` prevents these automatic updates. The application must also watch or periodically reread the file; a process that loads it only at startup still needs restarting.

Use immutable configuration names containing a content hash when predictable rollout and rollback matter. Update the Pod template to reference the new name, triggering a Deployment rollout. This avoids invisible drift and ensures old revisions keep their original configuration identity.

## A Kubernetes Secret is not a vault

Secret data in YAML is base64 encoded, not encrypted by that fact. Anyone who can read the Secret through the API can recover it. Clusters should encrypt Secret data at rest, and RBAC should restrict access by namespace and service account. Avoid broad list/watch permission because it exposes every matching value.

For mature environments, an external secret manager plus CSI driver or synchronizing operator can provide centralized rotation and cloud identity. The delivered credential still exists in process memory or a mounted file, so least privilege and short lifetimes remain necessary. Rotation must be tested through both credential overlap and connection-pool renewal.

### Configuration changes are releases

A log-level change may be low risk, but a feature flag, upstream URL, or pool size can alter user behavior as much as code. Give configuration an owner, schema, review path, and revision identity. Include the non-secret configuration version in deployment metadata and telemetry so incidents can correlate behavior with a change.

Decide whether each setting is read once, dynamically reloaded, or requires a rollout. Dynamic reload adds code paths that need validation and rollback; restarting through a Deployment may be simpler and more observable. Avoid configuration that changes independently on every request unless the external control plane has defined availability, caching, and failure semantics.

## Try this today

Create a ConfigMap for log level and a Secret for a disposable API token using command-line input, not a committed manifest. Inject both into a Node Deployment and validate them at startup. Change each value and observe that environment-based Pods do not update automatically; perform a rollout and verify the new configuration without printing the secret.

## Resources

- [Kubernetes: Configure a Pod with ConfigMaps](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)
- [Kubernetes: Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
