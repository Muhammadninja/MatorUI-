/**
 * Garage "active vehicle" hero — dark-theme QA.
 *
 * The hero's surface was `brand`, the CTA fill token, which is `#fff` in dark
 * mode: on the black Garage screen the whole card rendered as a bright white
 * block, and the per-scheme rgba literals beside it were tuned for that white
 * card. It now reads every colour from the `hero*` theme tokens — the dark
 * theme maps them onto the same card surface the other Garage cards use, and
 * the light theme keeps the inverted black hero exactly as it was.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, theme } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  theme: { scheme: 'dark' as 'light' | 'dark' },
}));

vi.mock('expo-router', () => ({ DarkTheme: { colors: {} }, DefaultTheme: { colors: {} } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({ SlidersHorizontal: host('icon') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('./garage-brand-badge', () => ({ GarageBrandBadge: host('badge') }));
vi.mock('@/contexts/theme.context', async () => {
  const { darkTokens, lightTokens } = await import('@/themes');
  return {
    useThemeContext: () => ({
      scheme: theme.scheme,
      tokens: theme.scheme === 'dark' ? darkTokens : lightTokens,
    }),
  };
});

import { darkTokens, lightTokens } from '@/themes';
import { GarageActiveHero } from './garage-active-hero';

const COBALT = {
  id: 'v-cobalt',
  year: 2020,
  make: 'Chevrolet',
  model: 'Cobalt',
  color: 'pearl',
  isPrimary: true,
  addedAt: 1,
} as React.ComponentProps<typeof GarageActiveHero>['vehicle'];

function render(scheme: 'light' | 'dark') {
  theme.scheme = scheme;
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <GarageActiveHero vehicle={COBALT} onShopParts={() => {}} onOpenDetail={() => {}} />,
    );
  });
  const card = r.root.find((n) => n.type === 'view' && n.props.rounded === 16);
  const cta = r.root.find((n) => (n.type as string) === 'button');
  const title = r.root.find((n) => n.type === 'text' && n.children.includes('Chevrolet Cobalt'));
  return { card, cta, title };
}

describe('GarageActiveHero colours', () => {
  test('the card surface is the shared vehicle banner', () => {
    expect(render('dark').card.props.colorName).toBe('vehicleBanner');
    expect(render('light').card.props.colorName).toBe('vehicleBanner');
  });

  test('dark: keeps the elevated card surface — not a white block', () => {
    expect(darkTokens.vehicleBanner).toBe(darkTokens.card);
    expect(darkTokens.vehicleBanner).not.toBe(darkTokens.brand);
    // Text on it stays readable.
    expect(render('dark').title.props.style.color).toBe(darkTokens.onVehicleBanner);
    expect(darkTokens.onVehicleBanner).toBe(darkTokens.text);
  });

  test('light: pale teal with graphite text', () => {
    expect(lightTokens.vehicleBanner).toBe('#E5F4F3');
    expect(lightTokens.vehicleBannerBorder).toBe('#C5E3E1');
    expect(render('light').title.props.style.color).toBe(lightTokens.onVehicleBanner);
    expect(lightTokens.onVehicleBanner).toBe(lightTokens.text);
  });

  test.each(['light', 'dark'] as const)('%s: the CTA is the brand button', (scheme) => {
    const { cta } = render(scheme);
    expect(cta.props.kind).toBe('brand');
    expect(cta.props.title).toBe('explore.shopParts');
  });

  test('no colour is decided in the component', () => {
    const source = readFileSync(join(__dirname, 'garage-active-hero.tsx'), 'utf8');
    expect(source).not.toMatch(/colorName="brand"/);
    expect(source).not.toMatch(/tokens\.onBrand/);
    expect(source).not.toMatch(/isDark|scheme ===/);
    expect(source).not.toMatch(/['"]rgba?\(/);
  });
});
