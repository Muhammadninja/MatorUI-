// @vitest-environment jsdom
/** A crash caught by AppErrorBoundary shows the fallback AND reaches Sentry —
 *  before, the fallback swallowed it and nothing was reported. */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';

const captureException = vi.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  return vi.fn();
});
vi.mock('@/services/sentry', () => ({ Sentry: { captureException } }));
vi.mock('lucide-react-native', () => ({ AlertTriangle: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: () => null }));
vi.mock('@/components/shared/app-text', () => ({ AppText: () => null }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: ({ children }: { children?: React.ReactNode }) => children,
}));

import { AppErrorBoundary } from '@/components/shared/app-error-boundary';

function Boom(): React.ReactElement {
  throw new Error('render failed');
}

test('a caught render crash is reported to Sentry with the boundary label', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  act(() => {
    create(
      <AppErrorBoundary label="this product">
        <Boom />
      </AppErrorBoundary>,
    );
  });
  expect(captureException).toHaveBeenCalledTimes(1);
  const [error, hint] = captureException.mock.calls[0];
  expect((error as Error).message).toBe('render failed');
  expect(hint.tags).toEqual({ boundary: 'this product' });
});
