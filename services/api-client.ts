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
import { debugLog } from '@/services/debug-log';

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
let authRequestEpoch = 0;

/** Invalidate responses and retries belonging to a former login session. */
export function invalidateAuthRequests(): void {
  authRequestEpoch += 1;
}

/** Register the auth layer's 401 callback. Called by `user.context.tsx`
 *  on mount. The handler typically attempts a token refresh and, on
 *  failure, signs the user out and routes to /auth. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

// ── Language hook ──────────────────────────────────────────────────────

/** The interface language sent as `Accept-Language` on every request, so the
 *  backend can resolve localized fields (category `label`, part descriptions)
 *  server-side.
 *
 *  Seeded to the same code as `FALLBACK_LANGUAGE` in `services/i18n.ts` — kept
 *  as a literal rather than an import so this transport module doesn't pull in
 *  i18next and every locale bundle. It covers the window before
 *  `language.context` hydrates the persisted choice (an async storage read, so
 *  no synchronous value exists to use), during which requests are sent in the
 *  app's default language rather than with no header at all. */
let appLanguage = 'en';

/** Register the app's interface language. Called by `language.context.tsx`
 *  on hydration and on every user switch. Pass the *app's* chosen language,
 *  not the device locale — they can differ. */
export function setAppLanguage(code: string) {
  appLanguage = code;
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
  /** Skip `Accept-Language` injection. For the handful of endpoints that
   *  detect the language from the payload themselves and must not be told
   *  otherwise — currently the sourcing chat (`POST /api/ai-chat/message`),
   *  which infers language from the message text. */
  skipLanguage?: boolean;
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
  const epoch = authRequestEpoch;
  const assertCurrentSession = () => {
    if (!opts.skipAuth && epoch !== authRequestEpoch) {
      throw new DOMException('Authentication session changed', 'AbortError');
    }
  };
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
  // Guards a single refresh-and-retry on a 401 (token expired mid-request).
  let authRetried = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    assertCurrentSession();
    const { signal, cleanup } = composeSignal(opts.signal, timeoutMs);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        // Server-side localization (category labels, etc.) keys off this.
        // Caller-supplied headers still win, so a transport can override it.
        ...(opts.skipLanguage ? null : { 'Accept-Language': appLanguage }),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...opts.headers,
      };
      if (!opts.skipAuth) {
        const token = await getAuthToken();
        assertCurrentSession();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const attemptLabel = attempt > 0 ? ` (retry ${attempt})` : '';
      debugLog('api', `→ ${method} ${path}${attemptLabel}`, body);

      const startedAt = Date.now();
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      const ms = Date.now() - startedAt;
      assertCurrentSession();
      debugLog('api', `← ${res.status} ${method} ${path} (${ms}ms)`);

      if (res.status === 204) return undefined as T;

      // Try to parse JSON, but tolerate non-JSON bodies (e.g. empty 200).
      const text = await res.text();
      assertCurrentSession();
      const parsed = text ? safeJsonParse(text) : undefined;

      if (!res.ok) {
        debugLog('api', `✗ ${res.status} ${method} ${path}`, parsed);
        if (res.status === 401) {
          // The access token likely expired mid-request. Let the auth layer
          // refresh it (persisting a new session), then retry ONCE with the
          // fresh token — otherwise a routine expiry surfaces to the user as a
          // spurious "Unauthorized" on an action they're actually allowed to do
          // (e.g. Save profile), even though the very next attempt would work.
          // Only fall through to throw when: auth is skipped, we already retried,
          // there's no handler, or the refresh yielded no token (refresh
          // failed → the handler has signed the user out and routed to sign-in).
          if (!opts.skipAuth && !authRetried && unauthorizedHandler) {
            authRetried = true;
            await unauthorizedHandler();
            assertCurrentSession();
            const refreshedToken = await getAuthToken();
            assertCurrentSession();
            if (refreshedToken) {
              // Don't let the refresh-retry consume the transient-retry budget.
              attempt--;
              continue;
            }
            // No token after refresh → refresh failed and the handler has
            // already signed the user out; fall through and surface the 401.
          }
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
      assertCurrentSession();
      // Expo fetch may reject cancellation with an ordinary native Error.
      // The signals distinguish caller cancellation from our timeout reliably.
      if (opts.signal?.aborted) {
        throw raw instanceof DOMException && raw.name === 'AbortError'
          ? raw
          : new DOMException('Request cancelled', 'AbortError');
      }
      // Internal timeout abort or network error: treat as transient.
      const isAbort = signal.aborted || (raw instanceof DOMException && raw.name === 'AbortError');
      const isNetwork = !isAbort && raw instanceof TypeError; // fetch's network-error shape
      if (isAbort || isNetwork) {
        debugLog('api', `✗ ${isAbort ? 'TIMEOUT' : 'NETWORK'} ${method} ${path}`);
        const err = new ApiError(
          0,
          isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
          isAbort ? 'Request timed out.' : 'Network request failed.',
        );
        // A lost response does not prove a write was rejected by the server.
        // Retry reads only; replaying a write can create duplicate orders.
        if (isIdempotent && attempt < maxRetries) {
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

  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
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
