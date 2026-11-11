---
title: Agent skill
description: Drive mish safely from an AI agent — JSON-first and read-only.
---

`skills/mish/` is a first-class Skill that lets agents investigate disk usage safely.

## When to use

- A disk is full or nearly full.
- "What is using space under `/var`?"
- Docker disk audits (container/image/volume sizes and mounts).
- Large, old (stale) files as cleanup candidates.

## Core workflow

```bash
mish scan /var --json
mish du /var --depth 3 --json
mish top /var -n 50 --json
mish find /var --size +1G --mtime -180d --json
mish docker --json
```

Always pass `--json` when the output feeds another step. See the skill's `reference.md` for every
command and endpoint, and `examples.md` for task recipes.

## Safety

- **Read-only.** mish never deletes or moves files, and exposes no destructive operation.
- Never run destructive cleanup (`rm`, `docker prune`) from results without explicit human
  confirmation. Report candidates; let a human act.
- Respect configured exclusions and indexed roots.
