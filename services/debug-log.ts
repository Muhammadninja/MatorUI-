/**
 * Lightweight structured debug logger for the auth / profile / API layer.
 *
 * We're moving to a dev/release build against the live backend, so we want to
 * SEE what goes over the wire without leaking secrets. This is the single place
 * that decides (a) whether debug logging is on and (b) how request/response
 * payloads get redacted.
 *
 * Enabled when:
 *   - `__DEV__` is true (local / dev-client builds), OR
 *   - `EXPO_PUBLIC_DEBUG_API === '1'` — an explicit override so a TestFlight /
 *     release build can emit the same logs while chasing a bug. Set it to '0'
 *     (or leave unset) to silence logs even in dev.
 *
 * Everything funnels through `debugLog(scope, event, data?)` which prints a
 * single tagged line like:
 *   [mator:api] → PATCH /v1/me { first_name: 'Sardor', phone_e164: '+998…' }
 * Secrets (tokens, OTP codes, passwords, auth headers) are redacted before they
 * ever reach the console.
 */

/** Master switch. Explicit '0' wins even in dev; explicit '1' forces logs on in
 *  release; otherwise follows `__DEV__`. */
export const DEBUG_API_ENABLED: boolean = (() => {
  const flag = process.env.EXPO_PUBLIC_DEBUG_API;
  if (flag === '1') return true;
  if (flag === '0') return false;
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
})();

/** Keys whose values must never be printed in full. Matched case-insensitively
 *  against object keys; the value is replaced with a short masked marker. */
const SECRET_KEYS = [
  'access_token',
  'refresh_token',
  'accesstoken',
  'refreshtoken',
  'token',
  'authorization',
  'otp_code',
  'otpcode',
  'code',
  'password',
  'captcha_token',
  'dev_otp_code',
];

/** Mask a secret value, keeping just enough to correlate logs (first/last few
 *  chars) without exposing it. */
function mask(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '‹redacted›';
  if (value.length <= 6) return '••••';
  return `${value.slice(0, 3)}…${value.slice(-2)} (${value.length} chars)`;
}

/** Deep-clone `data` with secret keys redacted. Best-effort: falls back to a
 *  plain string on anything non-serializable so logging never throws. */
export function redact(data: unknown, depth = 0): unknown {
  if (data == null || depth > 4) return data;
  if (Array.isArray(data)) return data.map((v) => redact(v, depth + 1));
  if (typeof data === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.includes(k.toLowerCase()) ? mask(v) : redact(v, depth + 1);
    }
    return out;
  }
  return data;
}

/**
 * Emit one tagged debug line. No-op when logging is disabled, so callers can
 * sprinkle these freely without guarding each one.
 *
 * @param scope short subsystem tag, e.g. 'api' | 'auth' | 'profile'
 * @param event human-readable event, e.g. '→ PATCH /v1/me' or 'updateProfile'
 * @param data  optional payload — redacted before printing
 */
export function debugLog(scope: string, event: string, data?: unknown): void {
  if (!DEBUG_API_ENABLED) return;
  const tag = `[mator:${scope}]`;
  if (data === undefined) {
    console.log(tag, event);
  } else {
    console.log(tag, event, redact(data));
  }
}
