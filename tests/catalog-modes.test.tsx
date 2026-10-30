/**
 * The two ways into the catalogue, wired screen to screen.
 *
 *   A. No model picked — the home grid: a system tile opens EVERY part of that
 *      system at once (`/category?cat=<root>`); no subcategory step. A car in
 *      the Garage does not change this.
 *   B. A model picked through a home-screen brand (Chevrolet, BYD, Volkswagen…)
 *      — brand → model → systems → subcategories → the parts that fit the
 *      model. The model travels as route params, so picking another brand or
 *      model, or going back home, needs no reset.
 *
 * The screens render for real over stub components; the drill hook and the
 * reference fetcher are real too, answering from the `part_categories` export
 * (fixtures/part-categories.ts) the way the backend does.
 */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { referenceCategories } from './fixtures/part-categories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── the app around the screens ─────────────────────────────────────────

const push = vi.fn();
let params: Record<string, string | undefined> = {};
vi.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => push(...a), navigate: () => {}, replace: () => {} },
  useLocalSearchParams: () => params,
}));

vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));
const get = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a) },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('expo-blur', () => ({ BlurView: () => null }));
vi.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  ArrowLeft: () => null,
  Bell: () => null,
  ChevronRight: () => null,
  PackageOpen: () => null,
  Search: () => null,
  X: () => null,
}));

// Hoisted with the mocks below, which call it while building their factories.
const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));
vi.mock('react-native', () => ({
  Keyboard: { dismiss: () => {} },
  Platform: { OS: 'ios' },
  RefreshControl: () => null,
  ScrollView: host('scroll'),
  StyleSheet: { absoluteFill: {}, create: <T,>(s: T) => s },
  TextInput: () => null,
  View: host('rn-view'),
}));
vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
  }) =>
    React.createElement(
      'list',
      null,
      ListHeaderComponent ?? null,
      data.map((item, index) =>
        React.createElement(React.Fragment, { key: index }, renderItem({ item, index })),
      ),
    ),
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-logo', () => ({ AppLogo: () => null }));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: host('header') }));
vi.mock('@/components/shared/wheel-loader', () => ({
  WheelLoader: () => null,
  ListLoadingOverlay: () => null,
}));
vi.mock('@/components/screens-components/catalog/category-tile', () => ({ default: host('tile') }));
vi.mock('@/components/screens-components/catalog/vehicle-make-tile', () => ({
  default: host('make-tile'),
}));
vi.mock('@/components/screens-components/catalog/category-grid-skeleton', () => ({
  default: () => null,
  BrandRowSkeleton: () => null,
  CategoryRowsSkeleton: () => null,
}));
vi.mock('@/components/screens-components/catalog/auto-part-icon', () => ({ default: () => null }));
vi.mock('@/components/screens-components/catalog/brand-logo', () => ({ default: () => null }));
vi.mock('@/components/screens-components/catalog/certified-section', () => ({
  default: () => null,
}));
vi.mock('@/components/screens-components/catalog/fitment-note', () => ({ default: () => null }));
vi.mock('@/components/screens-components/catalog/product-row', () => ({ default: () => null }));
vi.mock('@/components/screens-components/catalog/results-toolbar', () => ({ default: () => null }));

vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: {}, scheme: 'light' }),
}));
vi.mock('@/contexts/cart.context', () => ({ useCartContext: () => ({ addItem: () => {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: true }) }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/utils/nav', () => ({ openItemDetail: () => {} }));
vi.mock('@/services/global-modal-service/global-modal.service', () => ({
  modalService: { openModal: () => {} },
}));
vi.mock('@/hooks/use-notifications', () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ success: () => {} }) }));

// A car sits in the Garage throughout: it must change neither the home grid's
// navigation nor what a home-grid listing asks for.
const GARAGE_CAR = { id: 'v-1', make: 'Chevrolet', model: 'Malibu', year: 2022 };
vi.mock('@/hooks/use-garage', () => ({
  default: () => ({ vehicles: [GARAGE_CAR], primaryVehicle: GARAGE_CAR }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({ currentActiveVehicle: { vehicleId: GARAGE_CAR.id } }),
}));

/** The home-screen brand buttons and the models each one opens. */
const MAKES = [
  { id: 'chevrolet', name: 'Chevrolet', logoUrl: null, comingSoon: false },
  { id: 'byd', name: 'BYD', logoUrl: null, comingSoon: false },
  { id: 'volkswagen', name: 'Volkswagen', logoUrl: null, comingSoon: false },
];
const MODELS: Record<string, { id: string; makeId: string; name: string }[]> = {
  chevrolet: [{ id: 'cobalt', makeId: 'chevrolet', name: 'Cobalt' }],
  byd: [{ id: 'song-plus', makeId: 'byd', name: 'Song Plus' }],
  volkswagen: [{ id: 'id4', makeId: 'volkswagen', name: 'ID.4' }],
};
vi.mock('@/hooks/use-vehicle-catalog', () => ({
  useMakes: () => ({ state: 'success', makes: MAKES }),
  useModels: (makeId: string) => ({ state: 'success', models: MODELS[makeId] ?? [] }),
}));

/** Root tiles as the two root hooks hand them over (Russian UI). */
let homeTiles: unknown[] = [];
let systemTiles: unknown[] = [];
vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({ state: 'success', categories: homeTiles, refresh: async () => {} }),
}));
vi.mock('@/hooks/use-system-categories', () => ({
  useSystemCategories: () => ({ state: 'success', categories: systemTiles }),
}));

