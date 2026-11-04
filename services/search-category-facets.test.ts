/**
 * Search category facets — the id/label split.
 *
 * The contract the buyer-app i18n spec cares about: a category chip RENDERS a
 * localized display string but SUBMITS a stable id. If those two are ever
 * conflated, a filter silently stops matching the moment the user switches
 * language. These tests pin both halves:
 *   - `deriveCategoryFacets` always yields {id, name} pairs, whichever of the
 *     three response shapes the transport produced;
 *   - the HTTP transport preserves `categories` and the per-result
 *     `category_id` rather than stripping them.
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: vi.fn(async () => null),
  shouldUseHttpTransport: () => true,
}));

// These tests exercise pure facet mapping and the HTTP search contract;
// the native auth/provider graph is outside that boundary.
vi.mock('@/contexts/active-vehicle.context', () => ({
  useSearchVehicleContext: vi.fn(),
}));

import { deriveCategoryFacets } from '@/hooks/use-search';
import { HttpSearchTransport } from '@/services/search-service';
import type { SearchResponse } from '@/types/search';

/** A minimal well-formed response; each test overrides the facet fields. */
function response(patch: Partial<SearchResponse>): SearchResponse {
  return {
    query: 'tormoz',
    requestId: 'req_1',
    results: [],
    total: 0,
    durationMs: 1,
    ...patch,
  };
}

describe('deriveCategoryFacets — id/label split', () => {
  test('prefers `categories`, keeping id and localized name distinct', () => {
    const facets = deriveCategoryFacets(
      response({
        categories: [
          { id: 'brake-pads', name: 'Тормозные колодки', count: 12 },
          { id: 'motor-oil', name: 'Моторное масло', count: 7 },
        ],
        // Legacy keys are localized display strings — must be ignored here.
        facetCounts: { categories: { 'Тормозные колодки': 12 } },
        suggestedCategories: ['Моторное масло'],
      }),
    );

    expect(facets).toEqual([
      { id: 'brake-pads', name: 'Тормозные колодки', count: 12 },
      { id: 'motor-oil', name: 'Моторное масло', count: 7 },
    ]);
    // The id is the stable identifier: it is NOT the display string.
    expect(facets.every((f) => f.id !== f.name)).toBe(true);
  });

  test('the same ids come back under a different response language', () => {
    const ru = deriveCategoryFacets(
      response({ categories: [{ id: 'brake-pads', name: 'Тормозные колодки', count: 12 }] }),
    );
    const uz = deriveCategoryFacets(
      response({ categories: [{ id: 'brake-pads', name: 'Tormoz kolodkalari', count: 12 }] }),
    );

    expect(ru[0]!.id).toBe(uz[0]!.id);
    expect(ru[0]!.name).not.toBe(uz[0]!.name);
  });

  test('falls back to the legacy facet map when `categories` is absent', () => {
    const facets = deriveCategoryFacets(
      response({ facetCounts: { categories: { 'Тормозные колодки': 12 } } }),
    );
    // No real id exists in the legacy shape, so the name has to stand in —
    // preserving the pre-i18n behaviour rather than dropping the chip.
    expect(facets).toEqual([
      { id: 'Тормозные колодки', name: 'Тормозные колодки', count: 12 },
    ]);
  });

  test('falls back to suggestedCategories when nothing else is present', () => {
    const facets = deriveCategoryFacets(response({ suggestedCategories: ['Моторное масло'] }));
    expect(facets).toEqual([{ id: 'Моторное масло', name: 'Моторное масло' }]);
  });

  test('yields an empty list when the response carries no facets at all', () => {
    expect(deriveCategoryFacets(response({}))).toEqual([]);
  });
});

