import { shouldUseHttpTransport } from '@/config/api';
import {
  HttpGarageTransport,
  MockGarageTransport,
  type GarageTransport,
} from '@/services/garage-api';

// ── Types (stable API for callers) ───────────────────────────────────

export type VehicleColor = 'midnight' | 'graphite' | 'pearl' | 'matte';

/** Drivetrain configuration. Mirrors backend's `drivetrain` enum on
 *  the garage Vehicle DTO. Optional today (older vehicles created
 *  before this field shipped won't have it). */
export type VehicleDrivetrain = 'fwd' | 'rwd' | 'awd' | '4wd';

/** Transmission type. Subset of the UZ-catalog `TransmissionType` —
 *  kept here as a separate alias so the garage DTO stays
 *  self-contained and the catalog isn't a load-bearing dependency for
 *  every Vehicle consumer. */
export type VehicleTransmission = 'manual' | 'automatic' | 'cvt' | 'dct' | 'amt';

/** Fuel type. Required by the parts-search compatibility engine on
 *  the backend (different fuel = different intake / exhaust parts). */
export type VehicleFuelType = 'petrol' | 'diesel' | 'hybrid' | 'phev' | 'ev' | 'cng' | 'lpg';

/** 3D model payload — backend ships a GLB + KTX2 texture archive per
 *  vehicle so the detail screen can render an interactive walkaround.
 *  Optional because (a) the model layer isn't built yet on this app
 *  and (b) older vehicles in the catalog don't have a 3D asset. */
export type VehicleModel3d = {
  glbUrl: string;
  ktx2TexturesUrl: string;
  version: number;
  byteSize: number;
  checksumSha256: string;
  tuningVariants?: Array<{ id: string; name: string; thumbnailUrl: string }>;
};

/**
 * Live status broadcast by an external mechanic's dashboard via the
 * realtime channel. Drives the animated cell on the Vehicle Detail
 * screen — null/undefined means "no active job", any other value
 * means a mechanic has reported on this vehicle in the last few hours.
 */
export type VehicleLiveStatus = {
  /** Coarse stage of work — drives the cell's color tint. */
  stage: 'queued' | 'in_progress' | 'awaiting_parts' | 'ready' | 'flagged';
  /** Short label shown in the stats cell (e.g. "Diagnosing", "Brake
   *  pads ordered", "Test drive"). Backend-localized. */
  label: string;
  /** Free-form note from the mechanic, surfaced as the cell's
   *  subtitle when present. */
  note?: string;
  /** Mechanic's display name — surfaced in the detail screen header
   *  as the source of the live update. */
  mechanic?: string;
  /** ISO timestamp the status was emitted. UI shows "5m ago" etc. */
  emittedAt?: string;
};

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
   *  Cards prefer `images[0]`; when missing or empty, they show a car
   *  placeholder icon (no mock/stock image). */
  images?: string[];
  /** Fitment ids from the UZ catalog (`services/uz-vehicle-catalog.ts`).
   *  Optional during the migration — older vehicles created before the
   *  catalog rollout only have the free-text `make`/`model` fields.
   *  Parts-search uses these when present for exact OEM scope; falls
   *  back to text-match resolution otherwise. */
  brandId?: string;
  modelId?: string;
  generationId?: string;
  trimId?: string;
  engineId?: string;
  /** Live mechanic-dashboard status (see VehicleLiveStatus). Populated
   *  exclusively by the realtime channel — never persisted server-side
   *  on the Vehicle record itself, so a refetch always clears it
   *  unless the channel re-emits. */
  liveStatus?: VehicleLiveStatus;
  // ── Backend-aligned optional fields (UZ market) ────────────────────
  /** Backend's truthful color value (`#1F2A37`). The legacy `color`
   *  enum is derived from this via nearest-match for surfaces that
   *  haven't migrated to picking from a full hex picker yet. */
  colorHex?: string;
  transmission?: VehicleTransmission;
  drivetrain?: VehicleDrivetrain;
  fuelType?: VehicleFuelType;
  /** Engine displacement in cc, copied from backend's
   *  `engine.displacement_cc`. Used by the parts-search compatibility
   *  engine alongside `engineId`. */
  engineDisplacementCc?: number;
  /** Brand logo URL (CDN). Comes from backend's `make.logo_url` —
   *  rendered on the primary-vehicle card and the action-row. */
  brandLogoUrl?: string;
  /** UZ registration region prefix from the plate (e.g. `01`
   *  Toshkent). Useful for delivery-region defaults in the parts
   *  catalog. Server-derived from `license_plate`; clients should NOT
   *  set it on create — backend will fill. */
  registrationRegionCode?: string;
  /** 3D model + textures + tuning variants for the detail-screen
   *  walkaround. Optional — only populated for vehicles the backend
   *  has a CAD asset for. */
  model3d?: VehicleModel3d;
};

export type VehicleInput = Omit<Vehicle, 'id' | 'isPrimary' | 'addedAt'> & {
  setAsPrimary?: boolean;
};

export type VehiclePatch = Partial<Omit<Vehicle, 'id' | 'addedAt'>>;

// ── Realtime contract ────────────────────────────────────────────────
//
// Same shape as `CatalogSocketEvent` so a single shared
// socket-subscription module can dispatch events to all
// services without per-domain wiring. No client-side subscriber
// is built yet — these types document the backend contract so the
// realtime channel can be added in a single follow-up phase.

