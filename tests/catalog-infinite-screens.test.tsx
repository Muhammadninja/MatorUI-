/**
 * Scrolling the two catalogue lists to the end — the home tile's Category
 * screen and the brand → model → subcategory Parts screen — over GET
 * /v1/catalog/parts as the backend pages it (fixtures/catalog-parts.ts).
 *
 * The screens, the paging hook, React Query and the HTTP transport are all
 * real. The list is a stand-in that renders its header, rows and footer and
 * lets a test reach its end (`onEndReached`), as a scroll does. The rows are
 * stand-ins too, in their real cell gutters (`productCellStyle`).
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { brandCatalogue, brandId, FakeCatalog, partsIn } from './fixtures/catalog-parts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let params: Record<string, string | undefined> = {};
vi.mock('expo-router', () => ({
  router: { push: () => {}, back: () => {} },
  useLocalSearchParams: () => params,
  useFocusEffect: () => {},
}));
vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));
const get = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (url: string) => get(url) },
  ApiError: class ApiError extends Error {
    status = 0;
    get isNetworkError() {
      return this.status === 0;
    }
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) => (o?.count === undefined ? k : `${k}:${o.count}`),
    i18n: { language: 'ru' },
  }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  ArrowLeft: () => null,
  PackageOpen: () => null,
  Search: () => null,
  X: () => null,
}));

// Hoisted with the mocks below, which call it while building their factories.
const { grid, host, list } = vi.hoisted(() => ({
  /** What `useProductGridColumns` answers: two, or one under large text. */
  grid: { columns: 2 },
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  /** The props the list last rendered with. */
  list: {
    props: {} as {
      numColumns?: number;
      onEndReached?: () => void;
      data?: unknown[];
      overrideItemLayout?: (layout: { span?: number }, item: unknown, index: number) => void;
    },
  },
}));
vi.mock('react-native', () => ({
  Keyboard: { dismiss: () => {} },
  ScrollView: host('scroll'),
  TextInput: host('input'),
}));
vi.mock('@shopify/flash-list', () => ({
  FlashList: (props: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
    onEndReached?: () => void;
    overrideItemLayout?: (layout: { span?: number }, item: unknown, index: number) => void;
  }) => {
    list.props = props;
    return React.createElement(
      'list',
      null,
      props.ListHeaderComponent ?? null,
      props.data.map((item, index) =>
        React.createElement(React.Fragment, { key: index }, props.renderItem({ item, index })),
      ),
      props.ListFooterComponent ?? null,
    );
  },
}));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-settings-header', () => ({ AppSettingsHeader: host('header') }));
vi.mock('@/components/shared/wheel-loader', () => ({
  WheelLoader: () => null,
  ListLoadingOverlay: () => null,
}));
vi.mock('@/components/screens-components/search/search-results/footer-spinner', () => ({
  default: host('spinner'),
}));
vi.mock('@/components/screens-components/catalog/product-row', async (importOriginal) => ({
  default: host('row'),
  productCellStyle: (
    await importOriginal<typeof import('@/components/screens-components/catalog/product-row')>()
  ).productCellStyle,
  useProductGridColumns: () => grid.columns,
}));
// Loaded with the real `productCellStyle`, never rendered.
vi.mock('@/components/screens-components/home/image-box', () => ({}));
vi.mock('@/components/shared/app-icon-button', () => ({}));
vi.mock('@/components/shared/app-price', () => ({}));
vi.mock('@/components/shared/wheel-loader/wheel-loader', () => ({}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({ currentActiveVehicle: null }),
}));
vi.mock('@/contexts/likes.context', () => ({}));
vi.mock('@/hooks/use-sales', () => ({}));
vi.mock('@/services/compatibility-service', () => ({}));
vi.mock('@/services/sales-service', () => ({}));
vi.mock('@/components/screens-components/catalog/results-toolbar', () => ({
  default: host('toolbar'),
}));
vi.mock('@/components/screens-components/catalog/catalog-ai-inline-hint', () => ({
  default: host('inline-ai-hint'),
}));
vi.mock('@/components/screens-components/catalog/fitment-note', () => ({ default: host('note') }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/cart.context', () => ({ useCartContext: () => ({ addItem: () => {} }) }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: true }) }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/utils/nav', () => ({ openItemDetail: () => {} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ success: () => {} }) }));

