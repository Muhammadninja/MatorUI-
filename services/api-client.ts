/**
 * Unified HTTP client used by every transport.
 *
 * Wraps `fetch` with the cross-cutting concerns we want to enforce once:
 *
 *   1. **Auth header** injected from `getAuthToken()` (config/api.ts).
 *   2. **Timeout** via an internally-managed AbortController — chained
 *      with any caller-supplied signal.
 *   3. **Retry** with exponential backoff for transient failures (network
 *      errors + 5xx), capped at `maxRetries` attempts. Idempotent methods
 *      (GET, HEAD) retry by default; mutating methods only retry on
 *      network failure (not on 5xx, which may have already succeeded
 *      server-side).
 *   4. **401 handling**: invokes a single registered `onUnauthorized()`
 *      callback (wired by the auth layer to trigger token refresh →
 *      sign-out). The original request is NOT auto-retried — the auth
 *      layer decides what to do, then callers retry with a fresh token.
 *   5. **Structured errors**: every failure throws an `ApiError` with
 *      `.status`, `.code`, and the raw response when available. Consumers
 *      can `instanceof ApiError` and surface user-friendly toasts.
 *
 * Usage:
 *   const order = await apiClient.get<Order>('/v1/orders/123');
 *   await apiClient.post('/v1/cart/items', { id, qty });
 */

import { getApiBaseUrl, getAuthToken } from '@/config/api';

// ── Error type ─────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly response?: unknown,
    /** Seconds to wait before retrying, parsed from the `Retry-After`
     *  header on a 429. Undefined when the header is absent/unparseable. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the failure was a network / DNS / connect error (no HTTP
   *  status returned). Useful for "you're offline" UI. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** True when the server throttled the client (global rate limit).
   *  Callers should back off and respect `retryAfterSeconds`. */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** True when retrying with the same request might succeed. */
  get isTransient(): boolean {
    return this.isNetworkError || (this.status >= 500 && this.status < 600);
  }

  /** True when the server rejected the credentials. The auth layer's
   *  `onUnauthorized()` will already have fired by the time this throws. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

// ── 401 hook ───────────────────────────────────────────────────────────

type UnauthorizedHandler = () => void | Promise<void>;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Register the auth layer's 401 callback. Called by `user.context.tsx`
 *  on mount. The handler typically attempts a token refresh and, on
 *  failure, signs the user out and routes to /auth. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

// ── Request types ──────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';

export type RequestOptions = {
  /** Caller-supplied abort signal — composed with the internal timeout signal. */
  signal?: AbortSignal;
  /** Per-request timeout override in ms. Default 15_000. */
  timeoutMs?: number;
  /** Max retry attempts on transient failures. Default 2. */
  maxRetries?: number;
  /** Skip auth header injection (e.g. for /auth/sign-in itself). */
  skipAuth?: boolean;
  /** Extra headers to merge. */
  headers?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;

// ── Core request fn ────────────────────────────────────────────────────

async function request<T>(
  method: HttpMethod,
  path: string,
  body: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      0,
      'NO_API_BASE_URL',
      'No EXPO_PUBLIC_API_BASE_URL configured. apiClient cannot run against a mock backend. Use the transport layer instead.',
    );
  }

  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { signal, cleanup } = composeSignal(opts.signal, timeoutMs);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...opts.headers,
      };
      if (!opts.skipAuth) {
        const token = await getAuthToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });

      if (res.status === 204) return undefined as T;

      // Try to parse JSON, but tolerate non-JSON bodies (e.g. empty 200).
      const text = await res.text();
      const parsed = text ? safeJsonParse(text) : undefined;

      if (!res.ok) {
        if (res.status === 401) {
          await unauthorizedHandler?.();
          throw new ApiError(
            401,
            extractCode(parsed) ?? 'UNAUTHORIZED',
            extractMessage(parsed) ?? 'Authentication required.',
            parsed,
          );
        }
        const code = extractCode(parsed) ?? `HTTP_${res.status}`;
        const message = extractMessage(parsed) ?? `Request failed (${res.status}).`;
        const retryAfter =
          res.status === 429 ? parseRetryAfter(res.headers.get('Retry-After')) : undefined;
        const err = new ApiError(res.status, code, message, parsed, retryAfter);
        // 5xx is retryable on idempotent methods; throw to retry loop.
        if (err.isTransient && isIdempotent && attempt < maxRetries) {
          lastError = err;
          await backoff(attempt);
          continue;
        }
        throw err;
      }

      return parsed as T;
    } catch (raw) {
      // Caller-initiated abort — surface as-is (no retry, no wrap).
      if (raw instanceof DOMException && raw.name === 'AbortError' && opts.signal?.aborted) {
        throw raw;
      }
      // Internal timeout abort or network error: treat as transient.
      const isAbort = raw instanceof DOMException && raw.name === 'AbortError';
      const isNetwork = raw instanceof TypeError; // fetch's network-error shape
      if (isAbort || isNetwork) {
        const err = new ApiError(
          0,
          isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          isAbort ? 'Request timed out.' : 'Network request failed.',
        );
        // Idempotent OR network error (likely the request never reached
        // the server) → retry. Non-idempotent timeouts do NOT retry to
        // avoid double-submits.
        if ((isIdempotent || isNetwork) && attempt < maxRetries) {
          lastError = err;
          await backoff(attempt);
          continue;
        }
        throw err;
      }
      // Already an ApiError or unknown — rethrow.
      throw raw;
    } finally {
      cleanup();
    }
  }

  // Unreachable in practice — loop always returns or throws — but TS needs it.
  throw lastError;
}

// ── Helpers ────────────────────────────────────────────────────────────

function composeSignal(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

function backoff(attempt: number): Promise<void> {
  // 200ms, 400ms, 800ms… with a small random jitter so retries from a
  // fleet of clients don't synchronize.
  const base = 200 * 2 ** attempt;
  const jitter = base * 0.25 * (1 - 2 * pseudoRandom(attempt));
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}

// Deterministic-ish jitter — Math.random would be fine but pure functions
// are easier to test if we ever add a `backoff` unit test.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Parse a `Retry-After` header. Supports the delta-seconds form ("30")
 *  and the HTTP-date form; returns whole seconds from now, or undefined. */
function parseRetryAfter(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(0, Math.round(secs));
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return undefined;
  return Math.max(0, Math.round((when - Date.now()) / 1000));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractCode(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'code' in body) {
    const c = (body as { code: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return undefined;
}

function extractMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const obj = body as { message?: unknown; error?: unknown };
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  return undefined;
}

// ── Public surface ─────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PUT', path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>('DELETE', path, undefined, opts),
};
