# Security policy

## Supported versions

Security fixes are applied to the latest release on the main branch. Older releases may not receive
backports; upgrade before reporting an issue against an old version.

## Reporting a vulnerability

Please report security issues privately to the maintainers. Do not open a public issue for a
vulnerability that could expose filesystem metadata, snapshots or Docker data.

Include:

- the mish version and deployment shape (compose, Portainer, source, CLI-only);
- the affected endpoint or command;
- a minimal reproduction and the expected/actual behaviour;
- whether the service was bound to loopback or exposed to a network.

You should receive an acknowledgement within a few business days. Please allow time for a fix and
coordinated disclosure before publishing details.

## Threat model

mish is a self-hosted, read-only disk indexer. It is expected to run on a trusted host and to
read broad parts of the filesystem (often the whole host through a read-only bind mount). The
network-facing API is the main boundary:

- **Unauthenticated network access** exposes filenames, sizes, owners, mounts, drive serials and
  Docker inventory. The server therefore binds loopback by default and refuses a non-loopback bind
  without `MISH_AUTH_TOKEN`.
- **Scanned files are untrusted input.** Filenames can contain control characters and spreadsheet
  formulas; human CLI output is sanitized and CSV export neutralizes formulas.
- **Docker is privileged.** The app talks to a GET-only socket proxy. Mounting `docker.sock` `:ro`
  is not a write barrier.
- **The data directory is application state.** Snapshot deletion and GC are destructive to that
  state; they require the same protection as the rest of the API.
- **Dependencies and build inputs are part of the boundary.** `Cargo.lock` and `bun.lock` are
  committed; Docker base images and the socket proxy are pinned.

## Hardening checklist

- Keep the API on loopback, or set a strong `MISH_AUTH_TOKEN` and TLS at a reverse proxy.
- Set `MISH_ALLOWED_HOSTS` to the names clients use; keep `MISH_TRUST_PROXY=false` unless a
  trusted proxy sets the forwarding headers.
- Set `MISH_ROOTS` as narrowly as possible; the core rejects paths outside it.
- Run as the unprivileged `mish` user with only `CAP_DAC_READ_SEARCH`; mount host paths `:ro`.
- Keep `MISH_DOCKER=false` unless you need it, and use the GET-only proxy when you do.
- Keep the data directory owned by the service user with mode `0700`; do not make it world-writable.
- Back up snapshots before running GC or deleting them.
