/**
 * reference-catalog — contract tests for the vehicle reference tables that
 * back the Add-Vehicle pickers (`/v1/reference/*`).
 *
 * Pins:
 *   - the `{ items }` envelope unwrap + snake→camel mapping for each level
 *   - the cascade query params (makeId / modelId / trimId)
 *   - the local-catalog fallback when the `garage` domain isn't HTTP-enabled
 *   - an HTTP failure stays a failure, never the bundled catalog
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Toggled per-test so we can exercise both the HTTP and the local-fallback paths.
let httpOn = true;
vi.mock('@/config/api', () => ({
  shouldUseHttpTransport: () => httpOn,
}));

const get = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a) },
}));

import {
  fetchEngines,
  fetchMakes,
  fetchModels,
  fetchTrims,
  fetchReferenceCategories,
  localizedCategoryName,
} from './reference-catalog';
import { UZ_BRANDS } from './uz-vehicle-catalog';

beforeEach(() => {
  httpOn = true;
  get.mockReset();
});

describe('fetchMakes', () => {
  test('unwraps { items }, maps logo_url → logoUrl and coming_soon → comingSoon', async () => {
    get.mockResolvedValueOnce({
      items: [
        { id: 'kia', name: 'Kia', logo_url: null },
        { id: 'chevrolet', name: 'Chevrolet', logo_url: 'https://cdn/chevy.png', coming_soon: true },
      ],
    });
    const makes = await fetchMakes();
    expect(get).toHaveBeenCalledWith('/v1/reference/makes', expect.anything());
    expect(makes).toEqual([
      // `coming_soon` absent → comingSoon:false; explicit true → comingSoon:true.
      { id: 'kia', name: 'Kia', logoUrl: null, comingSoon: false },
      { id: 'chevrolet', name: 'Chevrolet', logoUrl: 'https://cdn/chevy.png', comingSoon: true },
    ]);
  });

  test('a failed request stays a failure, so the picker can offer a retry', async () => {
    get.mockRejectedValueOnce(new Error('network'));
    await expect(fetchMakes()).rejects.toThrow('network');
  });

  test('uses the local catalog (no HTTP) when garage domain is off', async () => {
    httpOn = false;
    const makes = await fetchMakes();
    expect(get).not.toHaveBeenCalled();
    expect(makes.length).toBe(UZ_BRANDS.length);
  });
});

describe('fetchModels', () => {
  test('passes makeId and maps make_id → makeId', async () => {
    get.mockResolvedValueOnce({
      items: [{ id: 'kia-k5', make_id: 'kia', name: 'K5' }],
    });
    const models = await fetchModels('kia');
    expect(get).toHaveBeenCalledWith('/v1/reference/models?makeId=kia', expect.anything());
    expect(models).toEqual([{ id: 'kia-k5', makeId: 'kia', name: 'K5' }]);
  });

  // Backend PR #150: each model carries the build years Garage accepts.
  test('maps year_from / year_to, keeping null for an open start', async () => {
    get.mockResolvedValueOnce({
      items: [
        { id: 'lacetti', make_id: 'chevrolet', name: 'Lacetti', year_from: 2002, year_to: 2024 },
        { id: 'damas', make_id: 'chevrolet', name: 'Damas', year_from: null, year_to: 2027 },
      ],
    });
    expect(await fetchModels('chevrolet')).toEqual([
      { id: 'lacetti', makeId: 'chevrolet', name: 'Lacetti', yearFrom: 2002, yearTo: 2024 },
      { id: 'damas', makeId: 'chevrolet', name: 'Damas', yearFrom: null, yearTo: 2027 },
    ]);
  });

  test('empty makeId short-circuits to [] without a request', async () => {
    expect(await fetchModels('')).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  // Live Chevrolet list (2026-11-14): the misspelled legacy "Genrta" row sorted
  // beside the real Gentra, so the add-vehicle picker showed Gentra twice.
  test('drops the misspelled legacy Genrta row and keeps the real Gentra', async () => {
    get.mockResolvedValueOnce({
      items: [
        { id: 'genrta-lacetti', make_id: 'chevrolet', name: 'Genrta' },
        { id: 'gentra', make_id: 'chevrolet', name: 'Gentra' },
        { id: 'lacetti', make_id: 'chevrolet', name: 'Lacetti' },
      ],
    });
    const models = await fetchModels('chevrolet');
    expect(models.map((m) => m.id)).toEqual(['gentra', 'lacetti']);
  });
});

describe('fetchTrims', () => {
  test('passes modelId and maps model_id → modelId', async () => {
    get.mockResolvedValueOnce({
      items: [{ id: 'cobalt-p2-premier', model_id: 'cobalt', name: 'Premier' }],
    });
    const trims = await fetchTrims('cobalt');
    expect(get).toHaveBeenCalledWith('/v1/reference/trims?modelId=cobalt', expect.anything());
    expect(trims).toEqual([{ id: 'cobalt-p2-premier', modelId: 'cobalt', name: 'Premier' }]);
  });

  test('trims have no local fallback (returns [] off-HTTP)', async () => {
    httpOn = false;
    expect(await fetchTrims('cobalt')).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('fetchEngines', () => {
  test('passes trimId and maps displacement_cc / fuel_type', async () => {
    get.mockResolvedValueOnce({
      items: [
        { id: 'b15d2-turbo', name: '1.5L Turbo (B15D2)', displacement_cc: 1500, fuel_type: 'petrol' },
      ],
    });
    const engines = await fetchEngines('cobalt-p2-premier');
    expect(get).toHaveBeenCalledWith(
      '/v1/reference/engines?trimId=cobalt-p2-premier',
      expect.anything(),
    );
    expect(engines).toEqual([
      { id: 'b15d2-turbo', name: '1.5L Turbo (B15D2)', displacementCc: 1500, fuelType: 'petrol' },
    ]);
  });

  test('no trimId → [] without a request', async () => {
    expect(await fetchEngines(undefined)).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

/**
 * Category display labels. `name` is the backend's internal English value and
 * is the LAST resort — a partly-translated category should still render a real
 * title rather than leak the internal one into the UI.
 */
