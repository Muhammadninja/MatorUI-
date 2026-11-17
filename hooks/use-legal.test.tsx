/**
 * use-legal — status semantics, locale-scoped document caching, and the
 * acceptance mutation's cache behavior.
 *
 * The key invariant under test: the frontend never recomputes legal verdicts.
 * It reads `requires_acceptance` and each document's own `accepted` flag.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Opt into React's act() environment so state updates flushed inside `act`
// don't warn. Mirrors the setup used by the other renderer-based specs.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getDocuments = vi.fn();
const getStatus = vi.fn();
const accept = vi.fn();
vi.mock('@/services/legal-api', () => ({
  legalTransport: {
    getDocuments: (...a: unknown[]) => getDocuments(...a),
    getStatus: (...a: unknown[]) => getStatus(...a),
    accept: (...a: unknown[]) => accept(...a),
  },
}));

let currentLanguage = 'ru';
vi.mock('@/contexts/language.context', () => ({
  useLanguageContext: () => ({ language: currentLanguage }),
}));

import {
  legalQueryKeys,
  useAcceptLegal,
  useLegalDocuments,
  useLegalStatus,
} from './use-legal';
import type { LegalStatusResponse } from '@/types/legal';

beforeEach(() => {
  getDocuments.mockReset();
  getStatus.mockReset();
  accept.mockReset();
  currentLanguage = 'ru';
});

function makeClient(gcTime = 0) {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime } },
  });
}

/** Render a hook and expose its latest value. */
async function renderHook<T>(
  useHook: () => T,
  client = makeClient(),
): Promise<{ current: () => T; renderer: ReactTestRenderer; client: QueryClient }> {
  const box: { value: T | undefined } = { value: undefined };
  function Probe() {
    box.value = useHook();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return { current: () => box.value as T, renderer, client };
}

/** Flush pending microtasks/timers until `predicate` holds. React Query settles
 *  over several ticks, so a single `act` flush isn't always enough. */
async function waitFor(predicate: () => boolean, attempts = 50): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  if (!predicate()) throw new Error('waitFor: condition never became true');
}

const statusDoc = (
  type: 'TERMS_OF_USE' | 'PRIVACY_POLICY' | 'PERSONAL_DATA_CONSENT',
  required: number,
  acceptedVersion: number | null,
) => ({
  type,
  required_version: required,
  accepted_version: acceptedVersion,
  accepted: acceptedVersion === required,
  // Omitted (not null) when never accepted — mirrors the backend contract.
  ...(acceptedVersion === null
    ? {}
    : { accepted_at: '2026-08-31T12:33:10.000Z' }),
});

describe('useLegalDocuments', () => {
  test('fetches all three documents and exposes them by type', async () => {
    getDocuments.mockResolvedValueOnce({
      documents: [
        { type: 'TERMS_OF_USE', version: 1, title: 'Соглашение' },
        { type: 'PRIVACY_POLICY', version: 2, title: 'Политика' },
        { type: 'PERSONAL_DATA_CONSENT', version: 1, title: 'Согласие' },
      ],
    });

    const { current } = await renderHook(() => useLegalDocuments());
    await waitFor(() => current().state === 'success');

    expect(current().state).toBe('success');
    expect(current().documents).toHaveLength(3);
    // Server-provided title is surfaced verbatim (no local translation table).
    expect(current().byType('PRIVACY_POLICY')).toMatchObject({
      version: 2,
      title: 'Политика',
    });
  });

  test('cache key is locale-scoped so languages never share an entry', async () => {
    expect(legalQueryKeys.documents('ru')).toEqual(['legal-documents', 'ru']);
    expect(legalQueryKeys.documents('uz')).toEqual(['legal-documents', 'uz']);
    expect(legalQueryKeys.documents('en-US')).toEqual(['legal-documents', 'en-US']);
    // Different locales must not collide.
    expect(legalQueryKeys.documents('ru')).not.toEqual(legalQueryKeys.documents('en'));
  });

  test('the cache stores the WRAPPED response, not a bare array', async () => {
    getDocuments.mockResolvedValueOnce({
      documents: [{ type: 'TERMS_OF_USE', version: 1, title: 'T' }],
    });
    const client = makeClient();

    const { current } = await renderHook(() => useLegalDocuments(), client);
    await waitFor(() => current().state === 'success');

    const cached = client.getQueryData(legalQueryKeys.documents('ru'));
    expect(Array.isArray(cached)).toBe(false);
    expect(cached).toEqual({ documents: [{ type: 'TERMS_OF_USE', version: 1, title: 'T' }] });
  });

  test('an empty document list is `empty`, not `success`', async () => {
    getDocuments.mockResolvedValueOnce({ documents: [] });
    const { current } = await renderHook(() => useLegalDocuments());
    await waitFor(() => current().state === 'empty');
    expect(current().state).toBe('empty');
  });

  test('a failed request surfaces the error state', async () => {
    getDocuments.mockRejectedValueOnce(new Error('offline'));
    const { current } = await renderHook(() => useLegalDocuments());
    await waitFor(() => current().state === 'error');
    expect(current().state).toBe('error');
  });
});

