---
title: Docker integration
description: Read-only container, image and volume sizes, mounts and live stats.
---

mish talks to the Docker Engine API **read-only** — only `GET` requests, never a mutation.

## What is collected

| Source                                | Data                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| `/containers/json?size=1`             | container list, `SizeRw`, `SizeRootFs`, image, state, labels |
| `/containers/{id}/json`               | mounts (type, source, destination, RW)                       |
| `/containers/{id}/stats?stream=false` | CPU %, memory used/limit, net RX/TX, block I/O               |
| `/images/json`, `/volumes`            | image and volume sizes                                       |

## Least privilege

Do not mount `docker.sock` into the app. The shipped compose files run the GET-only
[`tecnativa/docker-socket-proxy`](https://github.com/Tecnativa/docker-socket-proxy) and point the
core at it:

```yaml
environment:
  DOCKER_HOST: tcp://docker-socket-proxy:2375
```

The proxy sets `POST=0` (GET/HEAD only) and `EVENTS=0`. Mounting the socket `:ro` is not a write
barrier: the socket inode is read-only, but a connected client can still issue API requests. The
proxy is the control.

Set `MISH_DOCKER=false` to disable Docker collection entirely; the core will not contact the
endpoint and the Docker API routes return 404.

The collector accepts `unix://`, `tcp://` and `http://` endpoints.

## Failure modes

No socket, permission denied, or rootless Docker/Podman → the Docker views report unavailable and
everything else keeps working. Docker is never required.