export type GarageSocketEvent = {
  event:
    | 'garage.snapshot'
    | 'garage.vehicle.created'
    | 'garage.vehicle.updated'
    | 'garage.vehicle.deleted'
    | 'garage.primary.changed'
    /** Mechanic-broadcast live status change. Carries `vehicleId` and
     *  `status`; the client applies it to the cache WITHOUT a refetch,
     *  so the stats panel animates immediately. */
    | 'garage.vehicle.status.updated';
  /** Server-issued snapshot version. Lets late subscribers reconcile
   *  with the latest cache without re-fetching the full list. */
  snapshotVersion: string;
  timestamp: string;
  vehicle?: Vehicle;
  vehicleId?: string;
  /** Carried by `garage.vehicle.status.updated`. */
  status?: VehicleLiveStatus | null;
};

export const GARAGE_SOCKET_CHANNEL = 'garage:vehicles';
export const GARAGE_SOCKET_EVENTS: GarageSocketEvent['event'][] = [
  'garage.snapshot',
  'garage.vehicle.created',
  'garage.vehicle.updated',
  'garage.vehicle.deleted',
  'garage.primary.changed',
  'garage.vehicle.status.updated',
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
  private sessionEpoch = 0;
  private ownerId: string | null | undefined;

  setSession(ownerId: string | null): void {
    if (this.ownerId === ownerId) return;
    this.ownerId = ownerId;
    this.reset();
  }

  isSession(ownerId: string | null): boolean { return this.ownerId === ownerId; }
  sessionVersion(): number { return this.sessionEpoch; }

  private assertSession(epoch: number): void {
    if (epoch !== this.sessionEpoch) throw new DOMException('Garage session changed', 'AbortError');
  }

  constructor(transport: GarageTransport) {
    this.transport = transport;
  }

  /** Replace the transport at runtime (e.g. switching from mock to real API after login). */
  setTransport(transport: GarageTransport): void {
    this.transport = transport;
    this.hasLoaded = false;
  }

  /**
   * Drop all cached vehicles and forget we ever loaded. Called on sign-out so
   * the next user (or a guest) never sees the previous account's garage, and so
   * the following sign-in always triggers a fresh `refresh()` instead of
   * short-circuiting on a stale `hasLoaded`. Bumps `refreshSeq` so any in-flight
   * read from the signed-out session is discarded when it resolves.
   */
  reset(): void {
    this.sessionEpoch++;
    this.refreshSeq++;
    this.vehicles = [];
    this.hasLoaded = false;
    this.emit();
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
    const epoch = this.sessionEpoch;
    const created = await this.transport.create(input, signal);
    this.assertSession(epoch);
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
    const epoch = this.sessionEpoch;
    const updated = await this.transport.update(id, patch, signal);
    this.assertSession(epoch);
    this.vehicles = this.vehicles.map((v) => (v.id === id ? updated : v));
    this.emit();
    return updated;
  }

  async removeVehicle(id: string, signal?: AbortSignal): Promise<void> {
    const epoch = this.sessionEpoch;
    await this.transport.remove(id, signal);
    this.assertSession(epoch);
    await this.refresh(signal);
  }

  async setPrimary(id: string, signal?: AbortSignal): Promise<void> {
    const epoch = this.sessionEpoch;
    const seq = ++this.refreshSeq;
    const nextList = await this.transport.setPrimary(id, signal);
    this.assertSession(epoch);
    if (seq !== this.refreshSeq) throw new DOMException('Stale primary change superseded', 'AbortError');
    this.vehicles = nextList;
    this.emit();
  }

  /**
   * Apply a single realtime event to the in-memory cache and broadcast
   * to subscribers — NO network call. Lets the WebSocket consumer
   * (`hooks/use-garage-realtime.ts`) deliver mechanic-dashboard updates
   * to the UI in <50ms without paying for a list refetch.
   *
   * Snapshot events trigger a refetch (server tells us "your cache is
   * stale, refresh"), everything else is applied locally.
   */
  applyRealtimeEvent(event: GarageSocketEvent): void {
    switch (event.event) {
      case 'garage.snapshot': {
        // Snapshot means our cache version disagrees with the server's
        // — fastest reconciliation is to refetch.
        void this.refresh().catch(() => {});
        return;
      }
      case 'garage.vehicle.created': {
        if (!event.vehicle) return;
        if (this.vehicles.some((v) => v.id === event.vehicle!.id)) return;
        this.vehicles = [event.vehicle, ...this.vehicles];
        this.emit();
        return;
      }
      case 'garage.vehicle.updated': {
        if (!event.vehicle) return;
        const v = event.vehicle;
        this.vehicles = this.vehicles.map((curr) =>
          curr.id === v.id ? { ...curr, ...v } : curr,
        );
        this.emit();
        return;
      }
      case 'garage.vehicle.deleted': {
        if (!event.vehicleId) return;
        this.vehicles = this.vehicles.filter((v) => v.id !== event.vehicleId);
        this.emit();
        return;
      }
      case 'garage.primary.changed': {
        if (!event.vehicleId) return;
        const targetId = event.vehicleId;
        this.vehicles = this.vehicles.map((v) => ({ ...v, isPrimary: v.id === targetId }));
        this.emit();
        return;
      }
      case 'garage.vehicle.status.updated': {
        if (!event.vehicleId) return;
        const targetId = event.vehicleId;
        // `null` is meaningful — clears the live status. Distinguish
        // it from `undefined` (no status field on the event payload
        // at all, which we treat as a no-op).
        const next = event.status === undefined ? undefined : event.status ?? undefined;
        if (next === undefined && event.status !== null) return;
        this.vehicles = this.vehicles.map((v) =>
          v.id === targetId ? { ...v, liveStatus: next } : v,
        );
        this.emit();
        return;
      }
    }
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
  return shouldUseHttpTransport('garage') ? new HttpGarageTransport() : new MockGarageTransport();
}

export const garageService = new GarageService(createGarageTransport());

export default garageService;
