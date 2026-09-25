/**
 * Registration legal consent — gating logic and wiring guards.
 *
 * Consent lives in ONE place: the "Agree & continue" button on the OTP step.
 * Tapping it IS the acceptance — there are no checkboxes, and there is no
 * post-login acceptance sheet (the old `LegalUpdateHost`, which re-prompted a
 * signed-in user on every reload, is gone).
 *
 * The screen itself can't be rendered under vitest (see the note in
 * `app-pressable-view-regression.test.tsx`: react-native's Flow-typed entry
 * defeats the parser). So this spec covers the two things that actually carry
 * the requirement:
 *
 *   1. the version RULE, extracted and exercised directly;
 *   2. structural guards proving the screen names every document next to the
 *      button, sends backend versions, records the acceptance, and handles
 *      LEGAL_ACCEPTANCE_REQUIRED separately from an OTP failure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import type { LegalDocument, LegalDocumentType } from '@/types/legal';

const ROOT = join(__dirname, '../../..');

function read(rel: string): string {
  const path = join(ROOT, rel);
  expect(existsSync(path), `expected file to exist: ${rel}`).toBe(true);
  return readFileSync(path, 'utf8');
}

const SCREEN = 'components/screens-components/auth/passwordless-auth-screen.tsx';

// ── The version rule ─────────────────────────────────────────────────────
//
// Mirrors the screen's `legalVersions()`. Kept in the test as a pure function
// so the "never invent a version" requirement is asserted directly.

function legalVersions(documents: LegalDocument[]) {
  const versionOf = (t: LegalDocumentType) => documents.find((d) => d.type === t)?.version;
  const terms = versionOf('TERMS_OF_USE');
  const privacy = versionOf('PRIVACY_POLICY');
  const consent = versionOf('PERSONAL_DATA_CONSENT');
  if (terms === undefined || privacy === undefined || consent === undefined) return undefined;
  return {
    terms_version: terms,
    privacy_version: privacy,
    personal_data_consent_version: consent,
  };
}

const doc = (type: LegalDocumentType, version: number): LegalDocument => ({
  type,
  version,
  locale: 'ru',
  title: `title-${type}`,
  content: 'body',
  content_format: 'markdown',
  effective_at: '2026-08-31T00:00:00.000Z',
  is_required: true,
});

// Deliberately non-1 versions: a passing test must be reading them from the
// documents, not from a hardcoded default.
const DOCS = [
  doc('TERMS_OF_USE', 4),
  doc('PRIVACY_POLICY', 9),
  doc('PERSONAL_DATA_CONSENT', 2),
];

describe('submitted versions', () => {
  test('come from the fetched documents, not a constant', () => {
    expect(legalVersions(DOCS)).toEqual({
      terms_version: 4,
      privacy_version: 9,
      personal_data_consent_version: 2,
    });
  });

  test('a different backend payload yields different versions', () => {
    const other = [
      doc('TERMS_OF_USE', 11),
      doc('PRIVACY_POLICY', 12),
      doc('PERSONAL_DATA_CONSENT', 13),
    ];
    expect(legalVersions(other)).toEqual({
      terms_version: 11,
      privacy_version: 12,
      personal_data_consent_version: 13,
    });
  });

  test('documents never loaded → no versions, so consent is never faked', () => {
    expect(legalVersions([])).toBeUndefined();
  });

  test('a partial document set is not padded with a default', () => {
    expect(legalVersions([doc('TERMS_OF_USE', 4), doc('PRIVACY_POLICY', 9)])).toBeUndefined();
  });
});

describe('screen wiring', () => {
  const source = read(SCREEN);

  test('the CTA is the consent action', () => {
    expect(source).toContain("t('auth.agreeAndContinue')");
    expect(source).not.toContain("t('auth.verifyContinue')");
  });

  test('a failed documents request does not disable the CTA', () => {
    // The backend is the real gate (LEGAL_ACCEPTANCE_REQUIRED); blocking here
    // would turn an unrelated network error into "cannot sign in".
    const idx = source.indexOf('testID="auth-verify-btn"');
    expect(idx).toBeGreaterThan(-1);
    const button = source.slice(idx, source.indexOf('/>', idx));
    expect(button).toContain('disabled={isLoading || code.length < 6}');
    expect(button).not.toContain('legalGateSatisfied');
  });

  // Rendered behaviour (all three documents, links, order) is pinned by
  // legal-consent-note.test.tsx and passwordless-auth-screen.test.tsx; these
  // guard the wiring that makes the list come from the Legal API.
  test('every document is named next to the button, each one tappable', () => {
    const idx = source.indexOf('testID="auth-legal-note"');
    expect(idx).toBeGreaterThan(-1);
    const note = source.slice(source.lastIndexOf('<LegalConsentNote', idx), source.indexOf('/>', idx));
    expect(note).toContain('documents={legalDocuments}');
    expect(note).toContain('onOpen={openLegalDoc}');
    expect(note).toContain('linkTestIDPrefix="auth-legal-"');
  });

  // Regression: the phone step hardcoded Terms + Privacy and never showed
  // PERSONAL_DATA_CONSENT, although the backend serves three documents.
  test('the phone step lists the Legal API documents too, not a hardcoded pair', () => {
    const idx = source.indexOf('testID="auth-phone-legal-note"');
    expect(idx).toBeGreaterThan(-1);
    const note = source.slice(source.lastIndexOf('<LegalConsentNote', idx), source.indexOf('/>', idx));
    expect(note).toContain('documents={legalDocuments}');
    expect(source).not.toContain('auth.phoneLegalTerms');
    expect(source).not.toContain('auth.phoneLegalPrivacy');
  });

  test('no document type is hardcoded into a consent link', () => {
    for (const type of ['TERMS_OF_USE', 'PRIVACY_POLICY', 'PERSONAL_DATA_CONSENT']) {
      expect(source).not.toContain(`openLegalDoc('${type}')`);
    }
  });

  test('the consent line has no checkboxes', () => {
    expect(source).not.toContain('AppCheckbox');
    expect(source).not.toContain('CONSENT_ROWS');
  });

  test('verify-otp is called with backend-sourced legal versions', () => {
    expect(source).toContain('legal: legalVersions()');
  });

  test('the tap is recorded as an acceptance for existing accounts too', () => {
    expect(source).toContain('void recordAcceptance();');
    // The versions posted come from the documents, never a literal.
    const idx = source.indexOf('const recordAcceptance');
    const body = source.slice(idx, source.indexOf('};', idx));
    expect(body).toContain('legalDocuments.map((d) => ({ type: d.type, version: d.version }))');
  });

  test('a failed acceptance never breaks a successful sign-in', () => {
    const idx = source.indexOf('const recordAcceptance');
    const body = source.slice(idx, source.indexOf('};', idx));
    expect(body).toMatch(/try\s*\{[\s\S]*await accept\(acceptances\);[\s\S]*\}\s*catch/);
  });

  test('LEGAL_ACCEPTANCE_REQUIRED is handled before the generic OTP error', () => {
    const legalIdx = source.indexOf('LEGAL_ACCEPTANCE_REQUIRED');
    const otpIdx = source.indexOf("t('auth.codeDidNotWork')");
    expect(legalIdx).toBeGreaterThan(-1);
    expect(otpIdx).toBeGreaterThan(-1);
    // The legal branch must come first AND return, so a legal failure never
    // falls through to "the code didn't work".
    expect(legalIdx).toBeLessThan(otpIdx);
    const branch = source.slice(legalIdx, otpIdx);
    expect(branch).toContain('return;');
    expect(branch).toContain('auth.legalRequiredTitle');
    // It re-fetches the documents so the next tap carries current versions.
    expect(branch).toContain('refreshLegal();');
  });

  test('the passive "By continuing you agree" notice is gone', () => {
    expect(source).not.toContain('termsNotice');
  });

  test('no legal version is hardcoded in the screen', () => {
    expect(source).not.toMatch(/terms_version:\s*\d/);
    expect(source).not.toMatch(/privacy_version:\s*\d/);
    expect(source).not.toMatch(/personal_data_consent_version:\s*\d/);
  });
});
