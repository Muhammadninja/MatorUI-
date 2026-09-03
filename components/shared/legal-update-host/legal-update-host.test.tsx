/**
 * LegalUpdateHost — behavioral tests for the MANDATORY authenticated gate.
 *
 * These render the real component and inspect the produced tree, rather than
 * grepping its source. The RN leaf components are stubbed to plain host
 * elements (the repo's parser can't read react-native's Flow-typed entry — see
 * `app-pressable-view-regression.test.tsx`), but the component under test runs
 * its own logic unmodified: state, effects, the auth/status branches and the
 * props it hands the sheet.
 *
 * What that buys us: the "no bypass" property is asserted from the ACTUAL
 * rendered output — the sheet's dismiss props and the absence of any
 * Later/Skip/Close control — so a regression that re-adds an escape hatch
 * fails here.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();
const dangerToast = vi.fn();
let isAuthenticated = true;

const getStatus = vi.fn();
const getDocuments = vi.fn();
const accept = vi.fn();

vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
}));
vi.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => push(...a) } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/shared/app-bottom-sheet', () => ({
  AppBottomSheet: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('sheet', p, children),
}));
vi.mock('@/components/shared/app-button', () => ({
  AppButton: (p: Record<string, unknown>) => React.createElement('button', p),
}));
vi.mock('@/components/shared/app-checkbox', () => ({
  AppCheckbox: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('checkbox', p, children),
}));
vi.mock('@/components/shared/app-text', () => ({
  AppText: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('text', p, children),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('view', p, children),
  AppPressableView: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
    React.createElement('pressable', p, children),
}));
vi.mock('@/components/screens/legal-document-screen', () => ({
  default: (p: Record<string, unknown>) => React.createElement('document-screen', p),
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ danger: (...a: unknown[]) => dangerToast(...a) }),
}));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({ isAuthenticated }),
}));
vi.mock('@/contexts/language.context', () => ({
  useLanguageContext: () => ({ language: 'en' }),
}));
vi.mock('@/services/legal-api', () => ({
  legalTransport: {
    getDocuments: (...a: unknown[]) => getDocuments(...a),
    getStatus: (...a: unknown[]) => getStatus(...a),
    accept: (...a: unknown[]) => accept(...a),
  },
}));

import { LegalUpdateHost } from './legal-update-host';
import { legalQueryKeys } from '@/hooks/use-legal';

beforeEach(() => {
  push.mockReset();
  dangerToast.mockReset();
  getStatus.mockReset();
  accept.mockReset();
  getDocuments.mockReset().mockResolvedValue({ documents: [] });
  isAuthenticated = true;
});

const REQUIRES = {
  requires_acceptance: true,
  documents: [
    { type: 'TERMS_OF_USE', required_version: 2, accepted_version: 1, accepted: false },
    { type: 'PRIVACY_POLICY', required_version: 9, accepted_version: null, accepted: false },
  ],
};

const SATISFIED = {
  requires_acceptance: false,
  documents: [
    {
      type: 'TERMS_OF_USE',
      required_version: 2,
      accepted_version: 2,
      accepted: true,
      accepted_at: '2026-08-31T12:40:00.000Z',
    },
  ],
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

async function settle() {
  for (let i = 0; i < 25; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function render(client = makeClient()) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <LegalUpdateHost />
      </QueryClientProvider>,
    );
  });
  await settle();
  return { renderer, client };
}

/** Every node of a given host type in the rendered tree. */
function nodesOfType(renderer: ReactTestRenderer, type: string) {
  return renderer.root.findAll((n) => n.type === type, { deep: true });
}

/** User-VISIBLE strings only: rendered children plus accessibility labels and
 *  titles. Deliberately excludes prop NAMES — `dismissOnOverlayPress={false}`
 *  is the opposite of a bypass, and matching it would invert the test. */
function visibleText(renderer: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      const n = node as { props?: Record<string, unknown>; children?: unknown };
      for (const key of ['title', 'accessibilityLabel', 'testID']) {
        const v = n.props?.[key];
        if (typeof v === 'string') out.push(v);
      }
      if (n.children) walk(n.children);
    }
  };
  walk(renderer.toJSON());
  return out.join(' | ');
}

describe('A. anonymous browsing', () => {
  test('renders nothing and never calls the authenticated status endpoint', async () => {
    isAuthenticated = false;
    const { renderer } = await render();

    expect(renderer.toJSON()).toBeNull();
    // The endpoint requires a JWT — an anonymous browse must not touch it.
    expect(getStatus).not.toHaveBeenCalled();
  });
});

