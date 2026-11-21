---
title: Errors
description: Every mish error code, what it means, and how to fix it.
---

Every API failure returns the same JSON envelope:

```json
{
  "error": "forbidden_host",
  "message": "The Host header \"mish.lan\" is not in the allowed list. Add mish.lan to MISH_ALLOWED_HOSTS, or use * behind a proxy that rewrites Host.",
  "docs": "https://mish.example/errors/#forbidden_host"
}
```

- `error` is a stable machine code. Branch on it instead of the message.
- `message` explains what happened and usually names the offending value.
- `docs` links to the section below for that code.

The `docs` link comes from `MISH_DOCS_URL`. It defaults to this page on GitHub; set it to your docs
site (for example `https://mish.example`) so links open the rendered page. A direct page URL is also
accepted.

## Access and authentication

### unauthorized

**401.** No bearer token, or the token does not match the server's token (`MISH_AUTH_TOKEN` or the
generated `<dataDir>/auth-token`).

Send `Authorization: Bearer <token>` on every endpoint except `/api/v1/health`. If you did not set
`MISH_AUTH_TOKEN`, mish generated one at `<dataDir>/auth-token`; read it with
`docker compose exec mish cat /data/auth-token`.

### forbidden_host

**403.** The `Host` header of the request is not in the allow-list. This is the DNS-rebinding guard,
and it is about the URL you opened mish with, not about the path you scan.

The allow-list always contains `localhost`, `127.0.0.1` and `[::1]`, plus every entry in
`MISH_ALLOWED_HOSTS`, plus the bind address when `MISH_BIND` is a concrete IP. A wildcard bind such
as `0.0.0.0:9543` adds nothing, so LAN clients are rejected until you list the name or IP they use.

Add the browser's hostname or IP to `MISH_ALLOWED_HOSTS`, without scheme or port:

```bash
MISH_ALLOWED_HOSTS=192.168.1.50,mish.lan
```

Use `MISH_ALLOWED_HOSTS=*` when a reverse proxy or app-store router rewrites `Host`; the bearer token
and Origin checks still apply. The error message names the rejected host.

### cross_site_request

**403.** The request carried `Sec-Fetch-Site` other than `same-origin`/`none`. Unsafe requests are
only accepted from the mish UI on the same origin. Open the UI directly instead of calling the API
from another site's JavaScript.

### invalid_origin

**403.** The `Origin` header is not a parseable URL. This is usually a proxy that rewrites or strips
headers. Check the proxy configuration, or set `MISH_TRUST_PROXY=true` only when that proxy is
trusted to set the forwarding headers.

### cross_origin_request

**403.** The `Origin` host does not match the request `Host`. Open the UI on the same hostname the API
is served from. Behind a proxy that rewrites `Host`, add the public hostname to `MISH_ALLOWED_HOSTS`
and set `MISH_TRUST_PROXY=true`.

### unsupported_media_type

**415.** A `POST`/`PUT`/`PATCH`/`DELETE` request did not use `Content-Type: application/json`. Send the
JSON content type, even for an empty body.

### rate_limited

**429.** More than 600 requests per minute from one token, forwarded client or the local bucket. Wait
and retry. Behind a proxy, set `MISH_TRUST_PROXY=true` so buckets are per client instead of shared.
The counters are in memory and reset on restart.

### payload_too_large

**413.** The request body exceeded `MISH_MAX_BODY_BYTES` (default 1 MiB). Raise the limit only if you
really send larger bodies; scans are started with paths, not file contents.

## Request validation

### not_found

**404.** No route matches the path, or the scan/snapshot id does not exist. List scans with
`GET /api/v1/scans` and use a current id.

### docker_disabled

**404.** Docker integration is off. Set `MISH_DOCKER=true` and make sure the container can reach the
GET-only socket proxy at `DOCKER_HOST`.

### invalid_json

**400.** The request body is not valid JSON. Check for trailing commas, unquoted keys and a body that
was sent as form data.

### invalid_roots

**400.** `roots` must be an array of 1 to 32 non-empty strings, each at most 4096 characters. Send the
container paths to scan, for example `{ "roots": ["/host"] }`.

### invalid_cron

**400.** `cron` must be a 5-field expression: minute hour day-of-month month day-of-week. For example
`0 3 * * *` runs daily at 03:00.

### invalid_enabled

**400.** `enabled` must be a boolean, not the string `"true"`.

### invalid_export_format

