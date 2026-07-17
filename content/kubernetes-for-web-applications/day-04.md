---
title: "Container images, layers, and registries"
day: 4
week: 1
weekName: "Container Foundations"
description: "An image is the deployable supply-chain artifact for a containerized web app. Treating it as immutable, addressable content\u2014rather than \u201cwhatever the\u2026"
tag: "Kubernetes"
---

# Day 4 — Container images, layers, and registries

An image is the deployable supply-chain artifact for a containerized web app. Treating it as immutable, addressable content—rather than “whatever the latest build produced”—is foundational to reproducible releases and reliable rollback.

## OCI images are content-addressed bundles

An OCI image consists of a manifest, configuration, and ordered filesystem layers. Each component is identified by a cryptographic digest. The configuration records metadata such as the default command, environment, working directory, and layer history; the manifest ties it to a particular platform such as `linux/amd64`.

Layers are immutable and reusable. If two images share a base layer, a registry and local runtime can avoid transferring it twice. Layer order matters for build performance: stable dependency files should be copied and installed before frequently changing source code so ordinary edits do not invalidate dependency cache layers.

## Tags are movable; digests are immutable

`registry.example.com/api:1.4.0` is a human-friendly tag that points to a manifest. A registry can move that tag. `registry.example.com/api@sha256:...` identifies exact content. Deploying by digest ensures that every node retrieves the same artifact and makes a rollback deterministic.

Use unique tags—often a Git commit SHA—for traceability, but promote and deploy the digest produced by the build. Avoid relying on `latest`: it hides release identity, interacts confusingly with pull policies, and makes incident reconstruction harder. The version exposed by your `/version` endpoint should correspond to build metadata, not an arbitrary mutable tag.

## Registries distribute and govern artifacts

A registry stores image manifests and blobs and exposes APIs used by builders and runtimes. Production concerns include authentication, retention, vulnerability scanning, geographic availability, and rate limits. Kubernetes nodes need credentials or workload identity to pull private images; build pipelines need narrowly scoped permission to push.

Image distribution occurs on each node. Large images extend cold-start and scale-up time, especially when a new node has no cached layers. Prefer small runtime images and exclude source maps, tests, caches, local secrets, and development dependencies unless the runtime genuinely needs them.

## Build once, promote the same artifact

Environment-specific image builds create drift. Build and scan once, then promote the same digest from test to staging and production while injecting environment configuration at runtime. This separates code identity from operational configuration.

A useful release record includes source commit, build job, image digest, software bill of materials, scan result, and deployment revision. Signing and provenance attestations can later let admission policy verify that an image came from the approved pipeline. These controls matter more than a perfect Dockerfile style guide because they answer what code is actually running.

### Multi-platform images require deliberate testing

A manifest index can point to different image manifests for `linux/amd64` and `linux/arm64` under one tag. The runtime selects the matching platform. This is convenient for developers on ARM laptops and production on x86 nodes, but only if every variant is built from the same source and tested. Native Node add-ons are a common source of architecture-specific failures.

Do not assume a local build automatically supplies the production platform. Use a multi-platform builder or explicitly target the cluster architecture, and make CI validate that the registry contains each promised variant. When diagnosing an “exec format error,” inspect the node architecture and image manifest before changing application code. Platform identity belongs in the release evidence alongside the digest.

## Try this today

Build any local image, then run `docker image inspect <name>:<tag>` and `docker history <name>:<tag>`. Tag it twice and observe that both names initially share an image ID. If you have a test registry, push it and inspect the resulting digest; pull by digest and confirm that the image contents remain fixed even if the tag is rebuilt.

## Resources

- [OCI Image Format Specification](https://github.com/opencontainers/image-spec)
- [Docker: Image digests](https://docs.docker.com/dhi/core-concepts/digests/)
