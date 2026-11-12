/**
 * Legal transport — documents, acceptance status, and acceptance.
 *
 * Same shape as the other transports (`auth-api`, `orders-api`, `cart-api`):
 * an interface, a Mock impl for offline/E2E builds, an HTTP impl over the
 * unified `apiClient`, and a singleton swapped by `shouldUseHttpTransport`.
 *
 *   GET  /v1/legal/documents          → { documents: [...] }        (public)
 *   GET  /v1/legal/documents/:type  → LegalDocument in force       (public)
 *   GET  /v1/legal/documents/:type/:version → LegalDocument          (public)
 *   GET  /v1/legal/status             → LegalStatusResponse          (auth)
 *   POST /v1/legal/accept             → LegalStatusResponse          (auth)
 *
 * `Accept-Language` is injected globally by `api-client` from the app's
 * interface language, so the backend resolves the localized document and its
 * own regional fallback. This module deliberately does NOT set that header —
 * a second locale mechanism here would be able to drift from the app's.
 *
 * The documents endpoints are public: `skipAuth: true` keeps a signed-out
 * visitor (registration, guest Settings) from being 401'd. Status/accept are
 * authenticated and take the ambient bearer token.
 */

import { apiClient } from '@/services/api-client';
import type {
  LegalAcceptanceInput,
  LegalDocument,
  LegalDocumentType,
  LegalDocumentsResponse,
  LegalStatusDocument,
  LegalStatusResponse,
} from '@/types/legal';

export interface LegalTransport {
  /** All currently-active documents in the request's language. Returns the
   *  wrapped `{ documents }` envelope so the cache stores the backend's own
   *  response shape rather than a client-side reduction of it. */
  getDocuments(signal?: AbortSignal): Promise<LegalDocumentsResponse>;
  /** The version of one document currently in force — for an informational
   *  document (REFUND_POLICY) that the consent list does not carry. */
  getCurrentDocument(type: LegalDocumentType, signal?: AbortSignal): Promise<LegalDocument>;
  /** One pinned document version — used by deep links into an older version. */
  getDocument(
    type: LegalDocumentType,
    version: number,
    signal?: AbortSignal,
  ): Promise<LegalDocument>;
  /** The signed-in user's acceptance state. Requires a session. */
  getStatus(signal?: AbortSignal): Promise<LegalStatusResponse>;
  /** Records acceptance and returns the UPDATED status, so callers need no
   *  follow-up status request. */
  accept(acceptances: LegalAcceptanceInput[]): Promise<LegalStatusResponse>;
}

// ── HTTP transport ─────────────────────────────────────────────────────

class HttpLegalTransport implements LegalTransport {
  async getDocuments(signal?: AbortSignal): Promise<LegalDocumentsResponse> {
    const r = await apiClient.get<LegalDocumentsResponse>('/v1/legal/documents', {
      signal,
      skipAuth: true,
    });
    // Preserve the envelope; only defend against a malformed body.
    return { documents: r?.documents ?? [] };
  }

  async getCurrentDocument(type: LegalDocumentType, signal?: AbortSignal): Promise<LegalDocument> {
    return apiClient.get<LegalDocument>(`/v1/legal/documents/${encodeURIComponent(type)}`, {
      signal,
      skipAuth: true,
    });
  }

  async getDocument(
    type: LegalDocumentType,
    version: number,
    signal?: AbortSignal,
  ): Promise<LegalDocument> {
    return apiClient.get<LegalDocument>(
      `/v1/legal/documents/${encodeURIComponent(type)}/${encodeURIComponent(String(version))}`,
      { signal, skipAuth: true },
    );
  }

  async getStatus(signal?: AbortSignal): Promise<LegalStatusResponse> {
    return apiClient.get<LegalStatusResponse>('/v1/legal/status', { signal });
  }

  async accept(acceptances: LegalAcceptanceInput[]): Promise<LegalStatusResponse> {
    // No AbortSignal on purpose: an aborted mutation may already be committed
    // server-side, and silently cancelling would mask a recorded acceptance.
    // Matches the stance taken by orders/cart mutations.
    return apiClient.post<LegalStatusResponse>('/v1/legal/accept', { acceptances });
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

import { shouldUseHttpTransport } from '@/config/api';

export const legalTransport: LegalTransport = new HttpLegalTransport();
