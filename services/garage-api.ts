import type { Vehicle, VehicleInput, VehiclePatch } from '@/services/garage-service';

/**
 * Transport contract for garage CRUD. Implement once for the mock environment
 * (already done), once for a real HTTP API, swap by injecting a different
 * instance into the GarageService constructor.
 */
export interface GarageTransport {
  /** Reads accept a cancellation token. HTTP transport passes it to fetch();
   *  mock honors it by aborting the simulated delay. */
  list(signal?: AbortSignal): Promise<Vehicle[]>;
  get(id: string, signal?: AbortSignal): Promise<Vehicle | null>;
  /** Mutations also accept a signal so callers CAN cancel slow uploads
   *  mid-flight, but the service layer never aborts mutations on its own —
   *  by the time `create`/`update`/etc. is in flight the server may have
   *  already committed, and silently aborting locally would mask that. */
  create(input: VehicleInput, signal?: AbortSignal): Promise<Vehicle>;
  update(id: string, patch: VehiclePatch, signal?: AbortSignal): Promise<Vehicle>;
  remove(id: string, signal?: AbortSignal): Promise<void>;
  setPrimary(id: string, signal?: AbortSignal): Promise<Vehicle[]>;
}

// ── HTTP transport ───────────────────────────────────────────────────

import { apiClient, ApiError } from '@/services/api-client';
import type {
  VehicleDrivetrain,
  VehicleFuelType,
  VehicleModel3d,
  VehicleTransmission,
} from '@/services/garage-service';
import { colorEnumToHex, colorHexToEnum } from '@/utils/vehicle-color';
import { parseVehicleGeneration } from '@/services/vehicle-images/generation';
import { parseVehicleImage, type VehicleImageState } from '@/services/vehicle-images/image-status';
import { parseIdentityStatus } from '@/services/vehicle-images/vehicle-visual';

const API_BASE = '/v1/garage';

/**
 * Backend Vehicle DTO — snake_case, nested make/model/trim/engine
 * objects, ISO timestamps, hex color, kilometers. Mirrors the shape
 * documented in `text/backend.json` exactly. We keep it private to
 * this module so the rest of the app only ever sees the canonical
 * `Vehicle` shape from `garage-service.ts`.
 */
type ServerVehicle = {
  id: string;
  user_id?: string;
  is_primary: boolean;
  nickname?: string | null;
  // `id` is null for a manual vehicle (`is_custom`): the owner's typed names.
  make: { id: string | null; name: string; logo_url?: string | null } | null;
  model: { id: string | null; name: string } | null;
  is_custom?: boolean;
  year: number;
  trim?: { id: string; name: string } | null;
  engine?: {
    id: string;
    name: string;
    displacement_cc?: number;
    fuel_type?: VehicleFuelType;
  } | null;
  transmission?: VehicleTransmission;
  drivetrain?: VehicleDrivetrain;
  color_hex?: string;
  vin?: string | null;
  license_plate?: string | null;
  registration_region_code?: string | null;
  mileage_km?: number | null;
  fuel_type?: VehicleFuelType;
  model_3d?: {
    glb_url: string;
    ktx2_textures_url: string;
    version: number;
    byte_size: number;
    checksum_sha256: string;
    tuning_variants?: Array<{ id: string; name: string; thumbnail_url: string }>;
  } | null;
  /** Phase 3E: { status: pending|approved|unavailable, url, version, reason }. */
  vehicle_image?: unknown;
  /** { status: resolved|choice_required|unresolved, source, model, options }. */
  generation?: unknown;
  /** { status: verified|unverified|needs_review|unresolved, reason, model_id, … }. */
  identity?: unknown;
  created_at: string;
  updated_at?: string;
};

type ServerVehicleCreatePayload = {
  // Optional: omitted when the client couldn't resolve a catalog id, signalling
  // the backend to decode make/model from the `vin` instead. Present for
  // UZ-market VINs (resolved client-side) and picker-based adds.
  make_id?: string;
  model_id?: string;
  /** Manual vehicle: typed names when the catalog lacks the make/model. */
  custom_make_name?: string;
  custom_model_name?: string;
  year: number;
  trim_id?: string;
  engine_id?: string;
  transmission?: VehicleTransmission;
  drivetrain?: VehicleDrivetrain;
  color_hex: string;
  vin?: string;
  license_plate?: string;
  mileage_km?: number;
  nickname?: string;
  is_primary?: boolean;
  fuel_type?: VehicleFuelType;
};

