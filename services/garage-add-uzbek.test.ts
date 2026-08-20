/**
 * QA: Add-vehicle end-to-end for Uzbek-market cars.
 *
 * The garage "add" path decodes a VIN, then creates the vehicle. UzAuto /
 * GM-Uzbekistan VINs aren't in NHTSA, so the readiness question is: does a
 * local Cobalt/Gentra/Spark VIN decode to the backend's catalog make_id /
 * model_id, and does that create cleanly?
 *
 * This suite exercises the real units — `decodeUzVin`, the default
 * `VinDecoderService` engine (UZ-first, NHTSA fallback), `MockGarageTransport`,
 * and the HTTP wire adapter `toServerVehicleCreatePayload` — with a stubbed
 * NHTSA fallback so it runs fully offline. Same React-free Vitest convention
 * as orders-flow / checkout-flow.
 */
import { describe, expect, test } from 'vitest';

import { MockGarageTransport, toServerVehicleCreatePayload } from './garage-api';
import type { VehicleInput } from './garage-service';
import { resolveCatalogIds } from './reference-catalog';
import { decodeUzVin, UZ_VIN_FIXTURES } from './uz-vin-catalog';
import {
  UzMarketVinDecodeTransport,
  VinDecoderService,
  type RawVinRecord,
  type VinDecodeTransport,
} from './vin-decoder-service';

// A NHTSA-shaped fallback stub so the composite decoder never touches the
// network: it "knows" one foreign VIN and returns not-found for the rest.
const FOREIGN_VIN = '4T1B11HK1KU789023'; // 2019 Toyota Camry (a real NHTSA VIN)
const nhtsaStub: VinDecodeTransport = {
  fetchRaw: async (vin): Promise<RawVinRecord> =>
    vin === FOREIGN_VIN
      ? { Make: 'TOYOTA', Model: 'Camry', ModelYear: '2019', ErrorCode: '0' }
      : { ErrorCode: '1', ErrorText: 'No matching records' },
};

/** The app-wide engine (UZ-first) but with the network fallback stubbed out. */
function decoder(): VinDecoderService {
  return new VinDecoderService({ transport: new UzMarketVinDecodeTransport(nhtsaStub) });
}

/**
 * Build the VehicleInput exactly as the add-vehicle screen does post-decode:
 * decode the VIN, then resolve the backend's canonical make_id/model_id from
 * the reference catalog by name (NOT the decoder's guessed ids, which the live
 * backend rejects). In this suite there's no API base URL, so `resolveCatalogIds`
 * resolves against the bundled catalog.
 */
async function inputFromVin(vin: string): Promise<VehicleInput> {
  const d = await decoder().decode(vin);
  const { makeId, modelId } = await resolveCatalogIds(d.make, d.model);
  return {
    make: d.make,
    model: d.model,
    year: d.year,
    brandId: makeId,
    modelId,
    vin: d.vin,
    color: 'midnight',
    setAsPrimary: true,
  };
}

describe('decodeUzVin — pattern decoder', () => {
  test.each(UZ_VIN_FIXTURES)('$model ($vin) → catalog ids + year', (f) => {
    expect(decodeUzVin(f.vin)).toEqual({
      vin: f.vin,
      make: f.make,
      makeId: f.makeId,
      model: f.model,
      modelId: f.modelId,
      year: f.year,
      bodyStyle: f.bodyStyle,
      fuelType: f.fuelType,
    });
  });

  test('every fixture resolves a real backend make_id/model_id', () => {
    for (const f of UZ_VIN_FIXTURES) {
      expect(f.makeId).toBe('make_chevrolet');
      expect(f.modelId).toMatch(/^model_chevrolet_[a-z]+$/);
      expect(f.year).toBeGreaterThan(2000);
    }
  });

  test('returns null for foreign / malformed / unknown-model VINs', () => {
    expect(decodeUzVin(FOREIGN_VIN)).toBeNull(); // not a UZ WMI
    expect(decodeUzVin('XUFZZ6950K0000017')).toBeNull(); // unknown model code ZZ
    expect(decodeUzVin('XUFCB')).toBeNull(); // too short
    expect(decodeUzVin('')).toBeNull();
  });

  test('is case- and whitespace-insensitive', () => {
    expect(decodeUzVin('  xufcb6950k0000017 ')?.modelId).toBe('model_chevrolet_cobalt');
  });
});

