/**
 * legal-api — HTTP transport contract tests.
 *
 * Asserts the exact wire calls the backend contract specifies: paths, bodies,
 * auth posture, and that `Accept-Language` is left to the shared api-client
 * (this module must NOT set its own).
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

const get = vi.fn();
const post = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));

import { legalTransport } from './legal-api';
import type { LegalDocument, LegalStatusResponse } from '@/types/legal';

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

const doc = (over: Partial<LegalDocument> = {}): LegalDocument => ({
  type: 'TERMS_OF_USE',
  version: 1,
  locale: 'ru',
  title: 'Пользовательское соглашение',
  content: '# Заголовок',
  content_format: 'markdown',
  effective_at: '2026-08-31T00:00:00.000Z',
  is_required: true,
  ...over,
});

describe('getDocuments', () => {
  test('GETs /v1/legal/documents and unwraps `documents`', async () => {
    const documents = [
      doc(),
      doc({ type: 'PRIVACY_POLICY', version: 2 }),
      doc({ type: 'PERSONAL_DATA_CONSENT', version: 1 }),
    ];
    get.mockResolvedValueOnce({ documents });

    const result = await legalTransport.getDocuments();

    expect(get.mock.calls[0]![0]).toBe('/v1/legal/documents');
    // The WRAPPED envelope is preserved — not flattened to a bare array.
    expect(Array.isArray(result)).toBe(false);
    expect(result.documents).toHaveLength(3);
    expect(result.documents.map((d) => d.type)).toEqual([
      'TERMS_OF_USE',
      'PRIVACY_POLICY',
      'PERSONAL_DATA_CONSENT',
    ]);
    // Versions come straight off the wire — never synthesized client-side.
    expect(result.documents[1]!.version).toBe(2);
  });

  test('every documented field survives the round trip with its exact type', async () => {
    get.mockResolvedValueOnce({ documents: [doc()] });

    const { documents } = await legalTransport.getDocuments();
    const d = documents[0]!;

    expect(d.type).toBe('TERMS_OF_USE');
    expect(d.version).toBe(1);
    expect(Number.isInteger(d.version)).toBe(true);
    expect(d.locale).toBe('ru');
    expect(d.title).toBe('Пользовательское соглашение');
    expect(d.content).toBe('# Заголовок');
    expect(d.content_format).toBe('markdown');
    expect(d.effective_at).toBe('2026-08-31T00:00:00.000Z');
    expect(d.is_required).toBe(true);
  });

  test('is public — skips auth so a signed-out visitor can read it', async () => {
    get.mockResolvedValueOnce({ documents: [] });
    await legalTransport.getDocuments();
    expect((get.mock.calls[0]![1] as Record<string, unknown>).skipAuth).toBe(true);
  });

  test('does NOT set its own Accept-Language — that is api-client\'s job', async () => {
    get.mockResolvedValueOnce({ documents: [] });
    await legalTransport.getDocuments();
    const opts = get.mock.calls[0]![1] as Record<string, unknown>;
    expect(opts.headers).toBeUndefined();
    expect(opts.skipLanguage).toBeUndefined();
  });

  test('tolerates a malformed body rather than throwing', async () => {
    get.mockResolvedValueOnce({});
    await expect(legalTransport.getDocuments()).resolves.toEqual({ documents: [] });
  });
});

describe('getDocument', () => {
  test('GETs the pinned type/version path', async () => {
    get.mockResolvedValueOnce(doc({ version: 3 }));
    await legalTransport.getDocument('PRIVACY_POLICY', 3);
    expect(get.mock.calls[0]![0]).toBe('/v1/legal/documents/PRIVACY_POLICY/3');
  });
});

describe('getStatus', () => {
  test('accepts a document WITH accepted_at and one where it is OMITTED', async () => {
    // Exactly the backend's documented shape: a never-accepted document has
    // accepted_version null and NO accepted_at key at all.
    get.mockResolvedValueOnce({
      requires_acceptance: true,
      documents: [
        {
          type: 'TERMS_OF_USE',
          required_version: 1,
          accepted_version: 1,
          accepted: true,
          accepted_at: '2026-08-31T12:33:10.000Z',
        },
        {
          type: 'PERSONAL_DATA_CONSENT',
          required_version: 1,
          accepted_version: null,
          accepted: false,
        },
      ],
    });

    const status = await legalTransport.getStatus();

    expect(status.requires_acceptance).toBe(true);
    expect(status.documents[0]!.accepted_at).toBe('2026-08-31T12:33:10.000Z');
    expect(status.documents[1]!.accepted_version).toBeNull();
    // Absent stays absent — never normalized into null or a placeholder date.
    expect(status.documents[1]!.accepted_at).toBeUndefined();
    expect('accepted_at' in status.documents[1]!).toBe(false);
  });

  test('GETs /v1/legal/status WITH auth', async () => {
    const status: LegalStatusResponse = { requires_acceptance: false, documents: [] };
    get.mockResolvedValueOnce(status);

    await legalTransport.getStatus();

    expect(get.mock.calls[0]![0]).toBe('/v1/legal/status');
    // Authenticated endpoint — must not opt out of the bearer token.
    expect((get.mock.calls[0]![1] as Record<string, unknown>).skipAuth).toBeUndefined();
  });
});

describe('accept', () => {
  test('POSTs /v1/legal/accept with the exact acceptances payload', async () => {
    post.mockResolvedValueOnce({ requires_acceptance: false, documents: [] });

    await legalTransport.accept([
      { type: 'TERMS_OF_USE', version: 1 },
      { type: 'PRIVACY_POLICY', version: 2 },
    ]);

    expect(post.mock.calls[0]![0]).toBe('/v1/legal/accept');
    expect(post.mock.calls[0]![1]).toEqual({
      acceptances: [
        { type: 'TERMS_OF_USE', version: 1 },
        { type: 'PRIVACY_POLICY', version: 2 },
      ],
    });
  });

  test('the payload key is `acceptances` — NOT `documents`', async () => {
    post.mockResolvedValueOnce({ requires_acceptance: false, documents: [] });

    await legalTransport.accept([{ type: 'TERMS_OF_USE', version: 1 }]);

    const body = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['acceptances']);
    expect('documents' in body).toBe(false);
  });

  test('sends all three enum values, once each, with integer versions', async () => {
    post.mockResolvedValueOnce({ requires_acceptance: false, documents: [] });

    await legalTransport.accept([
      { type: 'TERMS_OF_USE', version: 4 },
      { type: 'PRIVACY_POLICY', version: 9 },
      { type: 'PERSONAL_DATA_CONSENT', version: 2 },
    ]);

    const body = post.mock.calls[0]![1] as {
      acceptances: { type: string; version: number }[];
    };
    const types = body.acceptances.map((a) => a.type);
    expect(types).toEqual(['TERMS_OF_USE', 'PRIVACY_POLICY', 'PERSONAL_DATA_CONSENT']);
    // No duplicates.
    expect(new Set(types).size).toBe(3);
    for (const a of body.acceptances) {
      expect(Number.isInteger(a.version)).toBe(true);
    }
  });

  test('sends no client-side metadata the backend captures itself', async () => {
    post.mockResolvedValueOnce({ requires_acceptance: false, documents: [] });

    await legalTransport.accept([{ type: 'TERMS_OF_USE', version: 1 }]);

    const raw = JSON.stringify(post.mock.calls[0]![1]);
    for (const forbidden of ['userId', 'user_id', 'ip', 'userAgent', 'user_agent', 'locale']) {
      expect(raw).not.toContain(forbidden);
    }
  });

  test('returns the updated status from the accept response itself', async () => {
    const updated: LegalStatusResponse = {
      requires_acceptance: false,
      documents: [
        {
          type: 'PRIVACY_POLICY',
          required_version: 2,
          accepted_version: 2,
          accepted: true,
          accepted_at: '2026-08-31T12:40:00.000Z',
        },
      ],
    };
    post.mockResolvedValueOnce(updated);

    const result = await legalTransport.accept([{ type: 'PRIVACY_POLICY', version: 2 }]);

    // No second status GET is needed.
    expect(result).toEqual(updated);
    expect(get).not.toHaveBeenCalled();
  });
});
