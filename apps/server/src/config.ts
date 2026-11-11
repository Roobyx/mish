import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ServerConfig {
  host: string;
  port: number;
  bind: string;
  dataDir: string;
  roots: string[];
  dockerEnabled: boolean;
  webDir?: string;
  coreSocket: string;
  coreBin?: string;
  version: string;
  /** Bearer token required by the API. Undefined disables built-in auth. */
  authToken?: string;
  /** Host header values accepted by the API (DNS-rebinding guard). */
  allowedHosts?: string[];
  /** Trust `X-Forwarded-Host`/`X-Forwarded-For` from a reverse proxy. */
  trustProxy?: boolean;
  /** Maximum concurrent SSE progress streams. */
  maxSseConnections?: number;
  /** Maximum JSON request body size. */
  maxBodyBytes?: number;
}

function readPackageVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function parseBind(bind: string): { host: string; port: number } {
  const idx = bind.lastIndexOf(":");
  if (idx === -1) return { host: bind, port: 8080 };
  const host = bind.slice(0, idx) || "0.0.0.0";
  const port = Number.parseInt(bind.slice(idx + 1), 10);
  return { host, port: Number.isFinite(port) ? port : 8080 };
}

function positiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export type EnvLike = Record<string, string | undefined>;

export function readConfig(env: EnvLike = process.env): ServerConfig {
  const bind = env.MISH_BIND ?? "127.0.0.1:8080";
  const { host, port } = parseBind(bind);
  const roots = (env.MISH_ROOTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const authToken = (env.MISH_AUTH_TOKEN ?? "").trim() || undefined;
  const allowedHosts = csv(env.MISH_ALLOWED_HOSTS ?? "localhost,127.0.0.1,[::1]");
  // A concrete bind address is also a legitimate Host header; wildcard binds
  // require the operator to list the names clients use.
  if (host && host !== "0.0.0.0" && host !== "::" && !allowedHosts.includes(host.toLowerCase())) {
    allowedHosts.push(host.toLowerCase());
  }

  return {
    host,
    port,
    bind,
    dataDir: env.MISH_DATA_DIR ?? "./data",
    roots,
    dockerEnabled: ["1", "true", "yes", "on"].includes((env.MISH_DOCKER ?? "").toLowerCase()),
    webDir: env.MISH_WEB_DIR,
    coreSocket: env.MISH_CORE_SOCKET ?? "/tmp/mish.sock",
    coreBin: env.MISH_CORE_BIN,
    version: readPackageVersion(),
    authToken,
    allowedHosts,
    trustProxy: ["1", "true", "yes", "on"].includes((env.MISH_TRUST_PROXY ?? "").toLowerCase()),
    maxSseConnections: positiveInt(env.MISH_MAX_SSE, 32),
    maxBodyBytes: positiveInt(env.MISH_MAX_BODY_BYTES, 1_048_576),
  };
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost", "[::1]"]);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.toLowerCase());
}

/**
 * A non-loopback bind must be authenticated. If the operator did not set a
 * token, generate one and persist it in the data directory instead of falling
 * back to an unauthenticated service. The token is logged once so it can be
 * read from `docker compose logs` or `/data/auth-token`.
 */
export function ensureAuthToken(config: ServerConfig): string | undefined {
  if (config.authToken) return config.authToken;
  if (isLoopbackHost(config.host)) return undefined;

  const file = join(config.dataDir, "auth-token");
  try {
    const existing = readFileSync(file, "utf8").trim();
    if (existing) {
      try {
        chmodSync(file, 0o600);
      } catch {
        // Best effort on platforms without POSIX permissions.
      }
      console.error(JSON.stringify({ level: "info", msg: "using existing API token", file }));
      return existing;
    }
  } catch {
    // No token file yet; generate one below.
  }

  const token = randomBytes(32).toString("hex");
  try {
    mkdirSync(config.dataDir, { recursive: true });
    // Remove an empty/stale entry (a symlink is removed itself, not followed).
    rmSync(file, { force: true });
    writeFileSync(file, `${token}\n`, { mode: 0o600, flag: "wx" });
    try {
      chmodSync(file, 0o600);
    } catch {
      // Best effort on platforms without POSIX permissions.
    }
  } catch (error) {
    throw new Error(`could not persist API token to ${file}: ${String(error)}`);
  }
  console.error(
    JSON.stringify({
      level: "warn",
      msg: "generated API token; read it from the data directory or set MISH_AUTH_TOKEN",
      file,
    }),
  );
  return token;
}
