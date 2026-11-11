---
title: Configuration
description: Every environment variable, port, mount and scan option, with its default and purpose.
---

## Environment variables

| Variable                  | Default                                  | Purpose                                                                       |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `MISH_DATA_DIR`       | `./data`                                 | Catalog, snapshots and journal                                                |
| `MISH_BIND`           | `127.0.0.1:8080`                         | Server bind address; non-loopback requires a token                            |
| `MISH_AUTH_TOKEN`     | —                                        | Bearer token required by the API (required for non-loopback binds)            |
| `MISH_ALLOWED_HOSTS`  | `localhost,127.0.0.1,[::1]`              | Accepted `Host` headers (DNS-rebinding guard)                                 |
| `MISH_TRUST_PROXY`    | `false`                                  | Trust `X-Forwarded-Host`/`X-Forwarded-For` from a reverse proxy               |
| `MISH_MAX_SSE`        | `32`                                     | Maximum concurrent SSE progress streams                                       |
| `MISH_MAX_BODY_BYTES` | `1048576`                                | Maximum JSON request body                                                     |
| `MISH_CORE_SOCKET`    | `/tmp/mish.sock`                     | Unix socket for the core daemon                                               |
| `MISH_CORE_BIN`       | —                                        | Path to the `mish` binary the server supervises                           |
| `MISH_ROOTS`          | —                                        | Canonical allowlist of scannable roots (comma-separated); empty rejects scans |
| `MISH_DOCKER`         | `false`                                  | Enable Docker integration (also gates the core collector)                     |
| `MISH_WEB_DIR`        | —                                        | Directory of built SPA assets to serve                                        |
| `MISH_DOCKER_SOCKET`  | `$DOCKER_HOST` or `/var/run/docker.sock` | Docker endpoint (`unix://`, `tcp://`)                                         |
| `DOCKER_HOST`             | —                                        | Docker endpoint used when `MISH_DOCKER_SOCKET` is unset                   |

Compose also reads `MISH_PUBLISH_ADDR` (default `127.0.0.1`), `MISH_PORT` and
`MISH_SITE_PORT`.

## Authentication

Set `MISH_AUTH_TOKEN` and send `Authorization: Bearer <token>` on every API request except
`/api/v1/health`. The web client asks for the token once per tab and keeps it in `sessionStorage`;
it is never placed in a URL. If a non-loopback bind has no token, the server generates one, writes
it to `<dataDir>/auth-token` (mode `0600`). A reverse proxy can provide its own authentication
instead.

## Scan options

`incremental`, `oneFileSystem` (default true), `followSymlinks`, `exclusions` (gitignore globs),
`ignoreFiles`, `threads`, `allocated` (default true).

Limits are enforced in the server and core: at most 32 roots, 128 exclusions, 4 concurrent scans,
10k query results, depth 32 and a 100k export cap.

## Snapshots and GC

Each scan produces an immutable snapshot. `snapshots gc --keep N` (or `POST /api/v1/gc`) deletes
completed snapshots beyond the newest N. Data backup = copy `blocks/` (when present),
`snapshots/` and `catalog.db`.
