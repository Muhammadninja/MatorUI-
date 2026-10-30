/**
 * TEST-ONLY: GET /v1/catalog/parts over an in-memory catalogue, paged the way
 * the backend pages it — `page` / `page_size` in, `{ items, total, page,
 * page_size, next_page }` out — with the filters the listing screens send
 * (category, make, model, q, gm_only, oem_only, region, sort).
 *
 * A test can hold answers back and release them in any order (`holding`), or
 * fail the next request (`failNext`). Every request is kept in `calls`.
 */

export type FakePart = {
  id: string;
  category: string;
  make: string;
  model: string;
  title: string;
  priceUzs: number;
  gm: boolean;
  oem: boolean;
  region: string;
  brand: string;
};

/** `n` parts filed on `category`, ids `<prefix>-01`…, shaped by `over(i)`. */
export function partsIn(
  category: string,
  prefix: string,
  n: number,
  over: (i: number) => Partial<FakePart> = () => ({}),
): FakePart[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    category,
    make: 'Chevrolet',
    model: 'Cobalt',
    title: `Part ${i + 1}`,
    priceUzs: 100_000 + ((i * 7919) % 50) * 1_000,
    gm: false,
    oem: false,
    region: 'china',
    brand: 'Gates',
    ...over(i),
  }));
}

type Held = { url: string; release: () => void; fail: () => void };

export class FakeCatalog {
  /** Every URL asked for, in order. */
  readonly calls: string[] = [];
  /** Answers waiting for `release()` while `holding` is on. */
  readonly held: Held[] = [];
  holding = false;
  private failures = 0;

  constructor(public rows: FakePart[]) {}

  /** The next `n` requests fail as a dropped connection does. */
  failNext(n = 1) {
    this.failures += n;
  }

  /** `apiClient.get`. */
  readonly get = (url: string): Promise<unknown> => {
    this.calls.push(url);
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error('Network request failed'));
    }
    if (!this.holding) return Promise.resolve(this.answer(url));
    return new Promise((resolve, reject) => {
      this.held.push({
        url,
        release: () => resolve(this.answer(url)),
        fail: () => reject(new Error('Network request failed')),
      });
    });
  };

  /** Query params of request `i` (default: the latest). */
  params(i = this.calls.length - 1): Record<string, string> {
    return Object.fromEntries(new URL(this.calls[i], 'https://api.test').searchParams);
  }

  /** Requests asked for since `from`, as their params. */
  paramsSince(from: number): Record<string, string>[] {
    return this.calls.slice(from).map((_, i) => this.params(from + i));
  }

  /** The rows `url` selects, in its order, before paging. */
  matching(url: string): FakePart[] {
    const q = new URL(url, 'https://api.test').searchParams;
    let rows = this.rows;
    const keep = (param: string, value: (p: FakePart) => string) => {
      const want = q.getAll(param);
      if (want.length) rows = rows.filter((p) => want.includes(value(p)));
    };
    keep('category', (p) => p.category);
    keep('make', (p) => p.make);
    keep('model', (p) => p.model);
    keep('region', (p) => p.region);
    const search = q.get('q')?.toLowerCase();
    if (search) rows = rows.filter((p) => p.title.toLowerCase().includes(search));
    if (q.get('gm_only') === 'true') rows = rows.filter((p) => p.gm);
    if (q.get('oem_only') === 'true') rows = rows.filter((p) => p.oem);
    const sort = q.get('sort');
    const byId = (a: FakePart, b: FakePart) => a.id.localeCompare(b.id);
    if (sort === 'price_asc')
      rows = [...rows].sort((a, b) => a.priceUzs - b.priceUzs || byId(a, b));
    if (sort === 'price_desc')
      rows = [...rows].sort((a, b) => b.priceUzs - a.priceUzs || byId(a, b));
    return rows;
  }

  private answer(url: string) {
    const rows = this.matching(url);
    const q = new URL(url, 'https://api.test').searchParams;
    const page = Number(q.get('page'));
    const size = Number(q.get('page_size'));
    return {
      items: rows.slice((page - 1) * size, page * size).map((p) => ({
        id: p.id,
        title: p.title,
        price_uzs: p.priceUzs,
        brand: { id: p.brand.toLowerCase(), name: p.brand },
        in_stock: true,
        images: [],
      })),
      total: rows.length,
      page,
      page_size: size,
      next_page: page * size < rows.length ? page + 1 : null,
    };
  }
}
