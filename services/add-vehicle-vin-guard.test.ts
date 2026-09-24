import { describe, expect, it } from 'vitest';

import { toServerVehicleCreatePayload } from './garage-api';
import { resolveCatalogIds } from './reference-catalog';
import type { VehicleInput } from './garage-service';

/**
 * The VIN route must not send a create it knows will be rejected.
 *
 * `POST /v1/garage/vehicles` validates against
 * `Backend/src/garage/vehicles/dto/create-vehicle.dto.ts`, where `make_id` and
 * `model_id` are plain `@IsString()` with NO `@IsOptional()`. The screen used
 * to omit them when the reference catalogue had no match, on the belief that
 * the server would decode them from the VIN. It does not — it 400s. So any
 * make the catalogue has not been seeded with failed AFTER the user had typed
 * 17 characters.
 *
 * The fix resolves ids at decode time and gates Save on them. These tests hold
 * the two halves of that contract: what the payload looks like when ids ARE
 * present, and that a payload without them is recognisably invalid (i.e. worth
 * blocking on) rather than something the backend will quietly fix up.
 */

function inputWith(makeId?: string, modelId?: string): VehicleInput {
  return {
    make: 'Chevrolet',
    model: 'Cobalt',
    year: 2023,
    brandId: makeId,
    modelId,
    vin: 'XWB4A11BDLA123456',
    color: 'midnight',
    setAsPrimary: true,
  };
}

/** The screen's `canSave` rule, kept here so the contract is testable. */
const savable = (ids: { makeId?: string; modelId?: string } | null) =>
  !!ids?.makeId && !!ids?.modelId;

describe('VIN route — catalogue guard', () => {
  it('builds a valid payload when both ids resolved', () => {
    const payload = toServerVehicleCreatePayload(inputWith('chevrolet', 'cobalt'));
    expect(payload.make_id).toBe('chevrolet');
    expect(payload.model_id).toBe('cobalt');
    expect(payload.vin).toBe('XWB4A11BDLA123456');
  });

  it('drops the ids entirely when unresolved, which the backend rejects', () => {
    // `toServerVehicleCreatePayload` maps a falsy id to `undefined` so it is
    // omitted from the JSON body. Against a DTO that requires the field, an
    // omitted key is a 400 — which is exactly why the screen must not get
    // this far.
    const payload = toServerVehicleCreatePayload(inputWith(undefined, undefined));
    expect(payload.make_id).toBeUndefined();
    expect(payload.model_id).toBeUndefined();
  });

  it('refuses to save unless BOTH ids are present', () => {
    expect(savable({ makeId: 'chevrolet', modelId: 'cobalt' })).toBe(true);
    // A half-resolve is just as fatal as none: the DTO requires both.
    expect(savable({ makeId: 'chevrolet' })).toBe(false);
    expect(savable({ modelId: 'cobalt' })).toBe(false);
    expect(savable({})).toBe(false);
    // null means "not resolved yet" — Save stays shut while it is in flight.
    expect(savable(null)).toBe(false);
  });

  it('resolves nothing for a make the catalogue does not carry', async () => {
    // Offline in tests, so this reads the bundled catalogue. Either way the
    // contract is the same: an unknown make yields no ids, and no ids means
    // no request.
    const ids = await resolveCatalogIds('Lamborghini', 'Huracan');
    expect(ids.makeId).toBeUndefined();
    expect(ids.modelId).toBeUndefined();
    expect(savable(ids)).toBe(false);
  });

  it('resolves a make the catalogue does carry', async () => {
    const ids = await resolveCatalogIds('Chevrolet', 'Cobalt');
    expect(savable(ids)).toBe(true);
  });
});