import CatalogPartsScreen from '@/components/screens/catalog-parts-screen';
import CategoryScreen from '@/components/screens/category-screen';

/** 60 brake parts over two models (30 each), every third a GM part; 30 engine. */
const ROWS = [
  ...partsIn('brake-system', 'b', 60, (i) => ({
    make: i % 2 ? 'BYD' : 'Chevrolet',
    model: i % 2 ? 'Song Plus' : 'Cobalt',
    gm: i % 3 === 0,
    title: i % 4 === 0 ? `Brake pad ${i + 1}` : `Brake disc ${i + 1}`,
  })),
  ...partsIn('engine-system', 'e', 30),
];

let catalog: FakeCatalog;
let client: QueryClient;
const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  catalog = new FakeCatalog([...ROWS]);
  get.mockReset();
  get.mockImplementation(catalog.get);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  list.props = {};
  grid.columns = 2;
});
// A screen left mounted would keep its timers and its list, and could answer
// the next test's scroll.
afterEach(async () => {
  await act(async () => {
    for (const r of mounted.splice(0)) r.unmount();
  });
  client.clear();
});

async function settle(ms = 0) {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, i === 0 ? ms : 0));
    });
  }
}

const app = (screen: React.ReactElement) => (
  <QueryClientProvider client={client}>{screen}</QueryClientProvider>
);

async function render(screen: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(app(screen));
  });
  mounted.push(r);
  await settle();
  return r;
}

/** Re-render with new route params, as navigating to another list does. */
async function navigate(r: ReactTestRenderer, screen: React.ReactElement, next: typeof params) {
  params = next;
  await act(async () => {
    r.update(app(screen));
  });
  await settle();
}

/** Scroll to the end of the list. */
async function reachEnd() {
  await act(async () => {
    list.props.onEndReached?.();
  });
  await settle();
}

const is = (n: ReactTestInstance, type: string) => (n.type as unknown) === type;
const rows = (r: ReactTestRenderer) =>
  r.root.findAll((n) => is(n, 'row')).map((n) => (n.props.item as { id: string }).id);
const texts = (r: ReactTestRenderer) =>
  r.root.findAll((n) => is(n, 'text')).map((n) => n.props.children as unknown);
const chip = (r: ReactTestRenderer, label: string) =>
  r.root.find(
    (n) =>
      is(n, 'pressable') &&
      n.findAll((c) => is(c, 'text') && c.props.children === label).length > 0,
  );
async function press(node: ReactTestInstance) {
  await act(async () => {
    (node.props.onPress as () => void)();
  });
  await settle();
}
const pages = (from = 0) => catalog.paramsSince(from).map((p) => p.page);

