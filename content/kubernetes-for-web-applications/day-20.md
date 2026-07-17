---
title: "Observability for application developers"
day: 20
week: 4
weekName: "Reliable Operations"
description: "Observability is the ability to explain system behavior from emitted evidence, especially when the failure was not predicted. For a Node web service, a\u2026"
tag: "Kubernetes"
---

# Day 20 — Observability for application developers

Observability is the ability to explain system behavior from emitted evidence, especially when the failure was not predicted. For a Node web service, a small coherent set of metrics, structured logs, and traces is more useful than hundreds of unowned signals.

## Metrics quantify trends and thresholds

Metrics are numeric time series suited to rates, distributions, capacity, and alerting. Start with request count by route template, status class, and method; request-duration histograms; in-flight work; event-loop lag; CPU; resident memory; and dependency latency/errors. Never label metrics with request IDs, raw URLs, user IDs, or other unbounded values because high cardinality can overwhelm the metrics system.

Prometheus commonly scrapes application and platform metrics; Grafana queries and presents them. Kubernetes does not install a complete monitoring stack by default. Define who owns scrape configuration, retention, dashboard changes, and alerts.

## Logs explain discrete events

Emit structured JSON to stdout with timestamp, severity, service, environment, release digest, trace ID, and stable event name. Log unexpected failures with stack information internally, but return sanitized error responses. Use route templates such as `/users/:id`, not sensitive concrete paths.

Avoid duplicate logging at every layer. One request-completion event can capture status and duration; specific domain events capture meaningful decisions. Sampling may be appropriate for high-volume success logs, while errors and security-relevant events require deliberate retention. Central aggregation is essential because Pods disappear.

## Traces connect distributed work

A trace represents a request or job as spans across services and dependencies. OpenTelemetry provides vendor-neutral APIs, SDKs, semantic conventions, and exporters for traces, metrics, and logs. Instrument inbound HTTP, outbound requests, database calls, and queue publish/consume boundaries, while avoiding secret-bearing attributes.

Propagate W3C Trace Context headers through trusted HTTP boundaries and message metadata. Include the active trace ID in logs so an operator can move from an aggregate latency spike to a representative trace and then to relevant application events. Sampling decisions should preserve enough errors and slow requests to diagnose them without collecting every operation indefinitely.

## SLOs turn telemetry into priorities

An SLO states a measured reliability objective, such as 99.9% of eligible API requests succeeding over 28 days, with an explicit indicator and exclusions. The error budget is the allowed unreliability. Alerts based on rapid error-budget consumption generally align better with user impact than alerts for every transient CPU spike.

A practical dashboard for one Node API should show traffic, error rate, p50/p95/p99 latency, saturation, replica/readiness state, rollout version, event-loop lag, memory, and top downstream failures. Every panel should support a decision. Link dashboards to a runbook and annotate releases so behavior changes have context.

### Instrumentation has reliability and cost limits

Telemetry code runs in the request path. Export asynchronously, bound queues and memory, and decide whether to drop telemetry rather than block user requests when a collector is unavailable. Configure exporter timeouts and observe dropped spans or log batches. A monitoring outage should not normally become an application outage.

Control volume at creation. Use histogram buckets that match meaningful latency thresholds, aggregate route labels, and sample high-volume traces. Retention should reflect diagnostic and compliance needs, and access should reflect the sensitive content telemetry may contain. Review instrumentation during API changes so renamed routes and error codes do not silently break dashboards or SLO calculations.

## Try this today

Add a request ID and OpenTelemetry-compatible trace context to one Node request path. Expose a Prometheus histogram and counter using route templates, emit one structured completion log, and generate traffic with successes, errors, and a slow dependency. Build a single dashboard view, then write one availability SLI and an alert condition tied to user impact.

## Resources

- [OpenTelemetry JavaScript documentation](https://opentelemetry.io/docs/languages/js/)
- [Prometheus instrumentation practices](https://prometheus.io/docs/practices/instrumentation/)
