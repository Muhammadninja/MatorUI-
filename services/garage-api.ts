import type { Vehicle, VehicleInput, VehiclePatch } from '@/services/garage-service';

/**
 * Transport contract for garage CRUD. Implement once for the mock environment
 * (already done), once for a real HTTP API, swap by injecting a different
 * instance into the GarageService constructor.
 */
export interface GarageTransport {
  list(): Promise<Vehicle[]>;
  get(id: string): Promise<Vehicle | null>;
  create(input: VehicleInput): Promise<Vehicle>;
  update(id: string, patch: VehiclePatch): Promise<Vehicle>;
  remove(id: string): Promise<void>;
  setPrimary(id: string): Promise<Vehicle[]>;
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

/** Simulated network latency in ms. Set to 0 to make mocks resolve synchronously-ish. */
const MOCK_LATENCY_MS = 0;

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  async list(): Promise<Vehicle[]> {
    await delay(MOCK_LATENCY_MS);
    return [...this.vehicles];
  }

  async get(id: string): Promise<Vehicle | null> {
    await delay(MOCK_LATENCY_MS);
    return this.vehicles.find((v) => v.id === id) ?? null;
  }

  async create(input: VehicleInput): Promise<Vehicle> {
    await delay(MOCK_LATENCY_MS);
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

  async update(id: string, patch: VehiclePatch): Promise<Vehicle> {
    await delay(MOCK_LATENCY_MS);
    let updated: Vehicle | undefined;
    this.vehicles = this.vehicles.map((v) => {
      if (v.id !== id) return v;
      updated = { ...v, ...patch, id: v.id, addedAt: v.addedAt };
      return updated;
    });
    if (!updated) throw new Error(`Vehicle ${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const wasPrimary = this.vehicles.find((v) => v.id === id)?.isPrimary ?? false;
    this.vehicles = this.vehicles.filter((v) => v.id !== id);
    if (wasPrimary && this.vehicles.length > 0) {
      this.vehicles = this.vehicles.map((v, i) => ({ ...v, isPrimary: i === 0 }));
    }
  }

  async setPrimary(id: string): Promise<Vehicle[]> {
    await delay(MOCK_LATENCY_MS);
    if (!this.vehicles.some((v) => v.id === id)) {
      throw new Error(`Vehicle ${id} not found`);
    }
    this.vehicles = this.vehicles
      .map((v) => ({ ...v, isPrimary: v.id === id }))
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
    return [...this.vehicles];
  }
}

// ── HTTP transport (stub for backend wiring) ─────────────────────────

/**
 * Drop-in HTTP transport. Uncomment + plug in the auth header strategy
 * (`Authorization: Bearer <token>` from the auth context) and the API
 * base URL via env (e.g. EXPO_PUBLIC_API_BASE_URL). Then swap the
 * MockGarageTransport for HttpGarageTransport in services/garage-service.ts.
 */
// export class HttpGarageTransport implements GarageTransport {
//   constructor(private baseUrl: string, private getAuthToken: () => Promise<string | null>) {}
//
//   private async request<T>(path: string, init?: RequestInit): Promise<T> {
//     const token = await this.getAuthToken();
//     const res = await fetch(`${this.baseUrl}${path}`, {
//       ...init,
//       headers: {
//         'Content-Type': 'application/json',
//         ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         ...init?.headers,
//       },
//     });
//     if (!res.ok) {
//       const message = await res.text().catch(() => res.statusText);
//       throw new Error(`Garage API ${res.status}: ${message}`);
//     }
//     if (res.status === 204) return undefined as T;
//     return res.json() as Promise<T>;
//   }
//
//   async list() {
//     const data = await this.request<{ vehicles: Vehicle[] }>('/garage/vehicles');
//     return data.vehicles;
//   }
//
//   async get(id: string) {
//     try {
//       const data = await this.request<{ vehicle: Vehicle }>(`/garage/vehicles/${id}`);
//       return data.vehicle;
//     } catch (e) {
//       if (e instanceof Error && e.message.startsWith('Garage API 404')) return null;
//       throw e;
//     }
//   }
//
//   async create(input: VehicleInput) {
//     const data = await this.request<{ vehicle: Vehicle }>('/garage/vehicles', {
//       method: 'POST',
//       body: JSON.stringify(input),
//     });
//     return data.vehicle;
//   }
//
//   async update(id: string, patch: VehiclePatch) {
//     const data = await this.request<{ vehicle: Vehicle }>(`/garage/vehicles/${id}`, {
//       method: 'PATCH',
//       body: JSON.stringify(patch),
//     });
//     return data.vehicle;
//   }
//
//   async remove(id: string) {
//     await this.request<void>(`/garage/vehicles/${id}`, { method: 'DELETE' });
//   }
//
//   async setPrimary(id: string) {
//     const data = await this.request<{ vehicles: Vehicle[] }>(
//       `/garage/vehicles/${id}/set-primary`,
//       { method: 'POST' },
//     );
//     return data.vehicles;
//   }
// }