type ServerVehiclePatchPayload = Partial<ServerVehicleCreatePayload> & {
  variant_model_id?: string | null;
};

/**
 * Server → client adapter. Flattens nested make/model/trim/engine
 * back to the flat strings the UI consumes, converts ISO timestamps
 * to epoch ms, hex color to enum, kilometers stay kilometers (UZ
 * market is metric — but we surface the raw value on `mileage` so
 * formatters can label units centrally).
 *
 * Defensive against partial payloads — the backend's
 * `vehicle.updated` realtime event may ship a subset.
 */
export function toClientVehicle(raw: ServerVehicle): Vehicle {
  const addedAt = Date.parse(raw.created_at);
  return {
    id: raw.id,
    year: raw.year,
    // Optional-chain make/model — a partial payload (e.g. a `vehicle.updated`
    // realtime event, or an unresolved make_id) can ship them null.
    make: raw.make?.name ?? '',
    model: raw.model?.name ?? '',
    trim: raw.trim?.name ?? undefined,
    nickname: raw.nickname ?? undefined,
    vin: raw.vin ?? undefined,
    plate: raw.license_plate ?? undefined,
    mileage: raw.mileage_km ?? undefined,
    color: colorHexToEnum(raw.color_hex),
    isPrimary: raw.is_primary,
    addedAt: Number.isFinite(addedAt) ? addedAt : 0,
    brandId: raw.make?.id ?? '',
    modelId: raw.model?.id ?? '',
    trimId: raw.trim?.id,
    engineId: raw.engine?.id ?? undefined,
    colorHex: raw.color_hex,
    transmission: raw.transmission,
    drivetrain: raw.drivetrain,
    fuelType: raw.fuel_type ?? raw.engine?.fuel_type,
    engineDisplacementCc: raw.engine?.displacement_cc,
    brandLogoUrl: raw.make?.logo_url ?? undefined,
    registrationRegionCode: raw.registration_region_code ?? undefined,
    model3d: raw.model_3d ? mapModel3d(raw.model_3d) : undefined,
    image: parseVehicleImage(raw.vehicle_image),
    isCustom: raw.is_custom === true || undefined,
    generation: parseVehicleGeneration(raw.generation),
    identityStatus: parseIdentityStatus(raw.identity),
  };
}

/**
 * `GET /v1/garage/vehicles/:id/image` → `{ vehicle_id, vehicle_image }`: the image
 * status, refreshed by the backend from the pipeline when due. Read-only.
 */
export async function fetchVehicleImage(
  id: string,
  signal?: AbortSignal,
): Promise<VehicleImageState | undefined> {
  const raw = await apiClient.get<{ vehicle_image?: unknown }>(
    `${API_BASE}/vehicles/${encodeURIComponent(id)}/image`,
    { signal },
  );
  return parseVehicleImage(raw?.vehicle_image);
}

function mapModel3d(raw: NonNullable<ServerVehicle['model_3d']>): VehicleModel3d {
  return {
    glbUrl: raw.glb_url,
    ktx2TexturesUrl: raw.ktx2_textures_url,
    version: raw.version,
    byteSize: raw.byte_size,
    checksumSha256: raw.checksum_sha256,
    tuningVariants: raw.tuning_variants?.map((tv) => ({
      id: tv.id,
      name: tv.name,
      thumbnailUrl: tv.thumbnail_url,
    })),
  };
}

/**
 * Client → server adapter for the CREATE endpoint. Drops the legacy
 * `make`/`model` text fields if `brandId`/`modelId` are present — the
 * backend canonical record is keyed by ids, free-text would be
 * thrown away anyway. Maps the 4-value color enum to hex via
 * `colorEnumToHex` (until the UI ships a full hex picker, the enum
 * stays the source of truth on writes).
 */
export function toServerVehicleCreatePayload(
  input: VehicleInput,
): ServerVehicleCreatePayload {
  const colorHex = input.colorHex ?? colorEnumToHex(input.color);
  return {
    // Omit (send undefined, never '') when unresolved so the backend treats it
    // as "decode from VIN" rather than rejecting an empty id as mismatched.
    make_id: input.brandId || undefined,
    model_id: input.modelId || undefined,
    custom_make_name: input.customMakeName || undefined,
    custom_model_name: input.customModelName || undefined,
    year: input.year,
    trim_id: input.trimId,
    engine_id: input.engineId,
    transmission: input.transmission,
    drivetrain: input.drivetrain,
    color_hex: colorHex,
    vin: input.vin,
    license_plate: input.plate,
    mileage_km: input.mileage,
    nickname: input.nickname,
    is_primary: input.setAsPrimary,
    fuel_type: input.fuelType,
  };
}

