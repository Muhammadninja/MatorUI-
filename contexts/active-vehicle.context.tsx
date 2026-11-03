import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  clearActiveVehicle,
  loadActiveVehicle,
  saveActiveVehicle,
  type ActiveVehicleSnapshot,
} from '@/services/active-vehicle-storage';
import { garageService, type Vehicle } from '@/services/garage-service';
import { useUserContext } from '@/contexts/user.context';
import {
  buildSearchVehicleContext,
  getModel,
  resolveFitmentFromText,
  type VehicleFitment,
} from '@/services/uz-vehicle-catalog';

/**
 * Provides the app-wide "currently active vehicle" — the one parts-
 * search scopes to. The reactive primitive other surfaces subscribe
 * to; concretely:
 *
 *   - Garage primary-toggle calls `setPrimaryVehicle(id)` → context
 *     updates → AsyncStorage persists → `useSearchVehicleContext()`
 *     re-renders downstream → next search request carries the new
 *     fitment.
 *   - Cold start: provider hydrates from AsyncStorage immediately so
 *     the first explore-screen render already has scope context.
 *   - Garage subscribes via `garageService.subscribe(...)` so if the
 *     primary is changed from the realtime channel (a different
 *     device flipped it), the active vehicle stays in sync without
 *     manual wiring at the call site.
 *
 * Pure React Context (no Zustand) — avoids adding a dep, integrates
 * with existing provider stack in `app/_layout.tsx` cleanly, and gives
 * us the snapshot consistency React Concurrent Mode expects.
 */

export type ActiveVehicle = {
  vehicleId: string;
  fitment: VehicleFitment;
  /** The full Vehicle row when the garage list is loaded; undefined
   *  while the garage is still cold (provider only knows the persisted
   *  fitment ids in that window). */
  vehicle?: Vehicle;
};

export type ActiveVehicleContextValue = {
  /** `null` when the user has no vehicles yet OR the storage snapshot
   *  hasn't loaded yet. Consumers MUST handle both cases. */
  currentActiveVehicle: ActiveVehicle | null;
  /** True until the first AsyncStorage hydration completes. Lets the
   *  consumer skip rendering with `undefined` scope on first paint. */
  isHydrating: boolean;
  /**
   * Flip the primary vehicle. Updates both the in-memory state AND
   * the garage backend (via `garageService.setPrimary`). When the
   * caller already knows they're in a no-network context (offline
   * banner, etc.) they can opt out of the backend call by passing
   * `{ skipBackend: true }`.
   */
  setPrimaryVehicle: (id: string, opts?: { skipBackend?: boolean }) => Promise<void>;
  /**
   * Override the fitment beyond what the garage row implies — e.g.
   * the user picked "Cobalt Position 2 Premier Turbo" via cascading
   * selects but the persisted Vehicle only has `make: "Chevrolet",
   * model: "Cobalt"`. Doesn't touch the backend.
   */
  setFitment: (fitment: Partial<VehicleFitment>) => void;
  /** Drop the active vehicle entirely — used on sign-out and on
   *  garage-empty transitions. */
  clearActive: () => Promise<void>;
};

const ActiveVehicleContext = createContext<ActiveVehicleContextValue | undefined>(undefined);

