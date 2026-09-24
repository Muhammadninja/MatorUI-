/**
 * G-5: real UzAuto VINs through the real decoder path.
 *
 * Every test goes through `VinDecoderService` → `UzMarketVinDecodeTransport`
 * → (for non-UZ VINs) `NhtsaVinDecodeTransport` → `mapRecord`. Only the
 * network is stubbed: global `fetch` returns vPIC payloads captured live on
 * 2026-09-25. No decoded object is mocked.
 *
 * VINs below are evidence prefixes padded with zeros to 17 characters. The
 * decoder reads positions 1–11 only, and no real serial number is stored here.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { toServerVehicleCreatePayload } from './garage-api';
import { resolveCatalogIds } from './reference-catalog';
import {
  UZAUTO_VIN_PATTERNS,
  resolveModelYear,
  UZ_VIN_FIXTURES,
} from './uz-vin-catalog';
import { UzMarketVinDecodeTransport, VinDecoderService } from './vin-decoder-service';

/** Fixed clock so model-year bounds don't drift with the calendar. */
const NOW = new Date('2026-09-25T12:00:00Z');

const pad = (prefix: string) => prefix.padEnd(17, '0');

// ── vPIC payloads captured live on 2026-09-25 (fields the mapper reads) ──────
const NHTSA_HONDA = {
  Count: 1,
  Message: 'Results returned successfully.',
  Results: [
    {
      Make: 'HONDA', Model: 'Accord', ModelYear: '2003', DisplacementL: '2.998832712',
      FuelTypePrimary: 'Gasoline', ErrorCode: '0',
      ErrorText: '0 - VIN decoded clean. Check Digit (9th position) is correct',
    },
  ],
};
/** What vPIC returns for a manufacturer it doesn't carry (Y6DTF69Y080000011). */
const NHTSA_UNREGISTERED = {
  Count: 1,
  Message: 'Results returned successfully.',
  Results: [
    {
      Make: '', Model: '', ModelYear: '', DisplacementL: '', FuelTypePrimary: '', ErrorCode: '1,7',
      ErrorText:
        '1 - Check Digit (9th position) does not calculate properly; 7 - Manufacturer is not ' +
        'registered with NHTSA for sale or importation in the U.S. for use on U.S roads',
    },
  ],
};

// ── api.mator.uz reference tables captured live on 2026-09-25 ────────────────
// The add-vehicle screen resolves the decoded make/model to catalogue ids
// against these. Note the two models both named "Tracker".
const REF_MAKES = {
  total: 4,
  items: [
    { id: 'chevrolet', name: 'Chevrolet', logo_url: null, coming_soon: false },
    { id: 'byd', name: 'BYD', logo_url: null, coming_soon: true },
    { id: 'leapmotor', name: 'Leapmotor', logo_url: null, coming_soon: true },
    { id: 'volkswagen', name: 'Volkswagen', logo_url: null, coming_soon: false },
  ],
};
const REF_MODELS_CHEVROLET = {
  total: 15,
  items: [
    ['cobalt', 'Cobalt'], ['malibu', 'Malibu'], ['orlando', 'Orlando'], ['nexia', 'Nexia'],
    ['lacetti', 'Lacetti'], ['tracker-2', 'Tracker'], ['gentra', 'Gentra'], ['spark', 'Spark'],
    ['tracker', 'Tracker'], ['nexia-3', 'Nexia 3'], ['captiva', 'Captiva'], ['onix', 'Onix'],
    ['genrta-lacetti', 'Genrta'], ['damas', 'Damas'], ['nexia-2', 'Nexia 2'],
  ].map(([id, name]) => ({ id, make_id: 'chevrolet', name })),
};

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const respond = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(json(body, status));

/** Serve the recorded reference tables to the real `apiClient`. */
function serveReference(models = REF_MODELS_CHEVROLET) {
  vi.stubEnv('EXPO_PUBLIC_API_BASE_URL', 'https://api.mator.uz');
  fetchMock.mockImplementation(async (url) => {
    if (url.endsWith('/v1/reference/makes')) return json(REF_MAKES);
    if (url.endsWith('/v1/reference/models?makeId=chevrolet')) return json(models);
    return json({ code: 'NOT_FOUND' }, 404);
  });
}