describe('VinDecoderService — default engine decodes UZ, falls back for foreign', () => {
  test.each(UZ_VIN_FIXTURES)('$model decodes with catalog ids + isVerified', async (f) => {
    const res = await decoder().decodeSafe(f.vin);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      vin: f.vin,
      make: f.make,
      model: f.model,
      year: f.year,
      makeId: f.makeId,
      modelId: f.modelId,
      isVerified: true,
    });
  });

  test('foreign VIN falls back to NHTSA and carries no catalog ids', async () => {
    const res = await decoder().decodeSafe(FOREIGN_VIN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.make).toBe('TOYOTA');
    expect(res.data.makeId).toBeUndefined();
    expect(res.data.modelId).toBeUndefined();
  });
});

describe('Add-vehicle create flow (MockGarageTransport)', () => {
  test.each(UZ_VIN_FIXTURES)('$model round-trips through create()', async (f) => {
    const transport = new MockGarageTransport();
    const created = await transport.create(await inputFromVin(f.vin));

    expect(created).toMatchObject({
      make: f.make,
      model: f.model,
      year: f.year,
      vin: f.vin,
      isPrimary: true,
    });

    const list = await transport.list();
    expect(list.map((v) => v.id)).toContain(created.id);
  });

  test('adding the whole UZ lineup keeps exactly one (newest) primary', async () => {
    const transport = new MockGarageTransport();
    let lastId = '';
    for (const f of UZ_VIN_FIXTURES) {
      lastId = (await transport.create(await inputFromVin(f.vin))).id;
    }
    const list = await transport.list();
    expect(list).toHaveLength(UZ_VIN_FIXTURES.length);
    expect(list.filter((v) => v.isPrimary)).toHaveLength(1);
    expect(list.find((v) => v.isPrimary)?.id).toBe(lastId);
  });
});

describe('resolveCatalogIds — decoded name → backend-valid ids', () => {
  test.each(UZ_VIN_FIXTURES)('$model resolves to catalog ids (not the VIN guess)', async (f) => {
    // Offline suite → resolves against the bundled catalog, whose ids are the
    // bare slugs (`chevrolet` / `cobalt`), not the decoder's `make_chevrolet`.
    const { makeId, modelId } = await resolveCatalogIds(f.make, f.model);
    expect(makeId).toBe('chevrolet');
    expect(modelId).toBe(f.model.toLowerCase());
  });

  test('a make/model the catalog does not carry resolves to nothing', async () => {
    expect(await resolveCatalogIds('Toyota', 'Camry')).toEqual({});
    expect(await resolveCatalogIds('Chevrolet', 'NotARealModel')).toEqual({});
    expect(await resolveCatalogIds('', '')).toEqual({});
  });
});

describe('Wire payload → backend contract (toServerVehicleCreatePayload)', () => {
  test.each(UZ_VIN_FIXTURES)('$model → resolved make_id/model_id + vin the backend accepts', async (f) => {
    const payload = toServerVehicleCreatePayload(await inputFromVin(f.vin));
    expect(payload.make_id).toBe('chevrolet');
    expect(payload.model_id).toBe(f.model.toLowerCase());
    expect(payload.vin).toBe(f.vin);
    expect(payload.color_hex).toBeTruthy();
    expect(payload.year).toBe(f.year);
  });

  test('unresolved (foreign) input omits ids but keeps the VIN for server-side decode', () => {
    const input: VehicleInput = {
      make: 'Toyota',
      model: 'Camry',
      year: 2019,
      vin: FOREIGN_VIN,
      color: 'midnight',
      setAsPrimary: true,
    };
    const payload = toServerVehicleCreatePayload(input);
    expect(payload.make_id).toBeUndefined();
    expect(payload.model_id).toBeUndefined();
    expect(payload.vin).toBe(FOREIGN_VIN);
  });
});
