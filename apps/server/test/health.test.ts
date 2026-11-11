import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApp, csvEscape } from "../src/app.js";
import type { ServerConfig } from "../src/config.js";
import { ensureAuthToken } from "../src/config.js";
import type { CoreApi, CoreStatus } from "../src/core/client.js";

function config(): ServerConfig {
  return {
    host: "127.0.0.1",
    port: 9543,
    bind: "127.0.0.1:9543",
    dataDir: "/data",
    roots: ["/host"],
    dockerEnabled: false,
    webDir: undefined,
    coreSocket: "/run/mish/mish.sock",
    coreBin: undefined,
    version: "0.1.0",
  };
}

/** Core stub that records calls and returns canned results. */
class StubCore implements CoreApi {
  calls: Array<{ method: string; params?: unknown }> = [];

  constructor(private readonly handler: (method: string, params?: unknown) => unknown) {}

  status(): CoreStatus {
    return { connected: true, socket: "/stub.sock" };
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    this.calls.push({ method, params });
    return this.handler(method, params) as T;
  }
}

describe("server API", () => {
  test("health reports ok and core state", async () => {
    const core = new StubCore(() => ({}));
    const app = createApp({ config: config(), core });
    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; protocol: number; core: CoreStatus };
    expect(body.status).toBe("ok");
    expect(body.protocol).toBe(1);
    expect(body.core.connected).toBe(true);
  });

  test("lists scans from the core", async () => {
    const core = new StubCore(() => ({ scans: [{ id: "s1", state: "completed" }] }));
    const app = createApp({ config: config(), core });
    const res = await app.request("/api/v1/scans");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scans: Array<{ id: string }> };
    expect(body.scans[0]?.id).toBe("s1");
    expect(core.calls[0]?.method).toBe("scans.list");
  });

  test("maps tiles query params to the core", async () => {
    const core = new StubCore(() => ({ tiles: [] }));
    const app = createApp({ config: config(), core });
    const res = await app.request("/api/v1/scans/abc/tiles?scope=7&depth=3&color=ext");
    expect(res.status).toBe(200);
    const call = core.calls[0];
    expect(call?.method).toBe("tree.tiles");
    expect(call?.params).toMatchObject({ id: "abc", scope: 7, depth: 3, color: "ext" });
  });

  test("unknown route is a JSON 404", async () => {
    const core = new StubCore(() => ({}));
    const app = createApp({ config: config(), core });
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not_found");
  });

  test("requires a bearer token when configured", async () => {
    const core = new StubCore(() => ({ scans: [] }));
    const app = createApp({ config: { ...config(), authToken: "s3cret" }, core });

    const health = await app.request("/api/v1/health");
    expect(health.status).toBe(200);

    const denied = await app.request("/api/v1/scans");
    expect(denied.status).toBe(401);
    expect(denied.headers.get("www-authenticate")).toBe("Bearer");

    const allowed = await app.request("/api/v1/scans", {
      headers: { authorization: "Bearer s3cret" },
    });
    expect(allowed.status).toBe(200);
  });

  test("rejects cross-origin and non-JSON unsafe requests", async () => {
    const core = new StubCore(() => ({}));
    const app = createApp({ config: config(), core });

    const crossOrigin = await app.request("/api/v1/gc", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://evil.example",
      },
      body: JSON.stringify({ keep: 3 }),
    });
    expect(crossOrigin.status).toBe(403);

    const textPlain = await app.request("/api/v1/gc", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ keep: 3 }),
    });
    expect(textPlain.status).toBe(415);
  });

  test("clamps export limits", async () => {
    const core = new StubCore(() => ({ items: [] }));
    const app = createApp({ config: config(), core });
    const res = await app.request("/api/v1/scans/abc/export?limit=999999999");
    expect(res.status).toBe(200);
    const call = core.calls[0];
    expect(call?.params).toMatchObject({ limit: 100000 });
  });

  test("docker routes are unavailable when disabled", async () => {
    const core = new StubCore(() => ({}));
    const app = createApp({ config: config(), core });
    const res = await app.request("/api/v1/docker/status");
    expect(res.status).toBe(404);
  });

  test("csvEscape neutralizes spreadsheet formulas", () => {
    expect(csvEscape("=1+1")).toBe('"\'=1+1"');
    expect(csvEscape("+1")).toBe('"\'+1"');
    expect(csvEscape("-1")).toBe('"\'-1"');
    expect(csvEscape("@1")).toBe('"\'@1"');
    expect(csvEscape("a=1")).toBe('"a=1"');
    expect(csvEscape('a"b')).toBe('"a""b"');
  });

  test("generates and reuses a token for non-loopback binds", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "mish-token-"));
    try {
      const base = { ...config(), host: "0.0.0.0", dataDir, authToken: undefined };
      const first = ensureAuthToken(base);
      expect(first).toBeDefined();
      const token = first ?? "";
      expect(token.length).toBe(64);
      expect(readFileSync(join(dataDir, "auth-token"), "utf8").trim()).toBe(token);
      expect(ensureAuthToken(base)).toBe(token);
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});
