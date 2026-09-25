/**
 * Registration consent line — renders the Legal API response, nothing else.
 *
 * Regression: the phone step of the sign-in sheet hardcoded two links (Terms,
 * Privacy) and never showed PERSONAL_DATA_CONSENT, although the backend
 * serves three documents. Both steps now render `LegalConsentNote`, so this
 * pins what it shows for a given `useLegalDocuments()` result.
 */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) =>
      ({
        'auth.agreeNoteComma': ', ',
        'auth.phoneLegalAnd': ' и ',
        'auth.phoneLegalSuffix': '.',
      })[k] ?? k,
  }),
}));

import { LegalConsentNote } from './legal-consent-note';
import type { LegalDocument, LegalDocumentType } from '@/types/legal';

const doc = (type: LegalDocumentType, title: string, version = 1): LegalDocument => ({
  type,
  version,
  locale: 'ru',
  title,
  content: 'body',
  content_format: 'markdown',
  effective_at: '2026-08-31T00:00:00.000Z',
  is_required: true,
});

// Exactly what GET /v1/legal/documents returns for Accept-Language: ru.
const RU_DOCS = [
  doc('TERMS_OF_USE', 'Пользовательское соглашение'),
  doc('PRIVACY_POLICY', 'Политика конфиденциальности'),
  doc('PERSONAL_DATA_CONSENT', 'Согласие на обработку персональных данных'),
];

type Props = React.ComponentProps<typeof LegalConsentNote>;

function render(over: Partial<Props> = {}) {
  const onOpen = vi.fn();
  const onRetry = vi.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <LegalConsentNote
        prefix="Продолжая, вы принимаете условия документов: "
        documents={RU_DOCS}
        state="success"
        onOpen={onOpen}
        onRetry={onRetry}
        testID="note"
        linkTestIDPrefix="link-"
        {...over}
      />,
    );
  });
  const links = (): ReactTestInstance[] =>
    r.root.findAll(
      (n) =>
        n.type === 'text' &&
        typeof n.props.testID === 'string' &&
        n.props.testID.startsWith('link-'),
    );
  /** The sentence as a user reads it. */
  const sentence = (): string => {
    const flat = (node: ReactTestInstance | string): string =>
      typeof node === 'string' ? node : node.children.map(flat).join('');
    const root = r.root.findAll((n) => n.type === 'text')[0];
    return root ? flat(root) : '';
  };
  return { r, onOpen, onRetry, links, sentence };
}

describe('LegalConsentNote', () => {
  test('lists all three backend documents, including PERSONAL_DATA_CONSENT', () => {
    const { links } = render();
    expect(links().map((l) => l.props.testID)).toEqual([
      'link-TERMS_OF_USE',
      'link-PRIVACY_POLICY',
      'link-PERSONAL_DATA_CONSENT',
    ]);
  });

  test('uses the backend titles and reads as one sentence', () => {
    const { sentence } = render();
    expect(sentence()).toBe(
      'Продолжая, вы принимаете условия документов: Пользовательское соглашение, ' +
        'Политика конфиденциальности и Согласие на обработку персональных данных.',
    );
  });

  test.each(RU_DOCS.map((d) => d.type))('tapping %s opens that document', (type) => {
    const { links, onOpen } = render();
    const link = links().find((l) => l.props.testID === `link-${type}`)!;
    expect(link.props.accessibilityRole).toBe('link');
    act(() => link.props.onPress());
    expect(onOpen).toHaveBeenCalledWith(type);
  });

  test('keeps the UI order even when the backend order differs', () => {
    const { links } = render({ documents: [RU_DOCS[2]!, RU_DOCS[0]!, RU_DOCS[1]!] });
    expect(links().map((l) => l.props.testID)).toEqual([
      'link-TERMS_OF_USE',
      'link-PRIVACY_POLICY',
      'link-PERSONAL_DATA_CONSENT',
    ]);
  });

  test('two documents join with "and" only', () => {
    const { sentence } = render({ documents: [RU_DOCS[0]!, RU_DOCS[1]!], prefix: 'P: ' });
    expect(sentence()).toBe('P: Пользовательское соглашение и Политика конфиденциальности.');
  });

  test('while loading it renders nothing — no placeholder documents', () => {
    const { r, links } = render({ documents: [], state: 'loading' });
    expect(links()).toHaveLength(0);
    expect(r.toJSON()).toBeNull();
  });

  test.each(['error', 'empty'] as const)(
    'on %s it offers a retry and invents no document',
    (state) => {
      const { r, links, onRetry } = render({ documents: [], state });
      expect(links()).toHaveLength(0);
      const retry = r.root.find((n) => n.type === 'text' && n.props.accessibilityRole === 'button');
      act(() => retry.props.onPress());
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  test('a failed REFETCH still shows the documents already loaded', () => {
    const { links } = render({ state: 'error' });
    expect(links()).toHaveLength(3);
  });
});