describe('Category screen (a home tile)', () => {
  beforeEach(() => {
    params = { cat: 'brake-system', label: 'Тормозная система' };
  });

  test('shows 24 rows, then the next page under them when the end is reached', async () => {
    const r = await render(<CategoryScreen />);
    expect(rows(r)).toHaveLength(24);
    await reachEnd();
    expect(rows(r)).toEqual(
      catalog
        .matching(catalog.calls[0])
        .slice(0, 48)
        .map((p) => p.id),
    );
    // The toolbar keeps counting every match, not the rows loaded.
    expect(r.root.find((n) => is(n, 'toolbar')).props.count).toBe(60);
  });

  test('a successful empty response offers AI while an API error stays an error', async () => {
    catalog = new FakeCatalog([]);
    get.mockImplementation(catalog.get);
    const empty = await render(<CategoryScreen />);
    expect(
      empty.root.findAll(
        (node) => is(node, 'pressable') && node.props.testID === 'mator-ai-category_empty',
      ),
    ).toHaveLength(1);

    get.mockReset().mockRejectedValue(new Error('API unavailable'));
    const failed = await render(<CategoryScreen />);
    expect(texts(failed)).toContain('catalog.loadPartsError');
    expect(
      failed.root.findAll(
        (node) => is(node, 'pressable') && String(node.props.testID).startsWith('mator-ai-'),
      ),
    ).toHaveLength(0);
  });

  test('inserts one full-width AI hint after eight products and keeps product order', async () => {
    const r = await render(<CategoryScreen />);
    const data = list.props.data as Array<{ id: string; kind?: string }>;
    expect(data[8]).toMatchObject({ id: 'catalog-ai-inline-hint', kind: 'ai_hint' });
    expect(data.filter((item) => item.kind === 'ai_hint')).toHaveLength(1);
    expect(data.filter((item) => !item.kind).map((item) => item.id)).toEqual(
      catalog
        .matching(catalog.calls[0])
        .slice(0, 24)
        .map((part) => part.id),
    );
    const span = {} as { span?: number };
    list.props.overrideItemLayout?.(span, data[8], 8);
    expect(span.span).toBe(2);
    expect(r.root.findAll((node) => is(node, 'inline-ai-hint'))).toHaveLength(1);
  });

  test('shows a spinner under the rows while the next page loads', async () => {
    const r = await render(<CategoryScreen />);
    catalog.holding = true;
    await reachEnd();
    expect(r.root.findAll((n) => is(n, 'spinner'))).toHaveLength(1);
    expect(rows(r)).toHaveLength(24);

    await act(async () => catalog.held[0].release());
    await settle();
    expect(r.root.findAll((n) => is(n, 'spinner'))).toHaveLength(0);
    expect(rows(r)).toHaveLength(48);
  });

  test('scrolls on to the last page, and no further', async () => {
    const r = await render(<CategoryScreen />);
    await reachEnd();
    await reachEnd();
    expect(rows(r)).toHaveLength(60);
    await reachEnd();
    expect(pages()).toEqual(['1', '2', '3']);
  });

  test('a failed page leaves the rows and offers a retry under them', async () => {
    const r = await render(<CategoryScreen />);
    catalog.failNext();
    await reachEnd();
    expect(rows(r)).toHaveLength(24);
    expect(texts(r)).toContain('catalog.loadPartsError');

    await press(r.root.find((n) => is(n, 'button') && n.props.title === 'common.retry'));
    expect(rows(r)).toHaveLength(48);
    expect(texts(r)).not.toContain('catalog.loadPartsError');
  });

  test('a new sort lists again from page 1', async () => {
    const r = await render(<CategoryScreen />);
    await reachEnd();
    const asked = catalog.calls.length;
    await act(async () => {
      (r.root.find((n) => is(n, 'toolbar')).props.onSortChange as (s: string) => void)('price_asc');
    });
    await settle();
    expect(catalog.paramsSince(asked)).toEqual([
      expect.objectContaining({ page: '1', sort: 'price_asc', category: 'brake-system' }),
    ]);
    expect(rows(r)).toEqual(
      catalog
        .matching(catalog.calls[asked])
        .slice(0, 24)
        .map((p) => p.id),
    );
  });

  test('another category lists again from page 1', async () => {
    const r = await render(<CategoryScreen />);
    await reachEnd();
    const asked = catalog.calls.length;
    await navigate(r, <CategoryScreen />, { cat: 'engine-system', label: 'Двигатель' });
    expect(catalog.paramsSince(asked)).toEqual([
      expect.objectContaining({ page: '1', category: 'engine-system' }),
    ]);
    expect(rows(r)).toHaveLength(24);
    expect(rows(r).every((id) => id.startsWith('e-'))).toBe(true);
  });
});

