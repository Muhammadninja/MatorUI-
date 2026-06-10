import { shouldUseHttpTransport } from '@/config/api';
import {
  HttpGarageTransport,
  MockGarageTransport,
  type GarageTransport,
} from '@/services/garage-api';

// ── Types (stable API for callers) ───────────────────────────────────

export type VehicleColor = 'midnight' | 'graphite' | 'pearl' | 'matte';

export type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  nickname?: string;
  vin?: string;
  plate?: string;
  mileage?: number;
  color: VehicleColor;
  isPrimary: boolean;
  addedAt: number;
  /** Optional vehicle photo URLs (user-uploaded or VIN-decoded stock).
   *  Cards prefer `images[0]`; when missing or empty, fall back to the
   *  seeded Picsum placeholder so the dev surface still gets variety. */
  images?: string[];
};

export type VehicleInput = Omit<Vehicle, 'id' | 'isPrimary' | 'addedAt'> & {
  setAsPrimary?: boolean;
};

export type VehiclePatch = Partial<Omit<Vehicle, 'id' | 'addedAt'>>;

// ── Realtime contract ────────────────────────────────────────────────
//
// Same shape as `CatalogSocketEvent` / `TopFeaturedSocketEvent` so a
// single shared socket-subscription module can dispatch events to all
// three services without per-domain wiring. No client-side subscriber
// is built yet — these types document the backend contract so the
// realtime channel can be added in a single follow-up phase.

export type GarageSocketEvent = {
  event:
    | 'garage.snapshot'
    | 'garage.vehicle.created'
    | 'garage.vehicle.updated'
    | 'garage.vehicle.deleted'
    | 'garage.primary.changed';
  /** Server-issued snapshot version. Lets late subscribers reconcile
   *  with the latest cache without re-fetching the full list. */
  snapshotVersion: string;
  timestamp: string;
  vehicle?: Vehicle;
  vehicleId?: string;
};

export const GARAGE_SOCKET_CHANNEL = 'garage:vehicles';
export const GARAGE_SOCKET_EVENTS: GarageSocketEvent['event'][] = [
  'garage.snapshot',
  'garage.vehicle.created',
  'garage.vehicle.updated',
  'garage.vehicle.deleted',
  'garage.primary.changed',
];

type GarageListener = (vehicles: Vehicle[]) => void;

// ── Service ──────────────────────────────────────────────────────────

/**
 * Stateful client-side cache + subscription bus. All writes go through
 * the transport (mock or HTTP); responses are merged into the cache and
 * broadcast to subscribers. Reads can come from cache (sync) for render
 * paths that already mounted with data, or via `refresh()` to re-fetch.
 */
class GarageService {
  private transport: GarageTransport;
  private vehicles: Vehicle[] = [];
  private listeners = new Set<GarageListener>();
  private hasLoaded = false;
  /** Monotonic seq stamped on every `refresh()` / `removeVehicle()` /
   *  `setPrimary()` issuance. Used to drop responses that resolve AFTER
   *  a newer request has already started. Without this guard, a slow
   *  refresh that lands after a fast mutation would revert the fresh
   *  cache to the stale snapshot. */
  private refreshSeq = 0;

  constructor(transport: GarageTransport) {
    this.transport = transport;
  }

  /** Replace the transport at runtime (e.g. switching from mock to real API after login). */
  setTransport(transport: GarageTransport): void {
    this.transport = transport;
    this.hasLoaded = false;
  }

  // ── Sync cache reads (no network) ──────────────────────────────────

  getVehicles(): Vehicle[] {
    return this.vehicles;
  }

  getById(id: string): Vehicle | undefined {
    return this.vehicles.find((v) => v.id === id);
  }

  getPrimary(): Vehicle | undefined {
    return this.vehicles.find((v) => v.isPrimary) ?? this.vehicles[0];
  }

  hasLoadedOnce(): boolean {
    return this.hasLoaded;
  }

  // ── Subscriptions ──────────────────────────────────────────────────

  subscribe(listener: GarageListener): () => void {
    this.listeners.add(listener);
    listener(this.vehicles);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ── Async mutations ────────────────────────────────────────────────

  /**
   * Fetch the full vehicle list and replace the cache. Late arrivals
   * (a slow response that resolves after a newer request has already
   * started) are dropped via the seq guard — they neither overwrite the
   * cache nor fire emit(). Callers see the dropped response as a thrown
   * AbortError (so hook abort/error paths handle it uniformly).
   */
  async refresh(signal?: AbortSignal): Promise<Vehicle[]> {
    const seq = ++this.refreshSeq;
    const fresh = await this.transport.list(signal);
    if (seq !== this.refreshSeq) {
      throw new DOMException('Stale refresh superseded', 'AbortError');
    }
    this.vehicles = fresh;
    this.hasLoaded = true;
    this.emit();
    return fresh;
  }

  async addVehicle(input: VehicleInput, signal?: AbortSignal): Promise<Vehicle> {
    const created = await this.transport.create(input, signal);
    // Server is the source of truth for isPrimary semantics; refresh the list.
    // Internal refresh inherits the same signal — if the consumer unmounts
    // while the post-create refresh is in flight, we drop the cache update
    // rather than fight the next mount's first refresh.
    await this.refresh(signal);
    return created;
  }

  async updateVehicle(
    id: string,
    patch: VehiclePatch,
    signal?: AbortSignal,
  ): Promise<Vehicle> {
    const updated = await this.transport.update(id, patch, signal);
    this.vehicles = this.vehicles.map((v) => (v.id === id ? updated : v));
    this.emit();
    return updated;
  }

  async removeVehicle(id: string, signal?: AbortSignal): Promise<void> {
    await this.transport.remove(id, signal);
    await this.refresh(signal);
  }

  async setPrimary(id: string, signal?: AbortSignal): Promise<void> {
    const nextList = await this.transport.setPrimary(id, signal);
    this.vehicles = nextList;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.vehicles;
    this.listeners.forEach((l) => l(snapshot));
  }
}

// ── Singleton wired to the env-selected transport ────────────────────
//
// Picks HTTP when `EXPO_PUBLIC_API_BASE_URL` is set (production / staging),
// falls back to the in-process mock when not (dev / tests with no
// backend). The selector is module-scope so the choice is fixed at load
// time — `setTransport()` on the service still lets us swap at runtime
// (e.g. for a "switch to mock" debug toggle).

function createGarageTransport(): GarageTransport {
  return shouldUseHttpTransport() ? new HttpGarageTransport() : new MockGarageTransport();
}

export const garageService = new GarageService(createGarageTransport());

export default garageService;