/** Every catalogue request a listing screen makes. */
const listRequests: Record<string, unknown>[] = [];
vi.mock('@/hooks/use-catalog-list', () => ({
  useCatalogList: (req: Record<string, unknown>) => {
    listRequests.push(req);
    return { state: 'success', items: [], total: 0, isRefreshing: false, refresh: () => {} };
  },
}));

import CatalogPartsScreen from '@/components/screens/catalog-parts-screen';
import CatalogSubcategoriesScreen from '@/components/screens/catalog-subcategories-screen';
import CatalogSystemsScreen from '@/components/screens/catalog-systems-screen';
import CategoryScreen from '@/components/screens/category-screen';
import ExploreScreen from '@/components/screens/explore-screen';
import MakeScreen from '@/components/screens/make-screen';
import { fetchRootCategories } from '@/services/categories-service';
import { localizedCategoryLabel } from '@/utils/category-label';

beforeAll(async () => {
  get.mockImplementation(async (url: string) => referenceCategories(url));
  const ru = (tiles: Awaited<ReturnType<typeof fetchRootCategories>>) =>
    tiles.map((c) => ({ ...c, label: localizedCategoryLabel(c, 'ru') }));
  homeTiles = ru(await fetchRootCategories('home'));
  systemTiles = ru(await fetchRootCategories('systems'));
});

beforeEach(() => {
  push.mockReset();
  get.mockClear();
  listRequests.length = 0;
  params = {};
});

/** Render `screen` and let its first load (a subcategory fetch) settle. */
async function render(screen: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(screen);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return r;
}

/** Press `node` (with what the real component passes its `onPress`, if
 *  anything) and let the async work behind it — a drill lookup — settle. */
