/**
 * Compatibility "Check If It Fits" — client flow contract.
 *
 * Guards the mobile half of POST /v1/catalog/parts/:id/check-compatibility:
 *   1. the service builds the right request (path + { vehicleId | vin } body)
 *      and passes the backend's status/badge contract straight through;
 *   2. it FAILS SOFT to `null` when the check can't run (mock/offline build, or
 *      no vehicle identifier) — this is what stops the item screen from ever
 *      rendering a fabricated fit badge (the original "false green" bug);
 *   3. the useCompatibility hook fetches on mount and exposes the result, and
 *      no-ops when there's no vehicle.
 *
 * Backend status→badge mapping itself is covered on the server
 * (mator.uz/Backend/src/catalog/parts/check-compatibility.spec.ts).
 */
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Tell React this is a valid `act()` environment (silences the "not configured
// to support act" warning; react-test-renderer needs it to flush effects).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Mutable transport gate so a single test can flip HTTP↔mock.
const gate = vi.hoisted(() => ({ http: true }));
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => gate.http,
}));

const post = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => post(...a) },
}));

import { checkCompatibility, type CompatibilityResult } from './compatibility-service';
import { useCompatibility } from '@/hooks/use-compatibility';

const NOT_COMPATIBLE: CompatibilityResult = {
  partId: 'p1',
  vehicleId: 'v1',
  status: 'NOT_COMPATIBLE',
  isCompatible: false,
  badge: { text: 'Не подходит для вашего авто', color: 'red' },
  details: { matchedBy: 'MODEL_REF', oemNumber: '96484900' },
};

const UNCERTAIN: CompatibilityResult = {
  ...NOT_COMPATIBLE,
  status: 'UNCERTAIN',
  isCompatible: false,
  badge: { text: 'Требует уточнения (проверьте VIN)', color: 'yellow' },
};
const EXACT_MATCH: CompatibilityResult = {
  ...NOT_COMPATIBLE,
  status: 'EXACT_MATCH',
  isCompatible: true,
  badge: { text: 'Подходит', color: 'green' },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  gate.http = true;
  post.mockReset();
  post.mockResolvedValue(NOT_COMPATIBLE);
});

describe('checkCompatibility — request building', () => {
  test('POSTs to the check-compatibility endpoint with the vehicleId body', async () => {
    const res = await checkCompatibility('p1', { vehicleId: 'v1' });
    expect(post).toHaveBeenCalledWith(
      '/v1/catalog/parts/p1/check-compatibility',
      { vehicleId: 'v1', vin: undefined },
    );
    expect(res).toEqual(NOT_COMPATIBLE);
  });

  test('passes the VIN through when no vehicleId is given', async () => {
    await checkCompatibility('p1', { vin: 'WVWZZZ1KZAW000001' });
    expect(post).toHaveBeenCalledWith(
      '/v1/catalog/parts/p1/check-compatibility',
      { vehicleId: undefined, vin: 'WVWZZZ1KZAW000001' },
    );
  });

  test('encodes the part id into the path', async () => {
    await checkCompatibility('part/stock 6', { vehicleId: 'v1' });
    expect(post).toHaveBeenCalledWith(
      '/v1/catalog/parts/part%2Fstock%206/check-compatibility',
      expect.anything(),
    );
  });
});

describe('checkCompatibility — fails soft (no false badge)', () => {
  test('preserves an unknown answer without converting it into a positive match', async () => {
    post.mockResolvedValue(UNCERTAIN);
    const res = await checkCompatibility('p1', { vehicleId: 'v1' });
    expect(res).toMatchObject({ status: 'UNCERTAIN', isCompatible: false, badge: { color: 'yellow' } });
  });
  test('returns null on a mock/offline build (no HTTP transport) and never calls the API', async () => {
    gate.http = false;
    const res = await checkCompatibility('p1', { vehicleId: 'v1' });
    expect(res).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  test('returns null when neither vehicleId nor vin is supplied', async () => {
    const res = await checkCompatibility('p1', {});
    expect(res).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});

// The hook renders no react-native components (the probe returns null), so
// react-test-renderer runs it cleanly in the node test env.
async function renderHook(partId: string | null, vehicleId?: string, vin?: string) {
  const seen: Array<ReturnType<typeof useCompatibility>> = [];
  let input = { partId, vehicleId, vin };
  function Probe() {
    seen.push(useCompatibility(input.partId, input.vehicleId, input.vin));
    return null;
  }
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(createElement(Probe));
  });
  return {
    seen, last: () => seen[seen.length - 1], tree,
    update: async (next: typeof input) => {
      input = next;
      await act(async () => { tree?.update(createElement(Probe)); });
    },
  };
}

describe('useCompatibility — mount flow', () => {
  afterEach(() => {
    // nothing persistent; renderers are unmounted per-test below
  });

  test('fetches on mount and exposes the result', async () => {
    const { last, tree } = await renderHook('p1', 'v1');
    expect(post).toHaveBeenCalledTimes(1);
    expect(last().result).toEqual(NOT_COMPATIBLE);
    expect(last().loading).toBe(false);
    await act(async () => tree?.unmount());
  });

  test('no-ops (no fetch, null result) when there is no active vehicle', async () => {
    const { last, tree } = await renderHook('p1', undefined, undefined);
    expect(post).not.toHaveBeenCalled();
    expect(last().result).toBeNull();
    await act(async () => tree?.unmount());
  });

  test('network failure is no answer, never a fabricated positive badge', async () => {
    post.mockRejectedValue(new Error('offline'));
    const { last, tree } = await renderHook('p1', 'v1');
    expect(last()).toEqual({ result: null, loading: false });
    await act(async () => tree?.unmount());
  });

  test.each([
    { partId: 'p1', vehicleId: 'v2', vin: undefined },
    { partId: 'p2', vehicleId: 'v1', vin: undefined },
    { partId: 'p1', vehicleId: 'v1', vin: 'WVWZZZ1KZAW000001' },
  ])('does not expose the prior positive badge while a changed selection is pending: %j', async (next) => {
    post.mockResolvedValueOnce(EXACT_MATCH);
    const hook = await renderHook('p1', 'v1');
    expect(hook.last().result?.status).toBe('EXACT_MATCH');
    const request = deferred<CompatibilityResult>();
    post.mockReturnValueOnce(request.promise);
    const start = hook.seen.length;
    await hook.update(next);
    expect(hook.seen.slice(start).every(({ result }) => result === null)).toBe(true);
    expect(hook.last()).toEqual({ result: null, loading: true });
    await act(async () => { request.resolve({ ...UNCERTAIN, partId: next.partId, vehicleId: next.vehicleId }); });
    expect(hook.last().result).toMatchObject({ status: 'UNCERTAIN', isCompatible: false });
    await act(async () => hook.tree?.unmount());
  });
});
