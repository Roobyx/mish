---
name: mish
description: >-
  Investigate disk usage on a Linux server with mish. Use for "disk is full",
  "what is using space", "largest directories/files", Docker disk audits, stale
  large files, and capacity questions. Read-only: mish never deletes or moves
  files. Prefer JSON output for parsing.
---

# mish

`mish` is a fast, headless, read-only disk-space analyzer. It scans filesystems into an
immutable index and answers "where did the space go?" from the CLI or the HTTP API.

## When to use

- A disk is full or nearly full and you need to find the cause.
- "What is using space under `/var`?" / "largest files on the box".
- Docker disk audit: container, image, and volume sizes; which mounts own which paths.
- Finding large, old (stale) files as cleanup candidates.
- Capacity questions: totals, per-filesystem usage, scan coverage.

## Safety

- **Read-only toward scanned files.** Never deletes, moves, or modifies them. Snapshot management
  (`mish snapshots delete|gc`, `DELETE /api/v1/scans/:id`, `POST /api/v1/gc`) only removes
  mish's own snapshots, never scanned files.
- Never run destructive cleanup (`rm`, `docker prune`) based on results without explicit human
  confirmation. Report candidates; let a human act.
- Respect `MISH_ROOTS` and configured exclusions; do not attempt path traversal outside them.
- When the HTTP API requires a token, send `Authorization: Bearer <token>`; never put it in a URL.
  Send `Content-Type: application/json` on POST/PUT/PATCH.

## Prerequisites

- `mish` on `PATH`, or the HTTP API base URL (default `http://127.0.0.1:8080`).
- The core needs broad read access to the target paths (root or `CAP_DAC_READ_SEARCH`).

## Core workflow

1. Scan a root (or reuse the latest snapshot):
   `mish scan /var --json`
2. Query it:
   - `mish du /var --json` — subtree sizes
   - `mish top /var -n 50 --json` — largest entries
   - `mish find /var --size +1G --mtime -30d --json` — filtered search
   - `mish ext /var --json` — extension breakdown
   - `mish tui /var` — interective terminal browse, for a human at a tty (no `--json`)
3. Interpret, then report with concrete paths and sizes. Prefer allocated size for "space used".

Always pass `--json` when the output feeds another step or a report. See
[`reference.md`](./reference.md) for every command and flag, and
[`examples.md`](./examples.md) for task recipes.

## Reporting

Give the user: the root scanned, the metric (allocated vs apparent), the top offenders with
paths and sizes, and any scan errors (unreadable directories). Do not speculate beyond the data.