async function press(node: { props: Record<string, unknown> }, ...args: unknown[]) {
  await act(async () => {
    (node.props.onPress as (...a: unknown[]) => void)(...args);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** A rendered stub, by the host name the mocks above give it. */
const is = (n: ReactTestInstance, type: string) => (n.type as unknown) === type;

const pressable = (r: ReactTestRenderer, label: string) =>
  r.root.find((n) => is(n, 'pressable') && n.props.accessibilityLabel === label);

const childLookups = () =>
  get.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('parentId='));

// ── A. no model picked ─────────────────────────────────────────────────

describe('A. home grid without a picked model', () => {
  test('shows the 10 systems, "Другое" included', async () => {
    const r = await render(<ExploreScreen />);
    const tiles = r.root.findAll((n) => is(n, 'tile'));
    expect(tiles.map((t) => t.props.label)).toEqual([
      'Тормозная система',
      'Моторные масла',
      'Электрика и освещение',
      'Тюнинг и аксессуары',
      'Трансмиссия',
      'ТО и жидкости',
      'Подвеска и рулевое',
      'Двигатель',
      'Отопление и охлаждение',
      'Другое',
    ]);
  });

  test('a system tile opens all of its parts at once — no subcategory step', async () => {
    const r = await render(<ExploreScreen />);
    for (const tile of r.root.findAll((n) => is(n, 'tile'))) {
      push.mockReset();
      await press(tile);
      const id = homeTiles.find((c) => (c as { label: string }).label === tile.props.label) as {
        id: string;
      };
      expect(push).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith({
        pathname: '/category',
        params: { cat: id.id, label: tile.props.label },
      });
    }
    // Never asked the tree for children, never pushed the subcategory screen.
    expect(childLookups()).toEqual([]);
  });

  test('the listing asks for the whole system, with no car scoping it', async () => {
    params = { cat: 'suspension-and-steering', label: 'Подвеска и рулевое' };
    await render(<CategoryScreen />);
    expect(listRequests.at(-1)).toEqual({
      page: 1,
      pageSize: 24,
      category: 'suspension-and-steering',
      vehicleCategory: undefined,
      sortBy: 'relevance',
    });
  });

  test('"Другое" lists its goods the same way', async () => {
    const r = await render(<ExploreScreen />);
    await press(r.root.find((n) => is(n, 'tile') && n.props.label === 'Другое'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/category',
      params: { cat: 'other', label: 'Другое' },
    });
  });
});

// ── B. a model picked through a home-screen brand ──────────────────────

describe('B. brand → model → systems → subcategories → fitting parts', () => {
  test.each([
    ['chevrolet', 'Chevrolet', 'Cobalt'],
    ['byd', 'BYD', 'Song Plus'],
    ['volkswagen', 'Volkswagen', 'ID.4'],
  ])('the %s button opens its models, and a model opens the systems', async (id, make, model) => {
    const home = await render(<ExploreScreen />);
    // VehicleMakeTile hands its brand id to `onPress`.
    await press(
      home.root.find((n) => is(n, 'make-tile') && n.props.brandId === id),
      id,
    );
    expect(push).toHaveBeenCalledWith({ pathname: '/make', params: { make: id } });

    push.mockReset();
    params = { make: id };
    const makeScreen = await render(<MakeScreen />);
    await press(pressable(makeScreen, `${make} ${model}`));
    expect(push).toHaveBeenCalledWith({
      pathname: '/catalog',
      params: { make, model, brandId: id },
    });
  });

  test('the systems list shows every system, "Другое" included', async () => {
    params = { make: 'Chevrolet', model: 'Cobalt', brandId: 'chevrolet' };
    const r = await render(<CatalogSystemsScreen />);
    const rows = r.root.findAll((n) => is(n, 'pressable')).map((n) => n.props.accessibilityLabel);
    expect(rows).toEqual([
      'Тормозная система',
      'Двигатель',
      'Подвеска и рулевое',
      'Трансмиссия',
      'Отопление и охлаждение',
      'Электрика и освещение',
      'ТО и жидкости',
      'Моторные масла',
      'Тюнинг и аксессуары',
      'Другое',
    ]);
  });

  test.each([
    ['brake-system', 'Тормозная система'],
    ['other', 'Другое'],
  ])('a system (%s) opens its subcategories, carrying the model', async (id, label) => {
    params = { make: 'Chevrolet', model: 'Cobalt', brandId: 'chevrolet' };
    const r = await render(<CatalogSystemsScreen />);
    await press(pressable(r, label));
    expect(push).toHaveBeenCalledWith({
      pathname: '/catalog/subcategories',
      params: {
        parentId: id,
        parentLabel: label,
        make: 'Chevrolet',
        model: 'Cobalt',
        brandId: 'chevrolet',
      },
    });
  });

  test('a subcategory opens its parts, still carrying the model', async () => {
    params = {
      parentId: 'brake-system',
      parentLabel: 'Тормозная система',
      make: 'BYD',
      model: 'Song Plus',
      brandId: 'byd',
    };
    const r = await render(<CatalogSubcategoriesScreen />);
    await press(pressable(r, 'Передние тормозные колодки'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/catalog/parts',
      params: {
        categoryId: 'front-brake-pads',
        categoryLabel: 'Передние тормозные колодки',
        make: 'BYD',
        model: 'Song Plus',
        brandId: 'byd',
      },
    });
  });

  test('wheel-hubs-bearings opens one more level — the bearings', async () => {
    params = {
      parentId: 'suspension-and-steering',
      parentLabel: 'Подвеска и рулевое',
      make: 'Volkswagen',
      model: 'ID.4',
      brandId: 'volkswagen',
    };
    const r = await render(<CatalogSubcategoriesScreen />);
    await press(pressable(r, 'Ступицы и подшипники'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/catalog/subcategories',
      params: {
        parentId: 'wheel-hubs-bearings',
        parentLabel: 'Ступицы и подшипники',
        make: 'Volkswagen',
        model: 'ID.4',
        brandId: 'volkswagen',
      },
    });

    params = { ...params, parentId: 'wheel-hubs-bearings', parentLabel: 'Ступицы и подшипники' };
    const bearings = await render(<CatalogSubcategoriesScreen />);
    const rows = bearings.root
      .findAll((n) => is(n, 'pressable'))
      .map((n) => n.props.accessibilityLabel);
    expect(rows).toEqual(['Шариковые подшипники', 'Роликовые подшипники']);
  });

  test('the parts list is filtered to the picked model', async () => {
    params = {
      categoryId: 'front-brake-pads',
      categoryLabel: 'Передние тормозные колодки',
      make: 'Chevrolet',
      model: 'Cobalt',
    };
    await render(<CatalogPartsScreen />);
    expect(listRequests.at(-1)).toMatchObject({
      category: 'front-brake-pads',
      make: 'Chevrolet',
      model: 'Cobalt',
    });
  });

  test('switching to another model scopes the parts to that model instead', async () => {
    params = { categoryId: 'front-brake-pads', make: 'Chevrolet', model: 'Cobalt' };
    await render(<CatalogPartsScreen />);
    params = { categoryId: 'front-brake-pads', make: 'BYD', model: 'Song Plus' };
    await render(<CatalogPartsScreen />);
    expect(listRequests.at(-1)).toMatchObject({ make: 'BYD', model: 'Song Plus' });
  });

  test('back on the home grid, the picked model is gone: tiles list everything again', async () => {
    params = { make: 'Chevrolet', model: 'Cobalt', brandId: 'chevrolet' };
    await render(<CatalogSystemsScreen />);

    params = {};
    const home = await render(<ExploreScreen />);
    await press(home.root.find((n) => is(n, 'tile') && n.props.label === 'Тормозная система'));
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/category',
      params: { cat: 'brake-system', label: 'Тормозная система' },
    });
  });
});