describe('B. authenticated, nothing required', () => {
  test('renders nothing — the app is usable as normal', async () => {
    getStatus.mockResolvedValueOnce(SATISFIED);
    const { renderer } = await render();

    expect(getStatus).toHaveBeenCalled();
    expect(renderer.toJSON()).toBeNull();
  });
});

describe('C. authenticated, acceptance required — MANDATORY', () => {
  test('shows the gate', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    const { renderer } = await render();

    expect(renderer.toJSON()).not.toBeNull();
    expect(nodesOfType(renderer, 'sheet')).toHaveLength(1);
  });

  test('the sheet is non-dismissible in every direction', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    const { renderer } = await render();

    const sheet = nodesOfType(renderer, 'sheet')[0]!;
    // Overlay tap, swipe-down and Android back (Modal's onRequestClose) are
    // all closed off. onClose must be a no-op, not a state setter.
    expect(sheet.props.dismissOnOverlayPress).toBe(false);
    expect(sheet.props.swipeToClose).toBe(false);
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.onClose()).toBeUndefined();

    // Calling onClose must NOT hide the gate.
    await act(async () => {
      sheet.props.onClose();
    });
    expect(renderer.toJSON()).not.toBeNull();
  });

  test('has NO Later / Skip / Close / Dismiss control', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    const { renderer } = await render();

    const visible = visibleText(renderer).toLowerCase();
    for (const bypass of ['later', 'skip', 'not now', 'dismiss', 'close', 'maybe']) {
      expect(visible, `found a bypass control: ${bypass}`).not.toContain(bypass);
    }
    // Exactly one button in the gate — accept.
    const buttons = nodesOfType(renderer, 'button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.props.testID).toBe('legal-update-accept');
  });

  test('one checkbox per outstanding document, none pre-ticked', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    const { renderer } = await render();

    const boxes = nodesOfType(renderer, 'checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.map((b) => b.props.testID)).toEqual([
      'legal-update-TERMS_OF_USE',
      'legal-update-PRIVACY_POLICY',
    ]);
    for (const b of boxes) expect(b.props.checked).toBe(false);
  });

  test('Accept stays disabled until EVERY box is ticked', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    const { renderer } = await render();

    const button = () => nodesOfType(renderer, 'button')[0]!;
    const box = (id: string) =>
      nodesOfType(renderer, 'checkbox').find((b) => b.props.testID === id)!;

    // none
    expect(button().props.disabled).toBe(true);

    // one of two
    await act(async () => {
      box('legal-update-TERMS_OF_USE').props.onChange(true);
    });
    expect(button().props.disabled).toBe(true);

    // both
    await act(async () => {
      box('legal-update-PRIVACY_POLICY').props.onChange(true);
    });
    expect(button().props.disabled).toBe(false);

    // un-ticking re-disables — consent is never sticky
    await act(async () => {
      box('legal-update-TERMS_OF_USE').props.onChange(false);
    });
    expect(button().props.disabled).toBe(true);
  });

  test('opening a document does not mark it accepted', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    const { renderer } = await render();

    await openDocument(renderer, 0);
    await goBack(renderer);

    // Still unticked, still blocking — reading is not consenting.
    expect(nodesOfType(renderer, 'checkbox')[0]!.props.checked).toBe(false);
    expect(nodesOfType(renderer, 'button')[0]!.props.disabled).toBe(true);
  });
});

// ── Document navigation above the gate ──────────────────────────────────
//
// The gate lives in a native Modal that covers the whole navigator, so a
// router.push would land UNDERNEATH it. These tests assert the document is
// presented in the gate's own Modal instead — visible, readable, and with a
// Back that returns to the gate rather than escaping it.

/** Tap the Nth document link. */
async function openDocument(renderer: ReactTestRenderer, index: number) {
  await act(async () => {
    nodesOfType(renderer, 'pressable')[index]!.props.onPress();
  });
}

/** Press Back from the document view. */
async function goBack(renderer: ReactTestRenderer) {
  await act(async () => {
    nodesOfType(renderer, 'document-screen')[0]!.props.onBack();
  });
}

const ALL_THREE = {
  requires_acceptance: true,
  documents: [
    { type: 'TERMS_OF_USE', required_version: 2, accepted_version: 1, accepted: false },
    { type: 'PRIVACY_POLICY', required_version: 9, accepted_version: null, accepted: false },
    {
      type: 'PERSONAL_DATA_CONSENT',
      required_version: 3,
      accepted_version: null,
      accepted: false,
    },
  ],
};

