# mish examples

All examples are read-only and JSON-first.

## 1. "The disk is full — what is using it?"

```bash
mish scan / --json > /tmp/scan.json
mish du / --depth 2 --json
mish top / -n 25 --metric alloc --json
```

Report the top 25 by allocated size with paths, plus any scan errors (unreadable dirs).

## 2. "What is under /var taking space?"

```bash
mish du /var --depth 3 --json
mish ext /var --json
```

## 3. Large, stale files (cleanup candidates)

```bash
mish find / --size +1G --mtime -180d --json
```

Report candidates only — never delete without explicit human confirmation.

## 4. Docker disk audit

```bash
mish docker --json
mish docker --stats --json
```

Lists container/image/volume sizes and mount → host-path mapping. Use the mount map to see which
container owns a given region of the disk.

## 5. "What grew this week?"

```bash
mish snapshots list --json
mish diff <older-snapshot> <newer-snapshot> --json
```

## 6. Agent HTTP flow

```bash
curl -s http://127.0.0.1:9543/api/v1/scans -X POST \
  -H 'content-type: application/json' \
  -d '{"roots":["/var"],"options":{"incremental":true}}'
curl -s http://127.0.0.1:9543/api/v1/scans/<id>/top?n=20
```
