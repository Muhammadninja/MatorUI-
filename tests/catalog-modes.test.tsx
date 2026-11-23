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

import { ROOT_PRODUCTS_COUNT, referenceCategories } from './fixtures/part-categories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── the app around the screens ─────────────────────────────────────────

const push = vi.fn();
let params: Record<string, string | undefined> = {};
vi.mock('expo-router', () => ({ useNavigation: () => ({ isFocused: () => true }), useSegments: () => [],
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
  ChevronDown: () => null,
  ChevronRight: () => null,
  ChevronUp: () => null,
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
  useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
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
vi.mock('@/components/screens-components/garage/home-garage-card', () => ({ default: () => null }));
vi.mock('@/components/screens-components/catalog/product-row', () => ({
  default: () => null,
  productCellStyle: () => ({}),
  useProductGridColumns: () => 1,
}));
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
const { toastSuccess, toastDanger } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastDanger: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: toastSuccess, danger: toastDanger }),
}));

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
let refreshResult: { isError: boolean } = { isError: false };
vi.mock('@/hooks/use-categories', () => ({
  useCategories: () => ({
    state: 'success',
    categories: homeTiles,
    refresh: async () => refreshResult,
  }),
}));
vi.mock('@/hooks/use-system-categories', () => ({
  useSystemCategories: () => ({ state: 'success', categories: systemTiles }),
}));

/** Every catalogue request a listing screen makes (the hook pages it). */
const listRequests: Record<string, unknown>[] = [];
vi.mock('@/hooks/use-catalog-list', () => ({
  CATALOG_PAGE_SIZE: 24,
  useCatalogInfiniteList: (req: Record<string, unknown>) => {
    listRequests.push(req);
    return {
      state: 'success',
      items: [],
      total: 0,
      brandFacets: [],
      isRefreshing: false,
      refresh: () => {},
      hasMore: false,
      isLoadingMore: false,
      loadMoreError: false,
      loadMore: () => {},
      retryLoadMore: () => {},
    };
  },
}));

// The order status card on Home is covered in order-status-card.test.tsx.
vi.mock('@/components/screens-components/orders/order-status-card', () => ({ OrderStatusCard: () => null }));
import CatalogPartsScreen from '@/components/screens/catalog-parts-screen';
import CatalogSubcategoriesScreen from '@/components/screens/catalog-subcategories-screen';
import CatalogSystemsScreen from '@/components/screens/catalog-systems-screen';
import CategoryScreen from '@/components/screens/category-screen';
import ExploreScreen from '@/components/screens/explore-screen';
import MakeScreen from '@/components/screens/make-screen';
import { HOME_ROOT_ORDER, fetchRootCategories } from '@/services/categories-service';
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

const categoriesToggle = (r: ReactTestRenderer) =>
  r.root.find((n) => is(n, 'pressable') && n.props.testID === 'explore-toggle-categories');

/** Explore lists six tiles until asked; these checks cover every root. */
async function expandCategories(r: ReactTestRenderer) {
  await press(categoriesToggle(r));
}

const childLookups = () =>
  get.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('parentId='));

// ── A. no model picked ─────────────────────────────────────────────────

