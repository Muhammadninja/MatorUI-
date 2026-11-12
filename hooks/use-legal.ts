/**
 * Legal React glue — documents/status reads via React Query, acceptance as a
 * mutation that seeds the status cache from its own response.
 *
 * Mirrors `use-orders.ts`: a `queryKeys` map, `state` discriminators for the
 * screens' loading/error/empty UI, and no business logic — every legal decision
 * (which documents are required, whether a version is current, whether the user
 * has accepted) belongs to the backend.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useLanguageContext } from '@/contexts/language.context';
import { ApiError } from '@/services/api-client';
import { legalTransport } from '@/services/legal-api';
import type {
  LegalAcceptanceInput,
  LegalDocument,
  LegalDocumentType,
  LegalStatusResponse,
} from '@/types/legal';

// ── Query keys ─────────────────────────────────────────────────────────

export const legalQueryKeys = {
  /** Locale-scoped, so switching language refetches instead of serving the
   *  previous language's cached text (`legal-documents:{locale}`). */
  documents: (locale: string) => ['legal-documents', locale] as const,
  /** One document in force, by type — same locale scoping as the list. */
  document: (type: LegalDocumentType, locale: string) =>
    ['legal-document', type, locale] as const,
  status: () => ['legal', 'status'] as const,
};

// ── useLegalDocuments ──────────────────────────────────────────────────

export type LegalDocumentsState = 'loading' | 'success' | 'empty' | 'error';

export type UseLegalDocumentsValue = {
  state: LegalDocumentsState;
  documents: LegalDocument[];
  /** Convenience lookup for the single-document screens. */
  byType: (type: LegalDocumentType) => LegalDocument | null;
  error: string | null;
  refresh: () => void;
};

/**
 * @param enabled false skips the request — for a screen showing a document the
 *        consent list does not carry. State then stays 'loading'; such a caller
 *        reads {@link useLegalDocument} instead.
 */
export function useLegalDocuments(enabled = true): UseLegalDocumentsValue {
  const { language } = useLanguageContext();

  const query = useQuery({
    queryKey: legalQueryKeys.documents(language),
    queryFn: ({ signal }) => legalTransport.getDocuments(signal),
    enabled,
  });

  return useMemo<UseLegalDocumentsValue>(() => {
    // The cache holds the backend's `{ documents }` envelope; unwrap it here
    // for consumers rather than reshaping it on the way in.
    const documents = query.data?.documents ?? [];
    let state: LegalDocumentsState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (documents.length === 0) state = 'empty';
    else state = 'success';

    return {
      state,
      documents,
      byType: (type) => documents.find((d) => d.type === type) ?? null,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

// ── useLegalDocument ───────────────────────────────────────────────────

export type UseLegalDocumentValue = {
  /** 'empty' = the backend has no version of this document in force (404). */
  state: LegalDocumentsState;
  document: LegalDocument | null;
  error: string | null;
  refresh: () => void;
};

/**
 * One document in force, by type, from GET /v1/legal/documents/:type — for
 * an informational document such as REFUND_POLICY, which the consent list
 * does not carry.
 */
export function useLegalDocument(
  type: LegalDocumentType,
  enabled = true,
): UseLegalDocumentValue {
  const { language } = useLanguageContext();

  const query = useQuery({
    queryKey: legalQueryKeys.document(type, language),
    queryFn: ({ signal }) => legalTransport.getCurrentDocument(type, signal),
    enabled,
    // A 404 is an answer ("not published"), not a transient failure.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  return useMemo<UseLegalDocumentValue>(() => {
    const notPublished = query.error instanceof ApiError && query.error.status === 404;
    let state: LegalDocumentsState;
    if (query.isPending) state = 'loading';
    else if (notPublished) state = 'empty';
    else if (query.isError) state = 'error';
    else state = 'success';

    return {
      state,
      document: query.data ?? null,
      error: !notPublished && query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

// ── useLegalStatus ─────────────────────────────────────────────────────

export type UseLegalStatusValue = {
  isLoading: boolean;
  isError: boolean;
  status: LegalStatusResponse | null;
  /**
   * Whether the backend says acceptance is outstanding. Deliberately `false`
   * until the request resolves — but callers must gate on `isLoading` too
   * rather than treating "not yet loaded" as "nothing required".
   */
  requiresAcceptance: boolean;
  /** The subset of documents the backend still wants accepted. Derived from
   *  each document's own `accepted` flag, so a single outdated document does
   *  not drag the already-accepted ones back into the flow. */
  outstandingTypes: LegalDocumentType[];
  refresh: () => void;
};

/**
 * @param enabled pass the session flag — the endpoint is authenticated, so it
 *        must not fire for a signed-out visitor.
 */
export function useLegalStatus(enabled: boolean): UseLegalStatusValue {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: legalQueryKeys.status(),
    queryFn: ({ signal }) => legalTransport.getStatus(signal),
    enabled,
  });

  // The status key carries no user identity, so a signed-out user's cached
  // acceptance would otherwise be served to whoever signs in next on the same
  // device (up to gcTime). Drop it the moment the session ends. Scoped to the
  // legal keys on purpose — clearing the whole client here would stomp every
  // other feature's cache.
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (wasEnabled.current && !enabled) {
      queryClient.removeQueries({ queryKey: legalQueryKeys.status() });
    }
    wasEnabled.current = enabled;
  }, [enabled, queryClient]);

  return useMemo<UseLegalStatusValue>(() => {
    const status = query.data ?? null;
    return {
      isLoading: enabled && query.isPending,
      // Gated on `enabled` too: a stale error left over from a previous
      // session must never surface for a signed-out user.
      isError: enabled && query.isError,
      status,
      requiresAcceptance: status?.requires_acceptance ?? false,
      outstandingTypes: (status?.documents ?? [])
        .filter((d) => !d.accepted)
        .map((d) => d.type),
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query, enabled]);
}

// ── useAcceptLegal ─────────────────────────────────────────────────────

export type UseAcceptLegalValue = {
  accept: (acceptances: LegalAcceptanceInput[]) => Promise<LegalStatusResponse>;
  isPending: boolean;
  error: Error | null;
};

export function useAcceptLegal(): UseAcceptLegalValue {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (acceptances: LegalAcceptanceInput[]) => legalTransport.accept(acceptances),
    onSuccess: (updated) => {
      // POST /accept returns the updated status, so seed the cache directly —
      // a follow-up GET /v1/legal/status would be redundant.
      queryClient.setQueryData(legalQueryKeys.status(), updated);
    },
  });

  const accept = useCallback(
    (acceptances: LegalAcceptanceInput[]) => mutation.mutateAsync(acceptances),
    [mutation],
  );

  return {
    accept,
    isPending: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error : null,
  };
}