describe('Parts screen (brand → model → subcategory)', () => {
  const COBALT = {
    categoryId: 'brake-system',
    categoryLabel: 'Тормозная система',
    make: 'Chevrolet',
    model: 'Cobalt',
  };
  beforeEach(() => {
    params = COBALT;
  });

  test('pages through the parts that fit the picked model, to the last one', async () => {
    const r = await render(<CatalogPartsScreen />);
    expect(catalog.params(0)).toMatchObject({ page: '1', page_size: '24', make: 'Chevrolet' });
    expect(rows(r)).toHaveLength(24);
    await reachEnd();
    expect(rows(r)).toHaveLength(30);
    await reachEnd();
    expect(pages()).toEqual(['1', '2']);
  });

  test('inserts the inline hint once after eight parts in a long subcategory list', async () => {
    await render(<CatalogPartsScreen />);
    const data = list.props.data as Array<{ id: string; kind?: string }>;
    expect(data[8]).toMatchObject({ id: 'catalog-ai-inline-hint', kind: 'ai_hint' });
    expect(data.filter((item) => item.kind === 'ai_hint')).toHaveLength(1);
  });

  test('another model lists again from page 1', async () => {
    const r = await render(<CatalogPartsScreen />);
    await reachEnd();
    const asked = catalog.calls.length;
    await navigate(r, <CatalogPartsScreen />, { ...COBALT, make: 'BYD', model: 'Song Plus' });
    expect(catalog.paramsSince(asked)).toEqual([
      expect.objectContaining({ page: '1', make: 'BYD', model: 'Song Plus' }),
    ]);
    expect(rows(r)).toEqual(
      catalog
        .matching(catalog.calls[asked])
        .slice(0, 24)
        .map((p) => p.id),
    );
  });

  test.each([
    ['catalog.chipGm', { gm_only: 'true' }],
    ['catalog.priceAsc', { sort: 'price_asc' }],
  ])('the %s chip lists again from page 1', async (label, sent) => {
    const r = await render(<CatalogPartsScreen />);
    await reachEnd();
    const asked = catalog.calls.length;
    await press(chip(r, label));
    expect(catalog.paramsSince(asked)).toEqual([expect.objectContaining({ page: '1', ...sent })]);
    expect(rows(r)).toEqual(
      catalog
        .matching(catalog.calls[asked])
        .slice(0, 24)
        .map((p) => p.id),
    );
  });

  test('a search lists again from page 1', async () => {
    const r = await render(<CatalogPartsScreen />);
    await reachEnd();
    const asked = catalog.calls.length;
    await act(async () => {
      (r.root.find((n) => is(n, 'input')).props.onChangeText as (s: string) => void)('pad');
    });
    await settle(350); // past the search debounce
    expect(catalog.paramsSince(asked)).toEqual([expect.objectContaining({ page: '1', q: 'pad' })]);
    expect(rows(r)).toEqual(
      catalog
        .matching(catalog.calls[asked])
        .slice(0, 24)
        .map((p) => p.id),
    );
  });
});

