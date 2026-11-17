import { describe, expect, test } from 'vitest';

import { ApiError } from './api-client';
import { toClientVehicle, toServerVehicleCreatePayload } from './garage-api';
import {
  checkManualName,
  manualVehicleRejection,
  manualYearChoices,
  MANUAL_YEAR_MIN,
  vehiclePartsParams,
} from './manual-vehicle';

describe('checkManualName', () => {
  test('cleans the name the way the backend stores it', () => {
    expect(checkManualName('  Great   Wall ')).toEqual({ name: 'Great Wall' });
    expect(checkManualName('Москвич 3')).toEqual({ name: 'Москвич 3' });
  });

  test('says why a name cannot be saved', () => {
    expect(checkManualName('   ')).toEqual({ error: 'empty' });
    expect(checkManualName('---')).toEqual({ error: 'invalid' });
    expect(checkManualName('A‮B')).toEqual({ error: 'invalid' });
    expect(checkManualName('x'.repeat(61))).toEqual({ error: 'tooLong' });
  });
});

test('manual years run from this year back, never into the future', () => {
  const years = manualYearChoices(2026);
  expect(years[0]).toBe(2026);
  expect(years.at(-1)).toBe(MANUAL_YEAR_MIN);
  expect(years).not.toContain(2027);
});

describe('manualVehicleRejection', () => {
  const rejection = (code: string, details: unknown) => new ApiError(400, code, 'x', { code, details });
  test('reads the backend refusals', () => {
    expect(manualVehicleRejection(rejection('VEHICLE_IN_CATALOG', { make_id: 'kia', model_id: 'kia-k5' })))
      .toEqual({ kind: 'inCatalog', makeId: 'kia', modelId: 'kia-k5' });
    expect(manualVehicleRejection(rejection('VEHICLE_YEAR_IN_FUTURE', { year: 2027, year_to: 2026 })))
      .toEqual({ kind: 'futureYear', yearTo: 2026 });
    expect(manualVehicleRejection(rejection('VEHICLE_MANUAL_NAME_INVALID', { field: 'custom_model_name' })))
      .toEqual({ kind: 'invalidName' });
  });
  test('anything else is not a manual-vehicle refusal', () => {
    expect(manualVehicleRejection(new Error('network'))).toBeNull();
    expect(manualVehicleRejection(rejection('VEHICLE_YEAR_UNSUPPORTED', { year_to: 2024 }))).toBeNull();
  });
});

describe('vehiclePartsParams', () => {
  test('a catalog car keeps its make and model scope', () => {
    expect(vehiclePartsParams({ make: 'Chevrolet', model: 'Cobalt', year: 2024, label: 'Chevrolet Cobalt' }))
      .toEqual({ make: 'Chevrolet', model: 'Cobalt', year: '2024', label: 'Chevrolet Cobalt' });
  });
  test('a manual car never scopes by its typed model; a catalog make is kept', () => {
    expect(vehiclePartsParams({ make: 'Kia', model: 'EV9', year: 2025, label: 'Kia EV9', isCustom: true, brandId: 'kia' }))
      .toEqual({ make: 'Kia', year: '2025', label: 'Kia EV9', custom: '1' });
    expect(vehiclePartsParams({ make: 'Zeekr', model: '001', year: 2024, label: 'Zeekr 001', isCustom: true, brandId: '' }))
      .toEqual({ year: '2024', label: 'Zeekr 001', custom: '1' });
  });
});

describe('garage API with manual vehicles', () => {
  test('create sends typed names and no made-up catalog ids', () => {
    const payload = toServerVehicleCreatePayload({
      make: 'Zeekr', model: '001', year: 2024, color: 'white', colorHex: '#FFFFFF',
      customMakeName: 'Zeekr', customModelName: '001',
    } as never);
    expect(payload).toMatchObject({ custom_make_name: 'Zeekr', custom_model_name: '001', year: 2024 });
    expect(payload.make_id).toBeUndefined();
    expect(payload.model_id).toBeUndefined();
  });

  test('a catalog create is unchanged', () => {
    const payload = toServerVehicleCreatePayload({
      make: 'Chevrolet', model: 'Cobalt', year: 2024, color: 'white', colorHex: '#FFFFFF',
      brandId: 'chevrolet', modelId: 'cobalt',
    } as never);
    expect(payload).toMatchObject({ make_id: 'chevrolet', model_id: 'cobalt' });
    expect(payload.custom_make_name).toBeUndefined();
    expect(payload.custom_model_name).toBeUndefined();
  });

  test('reads a manual vehicle: typed names, empty ids, isCustom', () => {
    const v = toClientVehicle({
      id: 'veh_m', is_primary: false, year: 2024, created_at: '2026-11-17T00:00:00Z',
      make: { id: null, name: 'Zeekr', logo_url: null }, model: { id: null, name: '001' }, is_custom: true,
    } as never);
    expect(v).toMatchObject({ make: 'Zeekr', model: '001', brandId: '', modelId: '', isCustom: true });
  });
});
