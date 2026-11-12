// Test-only implementations. Never imported by application code.
import { apiClient } from '@/services/api-client';
import type {
  LegalAcceptanceInput,
  LegalDocument,
  LegalDocumentType,
  LegalDocumentsResponse,
  LegalStatusDocument,
  LegalStatusResponse,
} from '@/types/legal';
import { shouldUseHttpTransport } from '@/config/api';

import type { LegalTransport } from "@/services/legal-api";
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

  constructor(
    private docs: LegalDocument[] = [
      mockDoc('TERMS_OF_USE', 1, 'Terms of Use'),
      mockDoc('PRIVACY_POLICY', 1, 'Privacy Policy'),
      mockDoc('PERSONAL_DATA_CONSENT', 1, 'Personal Data Consent'),
    ],
    /** Served only by getCurrentDocument, never by the consent list — as on the backend. */
    private informational: LegalDocument[] = [
      { ...mockDoc('REFUND_POLICY', 1, 'Refund & Returns Policy'), is_required: false },
    ],
  ) {}

  async getDocuments(): Promise<LegalDocumentsResponse> {
    await delay(MOCK_LATENCY_MS);
    return { documents: [...this.docs] };
  }

  async getCurrentDocument(type: LegalDocumentType): Promise<LegalDocument> {
    await delay(MOCK_LATENCY_MS);
    const found = [...this.docs, ...this.informational].find((d) => d.type === type);
    if (!found) throw new Error(`MockLegalTransport: no ${type} in force`);
    return found;
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