describe('H. reading a document from the gate', () => {
  test.each([
    [0, 'TERMS_OF_USE'],
    [1, 'PRIVACY_POLICY'],
    [2, 'PERSONAL_DATA_CONSENT'],
  ])('link %i opens %s above the gate, and Back returns to it', async (index, type) => {
    getStatus.mockResolvedValueOnce(ALL_THREE);
    const { renderer } = await render();

    // Gate first.
    expect(nodesOfType(renderer, 'document-screen')).toHaveLength(0);
    expect(nodesOfType(renderer, 'checkbox')).toHaveLength(3);

    await openDocument(renderer, index);

    // The document is now presented — inside the gate's own modal, not routed.
    const screens = nodesOfType(renderer, 'document-screen');
    expect(screens).toHaveLength(1);
    expect(screens[0]!.props.type).toBe(type);
    // It replaced the consent view, so it is genuinely visible (not behind).
    expect(nodesOfType(renderer, 'checkbox')).toHaveLength(0);
    // No route was pushed — that is exactly what put it behind the modal.
    expect(push).not.toHaveBeenCalled();

    await goBack(renderer);

    // Back lands on the gate again, still blocking, still unaccepted.
    expect(nodesOfType(renderer, 'document-screen')).toHaveLength(0);
    expect(nodesOfType(renderer, 'checkbox')).toHaveLength(3);
    expect(nodesOfType(renderer, 'button')[0]!.props.disabled).toBe(true);
  });

  test('the modal stays blocking while a document is open', async () => {
    getStatus.mockResolvedValueOnce(ALL_THREE);
    const { renderer } = await render();
    await openDocument(renderer, 0);

    const sheet = nodesOfType(renderer, 'sheet')[0]!;
    // Overlay tap and swipe stay disabled — the document view is not an escape
    // hatch out of the gate.
    expect(sheet.props.dismissOnOverlayPress).toBe(false);
    expect(sheet.props.swipeToClose).toBe(false);
    expect(sheet.props.visible).toBe(true);
    // The gate is never unmounted.
    expect(renderer.toJSON()).not.toBeNull();
  });

  test('Android hardware back closes the DOCUMENT, never the gate', async () => {
    getStatus.mockResolvedValueOnce(ALL_THREE);
    const { renderer } = await render();
    await openDocument(renderer, 0);

    // Modal's onRequestClose is what Android back triggers.
    await act(async () => {
      nodesOfType(renderer, 'sheet')[0]!.props.onClose();
    });

    // Back on the gate — not dismissed.
    expect(renderer.toJSON()).not.toBeNull();
    expect(nodesOfType(renderer, 'document-screen')).toHaveLength(0);
    expect(nodesOfType(renderer, 'checkbox')).toHaveLength(3);
  });

  test('ticks survive reading a document', async () => {
    getStatus.mockResolvedValueOnce(ALL_THREE);
    const { renderer } = await render();

    const box = (id: string) =>
      nodesOfType(renderer, 'checkbox').find((b) => b.props.testID === id)!;
    await act(async () => {
      box('legal-update-TERMS_OF_USE').props.onChange(true);
    });

    await openDocument(renderer, 1);
    await goBack(renderer);

    // The earlier tick is preserved; the unread ones are still false.
    expect(box('legal-update-TERMS_OF_USE').props.checked).toBe(true);
    expect(box('legal-update-PRIVACY_POLICY').props.checked).toBe(false);
  });

  test('can still accept after reading all three', async () => {
    getStatus.mockResolvedValueOnce(ALL_THREE);
    accept.mockResolvedValueOnce(SATISFIED);
    const { renderer } = await render();

    for (const index of [0, 1, 2]) {
      await openDocument(renderer, index);
      await goBack(renderer);
    }
    for (const b of nodesOfType(renderer, 'checkbox')) {
      await act(async () => {
        b.props.onChange(true);
      });
    }
    await act(async () => {
      await nodesOfType(renderer, 'button')[0]!.props.onPress();
    });
    await settle();

    expect(accept).toHaveBeenCalledWith([
      { type: 'TERMS_OF_USE', version: 2 },
      { type: 'PRIVACY_POLICY', version: 9 },
      { type: 'PERSONAL_DATA_CONSENT', version: 3 },
    ]);
    expect(renderer.toJSON()).toBeNull();
  });

  test('a document open at logout does not leave the gate stuck', async () => {
    getStatus.mockResolvedValue(ALL_THREE);
    const client = makeClient();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <LegalUpdateHost />
        </QueryClientProvider>,
      );
    });
    await settle();
    await openDocument(renderer, 0);

    isAuthenticated = false;
    await act(async () => {
      renderer.update(
        <QueryClientProvider client={client}>
          <LegalUpdateHost />
        </QueryClientProvider>,
      );
    });
    await settle();

    expect(renderer.toJSON()).toBeNull();
  });
});

