---
title: Getting started
description: Scan a filesystem and explore it in the browser in a few minutes.
---

mish answers one question fast: **where did my disk space go?** It scans and indexes
filesystems into an immutable snapshot, then serves an interactive web client and a JSON-first CLI.

## 1. Run it

```bash
docker compose up -d --build
```

- Web client + API: <http://localhost:9543>
- Landing + docs: <http://localhost:3300>

The compose file publishes on loopback by default, mounts a GET-only `docker-socket-proxy`, and
runs the app as an unprivileged user. The container binds `0.0.0.0:9543` so Docker can forward the
port, so the first visit asks for the generated API token:

```bash
docker compose exec mish cat /data/auth-token
```

Set `MISH_AUTH_TOKEN` to choose your own. For LAN access also set
`MISH_ALLOWED_HOSTS`; see [Security](/security/).

## 2. Scan something

Open the web client and press **Scan**, or use the API. Roots must be inside `MISH_ROOTS`
(the default is `/host`):

```bash
curl -s -X POST http://localhost:9543/api/v1/scans \
  -H 'content-type: application/json' \
  -d '{"roots":["/host/etc"]}'
```

If `MISH_AUTH_TOKEN` is set, add `-H "Authorization: Bearer $MISH_AUTH_TOKEN"`.

## 3. Explore

- **Treemap** — area is size; click a rectangle to drill in.
- **Sunburst / Icicle / Bubble** — other reads on the same hierarchy.
- **Bars / Histogram / Extensions / Age / Owners** — ranked and aggregated views.
- **Docker** — per-container size, mounts and live stats.
- **Duplicates / Diff** — cleanup candidates and growth between two snapshots.

## Next

- [Installation](/installation/) — compose, Portainer, binary.
- [Web UI guide](/web-ui/) — every view and colour mode.
- [CLI reference](/cli/) — the full command surface.
