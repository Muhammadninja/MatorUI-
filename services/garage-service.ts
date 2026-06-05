import { MockGarageTransport, type GarageTransport } from '@/services/garage-api';

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
};

export type VehicleInput = Omit<Vehicle, 'id' | 'isPrimary' | 'addedAt'> & {
  setAsPrimary?: boolean;
};

export type VehiclePatch = Partial<Omit<Vehicle, 'id' | 'addedAt'>>;

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

  /** Fetch the full vehicle list from the transport and replace the cache. */
  async refresh(): Promise<Vehicle[]> {
    const fresh = await this.transport.list();
    this.vehicles = fresh;
    this.hasLoaded = true;
    this.emit();
    return fresh;
  }

  async addVehicle(input: VehicleInput): Promise<Vehicle> {
    const created = await this.transport.create(input);
    // Server is the source of truth for isPrimary semantics; refresh the list.
    await this.refresh();
    return created;
  }

  async updateVehicle(id: string, patch: VehiclePatch): Promise<Vehicle> {
    const updated = await this.transport.update(id, patch);
    this.vehicles = this.vehicles.map((v) => (v.id === id ? updated : v));
    this.emit();
    return updated;
  }

  async removeVehicle(id: string): Promise<void> {
    await this.transport.remove(id);
    await this.refresh();
  }

  async setPrimary(id: string): Promise<void> {
    const nextList = await this.transport.setPrimary(id);
    this.vehicles = nextList;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.vehicles;
    this.listeners.forEach((l) => l(snapshot));
  }
}

// ── Singleton wired to the mock transport ────────────────────────────
// Swap the constructor argument for HttpGarageTransport(...) when ready
// to integrate the real API (see services/garage-api.ts).

export const garageService = new GarageService(new MockGarageTransport());

export default garageService;
