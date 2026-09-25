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
vi.mock('@/contexts/language.context', () => ({ useLanguageContext: () => ({ language: 'ru' }) }));
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
  const card = r.root.find((n) => n.type === 'view' && n.props.rounded === 22);
  const cta = r.root.find(
    (n) =>
      (n.type as string) === 'pressable' &&
      n.props.accessibilityLabel === 'garage.shopPartsThatFit',
  );
  const title = r.root.find((n) => n.type === 'text' && n.children.includes('2020 Chevrolet'));
  return { card, cta, title };
}

describe('GarageActiveHero colours', () => {
  test('the card surface is the `hero` token, not the CTA fill', () => {
    expect(render('dark').card.props.colorName).toBe('hero');
  });

  test('dark: a dark card surface — not a white block', () => {
    expect(darkTokens.hero).not.toBe('#ffffff');
    expect(darkTokens.hero).toBe(darkTokens.card);
    expect(darkTokens.hero).not.toBe(darkTokens.brand);
    // Text on it stays readable.
    expect(render('dark').title.props.style.color).toBe(darkTokens.onHero);
    expect(darkTokens.onHero).toBe(darkTokens.text);
  });

  test('light: the inverted black hero is unchanged', () => {
    expect(lightTokens.hero).toBe(lightTokens.brand);
    expect(lightTokens.onHero).toBe(lightTokens.onBrand);
    // Exactly the alpha whites the component used to hardcode for light mode.
    expect(lightTokens.heroMuted).toBe('rgba(255, 255, 255, 0.5)');
    expect(lightTokens.heroDivider).toBe('rgba(255, 255, 255, 0.18)');
    expect(lightTokens.heroWash).toBe('rgba(255, 255, 255, 0.16)');
  });

  test.each(['light', 'dark'] as const)('%s: the CTA stands out from the hero', (scheme) => {
    const tokens = scheme === 'dark' ? darkTokens : lightTokens;
    const { cta } = render(scheme);
    expect(cta.props.colorName).toBe('primaryBg');
    expect(tokens.primaryBg).not.toBe(tokens.hero);
    const label = cta.find((n) => n.type === 'text');
    expect(label.props.colorName).toBe('onPrimary');
  });

  test('no colour is decided in the component', () => {
    const source = readFileSync(join(__dirname, 'garage-active-hero.tsx'), 'utf8');
    expect(source).not.toMatch(/colorName="brand"/);
    expect(source).not.toMatch(/tokens\.onBrand/);
    expect(source).not.toMatch(/isDark|scheme ===/);
    expect(source).not.toMatch(/['"]rgba?\(/);
  });
});