describe('localizedCategoryName — language fallback matrix', () => {
  const full = {
    name: 'Brake pads',
    titleRu: 'Тормозные колодки',
    titleUz: 'Tormoz kolodkalari',
    titleEn: 'Brake pads',
  };

  test('picks the requested language when all three are present', () => {
    expect(localizedCategoryName(full, 'ru')).toBe('Тормозные колодки');
    expect(localizedCategoryName(full, 'uz')).toBe('Tormoz kolodkalari');
    expect(localizedCategoryName(full, 'en')).toBe('Brake pads');
  });

  test('ignores region and script subtags, and is case-insensitive', () => {
    expect(localizedCategoryName(full, 'uz-UZ')).toBe('Tormoz kolodkalari');
    expect(localizedCategoryName(full, 'uz-Latn-UZ')).toBe('Tormoz kolodkalari');
    expect(localizedCategoryName(full, 'EN-US')).toBe('Brake pads');
  });

  test('an unknown or missing language falls back to Russian', () => {
    expect(localizedCategoryName(full, 'de-DE')).toBe('Тормозные колодки');
    expect(localizedCategoryName(full, undefined)).toBe('Тормозные колодки');
    expect(localizedCategoryName(full, '')).toBe('Тормозные колодки');
  });

  test('falls through to another translation before the internal name', () => {
    const onlyUz = { ...full, titleRu: null, titleEn: null };
    expect(localizedCategoryName(onlyUz, 'ru')).toBe('Tormoz kolodkalari');
    expect(localizedCategoryName(onlyUz, 'en')).toBe('Tormoz kolodkalari');

    const onlyEn = { ...full, titleRu: null, titleUz: null };
    expect(localizedCategoryName(onlyEn, 'ru')).toBe('Brake pads');
    expect(localizedCategoryName(onlyEn, 'uz')).toBe('Brake pads');
  });

  test('uses the raw name only when every translation is missing', () => {
    const untranslated = { name: 'Brake pads', titleRu: null, titleUz: null, titleEn: null };
    for (const lang of ['ru', 'uz', 'en']) {
      expect(localizedCategoryName(untranslated, lang)).toBe('Brake pads');
    }
  });
});

describe('fetchReferenceCategories — title parsing', () => {
  beforeEach(() => {
    httpOn = true;
    get.mockReset();
  });

  test('reads all three titles in both camelCase and snake_case', async () => {
    get.mockResolvedValueOnce({
      items: [
        {
          id: 'brake-pads',
          name: 'Brake pads',
          title_ru: 'Тормозные колодки',
          title_uz: 'Tormoz kolodkalari',
          title_en: 'Brake pads',
          slug: 'brake-pads',
        },
        {
          id: 'motor-oil',
          name: 'Motor oil',
          titleRu: 'Моторное масло',
          titleUz: 'Motor moyi',
          titleEn: 'Motor oil',
          slug: 'motor-oil',
        },
      ],
    });

    const [pads, oil] = await fetchReferenceCategories();

    expect(pads).toMatchObject({
      titleRu: 'Тормозные колодки',
      titleUz: 'Tormoz kolodkalari',
      titleEn: 'Brake pads',
    });
    expect(oil).toMatchObject({
      titleRu: 'Моторное масло',
      titleUz: 'Motor moyi',
      titleEn: 'Motor oil',
    });
  });

  test('missing titles null out rather than undefined, so `||` chains work', async () => {
    get.mockResolvedValueOnce({
      items: [{ id: 'c1', name: 'Brake pads', slug: 'brake-pads' }],
    });

    const [c] = await fetchReferenceCategories();
    expect(c).toMatchObject({ titleRu: null, titleUz: null, titleEn: null });
    expect(localizedCategoryName(c!, 'uz')).toBe('Brake pads');
  });
});