export function ActiveVehicleProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState<ActiveVehicle | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const { profile, isAuthenticated, isHydrating: authHydrating } = useUserContext();
  const ownerId = isAuthenticated ? profile?.id ?? null : null;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const epochRef = useRef(0);
  const activeOwnerRef = useRef<string | null | undefined>(undefined);
  const previousOwnerRef = useRef<string | null | undefined>(undefined);
  const persistenceRef = useRef<Promise<unknown>>(Promise.resolve());
  const persist = useCallback((write: () => Promise<void>) => {
    const next = persistenceRef.current.then(write, write);
    persistenceRef.current = next.catch(() => undefined);
    return next;
  }, []);

  // Account changes invalidate hydration, pending pin changes and disk writes.
  useEffect(() => {
    if (authHydrating) return;
    let cancelled = false;
    const epoch = ++epochRef.current;
    const changed = previousOwnerRef.current !== undefined && previousOwnerRef.current !== ownerId;
    previousOwnerRef.current = ownerId;
    activeOwnerRef.current = ownerId;
    setActive(null);
    setIsHydrating(true);
    garageService.setSession(ownerId);
    void (async () => {
      if (changed || ownerId === null) await persist(clearActiveVehicle);
      const snapshot = ownerId === null ? null : await loadActiveVehicle();
      if (cancelled || epoch !== epochRef.current || ownerRef.current !== ownerId) return;
      if (snapshot && snapshot.ownerId === ownerId) {
        setActive({
          vehicleId: snapshot.vehicleId,
          fitment: snapshot.fitment,
          // `vehicle` stays undefined until the garage subscription
          // wires up below — consumers that need the full row should
          // gate on `vehicle` being defined.
        });
      }
      setIsHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId, authHydrating, persist]);

  // Step 2: subscribe to the garage cache. Whenever the list of
  // vehicles changes — initial load, primary flip from realtime,
  // local mutation — re-derive the active vehicle from the primary
  // (or from the persisted vehicleId if it still exists in the list).
  useEffect(() => {
    const unsubscribe = garageService.subscribe((vehicles) => {
      if (authHydrating || ownerId === null || ownerRef.current !== ownerId) return;
      activeOwnerRef.current = ownerId;
      setActive((curr) => {
        const persistedHit = curr ? vehicles.find((v) => v.id === curr.vehicleId) : undefined;
        const primary = vehicles.find((v) => v.isPrimary) ?? vehicles[0];
        // Prefer the persisted choice when it's still in the list —
        // primary changes here only "win" if our pinned vehicle was
        // removed.
        const target = persistedHit ?? primary;
        if (!target) {
          return null;
        }
        const fitment = deriveFitment(target, persistedHit ? curr?.fitment : undefined);
        return { vehicleId: target.id, fitment, vehicle: target };
      });
    });
    return unsubscribe;
  }, [ownerId, authHydrating]);

  const setPrimaryVehicle = useCallback<ActiveVehicleContextValue['setPrimaryVehicle']>(
    async (id, opts) => {
      if (authHydrating || ownerId === null || ownerRef.current !== ownerId) return;
      const vehicle = garageService.getById(id);
      if (!vehicle) return;
      const epoch = ++epochRef.current;
      setIsHydrating(false);
      const fitment = deriveFitment(vehicle);
      const snapshot: ActiveVehicleSnapshot = {
        ownerId,
        vehicleId: id,
        fitment,
        savedAt: Date.now(),
      };
      setActive({ vehicleId: id, fitment, vehicle });
      activeOwnerRef.current = ownerId;
      await persist(async () => {
        if (epoch === epochRef.current && ownerRef.current === ownerId) await saveActiveVehicle(snapshot);
      });
      if (epoch !== epochRef.current || ownerRef.current !== ownerId) return;
      if (!opts?.skipBackend && !vehicle.isPrimary) {
        try {
          await garageService.setPrimary(id);
        } catch {
          // The optimistic local update stays — the next refetch
          // will reconcile if the server rejected the flip.
        }
      }
    },
    [ownerId, authHydrating, persist],
  );

  const setFitment = useCallback<ActiveVehicleContextValue['setFitment']>((patch) => {
    if (authHydrating || ownerId === null || ownerRef.current !== ownerId) return;
    const epoch = epochRef.current;
    setActive((curr) => {
      if (!curr) return curr;
      const next: VehicleFitment = { ...curr.fitment, ...patch };
      void persist(async () => {
        if (epoch !== epochRef.current || ownerRef.current !== ownerId) return;
        await saveActiveVehicle({
          ownerId,
          vehicleId: curr.vehicleId,
          fitment: next,
          savedAt: Date.now(),
        });
      });
      return { ...curr, fitment: next };
    });
  }, [ownerId, authHydrating, persist]);

  const clearActive = useCallback<ActiveVehicleContextValue['clearActive']>(async () => {
    setActive(null);
    setIsHydrating(false);
    epochRef.current++;
    await persist(clearActiveVehicle);
  }, [persist]);

  const value = useMemo<ActiveVehicleContextValue>(
    () => ({
      currentActiveVehicle: !authHydrating && activeOwnerRef.current === ownerId ? active : null,
      isHydrating: authHydrating || isHydrating,
      setPrimaryVehicle,
      setFitment,
      clearActive,
    }),
    [active, isHydrating, authHydrating, ownerId, setPrimaryVehicle, setFitment, clearActive],
  );

  return <ActiveVehicleContext.Provider value={value}>{children}</ActiveVehicleContext.Provider>;
}

export function useActiveVehicle(): ActiveVehicleContextValue {
  const ctx = useContext(ActiveVehicleContext);
  if (!ctx) {
    throw new Error('useActiveVehicle() must be used within <ActiveVehicleProvider>');
  }
  return ctx;
}

/**
 * Search-side hook. Returns the enrichment payload (or `undefined`
 * when no vehicle is set) the parts-search request layer should
 * append to outgoing queries. Pure derivation — recomputes only when
 * the active fitment actually changes.
 */
export function useSearchVehicleContext():
  | ReturnType<typeof buildSearchVehicleContext>
  | undefined {
  const { currentActiveVehicle } = useActiveVehicle();
  return useMemo(() => {
    if (!currentActiveVehicle) return undefined;
    return buildSearchVehicleContext(currentActiveVehicle.fitment);
  }, [currentActiveVehicle]);
}

/**
 * Best-effort fitment derivation. New vehicles created through the
 * wizard set `brandId`/`modelId` etc. directly. Legacy vehicles only
 * have free-text `make`/`model` — for those we run the text resolver
 * against the UZ catalog. `existing` lets a manual override (set via
 * cascading selects after the garage row was created) survive a
 * subsequent re-derive.
 */
function deriveFitment(vehicle: Vehicle, existing?: VehicleFitment): VehicleFitment {
  if (vehicle.brandId && vehicle.modelId) {
    return {
      brandId: vehicle.brandId,
      modelId: vehicle.modelId,
      generationId: vehicle.generationId ?? existing?.generationId,
      trimId: vehicle.trimId ?? existing?.trimId,
      engineId: vehicle.engineId ?? existing?.engineId,
    };
  }
  const resolved = resolveFitmentFromText(vehicle.make, vehicle.model);
  if (resolved.brandId && resolved.modelId) {
    return {
      brandId: resolved.brandId,
      modelId: resolved.modelId,
      generationId: existing?.generationId,
      trimId: existing?.trimId,
      engineId: existing?.engineId,
    };
  }
  // Last-resort fallback — synthesize ad-hoc ids from the text so the
  // search backend can still echo something useful, even if the
  // OEM-scope lookup won't match anything in its DB.
  return {
    brandId: `unknown:${vehicle.make.toLowerCase()}`,
    modelId: `unknown:${vehicle.make.toLowerCase()}:${vehicle.model.toLowerCase()}`,
    generationId: existing?.generationId,
    trimId: existing?.trimId,
    engineId: existing?.engineId,
  };
}

/** Re-exported for typing convenience at consumer sites. */
export type { VehicleFitment };
export { getModel };