describe('Parts screen brand chips (130 parts; 52 Bosch, 2 of them on page 1)', () => {
  beforeEach(() => {
    catalog = new FakeCatalog(brandCatalogue());
    get.mockImplementation(catalog.get);
    params = {};
  });

  const brandChips = (r: ReactTestRenderer) =>
    r.root
      .findAll((n) => is(n, 'pressable') && String(n.props.testID).startsWith('filter-brand-'))
      .map((n) => (n.props.testID as string).slice('filter-brand-'.length));
  const clearChip = (r: ReactTestRenderer) =>
    r.root.find((n) => is(n, 'pressable') && n.props.testID === 'filter-clear-btn');
  /** The count the list header shows. */
  const partCount = (r: ReactTestRenderer) =>
    Number(/partCount:(\d+)/.exec(r.root.find((n) => is(n, 'note')).props.lead as string)?.[1]);
  const partsOf = (brand: string) => catalog.rows.filter((p) => p.brand === brand).map((p) => p.id);
  const brandOf = (id: string) => catalog.rows.find((p) => p.id === id)?.brand;
  async function search(r: ReactTestRenderer, text: string) {
    await act(async () => {
      (r.root.find((n) => is(n, 'input')).props.onChangeText as (s: string) => void)(text);
    });
    await settle(350); // past the search debounce
  }

  test('offers every brand of the catalogue, not only the brands on the loaded page', async () => {
    const r = await render(<CatalogPartsScreen />);
    expect(rows(r).map(brandOf)).not.toContain('Sachs');
    expect(brandChips(r)).toEqual(['Bosch', 'Febi', 'Gates', 'Mann', 'Sachs']);
  });

  test('a brand lists that brand across the whole catalogue, from page 1 to its last', async () => {
    const r = await render(<CatalogPartsScreen />);
    await reachEnd(); // the unfiltered page 2, before the pick
    const asked = catalog.calls.length;
    await press(chip(r, 'Bosch'));
    expect(catalog.paramsSince(asked)).toEqual([
      expect.objectContaining({ page: '1', brand: brandId('Bosch') }),
    ]);
    expect(rows(r)).toEqual(partsOf('Bosch').slice(0, 24));
    expect(partCount(r)).toBe(52);

    await reachEnd();
    await reachEnd();
    await reachEnd();
    expect(rows(r)).toEqual(partsOf('Bosch'));
    expect(partCount(r)).toBe(52);
    expect(pages(asked)).toEqual(['1', '2', '3']);
  });

  test('a second brand joins the first; unpicking one lists the other alone, from page 1', async () => {
    const r = await render(<CatalogPartsScreen />);
    await press(chip(r, 'Bosch'));
    await press(chip(r, 'Mann'));
    expect(catalog.params()).toMatchObject({
      page: '1',
      brand: `${brandId('Bosch')},${brandId('Mann')}`,
    });
    expect(partCount(r)).toBe(62);
    expect(new Set(rows(r).map(brandOf))).toEqual(new Set(['Bosch', 'Mann']));

    await press(chip(r, 'Bosch'));
    expect(catalog.params()).toMatchObject({ page: '1', brand: brandId('Mann') });
    expect(rows(r)).toEqual(partsOf('Mann'));
    expect(partCount(r)).toBe(10);
  });

  test('Clear lists the whole catalogue again, from page 1', async () => {
    const r = await render(<CatalogPartsScreen />);
    await press(chip(r, 'Bosch'));
    await reachEnd();
    await press(clearChip(r));
    expect(catalog.params()).toMatchObject({ page: '1' });
    expect(catalog.params()).not.toHaveProperty('brand');
    expect(rows(r)).toEqual(catalog.rows.slice(0, 24).map((p) => p.id));
    expect(partCount(r)).toBe(130);
  });

  test('the brand rides with the model, the category, the sort and the search', async () => {
    params = {
      categoryId: 'brake-system',
      categoryLabel: 'Тормозная система',
      make: 'Chevrolet',
      model: 'Cobalt',
    };
    const r = await render(<CatalogPartsScreen />);
    await press(chip(r, 'Bosch'));
    await press(chip(r, 'catalog.priceAsc'));
    await search(r, 'pad');
    const last = catalog.params();
    expect(last).toMatchObject({
      page: '1',
      brand: brandId('Bosch'),
      category: 'brake-system',
      make: 'Chevrolet',
      model: 'Cobalt',
      sort: 'price_asc',
      q: 'pad',
    });
    const expected = catalog.matching(catalog.calls.at(-1)!).map((p) => p.id);
    expect(expected).toHaveLength(9);
    expect(rows(r)).toEqual(expected);
    expect(partCount(r)).toBe(9);
  });

  test('a picked brand keeps its chip when nothing matches, so it can be unpicked', async () => {
    const r = await render(<CatalogPartsScreen />);
    await press(chip(r, 'Bosch'));
    await search(r, 'zzz');
    expect(rows(r)).toEqual([]);
    expect(brandChips(r)).toEqual(['Bosch']);
    expect(chip(r, 'Bosch').props.accessibilityState).toEqual({ selected: true });

    await press(chip(r, 'Bosch'));
    expect(catalog.params()).toMatchObject({ page: '1', q: 'zzz' });
    expect(catalog.params()).not.toHaveProperty('brand');
  });
});

describe('Card gutters', () => {
  /** How far each full row sits from the screen's two edges, as `left/right`. */
  const screenGutters = (r: ReactTestRenderer) => {
    const cells = r.root
      .findAll((n) => is(n, 'row'))
      .map((n) => n.parent!.parent!.props.style as { paddingLeft: number; paddingRight: number });
    const columns = list.props.numColumns ?? 1;
    const gutters = new Set<string>();
    for (let i = 0; i + columns <= cells.length; i += columns) {
      gutters.add(`${cells[i].paddingLeft}/${cells[i + columns - 1].paddingRight}`);
    }
    return [...gutters];
  };

  test('Parts screen: every card sits centred, on the same 16pt as the header', async () => {
    params = { categoryId: 'brake-system', categoryLabel: 'Тормозная система' };
    const r = await render(<CatalogPartsScreen />);
    expect(rows(r)).toHaveLength(24);
    expect(screenGutters(r)).toEqual(['16/16']);
  });

  test.each([2, 1])('Category screen: balanced at %i column(s)', async (columns) => {
    grid.columns = columns;
    params = { cat: 'brake-system', label: 'Тормозная система' };
    const r = await render(<CategoryScreen />);
    expect(list.props.numColumns).toBe(columns);
    expect(screenGutters(r)).toEqual(['16/16']);
  });
});