describe('D. successful acceptance', () => {
  test('sends backend versions, closes the gate, and issues NO second status GET', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    accept.mockResolvedValueOnce(SATISFIED);
    const { renderer, client } = await render();

    const box = (id: string) =>
      nodesOfType(renderer, 'checkbox').find((b) => b.props.testID === id)!;
    await act(async () => {
      box('legal-update-TERMS_OF_USE').props.onChange(true);
    });
    await act(async () => {
      box('legal-update-PRIVACY_POLICY').props.onChange(true);
    });
    await act(async () => {
      await nodesOfType(renderer, 'button')[0]!.props.onPress();
    });
    await settle();

    // Exactly the versions the backend said were required.
    expect(accept).toHaveBeenCalledWith([
      { type: 'TERMS_OF_USE', version: 2 },
      { type: 'PRIVACY_POLICY', version: 9 },
    ]);
    // The gate is gone — the app is usable again.
    expect(renderer.toJSON()).toBeNull();
    // Seeded from the mutation response; no follow-up status request.
    expect(client.getQueryData(legalQueryKeys.status())).toEqual(SATISFIED);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  test('a failed acceptance keeps the gate up and surfaces an error', async () => {
    getStatus.mockResolvedValueOnce(REQUIRES);
    accept.mockRejectedValueOnce(new Error('offline'));
    const { renderer } = await render();

    const boxes = nodesOfType(renderer, 'checkbox');
    for (const b of boxes) {
      await act(async () => {
        b.props.onChange(true);
      });
    }
    await act(async () => {
      await nodesOfType(renderer, 'button')[0]!.props.onPress();
    });
    await settle();

    expect(dangerToast).toHaveBeenCalled();
    // Never opens on a failure.
    expect(renderer.toJSON()).not.toBeNull();
  });
});

describe('E. status could not be determined', () => {
  test('blocks with a retry instead of silently exposing the app', async () => {
    getStatus.mockRejectedValueOnce(new Error('network down'));
    const { renderer } = await render();

    expect(renderer.toJSON()).not.toBeNull();
    const sheet = nodesOfType(renderer, 'sheet')[0]!;
    expect(sheet.props.dismissOnOverlayPress).toBe(false);
    expect(sheet.props.swipeToClose).toBe(false);

    const buttons = nodesOfType(renderer, 'button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.props.testID).toBe('legal-status-retry');
  });

  test('an anonymous user is NOT shown the status error', async () => {
    isAuthenticated = false;
    getStatus.mockRejectedValueOnce(new Error('network down'));
    const { renderer } = await render();

    expect(renderer.toJSON()).toBeNull();
  });
});

describe('F. loading', () => {
  test('does not render the gate before status resolves, and never fails open', async () => {
    // Never resolves — models the in-flight window.
    getStatus.mockReturnValueOnce(new Promise(() => {}));
    const { renderer } = await render();

    // Nothing shown yet, but nothing was decided either: the moment status
    // arrives saying acceptance is required, the gate appears (covered above).
    expect(renderer.toJSON()).toBeNull();
  });
});

describe('G. logout while acceptance is required', () => {
  test('the gate disappears and anonymous browsing resumes', async () => {
    getStatus.mockResolvedValue(REQUIRES);
    const client = makeClient();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <LegalUpdateHost />
        </QueryClientProvider>,
      );
    });
    await settle();
    expect(renderer.toJSON()).not.toBeNull();

    // Sign out.
    isAuthenticated = false;
    await act(async () => {
      renderer.update(
        <QueryClientProvider client={client}>
          <LegalUpdateHost />
        </QueryClientProvider>,
      );
    });
    await settle();

    expect(renderer.toJSON()).toBeNull();
    // Per-account isolation: the previous user's status must not linger.
    expect(client.getQueryData(legalQueryKeys.status())).toBeUndefined();
  });
});