const decoder = () =>
  new VinDecoderService({ transport: new UzMarketVinDecodeTransport(undefined, () => NOW) });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('G-5 device VIN: XWBUA7659P…, a 2023 Chevrolet Tracker-2', () => {
  // The first ten characters of the VIN that failed the G-5 device smoke test.
  // Position 11 wasn't supplied and the decoder doesn't read it; the serial is
  // never stored.
  const G5_VIN = pad('XWBUA7659P');

  test('decodes to its documented make, model and year without asking NHTSA', async () => {
    const res = await decoder().decodeSafe(G5_VIN);
    expect(res).toEqual({
      ok: true,
      data: expect.objectContaining({
        make: 'Chevrolet', model: 'Tracker-2', year: 2023, isVerified: true,
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('the year comes from the year code and the model window, not a constant', async () => {
    // Same VDS, other year codes: R is 2024; N (2022) is before the window.
    expect(await decoder().decodeSafe(pad('XWBUA7659R'))).toMatchObject({
      ok: true,
      data: { year: 2024 },
    });
    expect(await decoder().decodeSafe(pad('XWBUA7659N'))).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED_VIN' },
    });
  });

  test('resolves to catalogue ids chevrolet / tracker-2 and a valid create payload', async () => {
    const decoded = await decoder().decode(G5_VIN);
    serveReference();

    const ids = await resolveCatalogIds(decoded.make, decoded.model);
    expect(ids).toEqual({ makeId: 'chevrolet', modelId: 'tracker-2' });

    const payload = toServerVehicleCreatePayload({
      make: decoded.make, model: decoded.model, year: decoded.year,
      brandId: ids.makeId, modelId: ids.modelId, vin: decoded.vin,
      color: 'midnight', setAsPrimary: true,
    });
    expect(payload).toMatchObject({
      make_id: 'chevrolet', model_id: 'tracker-2', year: 2023, is_primary: true,
    });
  });

  test('picks tracker-2 whatever order the two "Tracker" models come in', async () => {
    serveReference({ ...REF_MODELS_CHEVROLET, items: [...REF_MODELS_CHEVROLET.items].reverse() });
    expect(await resolveCatalogIds('Chevrolet', 'Tracker-2')).toEqual({
      makeId: 'chevrolet',
      modelId: 'tracker-2',
    });
  });
});

describe('UzAuto evidence patterns (WMI XWB)', () => {
  const cases = [
    { prefix: 'XWBJF69VJEA', model: 'Cobalt', year: 2014 },
    { prefix: 'XWBJA69V9S', model: 'Cobalt', year: 2025 },
    { prefix: 'XWB5V31BDEA', model: 'Gentra', year: 2014 },
    { prefix: 'XWB7T11ZB3', model: 'Damas', year: 2003 },
    { prefix: 'XWBMA481JCA', model: 'Spark', year: 2012 },
    { prefix: 'XWBTF69V9HA', model: 'Nexia 3', year: 2017 },
    { prefix: 'XWBUA7659P', model: 'Tracker-2', year: 2023 },
  ];

  test.each(cases)('$prefix… → Chevrolet $model $year, without asking NHTSA', async (c) => {
    const res = await decoder().decodeSafe(pad(c.prefix));
    expect(res).toEqual({
      ok: true,
      data: expect.objectContaining({
        make: 'Chevrolet',
        model: c.model,
        year: c.year,
        isVerified: true,
        makeId: undefined,
        modelId: undefined,
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('every pattern is covered by a case above', () => {
    const covered = new Set(cases.map((c) => c.prefix.slice(3, 8)));
    expect(UZAUTO_VIN_PATTERNS.map((p) => p.vds).filter((v) => !covered.has(v))).toEqual([]);
  });

  test('every pattern resolves to catalogue ids against the live reference tables', async () => {
    serveReference();
    for (const p of UZAUTO_VIN_PATTERNS) {
      const ids = await resolveCatalogIds(p.make, p.model);
      expect(ids, `${p.vds} → ${p.model}`).toEqual({
        makeId: 'chevrolet',
        modelId: expect.any(String),
      });
    }
  });

  test('every pattern cites its evidence by prefix, never a full VIN', () => {
    for (const p of UZAUTO_VIN_PATTERNS) {
      expect(p.evidence).toContain(`XWB${p.vds}`);
      expect(p.evidence).not.toMatch(/XWB[A-HJ-NPR-Z0-9]{14}/);
    }
  });
});

describe('model year: ISO 3779 cycle chosen by the model window', () => {
  const damas = UZAUTO_VIN_PATTERNS.find((p) => p.model === 'Damas')!.modelYears;
  const cobalt = UZAUTO_VIN_PATTERNS.find((p) => p.model === 'Cobalt')!.modelYears;

  test('picks the earlier cycle when the later one is in the future', () => {
    // "3" is 2003 or 2033. 2033 is past next year, so 2003.
    expect(resolveModelYear('3', damas, NOW)).toBe(2003);
  });

  test('refuses a code that fits both cycles', () => {
    // "T" is 1996 or 2026, and Damas was built in both.
    expect(resolveModelYear('T', damas, NOW)).toBeNull();
  });

  test('refuses a year before the model existed', () => {
    // "C" is 1982 or 2012; the catalogue starts Cobalt in 2013.
    expect(resolveModelYear('C', cobalt, NOW)).toBeNull();
  });

  test('allows next model year, not the one after', () => {
    expect(resolveModelYear('V', cobalt, NOW)).toBe(2027);
    expect(resolveModelYear('W', cobalt, NOW)).toBeNull();
  });

  test('refuses characters that are not year codes', () => {
    for (const code of ['U', 'Z', '0']) expect(resolveModelYear(code, cobalt, NOW)).toBeNull();
  });
});

describe('unsupported UzAuto VINs fail clearly', () => {
  test('a VDS outside the evidence table is UNSUPPORTED_VIN, not a guess', async () => {
    const res = await decoder().decodeSafe(pad('XWBZZ0000EA'));
    expect(res).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_VIN' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a known pattern with an ambiguous year is UNSUPPORTED_VIN', async () => {
    const res = await decoder().decodeSafe(pad('XWB7T11ZBTA'));
    expect(res).toMatchObject({ ok: false, error: { code: 'UNSUPPORTED_VIN' } });
  });

  test('malformed VINs are rejected before any lookup', async () => {
    expect(await decoder().decodeSafe('XWB5V31BDEA')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_LENGTH' },
    });
    expect(await decoder().decodeSafe('XWB5V31BDEA00O000')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_CHARACTERS' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('XUF demo fixtures are unchanged', () => {
  test.each(UZ_VIN_FIXTURES)('$vin → $model $year with demo ids', async (f) => {
    const res = await decoder().decodeSafe(f.vin);
    expect(res).toEqual({
      ok: true,
      data: expect.objectContaining({
        make: f.make, model: f.model, year: f.year,
        makeId: f.makeId, modelId: f.modelId, isVerified: true,
      }),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('NHTSA fallback for foreign VINs', () => {
  test('Honda 1HGCM82633A004352 decodes through vPIC', async () => {
    respond(NHTSA_HONDA);
    const res = await decoder().decodeSafe('1HGCM82633A004352');
    expect(res).toEqual({
      ok: true,
      data: expect.objectContaining({ make: 'HONDA', model: 'Accord', year: 2003, isVerified: true }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/DecodeVinValues/1HGCM82633A004352');
  });

  test('an empty vPIC record is NOT_FOUND, not a successful "unidentified" decode', async () => {
    respond(NHTSA_UNREGISTERED);
    const res = await decoder().decodeSafe('Y6DTF69Y080000011');
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  test('a vPIC reply with no results is NOT_FOUND', async () => {
    respond({ Count: 0, Message: 'No data', Results: [] });
    expect(await decoder().decodeSafe('Y6DTF69Y080000011')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  test('a vPIC server error is PROVIDER_ERROR', async () => {
    respond({ Message: 'error' }, 500);
    expect(await decoder().decodeSafe('Y6DTF69Y080000011')).toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_ERROR' },
    });
  });
});
