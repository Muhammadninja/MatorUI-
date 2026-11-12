import { describe, expect, test } from 'vitest';

import { toClientVehicle, toServerVehiclePatchPayload } from './garage-api';

const wire = (generation?: unknown) =>
  ({
    id: 'veh_1',
    user_id: 'usr_1',
    is_primary: true,
    make: { id: 'chevrolet', name: 'Chevrolet', logo_url: null },
    model: { id: 'nexia', name: 'Nexia' },
    year: 2016,
    trim: null,
    color_hex: '#FFFFFF',
    created_at: '2026-11-12T00:00:00Z',
    ...(generation === undefined ? {} : { generation }),
  }) as any;

describe('Garage wire: generation', () => {
  test('maps the backend generation and keeps the vehicle’s own model for fitment', () => {
    const v = toClientVehicle(
      wire({
        status: 'resolved',
        source: 'owner',
        model: { id: 'nexia-3', name: 'Nexia 3' },
        options: [
          { id: 'nexia-2', name: 'Nexia 2', year_from: 2008, year_to: 2016 },
          { id: 'nexia-3', name: 'Nexia 3', year_from: 2016, year_to: 2022 },
        ],
      }),
    );
    expect(v.modelId).toBe('nexia');
    expect(v.model).toBe('Nexia');
    expect(v.generation).toMatchObject({ status: 'resolved', source: 'owner', model: { id: 'nexia-3' } });
  });

  test('an older backend without the field leaves it undefined', () => {
    expect(toClientVehicle(wire()).generation).toBeUndefined();
  });

  test('PATCH sends the pick, and null to clear it; other edits never send it', () => {
    expect(toServerVehiclePatchPayload({ variantModelId: 'nexia-3' })).toEqual({ variant_model_id: 'nexia-3' });
    expect(toServerVehiclePatchPayload({ variantModelId: null })).toEqual({ variant_model_id: null });
    expect(toServerVehiclePatchPayload({ nickname: 'Daily' })).toEqual({ nickname: 'Daily' });
  });
});
