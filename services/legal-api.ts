/**
 * Legal transport — documents, acceptance status, and acceptance.
 *
 * Same shape as the other transports (`auth-api`, `orders-api`, `cart-api`):
 * an interface, a Mock impl for offline/E2E builds, an HTTP impl over the
 * unified `apiClient`, and a singleton swapped by `shouldUseHttpTransport`.
 *
 *   GET  /v1/legal/documents          → { documents: [...] }        (public)
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

// ── Mock transport ─────────────────────────────────────────────────────

/**
 * Offline/E2E stand-in. The `content` below is deliberately nonsense filler,
 * NOT legal wording — it exists only to exercise the Markdown renderer and the
 * loading/error states. Real legal text never lives in the frontend.
 */
const MOCK_LATENCY_MS = 0;

const MOCK_CONTENT = [
  '# Sample heading',
  '',
  'Mock paragraph body used by offline builds. **Bold** and _italic_ render here.',
  '',
  '- First item',
  '- Second item',
  '',
  'See [example](https://example.com) for more.',
].join('\n');

function mockDoc(
  type: LegalDocumentType,
  version: number,
  title: string,
): LegalDocument {
  return {
    type,
    version,
    locale: 'en',
    title,
    content: MOCK_CONTENT,
    content_format: 'markdown',
    effective_at: '2026-08-31T00:00:00.000Z',
    is_required: true,
  };
}

function delay(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));
}

export class MockLegalTransport implements LegalTransport {
  private accepted = new Map<LegalDocumentType, number>();

  constructor(private docs: LegalDocument[] = [
    mockDoc('TERMS_OF_USE', 1, 'Terms of Use'),
    mockDoc('PRIVACY_POLICY', 1, 'Privacy Policy'),
    mockDoc('PERSONAL_DATA_CONSENT', 1, 'Personal Data Consent'),
  ]) {}

  async getDocuments(): Promise<LegalDocumentsResponse> {
    await delay(MOCK_LATENCY_MS);
    return { documents: [...this.docs] };
  }

  async getDocument(type: LegalDocumentType, version: number): Promise<LegalDocument> {
    await delay(MOCK_LATENCY_MS);
    const found = this.docs.find((d) => d.type === type && d.version === version);
    if (!found) throw new Error(`MockLegalTransport: no ${type} v${version}`);
    return found;
  }

  async getStatus(): Promise<LegalStatusResponse> {
    await delay(MOCK_LATENCY_MS);
    return this.snapshot();
  }

  async accept(acceptances: LegalAcceptanceInput[]): Promise<LegalStatusResponse> {
    await delay(MOCK_LATENCY_MS);
    for (const a of acceptances) this.accepted.set(a.type, a.version);
    return this.snapshot();
  }

  private snapshot(): LegalStatusResponse {
    const documents = this.docs.map((d) => {
      const accepted_version = this.accepted.get(d.type) ?? null;
      return {
        type: d.type,
        required_version: d.version,
        accepted_version,
        accepted: accepted_version === d.version,
        // Omitted entirely when never accepted — mirrors the backend, which
        // drops the key rather than sending null.
        ...(accepted_version === null
          ? {}
          : { accepted_at: new Date().toISOString() }),
      };
    }) satisfies LegalStatusDocument[];
    return {
      requires_acceptance: documents.some((d) => !d.accepted),
      documents,
    };
  }
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

export const legalTransport: LegalTransport = shouldUseHttpTransport('legal')
  ? new HttpLegalTransport()
  : new MockLegalTransport();
