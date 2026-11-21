import { CoreRpcError } from "./core/client.js";

/**
 * Single source of truth for API error codes.
 *
 * Every response carries `{ error, message, docs }`: `error` is the stable
 * machine code, `message` explains what happened, and `docs` points at the
 * matching section of the docs site (`/errors/#<code>`). Keep the catalog and
 * `apps/site/src/content/docs/errors.md` in sync; a test asserts the anchors.
 */
const ERROR_CATALOG = {
  internal_error: {
    status: 500,
    message: "The server hit an unexpected error. Check the server logs for the full details.",
  },
  not_found: {
    status: 404,
    message: "No route or resource matches this request.",
  },
  unauthorized: {
    status: 401,
    message:
      "A bearer token is required. Send Authorization: Bearer <token>, using MISH_AUTH_TOKEN or <dataDir>/auth-token.",
  },
  forbidden_host: {
    status: 403,
    message: "The Host header is not in the allowed list.",
  },
  cross_site_request: {
    status: 403,
    message: "The request came from another site. Open the mish UI on the same origin.",
  },
  invalid_origin: {
    status: 403,
    message: "The Origin header is not a valid URL.",
  },
  cross_origin_request: {
    status: 403,
    message: "The Origin does not match the request Host.",
  },
  unsupported_media_type: {
    status: 415,
    message: "Unsafe requests must use Content-Type: application/json.",
  },
  rate_limited: {
    status: 429,
    message: "Too many requests in the last minute. Wait a moment and retry.",
  },
  payload_too_large: {
    status: 413,
    message: "The request body is larger than MISH_MAX_BODY_BYTES (default 1 MiB).",
  },
  docker_disabled: {
    status: 404,
    message: "Docker integration is off. Set MISH_DOCKER=true to enable these routes.",
  },
  invalid_json: {
    status: 400,
    message: "The request body is not valid JSON.",
  },
  invalid_roots: {
    status: 400,
    message: "roots must be 1..32 non-empty strings.",
  },
  invalid_cron: {
    status: 400,
    message: "cron must be a 5-field cron expression, for example 0 3 * * *.",
  },
  invalid_enabled: {
    status: 400,
    message: "enabled must be a boolean.",
  },
  invalid_export_format: {
    status: 400,
    message: "format must be csv or json.",
  },
  invalid_keep: {
    status: 400,
    message: "keep must be a number.",
  },
  invalid_docker_overlay_request: {
    status: 400,
    message: "Both scan and container query parameters are required.",
  },
  scheduler_unavailable: {
    status: 503,
    message: "The scheduler is not available on this server.",
  },
  too_many_streams: {
    status: 503,
    message: "Too many concurrent progress streams. Close another scan tab and retry.",
  },
  parse_error: {
    status: 502,
    message: "The core returned a response the server could not parse.",
  },
  invalid_request: {
    status: 502,
    message: "The server sent the core an invalid JSON-RPC request.",
  },
  method_not_found: {
    status: 502,
    message: "The core does not implement this method. The server and core versions may not match.",
  },
  invalid_params: {
    status: 400,
    message: "The core rejected the request parameters.",
  },
  conflict: {
    status: 409,
    message: "The core rejected the request because of a conflicting operation.",
  },
  unsupported_format: {
    status: 422,
    message: "The snapshot uses an index format this build does not support.",
  },
  core_unavailable: {
    status: 502,
    message:
      "The mish core is not reachable. Check MISH_CORE_BIN and MISH_CORE_SOCKET, then read the container logs.",
  },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

/** Every code, in catalog order; tests use it to keep the docs page in sync. */
export const ERROR_CODES = Object.keys(ERROR_CATALOG) as ErrorCode[];

export interface ErrorBody {
  error: ErrorCode;
  message: string;
  docs: string;
  [key: string]: unknown;
}

/**
 * Accepts either a docs-site base (`https://mish.example`) or a direct page URL
 * (`https://…/errors.md`), so the default can point at the GitHub source.
 */
export function docsUrl(base: string, code: ErrorCode): string {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith(".md") ? `${trimmed}#${code}` : `${trimmed}/errors/#${code}`;
}

export function errorBody(
  base: string,
  code: ErrorCode,
  message?: string,
  extra?: Record<string, unknown>,
): ErrorBody {
  return {
    error: code,
    message: message ?? ERROR_CATALOG[code].message,
    docs: docsUrl(base, code),
    ...extra,
  };
}

export interface ErrorResponseOptions {
  status?: number;
  message?: string;
  extra?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export function errorResponse(
  base: string,
  code: ErrorCode,
  options: ErrorResponseOptions = {},
): Response {
  const body = errorBody(base, code, options.message, options.extra);
  return new Response(JSON.stringify(body), {
    status: options.status ?? ERROR_CATALOG[code].status,
    headers: { "content-type": "application/json; charset=UTF-8", ...options.headers },
  });
}

const RPC_ERRORS: Record<number, { code: ErrorCode; status: number }> = {
  [-32700]: { code: "parse_error", status: 502 },
  [-32600]: { code: "invalid_request", status: 502 },
  [-32601]: { code: "method_not_found", status: 502 },
  [-32602]: { code: "invalid_params", status: 400 },
  [-32603]: { code: "internal_error", status: 502 },
  [-32001]: { code: "not_found", status: 404 },
  [-32002]: { code: "conflict", status: 409 },
  [-32003]: { code: "unsupported_format", status: 422 },
};

export function coreMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Map a core failure to a stable code; connection failures become `core_unavailable`. */
export function coreErrorBody(base: string, error: unknown): ErrorBody {
  const message = coreMessage(error);
  const rpc = error instanceof CoreRpcError ? RPC_ERRORS[error.code] : undefined;
  return errorBody(
    base,
    rpc?.code ?? (error instanceof CoreRpcError ? "internal_error" : "core_unavailable"),
    message,
  );
}

export function coreErrorResponse(base: string, error: unknown): Response {
  const body = coreErrorBody(base, error);
  const rpc = error instanceof CoreRpcError ? RPC_ERRORS[error.code] : undefined;
  return new Response(JSON.stringify(body), {
    status: rpc?.status ?? 502,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
