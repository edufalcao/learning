---
title: "Multi-service applications with Compose"
day: 7
week: 2
weekName: "Kubernetes Fundamentals"
description: "Compose is a compact way to model a local web topology: application processes, data dependencies, networks, storage, and configuration in one\u2026"
tag: "Kubernetes"
---

# Day 7 — Multi-service applications with Compose

Compose is a compact way to model a local web topology: application processes, data dependencies, networks, storage, and configuration in one reproducible file. Its real value is not imitating Kubernetes syntax; it is making service boundaries and startup assumptions explicit.

## Services discover each other by name

Compose creates a default network and DNS records for service names. An API connects to `postgres:5432`, not `localhost:5432`, because localhost inside the API container refers to itself. Only publish ports that the host needs; service-to-service traffic can stay on the internal network.

```yaml
services:
  api:
    build: .
    environment:
      DATABASE_URL: postgres://app:dev@db:5432/app
    ports: ["3000:3000"]
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: app
    volumes: ["db-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  db-data: {}
```

The password is acceptable only as disposable local configuration. Do not commit real credentials.

## Startup order is not readiness

`depends_on` can order startup and, with a health condition, wait for a dependency’s health check. It does not make the application resilient to database restarts after startup. The API still needs bounded retries with backoff, connection timeouts, and clear failures.

Design as though dependencies can disappear at any time. Database migrations should be an explicit job or command rather than a race performed independently by every API replica. Cache unavailability should have an intentional policy: fail requests, degrade a feature, or fall back—never wait forever.

## Volumes preserve only the state you choose

The named volume in the example outlives the database container. `docker compose down` preserves it; `docker compose down --volumes` removes it. This is useful for local development but does not provide backup, replication, encryption policy, or recovery testing.

Bind mounts are helpful for live source editing but reduce parity with the immutable production image. Maintain a deliberate development override rather than turning the base topology into a collection of host-specific assumptions. Periodically run the exact built image without source mounts.

## Compose exposes orchestration requirements

Compose can restart containers and coordinate a single-machine topology, but it does not provide a distributed scheduler, multi-node rescheduling, rolling Deployments, cluster Services, or Kubernetes-style policy controls. That limitation is useful: it reveals what an orchestrator adds.

Translate concepts, not YAML. A Compose service may become a Deployment and Service; a one-off migration becomes a Job; configuration becomes ConfigMaps and Secrets; a named volume may become a PersistentVolumeClaim or, preferably for production databases, a managed service. The application’s network and failure contracts should remain the same.

### Keep local parity purposeful

Parity does not mean running every production infrastructure component on a laptop. It means preserving the behaviors that affect application correctness: immutable images, service-name discovery, runtime configuration, schema migrations, health checks, and dependency failure. A lightweight local Postgres container can represent a managed database’s SQL contract, but it cannot validate cloud identity, network latency, backup, or failover.

Use pinned image versions and committed initialization scripts so teammates get the same topology. Add profiles or override files for optional tools rather than starting an enormous stack by default. In CI, launch the Compose project with a unique project name, wait on health, run integration tests, and always collect logs before teardown. This turns the file into an executable application contract rather than only a developer convenience.

## Try this today

Run the example with a small Node API that executes `SELECT now()`. Verify the API resolves `db`, then restart only the database and observe how the connection pool recovers. Remove host port publication from the database and confirm the API can still connect. Destroy and recreate containers once with, and once without, deleting the named volume.

## Resources

- [Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/)
- [Compose Specification](https://compose-spec.io/)