describe('HttpSearchTransport — category contract passthrough', () => {
  test('preserves `categories` and maps snake_case `category_id`', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: 'tormoz',
          requestId: 'req_1',
          results: [
            {
              id: 'part_1',
              title: 'Bosch brake pad set',
              price: 'UZS 185 000',
              category: 'Тормозные колодки',
              category_id: 'brake-pads',
            },
          ],
          total: 1,
          categories: [{ id: 'brake-pads', name: 'Тормозные колодки', count: 12 }],
          facetCounts: { categories: { 'Тормозные колодки': 12 } },
          durationMs: 12,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    try {
      const res = await new HttpSearchTransport().search({ query: 'tormoz' });

      expect(res.categories).toEqual([
        { id: 'brake-pads', name: 'Тормозные колодки', count: 12 },
      ]);
      // Result rows carry the localized label AND the stable id.
      expect(res.results[0]!.category).toBe('Тормозные колодки');
      expect(res.results[0]!.categoryId).toBe('brake-pads');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('sends the request locale in the body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ results: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    try {
      await new HttpSearchTransport().search({ query: 'tormoz', locale: 'uz' });

      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse(init!.body as string).locale).toBe('uz');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('HttpSearchTransport — part numbers from the catalog rows', () => {
  const part = (id: string) => ({ id, title: id, price: '1 сум' });

  async function search(items: Record<string, unknown>[]) {
    const originalFetch = globalThis.fetch;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes('/v1/catalog/parts')
        ? json({ items })
        : json({ query: 'x', results: [part('oem'), part('gm'), part('none'), part('missing')] }),
    ) as typeof fetch;
    try {
      const { results } = await new HttpSearchTransport().search({ query: 'x' } as never);
      return Object.fromEntries(results.map((r) => [r.id, { oem: r.oem, gm: r.gm }]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  test('labels each number by its type, and leaves parts without one bare', async () => {
    const parts = await search([
      { id: 'oem', part_number_type: 'OEM', oem_numbers: ['A1'], gm_numbers: [] },
      { id: 'gm', part_number_type: 'GM', oem_numbers: ['B2'], gm_numbers: ['C3'] },
      { id: 'none', oem_numbers: [], gm_numbers: [] },
    ]);
    expect(parts.oem).toEqual({ oem: 'A1', gm: undefined });
    expect(parts.gm).toEqual({ oem: undefined, gm: 'C3' });
    expect(parts.none).toEqual({ oem: undefined, gm: undefined });
    // A part outside the catalog page simply has no number.
    expect(parts.missing).toEqual({ oem: undefined, gm: undefined });
  });
});

describe('HttpSearchTransport — exact amounts from the catalog rows', () => {
  /** `/v1/search` only ever sends a label rounded to whole som. */
  const rounded = { id: 'frac', title: 'Oil', price: 'UZS 65 730' };

  async function searchWith(
    searchResult: Record<string, unknown>,
    catalog: () => Response | Promise<Response>,
  ) {
    const originalFetch = globalThis.fetch;
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes('/v1/catalog/parts')
        ? catalog()
        : json({ query: 'x', results: [searchResult] }),
    );
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const { results } = await new HttpSearchTransport().search({ query: 'x' } as never);
      return results[0];
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
  const catalogRow = (row: Record<string, unknown>) => () =>
    new Response(JSON.stringify({ items: [{ id: 'frac', ...row }] }), { status: 200 });

  test('shows the amount the catalog holds, not the rounded search label', async () => {
    const result = await searchWith(rounded, catalogRow({ price_uzs: 65730.24 }));
    expect(result.price).toBe('UZS 65 730.24');
    // A defaulted label follows, or the row would draw the rounded one as a lead-in.
    expect(result.priceLabel).toBe(result.price);
  });

  test('keeps a lead-in the API really sent', async () => {
    const result = await searchWith(
      { ...rounded, priceLabel: 'Starting at' },
      catalogRow({ price_uzs: 65730.24 }),
    );
    expect(result.price).toBe('UZS 65 730.24');
    expect(result.priceLabel).toBe('Starting at');
  });

  test('still reads the amount when search already sends photos', async () => {
    const result = await searchWith(
      { ...rounded, images: ['https://cdn.test/a.jpg'] },
      catalogRow({ price_uzs: 65730.24 }),
    );
    expect(result.price).toBe('UZS 65 730.24');
    expect(result.images).toEqual(['https://cdn.test/a.jpg']);
  });

  test('a whole amount keeps the API label untouched', async () => {
    const result = await searchWith(
      { ...rounded, price: 'UZS 280 000' },
      catalogRow({ price_uzs: 280000 }),
    );
    expect(result.price).toBe('UZS 280 000');
  });

  test('a slow catalog gives up without retrying, so results still appear', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    globalThis.fetch = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(url));
      return String(url).includes('/v1/catalog/parts')
        ? new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          })
        : Promise.resolve(json({ query: 'x', results: [rounded] }));
    }) as typeof fetch;
    vi.useFakeTimers();
    try {
      const pending = new HttpSearchTransport().search({ query: 'x' } as never);
      await vi.advanceTimersByTimeAsync(4_000);
      const { results } = await pending;
      expect(results[0].price).toBe('UZS 65 730');
      expect(calls.filter((u) => u.includes('/v1/catalog/parts'))).toHaveLength(1);
    } finally {
      vi.useRealTimers();
      globalThis.fetch = originalFetch;
    }
  });

  test('a failing catalog is not retried', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status });
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return String(url).includes('/v1/catalog/parts')
        ? json({}, 503)
        : json({ query: 'x', results: [rounded] });
    }) as typeof fetch;
    try {
      const { results } = await new HttpSearchTransport().search({ query: 'x' } as never);
      expect(results[0].price).toBe('UZS 65 730');
      expect(calls.filter((u) => u.includes('/v1/catalog/parts'))).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test.each([
    ['the catalog has no such part', () => new Response(JSON.stringify({ items: [] }), { status: 200 })],
    ['the row has no amount', catalogRow({ price_uzs: null })],
    ['the catalog call fails', () => new Response('{}', { status: 500 })],
  ])('never invents precision when %s', async (_name, catalog) => {
    const result = await searchWith(rounded, catalog);
    expect(result.price).toBe('UZS 65 730');
  });
});
