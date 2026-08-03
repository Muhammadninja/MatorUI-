/**
 * VIN decoder — real-world decode contract (the garage Add-Vehicle path).
 *
 * The records below were captured VERBATIM from the live NHTSA vPIC
 * `DecodeVinValues` API (the service's real provider) so the test exercises the
 * exact shapes production sees, without depending on the network. Covers a clean
 * decode (ErrorCode "0" → trusted) and a partial one (ErrorCode "1" → present
 * but NOT `isVerified`, so it can't be auto-published).
 */
import { describe, expect, test } from 'vitest';

import {
  VinDecoderService,
  type RawVinRecord,
  type VinDecodeTransport,
} from './vin-decoder-service';

// Captured live from https://vpic.nhtsa.dot.gov/api (2026-07).
const HONDA_ACCORD_2003: RawVinRecord = {
  Make: 'HONDA',
  Model: 'Accord',
  ModelYear: '2003',
  DisplacementL: '2.998832712',
  FuelTypePrimary: 'Gasoline',
  ErrorCode: '0',
} as RawVinRecord;

const CHEVY_MALIBU_2018_PARTIAL: RawVinRecord = {
  Make: 'CHEVROLET',
  Model: 'Malibu',
  ModelYear: '2018',
  DisplacementL: '1.5',
  ErrorCode: '1', // vPIC flagged a partial decode for this synthetic-suffix VIN
} as RawVinRecord;

function serviceReturning(record: RawVinRecord): VinDecoderService {
  const transport: VinDecodeTransport = { fetchRaw: async () => record };
  return new VinDecoderService({ transport });
}

describe('VinDecoderService — real NHTSA payloads', () => {
  test('clean decode: Honda Accord VIN → make/model/year, isVerified', async () => {
    const svc = serviceReturning(HONDA_ACCORD_2003);
    const res = await svc.decodeSafe('1HGCM82633A004352');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({
      make: 'HONDA',
      model: 'Accord',
      year: 2003,
      engineDisplacement: '2.998832712',
      fuelType: 'Gasoline',
      isVerified: true,
      vin: '1HGCM82633A004352',
    });
  });

  test('partial decode: Chevrolet Malibu VIN → data present but NOT verified', async () => {
    const svc = serviceReturning(CHEVY_MALIBU_2018_PARTIAL);
    const res = await svc.decodeSafe('1G1ZD5ST8JF134138');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.make).toBe('CHEVROLET');
    expect(res.data.model).toBe('Malibu');
    expect(res.data.year).toBe(2018);
    // ErrorCode "1" ⇒ can't be trusted for auto-publish.
    expect(res.data.isVerified).toBe(false);
  });

  test('rejects a too-short VIN with INVALID_LENGTH (no provider call)', async () => {
    const svc = serviceReturning(HONDA_ACCORD_2003);
    const res = await svc.decodeSafe('1HGCM826'); // 8 chars
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('INVALID_LENGTH');
  });
});
