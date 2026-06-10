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

// ── Mock transport ───────────────────────────────────────────────────

const SEED_VEHICLES: Vehicle[] = [
  {
    id: 'v_seed_wrx',
    year: 2020,
    make: 'Subaru',
    model: 'WRX',
    trim: 'STI Limited',
    nickname: 'Weekend rocket',
    plate: '8YJK129',
    mileage: 42180,
    color: 'midnight',
    isPrimary: true,
    addedAt: 1_700_000_000_000,
  },
  {
    id: 'v_seed_4runner',
    year: 2022,
    make: 'Toyota',
    model: '4Runner',
    trim: 'TRD Pro',
    nickname: 'Trail truck',
    plate: 'TRD4RNR',
    mileage: 18540,
    color: 'graphite',
    isPrimary: false,
    addedAt: 1_705_000_000_000,
  },
];

/** Simulated network latency in ms. Tuned so the loading state in the
 *  hook is visually testable without making dev painful. Set to 0 for
 *  synchronous-ish mocks in unit tests. */
const MOCK_LATENCY_MS = 250;

/** Delay that respects an AbortSignal. Mirrors the catalog + top-featured
 *  delay() helpers — same shape so abort behavior is identical across
 *  every mock transport in the app. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function makeId(): string {
  const random = Math.floor(Math.random() * 1_000_000).toString(36);
  return `v_${Date.now().toString(36)}_${random}`;
}

export class MockGarageTransport implements GarageTransport {
  private vehicles: Vehicle[];

  constructor(seed: Vehicle[] = SEED_VEHICLES) {
    this.vehicles = [...seed];
  }

  async list(signal?: AbortSignal): Promise<Vehicle[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return [...this.vehicles];
  }

  async get(id: string, signal?: AbortSignal): Promise<Vehicle | null> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.vehicles.find((v) => v.id === id) ?? null;
  }

  async create(input: VehicleInput, signal?: AbortSignal): Promise<Vehicle> {
    await delay(MOCK_LATENCY_MS, signal);
    const shouldBePrimary = input.setAsPrimary || this.vehicles.length === 0;
    const created: Vehicle = {
      id: makeId(),
      year: input.year,
      make: input.make,
      model: input.model,
      trim: input.trim,
      nickname: input.nickname,
      vin: input.vin,
      plate: input.plate,
      mileage: input.mileage,
      color: input.color,
      isPrimary: shouldBePrimary,
      addedAt: Date.now(),
    };
    this.vehicles = shouldBePrimary
      ? [created, ...this.vehicles.map((v) => ({ ...v, isPrimary: false }))]
      : [...this.vehicles, created];
    return created;
  }

  async update(id: string, patch: VehiclePatch, signal?: AbortSignal): Promise<Vehicle> {
    await delay(MOCK_LATENCY_MS, signal);
    let updated: Vehicle | undefined;
    this.vehicles = this.vehicles.map((v) => {
      if (v.id !== id) return v;
      updated = { ...v, ...patch, id: v.id, addedAt: v.addedAt };
      return updated;
    });
    if (!updated) throw new Error(`Vehicle ${id} not found`);
    return updated;
  }

  async remove(id: string, signal?: AbortSignal): Promise<void> {
    await delay(MOCK_LATENCY_MS, signal);
    const wasPrimary = this.vehicles.find((v) => v.id === id)?.isPrimary ?? false;
    this.vehicles = this.vehicles.filter((v) => v.id !== id);
    if (wasPrimary && this.vehicles.length > 0) {
      this.vehicles = this.vehicles.map((v, i) => ({ ...v, isPrimary: i === 0 }));
    }
  }

  async setPrimary(id: string, signal?: AbortSignal): Promise<Vehicle[]> {
    await delay(MOCK_LATENCY_MS, signal);
    if (!this.vehicles.some((v) => v.id === id)) {
      throw new Error(`Vehicle ${id} not found`);
    }
    this.vehicles = this.vehicles
      .map((v) => ({ ...v, isPrimary: v.id === id }))
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
    return [...this.vehicles];
  }
}

// ── HTTP transport ───────────────────────────────────────────────────

import { apiClient, ApiError } from '@/services/api-client';

/**
 * Real HTTP transport. Routes every call through the unified `apiClient`
 * which handles auth/timeout/retry/401 centrally.
 */
export class HttpGarageTransport implements GarageTransport {
  async list(signal?: AbortSignal): Promise<Vehicle[]> {
    const { vehicles } = await apiClient.get<{ vehicles: Vehicle[] }>(
      '/garage/vehicles',
      { signal },
    );
    return vehicles;
  }

  async get(id: string, signal?: AbortSignal): Promise<Vehicle | null> {
    try {
      const { vehicle } = await apiClient.get<{ vehicle: Vehicle }>(
        `/garage/vehicles/${id}`,
        { signal },
      );
      return vehicle;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async create(input: VehicleInput, signal?: AbortSignal): Promise<Vehicle> {
    const { vehicle } = await apiClient.post<{ vehicle: Vehicle }>(
      '/garage/vehicles',
      input,
      { signal },
    );
    return vehicle;
  }

  async update(id: string, patch: VehiclePatch, signal?: AbortSignal): Promise<Vehicle> {
    const { vehicle } = await apiClient.patch<{ vehicle: Vehicle }>(
      `/garage/vehicles/${id}`,
      patch,
      { signal },
    );
    return vehicle;
  }

  async remove(id: string, signal?: AbortSignal): Promise<void> {
    await apiClient.delete(`/garage/vehicles/${id}`, { signal });
  }

  async setPrimary(id: string, signal?: AbortSignal): Promise<Vehicle[]> {
    const { vehicles } = await apiClient.post<{ vehicles: Vehicle[] }>(
      `/garage/vehicles/${id}/set-primary`,
      undefined,
      { signal },
    );
    return vehicles;
  }
}