describe('A. home grid without a picked model', () => {
  test('shows six tiles first, with the rest one tap away', async () => {
    const r = await render(<ExploreScreen />);
    expect(r.root.findAll((n) => is(n, 'tile'))).toHaveLength(6);
    await expandCategories(r);
    expect(r.root.findAll((n) => is(n, 'tile'))).toHaveLength(10);
  });

  test.each([
    [false, 'explore.pricesStockUpdated', toastSuccess],
    [true, 'search.catalogueLoadError', toastDanger],
  ])('pull-to-refresh reports what happened (failed: %s)', async (isError, message, toast) => {
    toastSuccess.mockClear();
    toastDanger.mockClear();
    refreshResult = { isError };
    const r = await render(<ExploreScreen />);
    const scroller = r.root.find((n) => is(n, 'scroll') && Boolean(n.props.refreshControl));
    await act(async () => {
      scroller.props.refreshControl.props.onRefresh();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(toast).toHaveBeenCalledExactlyOnceWith(message);
    expect(toastSuccess.mock.calls.length + toastDanger.mock.calls.length).toBe(1);
    refreshResult = { isError: false };
  });

  test('the toggle swaps its label and exposes the expanded state', async () => {
    const r = await render(<ExploreScreen />);
    const label = () =>
      categoriesToggle(r).findByProps({ weight: 'medium' }).props.children as string;
    expect(label()).toBe('explore.allCategories');
    expect(categoriesToggle(r).props.accessibilityState).toEqual({ expanded: false });
    await expandCategories(r);
    expect(label()).toBe('explore.collapseCategories');
    expect(categoriesToggle(r).props.accessibilityState).toEqual({ expanded: true });
    await press(categoriesToggle(r));
    expect(label()).toBe('explore.allCategories');
    expect(r.root.findAll((n) => is(n, 'tile'))).toHaveLength(6);
  });

  describe('collapsing while scrolled', () => {
    const scrollTo = vi.fn();

    /** Lay the screen out, expand the grid, scroll to `y`, collapse to `contentHeight`. */
    async function collapseFrom(y: number, contentHeight: number) {
      scrollTo.mockClear();
      let r!: ReactTestRenderer;
      await act(async () => {
        r = create(<ExploreScreen />, {
          createNodeMock: (el) => (el.type === 'scroll' ? { scrollTo } : null),
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      const scroller = r.root.find((n) => is(n, 'scroll') && Boolean(n.props.onContentSizeChange));
      // The heading row (title + "All categories") is what's measured.
      const heading = r.root.find(
        (n) => is(n, 'view') && n.props.testID === 'explore-categories-heading',
      );
      await act(async () => {
        scroller.props.onLayout({ nativeEvent: { layout: { height: 700 } } });
        heading.props.onLayout({ nativeEvent: { layout: { y: 500 } } });
      });
      await expandCategories(r);
      await act(async () => {
        scroller.props.onContentSizeChange(390, 1400);
        scroller.props.onScroll({ nativeEvent: { contentOffset: { y } } });
      });
      await press(categoriesToggle(r));
      await act(async () => {
        scroller.props.onContentSizeChange(390, contentHeight);
      });
      return { r, scroller };
    }

    // The header measures top inset (0) + 132 until its onLayout fires, so the
    // heading pins at 500 - 132 - 12 (fade) - 12 (clearance) = 344.
    test('returns to the category heading', async () => {
      await collapseFrom(650, 1200);
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ y: 344, animated: true });
    });

    test('stops at the end of a page too short to pin the heading', async () => {
      await collapseFrom(650, 900);
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ y: 200, animated: true });
    });

    test('leaves the scroll alone when the section is already in view', async () => {
      await collapseFrom(100, 1200);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    test('expanding never moves the scroll', async () => {
      const { r, scroller } = await collapseFrom(100, 1200);
      await expandCategories(r);
      await act(async () => {
        scroller.props.onScroll({ nativeEvent: { contentOffset: { y: 900 } } });
        scroller.props.onContentSizeChange(390, 1400);
      });
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  test('shows the 10 systems, "Другое" included', async () => {
    const r = await render(<ExploreScreen />);
    await expandCategories(r);
    const tiles = r.root.findAll((n) => is(n, 'tile'));
    expect(tiles.map((t) => t.props.label)).toEqual([
      'Тормозная система',
      'Электрика и освещение',
      'ТО и жидкости',
      'Двигатель',
      'Трансмиссия',
      'Моторные масла',
      'Отопление и охлаждение',
      'Подвеска и рулевое',
      'Тюнинг и аксессуары',
      'Другое',
    ]);
  });

  test('each tile carries the parts count served for its system', async () => {
    const r = await render(<ExploreScreen />);
    await expandCategories(r);
    const counts = r.root.findAll((n) => is(n, 'tile')).map((t) => t.props.count);
    expect(counts).toEqual(HOME_ROOT_ORDER.map((id) => ROOT_PRODUCTS_COUNT[id]));
  });

  test('a system tile opens all of its parts at once — no subcategory step', async () => {
    const r = await render(<ExploreScreen />);
    await expandCategories(r);
    // Each press is a separate, unhurried tap (the double-tap guard is below).
    let clock = Date.now();
    const now = vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1000));
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
    now.mockRestore();
    // Never asked the tree for children, never pushed the subcategory screen.
    expect(childLookups()).toEqual([]);
  });

  test('a rapid double tap opens the category once', async () => {
    const r = await render(<ExploreScreen />);
    const [first, second] = r.root.findAll((n) => is(n, 'tile'));
    push.mockReset();
    await press(first);
    await press(first);
    await press(second);
    expect(push).toHaveBeenCalledTimes(1);
  });

  test('the listing asks for the whole system, with no car scoping it', async () => {
    params = { cat: 'suspension-and-steering', label: 'Подвеска и рулевое' };
    await render(<CategoryScreen />);
    expect(listRequests.at(-1)).toEqual({
      pageSize: 24,
      category: 'suspension-and-steering',
      vehicleCategory: undefined,
      sortBy: 'relevance',
    });
  });

  test('"Другое" lists its goods the same way', async () => {
    const r = await render(<ExploreScreen />);
    await expandCategories(r);
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
