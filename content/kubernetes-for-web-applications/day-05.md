---
title: "Dockerfiles for production Node.js services"
day: 5
week: 1
weekName: "Container Foundations"
description: "A production Dockerfile should produce a small, deterministic runtime artifact, not reproduce a developer workstation. For Node and Nuxt, the key is\u2026"
tag: "Kubernetes"
---

# Day 5 — Dockerfiles for production Node.js services

A production Dockerfile should produce a small, deterministic runtime artifact, not reproduce a developer workstation. For Node and Nuxt, the key is separating dependency/build work from the runtime, preserving cache efficiency, and making privilege and secret boundaries explicit.

## Multi-stage builds separate concerns

Use one stage with compilers and development dependencies, then copy only runtime output into a minimal final stage. A Nuxt 3 production build emits a self-contained `.output` tree that can run with Node:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN useradd --system --uid 10001 --create-home app
COPY --from=build --chown=app:app /app/.output ./.output
USER 10001
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Pin the Node major version and commit the lockfile. For stricter reproducibility, pin the base image digest and use an automated dependency process to update it.

## Cache dependencies deliberately

Docker rebuilds from the first changed instruction onward. Copying `package.json` and the lockfile before application source allows `npm ci` to remain cached while source files change. A BuildKit cache mount preserves the package download cache without baking it into an image layer.

Use `.dockerignore` to exclude `.git`, `node_modules`, build output, coverage, local environment files, and editor data. Sending a smaller build context is faster and reduces accidental secret exposure. Do not copy host `node_modules`; native packages may target the wrong OS or CPU architecture.

## Runtime images should be boring and unprivileged

Choose a maintained base that provides the compatibility and debugging surface you require. Alpine is small but uses musl rather than glibc and can complicate native Node dependencies. A Debian slim image is often a pragmatic default. “Distroless” images reduce utilities and attack surface but require stronger external debugging practices.

Run as a fixed non-root UID, listen above port 1024, and avoid installing shells or package managers in the final image unless needed. The application should write logs to stdout/stderr and treat its filesystem as disposable. Kubernetes can then enforce `runAsNonRoot`, a read-only root filesystem, and dropped capabilities.

## Secrets and configuration belong outside the build

`ARG` and `ENV` values can appear in image metadata or build history. Never use them for registry tokens, private npm credentials, or runtime secrets. With BuildKit, mount build secrets temporarily—for example, an npm configuration file—so they never enter a layer. Rotate any secret that was copied into a build context, even if a later instruction deleted it.

Public Nuxt configuration may be compiled into browser assets and is not secret. Runtime server configuration should be read from environment variables or mounted files. Validate required values at process startup so a malformed deployment fails visibly rather than serving partially configured traffic.

### Make the image observable and testable

Add OCI labels for source repository, revision, and creation metadata so operators can trace an artifact without relying on its tag. Expose a non-secret application version from the build through a small `/version` response or startup log. This should identify the Git revision used to create the image, while the deployment system records the final registry digest.

Test the final stage, not only `npm run build` on the host. Start it as the configured user, with the root filesystem read-only and only documented environment variables present. Exercise HTTP startup and SIGTERM shutdown. Scan the final image rather than the builder stage, but also review build dependencies because compromised tooling can affect produced output even when it is absent at runtime.

## Try this today

Containerize a Nuxt or Node service with the Dockerfile pattern above. Build twice after changing only one source file and compare cached steps. Run `docker run --rm -p 3000:3000 --read-only --tmpfs /tmp <image>`, verify the process user with `docker exec`, and confirm no `.env` or development dependency exists in the final filesystem.

## Resources

- [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/)
- [Nuxt deployment documentation](https://nuxt.com/docs/getting-started/deployment)
