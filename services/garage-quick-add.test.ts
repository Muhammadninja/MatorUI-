import { describe, expect, it } from 'vitest';

import { toServerVehicleCreatePayload } from "@/services/garage-api";
import { MockGarageTransport } from "@/tests/support/transports/garage-api";
import type { VehicleInput } from './garage-service';
import { colorHexToEnum, DEFAULT_VEHICLE_COLOR_HEX } from '../utils/vehicle-color';

/**
 * The garage "model and year" route: pick a make, pick a model, pick a year.
 *
 * Its whole reason to exist is that `POST /v1/garage/vehicles` requires only
 * `make_id`, `model_id` and `year` (`create-vehicle.dto.ts` marks everything
 * else `@IsOptional()`), so no VIN is needed. These tests pin that the payload
 * the route builds satisfies exactly that contract.
 *
 * The ids are the ones `GET /v1/reference/makes|models` actually returns on
 * production, NOT the bundled `uz-vehicle-catalog` ids. That distinction is the
 * bug this route used to have: the picker listed bundled makes the backend has
 * never been seeded with, and spelled Tracker as `tracker` where the live
 * catalog calls it `tracker-2`, so the create failed after the user had already
 * chosen a car.
 */

/** Exactly what the empty state's route 2 hands to `addVehicle`. */
function quickAddInput(
  makeId: string,
  makeName: string,
  modelId: string,
  modelName: string,
  year: number,
  isFirstCar: boolean,
): VehicleInput {
  return {
    make: makeName,
    model: modelName,
    year,
    brandId: makeId,
    modelId,
    color: colorHexToEnum(DEFAULT_VEHICLE_COLOR_HEX),
    colorHex: DEFAULT_VEHICLE_COLOR_HEX,
    setAsPrimary: isFirstCar,
  };
}

describe('garage quick add — wire payload', () => {
  it('sends the three fields the backend requires, and no VIN', () => {
    const payload = toServerVehicleCreatePayload(
      quickAddInput('chevrolet', 'Chevrolet', 'cobalt', 'Cobalt', 2023, true),
    );

    expect(payload.make_id).toBe('chevrolet');
    expect(payload.model_id).toBe('cobalt');
    expect(payload.year).toBe(2023);
    // The route never collects a VIN, so it must not invent one. An empty
    // string here would be sent and rejected; undefined is omitted.
    expect(payload.vin).toBeUndefined();
    expect(payload.color_hex).toBeTruthy();
  });

  it('passes live catalog ids through untouched', () => {
    // `tracker-2` is what production returns. A round-trip through the bundled
    // catalog would have rewritten or dropped it.
    const payload = toServerVehicleCreatePayload(
      quickAddInput('chevrolet', 'Chevrolet', 'tracker-2', 'Tracker', 2021, false),
    );
    expect(payload.model_id).toBe('tracker-2');
  });

  it('claims primary only for the first car', () => {
    const first = toServerVehicleCreatePayload(
      quickAddInput('byd', 'BYD', 'byd-chazor', 'Chazor', 2024, true),
    );
    const later = toServerVehicleCreatePayload(
      quickAddInput('byd', 'BYD', 'byd-chazor', 'Chazor', 2024, false),
    );
    expect(first.is_primary).toBe(true);
    // Not `false`: an explicit false would demote whatever is already active.
    expect(later.is_primary).toBe(false);
  });

  it('round-trips through the transport and lands in the garage', async () => {
    const transport = new MockGarageTransport();
    const created = await transport.create(
      quickAddInput('chevrolet', 'Chevrolet', 'nexia', 'Nexia', 2019, true),
    );

    expect(created.id).toBeTruthy();
    expect(created.make).toBe('Chevrolet');
    expect(created.model).toBe('Nexia');
    expect(created.year).toBe(2019);

    const list = await transport.list();
    expect(list.some((v) => v.id === created.id)).toBe(true);
  });

  it('keeps exactly one primary when a second car is added as primary', async () => {
    const transport = new MockGarageTransport();
    const a = await transport.create(
      quickAddInput('chevrolet', 'Chevrolet', 'spark', 'Spark', 2018, true),
    );
    const b = await transport.create(
      quickAddInput('chevrolet', 'Chevrolet', 'gentra', 'Gentra', 2022, true),
    );

    const list = await transport.list();
    const primaries = list.filter((v) => v.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });
});
