/**
 * apiClient — unit tests.
 *
 * We mock fetch at module scope so we can shape each scenario's response
 * sequence (retry chains, 401 → handler, abort, etc.) without touching
 * the network. `config/api.ts` is also mocked so the base URL and auth
 * token are controlled inputs, not env-dependent.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: vi.fn(async () => 'tkn'),
  shouldUseHttpTransport: () => true,
}));

import { apiClient, ApiError, invalidateAuthRequests, setAppLanguage, setUnauthorizedHandler } from './api-client';
import * as config from '@/config/api';

const originalFetch = globalThis.fetch;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  setUnauthorizedHandler(null);
  setAppLanguage('en');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function bad(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiClient — happy paths', () => {
  test('GET injects Bearer token and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 'abc' }));
    const res = await apiClient.get<{ id: string }>('/items/abc');
    expect(res).toEqual({ id: 'abc' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.test/items/abc');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tkn');
  });

  test('sends the registered app language as Accept-Language', async () => {
    setAppLanguage('uz');
    fetchMock.mockResolvedValueOnce(ok({ ok: true }));
    await apiClient.get('/v1/categories');

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)['Accept-Language']).toBe('uz');
  });

  test('a per-request Accept-Language overrides the registered language', async () => {
    setAppLanguage('uz');
    fetchMock.mockResolvedValueOnce(ok({ ok: true }));
    await apiClient.get('/v1/categories', { headers: { 'Accept-Language': 'ru' } });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)['Accept-Language']).toBe('ru');
  });

  test('skipLanguage omits Accept-Language entirely', async () => {
    setAppLanguage('uz');
    fetchMock.mockResolvedValueOnce(ok({ ok: true }));
    // The sourcing chat detects language from the message text; telling it
    // otherwise would override what the buyer actually typed.
    await apiClient.post('/api/ai-chat/message', { message: 'tormoz' }, { skipLanguage: true });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)['Accept-Language']).toBeUndefined();
  });

  test('POST serializes body + sets Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ok: true }));
    await apiClient.post('/x', { a: 1 });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  test('204 returns undefined without throwing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const res = await apiClient.delete('/x');
    expect(res).toBeUndefined();
  });

  test('skipAuth omits the Authorization header', async () => {
    fetchMock.mockResolvedValueOnce(ok({}));
    await apiClient.post('/auth/sign-in', { e: 'a' }, { skipAuth: true });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  test('null token does not set Authorization', async () => {
    (config.getAuthToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    fetchMock.mockResolvedValueOnce(ok({}));
    await apiClient.get('/public');

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('apiClient — retry behavior', () => {
  test('GET retries on 5xx then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(bad({ code: 'X', message: 'down' }, 503))
      .mockResolvedValueOnce(ok({ ok: true }));
    const res = await apiClient.get('/x', { maxRetries: 1 });
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('POST does NOT retry on 5xx (non-idempotent)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(bad({ code: 'X', message: 'down' }, 502)),
    );
    await expect(apiClient.post('/x', { a: 1 }, { maxRetries: 2 })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each(['post', 'patch', 'put', 'delete'] as const)('%s does not replay ambiguous network failures', async (method) => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiClient[method]('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('GET still retries network errors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(ok({ ok: true }));
    await expect(apiClient.get('/x', { maxRetries: 1 })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('completed requests release caller abort listeners', async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    fetchMock.mockImplementation(async () => ok({}));
    for (let i = 0; i < 20; i++) await apiClient.get('/x', { signal: controller.signal });
    expect(add).toHaveBeenCalledTimes(20);
    expect(remove).toHaveBeenCalledTimes(20);
    for (let i = 0; i < 20; i++) expect(remove.mock.calls[i]?.[1]).toBe(add.mock.calls[i]?.[1]);
  });

  test('gives up after maxRetries on persistent 5xx', async () => {
    // mockImplementation rather than mockResolvedValue so each call gets
    // its OWN Response — a fetch Response body is single-use, and the
    // retry path reads `res.text()` on every attempt.
    fetchMock.mockImplementation(() => Promise.resolve(bad({ message: 'bad' }, 503)));
    const err = (await apiClient
      .get('/x', { maxRetries: 2 })
      .catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.isTransient).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('apiClient — 401 handling', () => {
  test('invokes onUnauthorized handler and throws ApiError', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetchMock.mockImplementation(() =>
      Promise.resolve(bad({ code: 'AUTH', message: 'nope' }, 401)),
    );

    const err = (await apiClient.get('/x').catch((e) => e)) as ApiError;
    expect(handler).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('AUTH');
    expect(err.isUnauthorized).toBe(true);
  });

  test('no handler registered — still throws ApiError', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(bad({}, 401)));
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
  });

  test('401 → handler refreshes token → retries once with the fresh token and succeeds', async () => {
    const handler = vi.fn(); // simulates a successful refresh
    setUnauthorizedHandler(handler);
    (config.getAuthToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('stale') // first attempt's header
      .mockResolvedValueOnce('fresh') // 401-branch check → truthy → retry
      .mockResolvedValueOnce('fresh'); // retry's header
    fetchMock
      .mockResolvedValueOnce(bad({ message: 'expired' }, 401))
      .mockResolvedValueOnce(ok({ ok: true }));

    const res = await apiClient.patch('/me', { first_name: 'A' });
    expect(res).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchMock.mock.calls[1]!;
    expect((retryInit!.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  test('401 → refresh yields no token (signed out) → throws once, no retry loop', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    (config.getAuthToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce('stale') // header
      .mockResolvedValueOnce(null); // 401-branch check → falsy → throw
    fetchMock.mockResolvedValue(bad({ code: 'UNAUTHORIZED', message: 'nope' }, 401));

    const err = (await apiClient.get('/x').catch((e) => e)) as ApiError;
    expect(err.status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiClient — 4xx client errors', () => {
  test('400 does not retry', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(bad({ message: 'bad input' }, 400)),
    );
    await expect(apiClient.get('/x', { maxRetries: 2 })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('404 returns ApiError with status 404 (caller can branch on it)', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(bad({}, 404)));
    const err = (await apiClient.get('/x').catch((e) => e)) as ApiError;
    expect(err.status).toBe(404);
    expect(err.isTransient).toBe(false);
  });
});

describe('apiClient — abort propagation', () => {
  test('native cancellation errors normalize to AbortError for caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(new Error('fetch failed: FetchRequestCanceledException Expo/NativeResponse.swift:63'));
    await expect(apiClient.patch('/v1/cart/items/test', { quantity: 2 }, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError', message: 'Request cancelled' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('native timeout errors show a safe message and never retry a cart write', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(
          new Error('fetch failed: FetchRequestCanceledException Expo/NativeResponse.swift:63'),
        ));
      }));
      const rejected = expect(apiClient.patch('/v1/cart/items/test', { quantity: 2 }, { timeoutMs: 10 }))
        .rejects.toMatchObject({ code: 'TIMEOUT', message: 'Request timed out.' });
      await vi.advanceTimersByTimeAsync(10);
      await rejected;
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

  test('native read timeout errors retain the bounded retry policy', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new Error('native request cancelled')));
      }));
      const rejected = expect(apiClient.get('/v1/cart', { timeoutMs: 10, maxRetries: 1 }))
        .rejects.toMatchObject({ code: 'TIMEOUT', message: 'Request timed out.' });
      await vi.runAllTimersAsync();
      await rejected;
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  test('pre-aborted signal propagates as AbortError, not ApiError', async () => {
    // Aborting before the call is simpler than racing: fetch sees an
    // already-aborted signal and rejects immediately.
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockImplementation((_url, init) => {
      if (init?.signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.resolve(ok({}));
    });
    const err = await apiClient
      .get('/x', { signal: controller.signal })
      .catch((e) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
  });
});

describe('apiClient — session isolation', () => {
  test('an old response is discarded after the session changes', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const request = apiClient.get('/v1/cart');
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    invalidateAuthRequests();
    resolve(ok({ items: ['previous-account'] }));
    await rejected;
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('a previous session 401 never refreshes the new account', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const request = apiClient.patch('/v1/cart/items/old', { quantity: 2 });
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    invalidateAuthRequests();
    resolve(bad({ message: 'expired' }, 401));
    await rejected;
    expect(handler).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('a transient failure cannot retry with a different account', async () => {
    fetchMock.mockImplementationOnce(async () => {
      invalidateAuthRequests();
      throw new TypeError('offline');
    });
    await expect(apiClient.patch('/v1/cart/items/old', { quantity: 2 }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