/**
 * Client → server adapter for PATCH. Only forwards keys that the
 * client actually changed (the wire payload omits undefined so the
 * server's partial-update semantics stay honest).
 */
export function toServerVehiclePatchPayload(
  patch: VehiclePatch,
): ServerVehiclePatchPayload {
  const out: ServerVehiclePatchPayload = {};
  if (patch.brandId !== undefined) out.make_id = patch.brandId;
  if (patch.modelId !== undefined) out.model_id = patch.modelId;
  if (patch.year !== undefined) out.year = patch.year;
  if (patch.trimId !== undefined) out.trim_id = patch.trimId;
  if (patch.engineId !== undefined) out.engine_id = patch.engineId;
  if (patch.transmission !== undefined) out.transmission = patch.transmission;
  if (patch.drivetrain !== undefined) out.drivetrain = patch.drivetrain;
  if (patch.colorHex !== undefined) out.color_hex = patch.colorHex;
  else if (patch.color !== undefined) out.color_hex = colorEnumToHex(patch.color);
  if (patch.vin !== undefined) out.vin = patch.vin;
  if (patch.plate !== undefined) out.license_plate = patch.plate;
  if (patch.mileage !== undefined) out.mileage_km = patch.mileage;
  if (patch.nickname !== undefined) out.nickname = patch.nickname;
  if (patch.fuelType !== undefined) out.fuel_type = patch.fuelType;
  if (patch.variantModelId !== undefined) out.variant_model_id = patch.variantModelId;
  if (patch.customMakeName !== undefined) out.custom_make_name = patch.customMakeName;
  if (patch.customModelName !== undefined) out.custom_model_name = patch.customModelName;
  return out;
}

/**
 * Real HTTP transport. Routes every call through the unified `apiClient`
 * which handles auth/timeout/retry/401 centrally. Every read is run
 * through `toClientVehicle`; every write is rebuilt as a server
 * payload first.
 */
export class HttpGarageTransport implements GarageTransport {
  async list(signal?: AbortSignal): Promise<Vehicle[]> {
    const { vehicles } = await apiClient.get<{ vehicles?: ServerVehicle[] | null }>(
      `${API_BASE}/vehicles`,
      { signal },
    );
    // Guard: an empty garage / `{}` body must yield [] rather than crash.
    return (vehicles ?? []).map(toClientVehicle);
  }

  async get(id: string, signal?: AbortSignal): Promise<Vehicle | null> {
    try {
      // Live backend returns the vehicle DIRECTLY (not wrapped in `{ vehicle }`).
      const vehicle = await apiClient.get<ServerVehicle>(
        `${API_BASE}/vehicles/${encodeURIComponent(id)}`,
        { signal },
      );
      return toClientVehicle(vehicle);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async create(input: VehicleInput, signal?: AbortSignal): Promise<Vehicle> {
    const payload = toServerVehicleCreatePayload(input);
    // POST returns the created vehicle DIRECTLY (201, not wrapped).
    const vehicle = await apiClient.post<ServerVehicle>(
      `${API_BASE}/vehicles`,
      payload,
      { signal },
    );
    return toClientVehicle(vehicle);
  }

  async update(id: string, patch: VehiclePatch, signal?: AbortSignal): Promise<Vehicle> {
    const payload = toServerVehiclePatchPayload(patch);
    // PATCH returns the updated vehicle DIRECTLY (not wrapped).
    const vehicle = await apiClient.patch<ServerVehicle>(
      `${API_BASE}/vehicles/${encodeURIComponent(id)}`,
      payload,
      { signal },
    );
    return toClientVehicle(vehicle);
  }

  async remove(id: string, signal?: AbortSignal): Promise<void> {
    await apiClient.delete(`${API_BASE}/vehicles/${encodeURIComponent(id)}`, { signal });
  }

  async setPrimary(id: string, signal?: AbortSignal): Promise<Vehicle[]> {
    // Primary is set via a PATCH `{ is_primary: true }` — the real backend has
    // no dedicated `/set-primary` route. It returns only the single updated
    // vehicle, so re-fetch the whole list afterwards to reflect the new primary
    // (and the previously-primary vehicle being demoted) across the garage.
    await apiClient.patch<ServerVehicle>(
      `${API_BASE}/vehicles/${encodeURIComponent(id)}`,
      { is_primary: true },
      { signal },
    );
    return this.list(signal);
  }
}
