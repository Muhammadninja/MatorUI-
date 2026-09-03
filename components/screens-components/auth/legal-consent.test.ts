/**
 * Registration legal consent — gating logic and wiring guards.
 *
 * The screen itself can't be rendered under vitest (see the note in
 * `app-pressable-view-regression.test.tsx`: react-native's Flow-typed entry
 * defeats the parser). So this spec covers the two things that actually carry
 * the requirement:
 *
 *   1. the gating RULE, extracted and exercised directly over every
 *      combination of checkbox state;
 *   2. structural guards proving the screen wires that rule into the Continue
 *      button, sends backend versions, and handles LEGAL_ACCEPTANCE_REQUIRED
 *      separately from an OTP failure.
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

// ── The gating rule ──────────────────────────────────────────────────────
//
// Mirrors the screen's `allAccepted` + `legalVersions()`. Kept in the test as
// a pure function so every checkbox permutation is cheap to assert.

type Accepted = Record<LegalDocumentType, boolean>;

function allAccepted(documents: LegalDocument[], accepted: Accepted): boolean {
  const required = documents.filter((d) => d.is_required).map((d) => d.type);
  return required.length > 0 && required.every((type) => accepted[type]);
}

function legalVersions(documents: LegalDocument[], accepted: Accepted) {
  if (!allAccepted(documents, accepted)) return undefined;
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

const NONE: Accepted = {
  TERMS_OF_USE: false,
  PRIVACY_POLICY: false,
  PERSONAL_DATA_CONSENT: false,
};

describe('continue gating', () => {
  test('nothing checked → blocked', () => {
    expect(allAccepted(DOCS, NONE)).toBe(false);
    expect(legalVersions(DOCS, NONE)).toBeUndefined();
  });

  test.each([
    ['TERMS_OF_USE'],
    ['PRIVACY_POLICY'],
    ['PERSONAL_DATA_CONSENT'],
  ] as const)('only %s checked → still blocked', (type) => {
    expect(allAccepted(DOCS, { ...NONE, [type]: true })).toBe(false);
  });

  test.each([
    ['TERMS_OF_USE', 'PRIVACY_POLICY'],
    ['TERMS_OF_USE', 'PERSONAL_DATA_CONSENT'],
    ['PRIVACY_POLICY', 'PERSONAL_DATA_CONSENT'],
  ] as const)('two of three (%s + %s) → still blocked', (a, b) => {
    expect(allAccepted(DOCS, { ...NONE, [a]: true, [b]: true })).toBe(false);
  });

  test('all three checked → allowed', () => {
    const all: Accepted = {
      TERMS_OF_USE: true,
      PRIVACY_POLICY: true,
      PERSONAL_DATA_CONSENT: true,
    };
    expect(allAccepted(DOCS, all)).toBe(true);
  });

  test('documents not loaded yet → blocked (never fails open)', () => {
    const all: Accepted = {
      TERMS_OF_USE: true,
      PRIVACY_POLICY: true,
      PERSONAL_DATA_CONSENT: true,
    };
    expect(allAccepted([], all)).toBe(false);
  });

  test('an optional document does not gate the button', () => {
    const docs = [
      doc('TERMS_OF_USE', 4),
      doc('PRIVACY_POLICY', 9),
      { ...doc('PERSONAL_DATA_CONSENT', 2), is_required: false },
    ];
    expect(
      allAccepted(docs, { ...NONE, TERMS_OF_USE: true, PRIVACY_POLICY: true }),
    ).toBe(true);
  });
});

describe('submitted versions', () => {
  test('come from the fetched documents, not a constant', () => {
    const all: Accepted = {
      TERMS_OF_USE: true,
      PRIVACY_POLICY: true,
      PERSONAL_DATA_CONSENT: true,
    };
    expect(legalVersions(DOCS, all)).toEqual({
      terms_version: 4,
      privacy_version: 9,
      personal_data_consent_version: 2,
    });
  });

  test('a different backend payload yields different versions', () => {
    const all: Accepted = {
      TERMS_OF_USE: true,
      PRIVACY_POLICY: true,
      PERSONAL_DATA_CONSENT: true,
    };
    const other = [
      doc('TERMS_OF_USE', 11),
      doc('PRIVACY_POLICY', 12),
      doc('PERSONAL_DATA_CONSENT', 13),
    ];
    expect(legalVersions(other, all)).toEqual({
      terms_version: 11,
      privacy_version: 12,
      personal_data_consent_version: 13,
    });
  });
});

describe('documents-unavailable gate', () => {
  /** Mirrors the screen's `legalGateSatisfied`. */
  const gate = (state: string, accepted: boolean) => (state === 'error' ? true : accepted);

  test('a failed documents request does NOT lock an existing user out', () => {
    // The backend ignores `legal` for an existing account, so blocking here
    // would turn an unrelated network error into "cannot sign in".
    expect(gate('error', false)).toBe(true);
  });

  test('a successful load still requires explicit consent', () => {
    expect(gate('success', false)).toBe(false);
    expect(gate('success', true)).toBe(true);
  });

  test('still loading blocks — never fails open mid-flight', () => {
    expect(gate('loading', false)).toBe(false);
  });

  test('no versions are sent when documents never loaded, so consent is never faked', () => {
    const all: Accepted = {
      TERMS_OF_USE: true,
      PRIVACY_POLICY: true,
      PERSONAL_DATA_CONSENT: true,
    };
    // Even with the gate open, an empty document set yields no legal block —
    // a registration cannot silently succeed without real consent.
    expect(legalVersions([], all)).toBeUndefined();
  });
});

describe('screen wiring', () => {
  const source = read(SCREEN);

  test('the Continue button is gated on the legal gate', () => {
    expect(source).toMatch(/disabled=\{[^}]*!legalGateSatisfied/);
  });

  test('verify-otp is called with backend-sourced legal versions', () => {
    expect(source).toContain('legal: legalVersions()');
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
  });

  test('checkboxes are never pre-ticked', () => {
    // The initial acceptance state must be all-false.
    const init = source.slice(source.indexOf('useState<Record<LegalDocumentType, boolean>>'));
    const block = init.slice(0, init.indexOf('});'));
    expect(block).not.toMatch(/:\s*true/);
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
