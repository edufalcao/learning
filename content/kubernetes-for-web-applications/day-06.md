---
title: "Running containers like an operator"
day: 6
week: 2
weekName: "Kubernetes Fundamentals"
description: "Building an image is only half the contract; operating it means understanding exactly how the process starts, stops, emits evidence, and uses host\u2026"
tag: "Kubernetes"
---

# Day 6 — Running containers like an operator

Building an image is only half the contract; operating it means understanding exactly how the process starts, stops, emits evidence, and uses host resources. Practicing these mechanics locally makes later Kubernetes failures recognizable rather than opaque.

## Lifecycle, exit status, and signals

A container runs while its configured main process runs. Exit code `0` normally means deliberate completion; nonzero codes indicate failure by convention. If PID 1 crashes, the container stops regardless of whether background child processes remain useful. A restart policy may start a new instance, but it does not repair the underlying cause.

Use the exec form of `CMD` so Node directly receives signals:

```dockerfile
CMD ["node", "server.mjs"]
```

Shell form introduces `/bin/sh -c`, which can interfere with signal delivery. On SIGTERM, stop accepting requests, allow in-flight work to complete within a deadline, close database clients, and exit. Test this behavior; orchestrators eventually send SIGKILL when the grace period expires.

## Logs are an external data stream

Applications should write structured events to stdout and errors to stderr. The container runtime captures those streams; a logging agent can later ship them centrally. Files written inside the container are harder to collect and disappear with the writable layer.

A useful JSON log includes timestamp, severity, service, request or trace ID, route, duration, and a stable error code. Do not log credentials, cookies, authorization headers, or complete request bodies. `docker logs --since 10m --follow <container>` is the local equivalent of following a workload’s current evidence, but remember that a restarted container may have previous-instance logs elsewhere.

## Ports, mounts, and runtime configuration

Publishing `-p 8080:3000` maps host port 8080 to the container’s port 3000. `EXPOSE 3000` is documentation; it does not publish anything. Bind mounts map a specific host path and are useful for development. Named volumes are managed by Docker and suit persistent local data. Neither should be used to inject an entire host home directory into a production container.

Environment variables are convenient configuration, but they are visible through process and runtime inspection. Use them for ordinary settings and use secret-specific mechanisms for credentials. Validate and normalize them:

```js
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(port) || port < 1) throw new Error('Invalid PORT');
```

## Debug from outside inward

Start with `docker ps -a` for state and exit code, then inspect logs and `docker inspect`. Confirm the command, environment, mounts, health, and port bindings. Use `docker exec` only if the container is running. For an image that exits immediately, override the entrypoint to a shell or start a separate diagnostic container from the same image.

Avoid “fixing” a running container by installing packages or editing files. That creates unrecorded state that disappears on replacement. Reproduce the failure, update source or image construction, rebuild, and redeploy.

### Restart policy is not resilience

A restart can recover from a transient process crash, but repeated restarts consume resources and may make a dependency outage worse. Establish what exit codes mean, whether startup performs migrations, and whether retries are bounded. A worker that loses a job when terminated needs queue acknowledgement semantics; an HTTP API needs upstream timeouts and idempotent retry behavior. Container lifecycle controls cannot invent those guarantees.

Measure shutdown under load. Docker sends SIGTERM and waits before forcing termination, which approximates—but does not fully reproduce—an orchestrated rollout. Track in-flight requests, rejected connections, unfinished background work, and exit duration. The result informs Kubernetes readiness changes and termination grace periods rather than leaving them at arbitrary defaults.

## Try this today

Run your Day 5 image with a deliberately invalid environment variable and inspect its exit status and logs. Run it correctly, send `docker stop`, and time graceful shutdown. Test port publishing and a read-only root filesystem. Finally, start it with a missing runtime file and write a five-step diagnosis based only on inspectable evidence.

## Resources

- [Docker: Start containers automatically](https://docs.docker.com/engine/containers/start-containers-automatically/)
- [Node.js HTTP server close documentation](https://nodejs.org/api/http.html#serverclosecallback)
