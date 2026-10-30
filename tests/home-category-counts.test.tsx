/**
 * The parts count under each home-grid tile, from the wire to the words.
 *
 * GET /v1/reference/categories serves every root with its `productsCount`,
 * counted by the backend over the root's whole subtree (the counting rule is
 * tested there). Here: each of the 10 tiles shows the count served for its
 * root, through the real tile and the app's own i18next, in the plural form
 * the language asks for — and a backend without counts leaves the tiles with
 * no count line rather than a made-up one.
 */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { referenceCategories } from './fixtures/part-categories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));
const get = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a) },
}));

// Hoisted with the mocks below, which call it while building their factories.
const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/screens-components/catalog/auto-part-icon', () => ({ default: () => null }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));

import CategoryTile from '@/components/screens-components/catalog/category-tile';
import { fetchRootCategories, type CategoryTileData } from '@/services/categories-service';
import i18n from '@/services/i18n';
import { localizedCategoryLabel } from '@/utils/category-label';

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => referenceCategories(url));
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

/** Render the real tile for `tile` with the interface in `lang`. */
async function renderTile(tile: CategoryTileData, lang: string): Promise<ReactTestRenderer> {
  await i18n.changeLanguage(lang);
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <CategoryTile
        name={tile.name}
        label={localizedCategoryLabel(tile, lang)}
        iconKey={tile.iconKey}
        count={tile.count}
        onPress={() => {}}
      />,
    );
  });
  return r;
}

const is = (n: ReactTestInstance, type: string) => (n.type as unknown) === type;

/** The tile's lines of text: its name, then its count line when it has one. */
const lines = (r: ReactTestRenderer) =>
  r.root.findAll((n) => is(n, 'text')).map((n) => String(n.props.children));

const brakes = async () =>
  (await fetchRootCategories('home')).find((t) => t.id === 'brake-system')!;

describe('the count line on the home grid', () => {
  test('every one of the 10 tiles shows the count served for its root', async () => {
    const shown: Record<string, string> = {};
    for (const tile of await fetchRootCategories('home')) {
      shown[tile.id] = lines(await renderTile(tile, 'ru'))[1];
    }
    expect(shown).toEqual({
      'brake-system': '125 запчастей',
      'motor-oil': '84 запчасти',
      'electrical-and-lighting': '312 запчастей',
      'tuning-and-accessories': '21 запчасть',
      transmission: '1 запчасть',
      'maintenance-and-fluids': '0 запчастей',
      'suspension-and-steering': '47 запчастей',
      'engine-system': '1043 запчасти',
      'heating-and-cooling': '22 запчасти',
      other: '5 запчастей',
    });
  });

  test('sits under the name and joins it in the accessibility label', async () => {
    const r = await renderTile(await brakes(), 'ru');
    expect(lines(r)).toHaveLength(2);
    expect(r.root.find((n) => is(n, 'pressable')).props.accessibilityLabel).toBe(
      'Тормозная система, 125 запчастей',
    );
  });

  test('is absent when the backend serves no count — never a 0 the app made up', async () => {
    get.mockImplementation(async (url: string) => ({
      items: referenceCategories(url).items.map(({ productsCount: _count, ...node }) => node),
    }));
    const r = await renderTile(await brakes(), 'ru');
    expect(lines(r)).toHaveLength(1);
    expect(r.root.find((n) => is(n, 'pressable')).props.accessibilityLabel).toBe(
      'Тормозная система',
    );
  });
});

describe('the count line in every language', () => {
  const withCount = async (count: number) => ({ ...(await brakes()), count });

  test.each([
    [1, '1 запчасть'],
    [21, '21 запчасть'],
    [2, '2 запчасти'],
    [84, '84 запчасти'],
    [1043, '1043 запчасти'],
    [0, '0 запчастей'],
    [11, '11 запчастей'],
    [111, '111 запчастей'],
    [125, '125 запчастей'],
  ])('ru: %i → «%s»', async (count, text) => {
    expect(lines(await renderTile(await withCount(count), 'ru'))[1]).toBe(text);
  });

  test.each([
    [1, '1 ta qism'],
    [125, '125 ta qism'],
  ])('uz: %i → «%s»', async (count, text) => {
    expect(lines(await renderTile(await withCount(count), 'uz'))[1]).toBe(text);
  });

  test.each([
    [1, '1 part'],
    [0, '0 parts'],
    [84, '84 parts'],
  ])('en: %i → «%s»', async (count, text) => {
    expect(lines(await renderTile(await withCount(count), 'en'))[1]).toBe(text);
  });
});