**400.** The export `format` query parameter must be `csv` or `json`.

### invalid_keep

**400.** `keep` must be a number. It is the number of newest snapshots to retain during GC.

### invalid_docker_overlay_request

**400.** `/api/v1/docker/overlay-contents` requires both the `scan` and `container` query
parameters.

## Core and scans

### invalid_params

**400.** The core rejected the request parameters. The message names the specific problem:
- `scan roots are not configured; set MISH_ROOTS` — no usable root is mounted; see
  [configuration](/configuration/).
- `root '…' is outside the configured MISH_ROOTS` — the path is not under an allowed root.
- `invalid root '…'` — the path does not exist or cannot be resolved inside the container.
- `too many concurrent scans` — wait for a running scan to finish (the limit is 4).
- `too many exclusions` or `exclusion is longer than …` — reduce or shorten the patterns.
- `docker integration is disabled` — set `MISH_DOCKER=true`.

### conflict

**409.** The core is busy or the operation conflicts with an active scan. Retry once the scan
finishes.

### unsupported_format

**422.** The snapshot was written with an index format this build does not support, usually after a
downgrade. Rescan the path or remove the old snapshot.

### method_not_found

**502.** The core does not implement a method the server called, which means the server and core
binaries are different versions. Deploy matching versions; the container image ships both.

### parse_error

**502.** The core returned a response the server could not parse. Check the core logs for a crash or
interleaved output; mismatched server/core versions can also cause this.

### invalid_request

**502.** The server sent the core a malformed JSON-RPC request. This is a bug or a version mismatch;
collect the server and core versions from `GET /api/v1/version` and the logs.

### core_unavailable

**502.** The server could not reach the core daemon over the Unix socket. Check that `MISH_CORE_BIN`
points at the `mish` binary, `MISH_CORE_SOCKET` matches the socket the daemon binds, and the data
directory is writable. A crashed daemon is restarted automatically; read the container logs for
`core exited; restarting`.

### too_many_streams

**503.** More than `MISH_MAX_SSE` (default 32) progress streams are open. Close another scan tab, or
raise `MISH_MAX_SSE`.

### scheduler_unavailable

**503.** The server started without its scheduler. Restart the server; if it persists, report the
server and core versions from `GET /api/v1/version`.

### internal_error

**500.** An unexpected server error. The response intentionally omits details; read the server log
line that starts with `"level":"error"` and report it with the version from
`GET /api/v1/version`.

## CLI failures

### cli

`mish` prints `error: <message>` and a `docs:` link on stderr, or `{ "ok": false, "error": …,
"docs": … }` with `--json`. The message names the failing step; the common causes are:
- **Snapshot not found** — the id does not exist or no completed snapshot is available yet. Run
  `mish snapshots list`, or pass `--snapshot <id>`.
- **Data directory not readable or writable** — check `MISH_DATA_DIR` (default `./data`) and its
  permissions.
- **Invalid root or exclusion** — the path must exist and sit under `MISH_ROOTS`; globs must parse.
- **Core not running** — `mish daemon` must be listening on `MISH_CORE_SOCKET` for commands that
  call the daemon.

The link base comes from `MISH_DOCS_URL`, the same variable the server uses.

## Startup and configuration

These are printed to the container log or the process stderr rather than returned as API errors.

### `could not persist API token to …`

The data directory is not writable. Mount a writable volume at `MISH_DATA_DIR` (the compose files use
`/data`) or set `MISH_AUTH_TOKEN` yourself.

### `core spawn failed: …` or `core exited; restarting`

The server cannot start the core binary. Confirm `MISH_CORE_BIN` exists and is executable, that the
socket directory exists, and that the process has enough memory. The server backs off and retries,
but the API stays on `core_unavailable` until the daemon runs.

### `no usable MISH_ROOTS; all scan requests will be rejected`

None of the configured roots exists inside the container. Set `MISH_ROOTS` to a mounted path such as
`/host`, and make sure the host filesystem is mounted read-only at that path.

### `MISH_DATA_DIR is empty`

The core refuses to start without a data directory. Set `MISH_DATA_DIR` (compose sets `/data`).

### Address already in use

Another process holds the port. Change `MISH_PORT` (host side) or `MISH_BIND` (container side), or
stop the other process.

## See also

- [Configuration](/configuration/) for every `MISH_*` variable.
- [Security](/security/) for the token, Host and proxy model.
- [Troubleshooting](/troubleshooting/) for symptom-first fixes.