describe('useLegalStatus', () => {
  test('all documents accepted → no acceptance required', async () => {
    getStatus.mockResolvedValueOnce({
      requires_acceptance: false,
      documents: [
        statusDoc('TERMS_OF_USE', 1, 1),
        statusDoc('PRIVACY_POLICY', 1, 1),
        statusDoc('PERSONAL_DATA_CONSENT', 1, 1),
      ],
    } satisfies LegalStatusResponse);

    const { current } = await renderHook(() => useLegalStatus(true));
    await waitFor(() => current().status !== null);

    expect(current().requiresAcceptance).toBe(false);
    expect(current().outstandingTypes).toEqual([]);
  });

  test('ONE outdated document → only that one is outstanding', async () => {
    getStatus.mockResolvedValueOnce({
      requires_acceptance: true,
      documents: [
        statusDoc('TERMS_OF_USE', 1, 1),
        statusDoc('PRIVACY_POLICY', 2, 1), // accepted v1, now requires v2
        statusDoc('PERSONAL_DATA_CONSENT', 1, 1),
      ],
    } satisfies LegalStatusResponse);

    const { current } = await renderHook(() => useLegalStatus(true));
    await waitFor(() => current().status !== null);

    expect(current().requiresAcceptance).toBe(true);
    // The already-accepted documents are NOT dragged back into the flow.
    expect(current().outstandingTypes).toEqual(['PRIVACY_POLICY']);
  });

  test('MULTIPLE outdated documents are all reported', async () => {
    getStatus.mockResolvedValueOnce({
      requires_acceptance: true,
      documents: [
        statusDoc('TERMS_OF_USE', 3, 1),
        statusDoc('PRIVACY_POLICY', 2, 1),
        statusDoc('PERSONAL_DATA_CONSENT', 1, 1),
      ],
    } satisfies LegalStatusResponse);

    const { current } = await renderHook(() => useLegalStatus(true));
    await waitFor(() => current().status !== null);

    expect(current().outstandingTypes).toEqual(['TERMS_OF_USE', 'PRIVACY_POLICY']);
  });

  test('a never-accepted document (accepted_version null) is outstanding', async () => {
    getStatus.mockResolvedValueOnce({
      requires_acceptance: true,
      documents: [statusDoc('PERSONAL_DATA_CONSENT', 1, null)],
    } satisfies LegalStatusResponse);

    const { current } = await renderHook(() => useLegalStatus(true));
    await waitFor(() => current().status !== null);

    expect(current().outstandingTypes).toEqual(['PERSONAL_DATA_CONSENT']);
    expect(current().status?.documents[0]!.accepted_version).toBeNull();
    // Absent accepted_at stays absent.
    expect(current().status?.documents[0]!.accepted_at).toBeUndefined();
  });

  test('does not call the authenticated endpoint when signed out', async () => {
    await renderHook(() => useLegalStatus(false));
    expect(getStatus).not.toHaveBeenCalled();
  });

  test('while loading, requiresAcceptance is not yet trustworthy — isLoading says so', async () => {
    // Never resolves: models the in-flight window.
    getStatus.mockReturnValueOnce(new Promise(() => {}));
    const { current } = await renderHook(() => useLegalStatus(true));
    expect(current().isLoading).toBe(true);
  });
});

describe('session transitions', () => {
  test('signing out drops the cached status so the next user cannot read it', async () => {
    getStatus.mockResolvedValueOnce({
      requires_acceptance: false,
      documents: [statusDoc('TERMS_OF_USE', 1, 1)],
    } satisfies LegalStatusResponse);
    const client = makeClient();

    // Signed in: status is fetched and cached.
    const box: { enabled: boolean } = { enabled: true };
    const values: { current: ReturnType<typeof useLegalStatus> | undefined } = {
      current: undefined,
    };
    function Probe({ enabled }: { enabled: boolean }) {
      values.current = useLegalStatus(enabled);
      return null;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <Probe enabled={box.enabled} />
        </QueryClientProvider>,
      );
    });
    await waitFor(() => values.current?.status != null);
    expect(client.getQueryData(legalQueryKeys.status())).toBeDefined();

    // Sign out: the hook is re-rendered with enabled=false.
    await act(async () => {
      renderer.update(
        <QueryClientProvider client={client}>
          <Probe enabled={false} />
        </QueryClientProvider>,
      );
    });

    // User A's acceptance must not linger for whoever signs in next.
    expect(client.getQueryData(legalQueryKeys.status())).toBeUndefined();
  });
});

describe('useAcceptLegal', () => {
  test('sends the acceptances and seeds status from the response — no second GET', async () => {
    const updated: LegalStatusResponse = {
      requires_acceptance: false,
      documents: [statusDoc('PRIVACY_POLICY', 2, 2)],
    };
    accept.mockResolvedValueOnce(updated);
    // Keep this inactive cache key alive long enough to assert synchronous
    // mutation seeding; production clients use React Query's normal GC window.
    const client = makeClient(Infinity);

    const { current } = await renderHook(() => useAcceptLegal(), client);

    await act(async () => {
      await current().accept([{ type: 'PRIVACY_POLICY', version: 2 }]);
    });

    expect(accept).toHaveBeenCalledWith([{ type: 'PRIVACY_POLICY', version: 2 }]);
    // The mutation response populates the status cache directly.
    expect(client.getQueryData(legalQueryKeys.status())).toEqual(updated);
    expect(getStatus).not.toHaveBeenCalled();
  });
});
