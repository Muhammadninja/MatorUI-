import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));
vi.mock('expo-image', () => ({ Image: host('image') }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));

import BrandLogo from './brand-logo';
import { bundledBrandLogo } from './bundled-brand-logos';

const render = (el: React.ReactElement) => {
  let r!: ReturnType<typeof create>;
  act(() => {
    r = create(el);
  });
  return r.root;
};

describe('bundled brand logos', () => {
  test('every newly enabled make without a backend logo has one, matched by name', () => {
    for (const name of ['Kia', 'Hyundai', 'Chery', 'Toyota', 'Haval', 'Lada', 'Nissan', 'Daewoo', 'Ravon', 'SsangYong', 'Škoda', 'Genesis']) {
      expect(bundledBrandLogo(name), name).not.toBeNull();
    }
    expect(bundledBrandLogo('Zeekr')).toBeNull();
  });

  test('the backend logo still wins; the bundled one replaces only the initial', () => {
    const remote = render(<BrandLogo logoUrl="https://cdn/kia.png" name="Kia" />);
    expect(remote.findByType('image' as never).props.source).toEqual({ uri: 'https://cdn/kia.png' });

    const bundled = render(<BrandLogo logoUrl={null} name="Kia" />);
    expect(bundled.findByType('image' as never).props.source).toBe(bundledBrandLogo('Kia'));

    const unknown = render(<BrandLogo logoUrl={null} name="Zeekr" />);
    expect(unknown.findByType('text' as never).props.children).toBe('Z');
  });
});
