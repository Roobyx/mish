---
title: Security & privacy
description: Read-only scanning, token auth, least-privilege Docker and path validation.
---

## Read-only scanning

mish never deletes, moves, or modifies scanned files. The only writes are to its own data
directory (snapshots and the catalog).

Snapshot management is destructive to **application data**, not to scanned files: `DELETE
/api/v1/scans/:id`, `POST /api/v1/gc` and `mish snapshots delete|gc` remove snapshots. Protect
the API accordingly.

## Authentication and network exposure

The server binds `127.0.0.1:9543` by default. A loopback bind may run without authentication; any
other bind requires a token. If `MISH_AUTH_TOKEN` is unset, the server generates one, persists
it to `<dataDir>/auth-token` (mode `0600`). Set your own token for stable access.

The compose files publish only on loopback by default, but the container listens on `0.0.0.0:9543`
so Docker can forward the port. That non-loopback bind means the first visit asks for the generated
token; read it with:

```bash
docker compose exec mish cat /data/auth-token
```

For LAN access:

1. Set `MISH_PUBLISH_ADDR=0.0.0.0` and `MISH_BIND=0.0.0.0:9543`.
2. Set a strong `MISH_AUTH_TOKEN` (`openssl rand -hex 32`). The API requires
   `Authorization: Bearer <token>`.
3. Set `MISH_ALLOWED_HOSTS` to the hostname/IP clients use.
4. Terminate TLS at a reverse proxy. Set `MISH_TRUST_PROXY=true` only when that proxy is
   trusted to set `X-Forwarded-Host`/`X-Forwarded-For`.

The API also rejects cross-origin unsafe requests and non-JSON POST/PUT/PATCH bodies, and applies a
Host allowlist to reduce DNS-rebinding risk. The health endpoint remains unauthenticated for the
container healthcheck.

## Path validation

`MISH_ROOTS` is an allowlist. The core canonicalizes every requested scan root (resolving
symlinks) and rejects anything that is not equal to or below an allowed root. With no roots
configured, scans are rejected. Keep the list as narrow as possible.

## Permissions

The core needs broad **read** access to the scanned filesystem. The container runs as the
unprivileged `mish` user with only `CAP_DAC_READ_SEARCH`; host filesystems are mounted
read-only. Do not add write capabilities or mount host paths read-write.

## Docker

Only `GET` requests are issued to the Docker Engine API. The compose files route the app through a
GET-only socket proxy (`POST=0`); the proxy is the only service that touches `docker.sock`. Set
`MISH_DOCKER=false` to disable Docker integration entirely.

Mounting `docker.sock` read-only does **not** prevent writes to the API: `:ro` only protects the
socket inode. The proxy is the real control.

## No telemetry

There are no external network calls at runtime. mish is fully offline-capable.

## Reporting a vulnerability

Please report security issues privately to the maintainers rather than opening a public issue.
Include the version, deployment shape and a minimal reproduction. See `SECURITY.md` in the
repository for the current disclosure policy.
