/**
 * Legal feature — repository-level guards.
 *
 * Covers the requirements that live across files rather than inside one
 * module: the Settings entries, the three document routes, and the hard rule
 * that no legal TEXT or VERSION exists anywhere in the frontend.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { MockLegalTransport } from "@/tests/support/transports/legal-api";
import {
  LEGAL_DOCUMENT_TYPES,
  legalDocumentSlug,
  legalDocumentTypeFromSlug,
  MARKDOWN_CONTENT_FORMAT,
  orderLegalDocuments,
  type LegalDocument,
} from '@/types/legal';

const ROOT = join(__dirname, '..');

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
const readJson = (rel: string): Record<string, unknown> => JSON.parse(read(rel));

const LOCALES = ['en', 'ru', 'uz'] as const;
const TYPES = ['TERMS_OF_USE', 'PRIVACY_POLICY', 'PERSONAL_DATA_CONSENT'] as const;

describe('Settings → Legal', () => {
  const source = read('components/screens/settings-security-screen.tsx');

  test.each(TYPES)('lists %s', (type) => {
    expect(source).toContain(type);
  });

  test.each([
    ['/terms', 'TERMS_OF_USE'],
    ['/privacy', 'PRIVACY_POLICY'],
    ['/personal-data-consent', 'PERSONAL_DATA_CONSENT'],
  ])('routes %s for %s', (href) => {
    expect(source).toContain(`'${href}'`);
  });

  test('labels come from i18n, not literals', () => {
    expect(source).toContain('settings.privacy');
    expect(source).toContain('settings.personalDataConsent');
  });
});

describe('document routes', () => {
  test.each([
    ['app/(tabs)/(profile)/terms.tsx', 'TERMS_OF_USE'],
    ['app/(tabs)/(profile)/privacy.tsx', 'PRIVACY_POLICY'],
    ['app/(tabs)/(profile)/personal-data-consent.tsx', 'PERSONAL_DATA_CONSENT'],
  ])('%s renders the %s document', (file, type) => {
    expect(existsSync(join(ROOT, file)), `missing route: ${file}`).toBe(true);
    expect(read(file)).toContain(`type="${type}"`);
  });

  test('/terms is preserved so existing deep links keep resolving', () => {
    expect(existsSync(join(ROOT, 'app/(tabs)/(profile)/terms.tsx'))).toBe(true);
  });

  test('all three routes are registered in the profile stack', () => {
    const layout = read('app/(tabs)/(profile)/_layout.tsx');
    for (const name of ['terms', 'privacy', 'personal-data-consent']) {
      expect(layout).toContain(`name="${name}"`);
    }
  });

  test('the old hardcoded terms screen is deleted', () => {
    expect(existsSync(join(ROOT, 'components/screens/terms-screen.tsx'))).toBe(false);
  });
});

describe('no hardcoded legal content', () => {
  test.each(LOCALES)('%s.json has no `terms` legal-text namespace', (loc) => {
    const json = readJson(`locales/${loc}.json`);
    expect(json.terms).toBeUndefined();
  });

  test.each(LOCALES)('%s.json dropped the passive consent notice', (loc) => {
    const json = readJson(`locales/${loc}.json`) as { auth?: Record<string, unknown> };
    expect(json.auth?.termsNotice).toBeUndefined();
  });

  test.each(LOCALES)('%s.json has no s1..s15 legal section keys', (loc) => {
    const raw = read(`locales/${loc}.json`);
    for (const n of [1, 2, 15]) {
      expect(raw).not.toContain(`"s${n}Heading"`);
      expect(raw).not.toContain(`"s${n}Body"`);
    }
    expect(raw).not.toContain('"effectiveDate"');
  });

  test.each(LOCALES)('%s.json keeps only UI strings under `legal`', (loc) => {
    const json = readJson(`locales/${loc}.json`) as { legal?: Record<string, unknown> };
    expect(json.legal).toBeDefined();
    // UI chrome is short; a legal paragraph is not. Anything long here would
    // mean document text crept back into the bundle.
    for (const [key, value] of Object.entries(json.legal!)) {
      if (typeof value === 'string') {
        expect(value.length, `legal.${key} looks like document text`).toBeLessThan(120);
      }
    }
  });

  test.each(LOCALES)('%s.json still provides the three UI type labels', (loc) => {
    const json = readJson(`locales/${loc}.json`) as {
      legal?: { types?: Record<string, string> };
    };
    for (const type of TYPES) {
      expect(json.legal?.types?.[type], `${loc}: missing legal.types.${type}`).toBeTruthy();
    }
  });

  test('no source file hardcodes a legal version', () => {
    for (const rel of [
      'services/legal-api.ts',
      'hooks/use-legal.ts',
      'components/screens/legal-document-screen.tsx',
      'components/screens-components/auth/passwordless-auth-screen.tsx',
    ]) {
      const source = read(rel);
      expect(source, `${rel} hardcodes a version`).not.toMatch(
        /(TERMS|PRIVACY|CONSENT)_VERSION\s*=/,
      );
    }
  });

  test('the document screen renders backend content, not local text', () => {
    const source = read('components/screens/legal-document-screen.tsx');
    expect(source).toContain('doc!.content');
    expect(source).toContain('doc!.title');
    // No i18n-sourced document body.
    expect(source).not.toMatch(/t\('terms\./);
  });
});

describe('consent policy', () => {
  test('no LegalGuard / LegalInterceptor / middleware module exists', () => {
    for (const bad of [
      'guards/legal-guard.ts',
      'guards/legal.guard.ts',
      'services/legal-interceptor.ts',
    ]) {
      expect(existsSync(join(ROOT, bad)), `unexpected global guard: ${bad}`).toBe(false);
    }
  });

  // The post-login acceptance sheet re-prompted a signed-in user on every
  // reload. Consent is now collected once, at sign-in, by the "Agree &
  // continue" button — so nothing may re-open an acceptance prompt later.
  test('the post-login acceptance host is gone', () => {
    expect(existsSync(join(ROOT, 'components/shared/legal-update-host'))).toBe(false);
  });

  test('the root layout mounts no legal host', () => {
    expect(read('app/_layout.tsx')).not.toContain('LegalUpdateHost');
  });

  test.each(LOCALES)('%s.json dropped the acceptance-sheet copy', (loc) => {
    const legal = (readJson(`locales/${loc}.json`) as { legal?: Record<string, unknown> })
      .legal!;
    for (const key of [
      'later',
      'reviewAction',
      'updatedTitle',
      'updatedBody',
      'acceptAndContinue',
      'statusErrorTitle',
      'statusErrorBody',
    ]) {
      expect(legal[key], `legal.${key} belongs to the removed sheet`).toBeUndefined();
    }
  });

  test.each(LOCALES)('%s.json carries the sign-in consent copy', (loc) => {
    const auth = (readJson(`locales/${loc}.json`) as { auth?: Record<string, unknown> })
      .auth!;
    expect(auth.agreeAndContinue).toBeTruthy();
    expect(auth.agreeNotePrefix).toBeTruthy();
    // The checkbox row labels went with the checkboxes.
    expect(auth.acceptTerms).toBeUndefined();
    expect(auth.acceptPrivacy).toBeUndefined();
    expect(auth.acceptPersonalData).toBeUndefined();
  });

  test('the api-client has no legal-acceptance interception', () => {
    expect(read('services/api-client.ts')).not.toContain('LEGAL_ACCEPTANCE_REQUIRED');
  });
});

describe('content_format handling', () => {
  const screen = read('components/screens/legal-document-screen.tsx');

  test('markdown routes to the Markdown renderer', () => {
    expect(screen).toContain('MARKDOWN_CONTENT_FORMAT');
    expect(screen).toContain('<AppMarkdown content={doc!.content} />');
  });

  test('an unknown format falls back to plain text instead of throwing', () => {
    // The ternary must have a non-Markdown branch that still renders content.
    const branch = screen.slice(screen.indexOf('MARKDOWN_CONTENT_FORMAT'));
    expect(branch).toContain(') : (');
    expect(branch).toContain('{doc!.content}');
    expect(screen).not.toContain('throw new Error');
  });

});

describe('legal document type enum', () => {
  // Runtime assertions against the exported constant — a source grep would
  // still pass if the type alias were right but the runtime value wrong.
  test('LEGAL_DOCUMENT_TYPES holds exactly the three backend values', () => {
    expect([...LEGAL_DOCUMENT_TYPES]).toEqual([
      'TERMS_OF_USE',
      'PRIVACY_POLICY',
      'PERSONAL_DATA_CONSENT',
    ]);
  });

  test('no short enum value appears at runtime', () => {
    for (const value of LEGAL_DOCUMENT_TYPES) {
      expect(value).not.toBe('TERMS');
      expect(value).not.toBe('PRIVACY');
    }
  });

  test('the mock transport emits exactly those three types', async () => {
    const { documents } = await new MockLegalTransport().getDocuments();
    expect(documents.map((d) => d.type)).toEqual([...LEGAL_DOCUMENT_TYPES]);
  });

  test('MARKDOWN_CONTENT_FORMAT is the literal the backend sends', () => {
    expect(MARKDOWN_CONTENT_FORMAT).toBe('markdown');
  });
});

describe('accept payload contract', () => {
  test('the transport posts `acceptances`, never `documents`', () => {
    const source = read('services/legal-api.ts');
    expect(source).toContain("'/v1/legal/accept', { acceptances }");
    expect(source).not.toMatch(/legal\/accept',\s*\{\s*documents/);
  });

  test('no client-side version comparison anywhere in the legal feature', () => {
    for (const rel of [
      'services/legal-api.ts',
      'hooks/use-legal.ts',
      'components/screens-components/auth/passwordless-auth-screen.tsx',
      'components/screens/legal-document-screen.tsx',
    ]) {
      const code = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      // The backend owns `accepted`; the client must never re-derive it.
      expect(code, `${rel} compares versions locally`).not.toMatch(
        /accepted_version\s*(>=|>|===|<)\s*\w*required_version/,
      );
      expect(code, `${rel} compares versions locally`).not.toMatch(
        /required_version\s*(>=|>|===|<)\s*\w*accepted_version/,
      );
    }
  });

  test('the status consumer reads the backend `accepted` flag', () => {
    expect(read('hooks/use-legal.ts')).toContain('.filter((d) => !d.accepted)');
  });
});

describe('markdown safety wiring', () => {
  test('the renderer has no HTML or WebView escape hatch', () => {
    // Strip comments first: the file DOCUMENTS that it avoids these APIs, and
    // the guard is about actual code, not prose.
    const code = read('components/shared/app-markdown/app-markdown.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('dangerouslySetInnerHTML');
    expect(code).not.toContain('WebView');
    expect(code).not.toContain('innerHTML');
  });

  test('the parser is the only link-target authority', () => {
    expect(read('utils/markdown.ts')).toContain('isSafeHref');
  });
});

describe('legal document helpers', () => {
  const doc = (type: string, title = type) =>
    ({
      type,
      version: 1,
      locale: 'ru',
      title,
      content: '',
      content_format: 'markdown',
      effective_at: '2026-08-31T00:00:00.000Z',
      is_required: true,
    }) as LegalDocument;

  test('orderLegalDocuments keeps every document, in UI order', () => {
    const ordered = orderLegalDocuments([
      doc('PERSONAL_DATA_CONSENT'),
      doc('TERMS_OF_USE'),
      doc('PRIVACY_POLICY'),
    ]);
    expect(ordered.map((d) => d.type)).toEqual([...LEGAL_DOCUMENT_TYPES]);
  });

  test('an unknown future type is kept (last), not dropped', () => {
    const ordered = orderLegalDocuments([doc('COOKIE_POLICY'), doc('TERMS_OF_USE')]);
    expect(ordered.map((d) => d.type)).toEqual(['TERMS_OF_USE', 'COOKIE_POLICY']);
  });

  test('nothing is invented for an empty response', () => {
    expect(orderLegalDocuments([])).toEqual([]);
  });

  test('slugs round-trip for all three documents', () => {
    expect(LEGAL_DOCUMENT_TYPES.map(legalDocumentSlug)).toEqual([
      'terms_of_use',
      'privacy_policy',
      'personal_data_consent',
    ]);
    for (const type of LEGAL_DOCUMENT_TYPES) {
      expect(legalDocumentTypeFromSlug(legalDocumentSlug(type))).toBe(type);
    }
  });

  // No false fallback: anything that is not exactly one of the three slugs is
  // null — the route then shows "unavailable", never a different document.
  test.each([
    'TERMS_OF_USE', // the enum itself is not a slug
    'Terms_Of_Use',
    'terms',
    'terms_of_use ',
    'privacy',
    'cookie_policy', // a type this build does not know
    '',
    undefined,
    null,
    1,
    ['terms_of_use'], // expo-router hands repeated params over as arrays
  ])('legalDocumentTypeFromSlug(%j) is null', (bad) => {
    expect(legalDocumentTypeFromSlug(bad)).toBeNull();
  });
});
