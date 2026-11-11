---
title: Installation
description: Docker compose, Portainer, and running from source.
---

## Docker compose (recommended)

```bash
git clone https://github.com/Roobyx/mish
cd mish
docker compose up -d --build
```

| Service               | Port   | Purpose                                                             |
| --------------------- | ------ | ------------------------------------------------------------------- |
| `mish`            | `9543` | API + web client (bundles the Rust core)                            |
| `mish-site`       | `3300` | Landing + docs (canonical 3000; override with `MISH_SITE_PORT`) |
| `docker-socket-proxy` | —      | GET-only Docker API access                                          |

The host filesystems are bind-mounted read-only, the app runs as an unprivileged user with only
`CAP_DAC_READ_SEARCH`, and it never mounts `docker.sock` directly. The app port is published on
loopback by default. The container binds `0.0.0.0:9543` so Docker can forward the port; if no
`MISH_AUTH_TOKEN` is set, a token is generated in `/data/auth-token`. Read it with
`docker compose exec mish cat /data/auth-token`.

For LAN access, set `MISH_PUBLISH_ADDR=0.0.0.0`, `MISH_BIND=0.0.0.0:9543`, a strong
`MISH_AUTH_TOKEN` and `MISH_ALLOWED_HOSTS`; see [Security](/security/).

## Portainer

Use `deploy/compose/portainer-stack.yml`: **Stacks → Add stack → paste/upload → set environment
variables → Deploy**. See `deploy/compose/.env.example` for `MISH_PORT`,
`MISH_SITE_PORT`, `HOST_MOUNT`, `MISH_ROOTS`, `MISH_AUTH_TOKEN`,
`MISH_ALLOWED_HOSTS` and `DOCKER_HOST`.

## From source

```bash
# Rust core + CLI
cargo build --workspace --release

# TypeScript (Bun workspaces)
bun install
bun run --filter '*' build
```

Run the core daemon and the server:

```bash
mish daemon --socket /tmp/mish.sock --data-dir ./data
MISH_ROOTS=/var/data \
MISH_AUTH_TOKEN="$(openssl rand -hex 32)" \
MISH_CORE_SOCKET=/tmp/mish.sock \
bun run --filter '@mish/server' start
```

`MISH_ROOTS` is required: without it the daemon rejects every scan. If the server binds a
non-loopback address it also requires `MISH_AUTH_TOKEN`.

## Permissions

The core needs broad **read** access to the scanned filesystem. Prefer running it as an
unprivileged user with `CAP_DAC_READ_SEARCH` rather than root. Docker integration additionally
needs access to the Docker API; use the GET-only socket proxy.
