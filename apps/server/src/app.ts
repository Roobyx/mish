import { createHash, timingSafeEqual } from "node:crypto";

import type { HostMountsResponse } from "@mish/api-types";
import { PROTOCOL_VERSION } from "@mish/api-types";
import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { streamSSE } from "hono/streaming";
import type { ServerConfig } from "./config.js";
import { type CoreApi, CoreRpcError } from "./core/client.js";
import { drivesFromMounts } from "./drives.js";
import { openApiDocument } from "./openapi.js";
import type { Scheduler } from "./scheduler.js";

export interface AppDeps {
  config: ServerConfig;
  core: CoreApi;
  scheduler?: Scheduler;
  startedAt?: number;
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const MAX_LIMIT = 10_000;
const MAX_DEPTH = 32;
const MAX_SCOPE = 0xffff_ffff;
const MAX_EXPORT = 100_000;
const MAX_ROOTS = 32;
const MAX_CRON_LEN = 128;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 600;

/** Parse a query/body integer and keep it inside a safe range. */
function clampInt(
  value: string | number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

/** Compare secrets without leaking their length through timing. */
function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function hostnameOf(host: string): string {
  if (!host) return "";
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Neutralize spreadsheet formulas in a quoted CSV field. */
export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  let out = '"';
  let first = true;
  for (const character of text) {
    if (first && ["=", "+", "-", "@", "\t", "\r"].includes(character)) out += "'";
    first = false;
    out += character === '"' ? '""' : character;
  }
  return `${out}"`;
}

function coreMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function coreStatus(error: unknown, fallback = 502): number {
  if (error instanceof CoreRpcError) {
    switch (error.code) {
      case -32602:
        return 400;
      case -32001:
        return 404;
      case -32002:
        return 409;
      case -32003:
        return 422;
      default:
        return 502;
    }
  }
  return fallback;
}

/** Build the Hono application (transport-agnostic; easy to unit test). */
export function createApp({ config, core, scheduler, startedAt = Date.now() }: AppDeps): Hono {
  const app = new Hono();
  app.onError((error, c) => {
    console.error(JSON.stringify({ level: "error", msg: coreMessage(error) }));
    return c.json({ error: "internal_error" }, 500);
  });
  const authToken = config.authToken;
  // Loopback hosts are always allowed so the container healthcheck and local
  // clients keep working even when MISH_ALLOWED_HOSTS is narrowed.
  const allowedHosts = new Set(
    ["localhost", "127.0.0.1", "[::1]", ...(config.allowedHosts ?? [])].map((host) =>
      host.toLowerCase(),
    ),
  );
  const trustProxy = config.trustProxy ?? false;
  const maxSse = config.maxSseConnections ?? 32;
  const maxBody = config.maxBodyBytes ?? 1_048_576;
  const requestHost = (c: Context): string =>
    (trustProxy ? c.req.header("x-forwarded-host") : undefined) ??
    c.req.header("host") ??
    new URL(c.req.url).host;
  const rateBuckets = new Map<string, { count: number; reset: number }>();
  let activeSse = 0;

  const coreError = (message: string, status = 502) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "content-type": "application/json" },
    });

  const readJson = async <T>(c: Context): Promise<T | null> => {
    try {
      return (await c.req.json()) as T;
    } catch {
      return null;
    }
  };

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: "same-origin",
      crossOriginResourcePolicy: "same-origin",
      referrerPolicy: "no-referrer",
      strictTransportSecurity: false,
      xContentTypeOptions: "nosniff",
      xFrameOptions: "DENY",
      xXssProtection: "0",
      removePoweredBy: true,
    }),
  );

  // Host, Origin, CSRF and auth guard. The health endpoint stays public so the
  // container healthcheck can run without a token.
  app.use("/api/v1/*", async (c, next) => {
    const host = hostnameOf(requestHost(c));
    if (!host || !allowedHosts.has(host)) {
      return c.json({ error: "forbidden_host" }, 403);
    }

    const method = c.req.method;
    if (method !== "GET" && method !== "HEAD") {
      const site = c.req.header("sec-fetch-site");
      if (site && site !== "same-origin" && site !== "none") {
        return c.json({ error: "cross_site_request" }, 403);
      }
      const origin = c.req.header("origin");
      if (origin) {
        let originHost = "";
        try {
          originHost = new URL(origin).host.toLowerCase();
        } catch {
          return c.json({ error: "invalid_origin" }, 403);
        }
        const expected = hostnameOf(requestHost(c));
        const originHostname = hostnameOf(originHost);
        // A trusted proxy may rewrite Host to the backend address. In that case
        // accept an Origin that matches a configured allowed host.
        if (!expected || originHostname !== expected) {
          if (!(trustProxy && originHostname && allowedHosts.has(originHostname))) {
            return c.json({ error: "cross_origin_request" }, 403);
          }
        }
      }
      const contentType = (c.req.header("content-type") ?? "").toLowerCase();
      if (!contentType.startsWith("application/json")) {
        return c.json({ error: "unsupported_media_type" }, 415);
      }
    }

    if (authToken && c.req.path !== "/api/v1/health") {
      const header = c.req.header("authorization") ?? "";
      const [scheme, ...rest] = header.split(" ");
      if (scheme?.toLowerCase() !== "bearer" || !safeEqual(rest.join(" "), authToken)) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json", "www-authenticate": "Bearer" },
        });
      }
    }

    const key = authToken
      ? "token"
      : trustProxy
        ? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "proxy"
        : "local";
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.reset <= now) {
      rateBuckets.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    } else {
      bucket.count += 1;
      if (bucket.count > RATE_MAX) {
        return c.json({ error: "rate_limited" }, 429);
      }
    }
    if (rateBuckets.size > 1024) {
      for (const [bucketKey, entry] of rateBuckets) {
        if (entry.reset <= now) rateBuckets.delete(bucketKey);
      }
    }
    await next();
  });

  app.use(
    "/api/v1/*",
    bodyLimit({
      maxSize: maxBody,
      onError: (c) => c.json({ error: "payload_too_large" }, 413),
    }),
  );
  app.use("/api/v1/*", async (c, next) => {
    await next();
    c.header("cache-control", "no-store");
  });
  app.use("/api/v1/docker/*", async (c, next) => {
    if (!config.dockerEnabled) {
      return c.json({ error: "docker_disabled" }, 404);
    }
    await next();
  });

  app.get("/api/v1/health", (c) => {
    const status = core.status();
    return c.json({
      status: "ok" as const,
      // The health endpoint is public for the container healthcheck; do not
      // expose the core socket path or other host details.
      core: { connected: status.connected, socket: "", version: status.version },
      protocol: PROTOCOL_VERSION,
      uptimeS: Math.floor((Date.now() - startedAt) / 1000),
    });
  });

  app.get("/api/v1/version", (c) =>
    c.json({
      server: config.version,
      protocol: PROTOCOL_VERSION,
      runtime: `bun ${Bun.version}`,
    }),
  );

  app.get("/api/v1/config", (c) =>
    c.json({
      dataDir: config.dataDir,
      bind: config.bind,
      roots: config.roots,
      dockerEnabled: config.dockerEnabled,
    }),
  );

  app.get("/api/v1/openapi.json", (c) => c.json(openApiDocument));

  app.get("/api/v1/host/mounts", async (c) => {
    try {
      return c.json(await core.call("host.mounts"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  // Drives with capacity for the dashboard. Falls back to the configured roots
  // so the cards still render while the core is down or restarting.
  app.get("/api/v1/host/drives", async (c) => {
    const hostRoot = config.roots[0] ?? "/host";
    try {
      const mounts = await core.call<HostMountsResponse>("host.mounts");
      return c.json({ hostRoot: mounts.hostRoot, drives: drivesFromMounts(mounts.mounts) });
    } catch (error) {
      return c.json({
        hostRoot,
        drives: drivesFromMounts([{ path: "/", containerPath: hostRoot, device: "", fstype: "" }]),
        warning: coreMessage(error),
      });
    }
  });

  // ---- schedules ----
  app.get("/api/v1/schedules", (c) => c.json({ schedules: scheduler?.list() ?? [] }));

  app.post("/api/v1/schedules", async (c) => {
    if (!scheduler) return coreError("scheduler unavailable", 503);
    const body = await readJson<{ roots?: unknown; cron?: unknown; enabled?: unknown }>(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (
      !Array.isArray(body.roots) ||
      body.roots.length === 0 ||
      body.roots.length > MAX_ROOTS ||
      body.roots.some((root) => typeof root !== "string" || root.length === 0 || root.length > 4096)
    ) {
      return c.json({ error: "roots must be 1..32 non-empty strings" }, 400);
    }
    if (
      typeof body.cron !== "string" ||
      body.cron.trim().length === 0 ||
      body.cron.length > MAX_CRON_LEN
    ) {
      return c.json({ error: "invalid cron expression" }, 400);
    }
    if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
      return c.json({ error: "enabled must be a boolean" }, 400);
    }
    return c.json(
      scheduler.add({
        roots: body.roots as string[],
        cron: body.cron,
        enabled: body.enabled as boolean | undefined,
      }),
      201,
    );
  });

  app.delete("/api/v1/schedules/:id", (c) => {
    if (!scheduler) return coreError("scheduler unavailable", 503);
    return c.json({ deleted: scheduler.remove(c.req.param("id")) });
  });

  // ---- scans ----
  app.get("/api/v1/scans", async (c) => {
    try {
      return c.json(await core.call("scans.list"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.post("/api/v1/scans", async (c) => {
    const body = await readJson<{ roots?: unknown; options?: unknown }>(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (
      !Array.isArray(body.roots) ||
      body.roots.length === 0 ||
      body.roots.length > MAX_ROOTS ||
      body.roots.some((root) => typeof root !== "string" || root.length === 0 || root.length > 4096)
    ) {
      return c.json({ error: "roots must be 1..32 non-empty strings" }, 400);
    }
    try {
      return c.json(await core.call("scans.create", body), 201);
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id", async (c) => {
    try {
      return c.json(await core.call("scans.get", { id: c.req.param("id") }));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error, 404));
    }
  });

  app.delete("/api/v1/scans/:id", async (c) => {
    try {
      return c.json(await core.call("scans.delete", { id: c.req.param("id") }));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.post("/api/v1/scans/:id/cancel", async (c) => {
    try {
      return c.json(await core.call("scans.cancel", { id: c.req.param("id") }));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/stats", async (c) => {
    try {
      return c.json(await core.call("scans.get", { id: c.req.param("id") }));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error, 404));
    }
  });

  app.get("/api/v1/scans/:id/progress", async (c) => {
    const id = c.req.param("id");
    const wantsStream = (c.req.header("accept") ?? "").includes("text/event-stream");
    if (!wantsStream) {
      try {
        return c.json(await core.call("scans.progress", { id }));
      } catch (error) {
        return coreError(coreMessage(error), coreStatus(error, 404));
      }
    }
    if (activeSse >= maxSse) {
      return c.json({ error: "too_many_streams" }, 503);
    }
    activeSse += 1;
    const deadline = Date.now() + 30 * 60_000;
    try {
      return streamSSE(c, async (stream) => {
        try {
          for (;;) {
            try {
              const progress = await core.call<{ state?: string }>("scans.progress", { id });
              await stream.writeSSE({ event: "progress", data: JSON.stringify(progress) });
              if (progress.state && TERMINAL.has(progress.state)) break;
            } catch (error) {
              await stream.writeSSE({
                event: "error",
                data: JSON.stringify({ error: coreMessage(error) }),
              });
              break;
            }
            if (Date.now() > deadline) break;
            await stream.sleep(500);
          }
        } finally {
          activeSse -= 1;
        }
      });
    } catch (error) {
      activeSse -= 1;
      throw error;
    }
  });

  app.get("/api/v1/scans/:id/children/:nodeId", async (c) => {
    try {
      return c.json(
        await core.call("tree.children", {
          id: c.req.param("id"),
          scope: clampInt(c.req.param("nodeId"), 0, 0, MAX_SCOPE),
          sort: c.req.query("sort") ?? "size",
          limit: clampInt(c.req.query("limit"), 500, 1, MAX_LIMIT),
          offset: clampInt(c.req.query("offset"), 0, 0, MAX_LIMIT),
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/tiles", async (c) => {
    try {
      return c.json(
        await core.call("tree.tiles", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          depth: clampInt(c.req.query("depth"), 2, 1, MAX_DEPTH),
          color: c.req.query("color") ?? "ext",
          metric: c.req.query("metric") ?? "alloc",
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/top", async (c) => {
    try {
      return c.json(
        await core.call("query.top", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          n: clampInt(c.req.query("n"), 50, 1, MAX_LIMIT),
          kind: c.req.query("kind"),
          metric: c.req.query("metric") ?? "alloc",
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/extensions", async (c) => {
    try {
      const result = await core.call<{
        items: Array<{ key: string; count: number; size: number }>;
      }>("query.histogram", {
        id: c.req.param("id"),
        scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
        dim: "ext",
      });
      const items = (result.items ?? []).map((bucket) => ({
        ext: bucket.key,
        count: bucket.count,
        size: bucket.size,
      }));
      return c.json({ items });
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/histogram", async (c) => {
    try {
      return c.json(
        await core.call("query.histogram", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          dim: c.req.query("dim") ?? "ext",
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/heatmap", async (c) => {
    try {
      return c.json(
        await core.call("query.heatmap", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/owners", async (c) => {
    try {
      return c.json(
        await core.call("query.histogram", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          dim: "owner",
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/age", async (c) => {
    try {
      return c.json(
        await core.call("query.histogram", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          dim: "age",
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/tree", async (c) => {
    try {
      return c.json(
        await core.call("tree.hierarchy", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          depth: clampInt(c.req.query("depth"), 2, 1, MAX_DEPTH),
          limit: clampInt(c.req.query("limit"), 2000, 1, MAX_LIMIT),
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/export", async (c) => {
    try {
      const format = c.req.query("format") ?? "json";
      if (format !== "csv" && format !== "json") {
        return c.json({ error: "format must be csv or json" }, 400);
      }
      const scope = clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE);
      const result = await core.call<{ items: Array<Record<string, unknown>> }>("query.search", {
        id: c.req.param("id"),
        scope,
        limit: clampInt(c.req.query("limit"), 100000, 1, MAX_EXPORT),
      });
      const items = result.items ?? [];
      if (format === "csv") {
        const header = "id,parent,name,kind,sizeAlloc,sizeApparent,subtreeSize,mtimeMs";
        const rows = items.map((item) =>
          [
            item["id"],
            item["parent"] ?? "",
            csvEscape(item["name"]),
            item["kind"],
            item["sizeAlloc"],
            item["sizeApparent"],
            item["subtreeSize"],
            item["mtimeMs"],
          ].join(","),
        );
        const safeId =
          c.req
            .param("id")
            .replace(/[^A-Za-z0-9_-]/g, "")
            .slice(0, 64) || "export";
        return c.body(`${[header, ...rows].join("\n")}\n`, 200, {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="mish-${safeId}.csv"`,
        });
      }
      return c.json({ snapshot: c.req.param("id"), nodes: items });
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/search", async (c) => {
    try {
      return c.json(
        await core.call("query.search", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          name: c.req.query("q"),
          ext: c.req.query("ext"),
          kind: c.req.query("kind"),
          size_min: c.req.query("size_min")
            ? clampInt(c.req.query("size_min"), 0, 0, Number.MAX_SAFE_INTEGER)
            : undefined,
          size_max: c.req.query("size_max")
            ? clampInt(c.req.query("size_max"), 0, 0, Number.MAX_SAFE_INTEGER)
            : undefined,
          limit: clampInt(c.req.query("limit"), 500, 1, MAX_LIMIT),
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/duplicates", async (c) => {
    try {
      return c.json(
        await core.call("query.duplicates", {
          id: c.req.param("id"),
          scope: clampInt(c.req.query("scope"), 0, 0, MAX_SCOPE),
          mode: c.req.query("mode") ?? "name+size",
          limit: clampInt(c.req.query("limit"), 200, 1, 1000),
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/scans/:id/diff/:otherId", async (c) => {
    try {
      return c.json(
        await core.call("query.diff", {
          a: c.req.param("otherId"),
          b: c.req.param("id"),
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.post("/api/v1/gc", async (c) => {
    const body = await readJson<{ keep?: unknown }>(c);
    if (!body) return c.json({ error: "invalid_json" }, 400);
    if (body.keep !== undefined && (typeof body.keep !== "number" || !Number.isFinite(body.keep))) {
      return c.json({ error: "keep must be a number" }, 400);
    }
    try {
      const keep = clampInt(body.keep as number | undefined, 3, 0, 1000);
      return c.json(await core.call("snapshots.gc", { keep }));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  // ---- docker (read-only) ----
  app.get("/api/v1/docker/status", async (c) => {
    try {
      return c.json(await core.call("docker.status"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/containers", async (c) => {
    try {
      const scan = c.req.query("scan");
      return c.json(await core.call("docker.containers", scan ? { scan } : undefined));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/mounts", async (c) => {
    try {
      const scan = c.req.query("scan");
      if (scan) {
        return c.json(await core.call("docker.mountsFor", { id: scan }));
      }
      return c.json(await core.call("docker.mounts"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/images", async (c) => {
    try {
      return c.json(await core.call("docker.images"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/volumes", async (c) => {
    try {
      return c.json(await core.call("docker.volumes"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/locate", async (c) => {
    try {
      return c.json(await core.call("docker.locate", { query: c.req.query("q") ?? "" }));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/overlay-contents", async (c) => {
    try {
      const scan = c.req.query("scan");
      const container = c.req.query("container");
      if (!scan || !container) {
        return c.json({ error: "scan and container are required" }, 400);
      }
      return c.json(
        await core.call("docker.overlayContents", {
          id: scan,
          container,
          layer: c.req.query("layer") ?? "",
        }),
      );
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.get("/api/v1/docker/stats", async (c) => {
    try {
      return c.json(await core.call("docker.stats"));
    } catch (error) {
      return coreError(coreMessage(error), coreStatus(error));
    }
  });

  app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

  return app;
}
