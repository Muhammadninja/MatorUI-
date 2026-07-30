/**
 * reference-catalog — contract tests for the vehicle reference tables that
 * back the Add-Vehicle pickers (`/v1/reference/*`).
 *
 * Pins:
 *   - the `{ items }` envelope unwrap + snake→camel mapping for each level
 *   - the cascade query params (makeId / modelId / trimId)
 *   - the local-catalog fallback when the `garage` domain isn't HTTP-enabled
 *   - graceful degradation to local makes when the HTTP call throws
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

  test('falls back to the local catalog when the request throws', async () => {
    get.mockRejectedValueOnce(new Error('network'));
    const makes = await fetchMakes();
    expect(makes.length).toBe(UZ_BRANDS.length);
    expect(makes[0]).toHaveProperty('id');
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

  test('empty makeId short-circuits to [] without a request', async () => {
    expect(await fetchModels('')).toEqual([]);
    expect(get).not.toHaveBeenCalled();
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
