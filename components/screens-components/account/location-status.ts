import type { LocationFailure } from '@/hooks/use-app-location/use-app-location';

/** Where the address's delivery point came from, when it has one. */
export type PointSource = 'saved' | 'location' | 'map' | 'suggestion';

/** The one line that says what the address's point is right now. */
export type LocationHeadline = 'locating' | 'saved' | 'current' | 'pinned' | 'none';

/** At most one line under it. A failure never denies a point that is still set. */
export type LocationNote =
  | 'hint'
  | 'denied'
  | 'unavailable'
  | 'deniedKept'
  | 'unavailableKept'
  | null;

export type LocationStatus = { headline: LocationHeadline; note: LocationNote };

/**
 * The address form's location row, from the actual data only.
 *
 * It used to read "location set" off the saved point and "couldn't determine
 * the location" off a separate failed-GPS flag, so a saved address whose GPS
 * refresh failed said both at once. Here the headline is what the address
 * really holds (or that a lookup is running), and a failed lookup with a point
 * still in place says that point was kept. Nothing reports a position the
 * device didn't give.
 */
export function deriveLocationStatus({
  locating,
  source,
  failure,
}: {
  locating: boolean;
  /** The point the address holds now, or null. */
  source: PointSource | null;
  /** Why the last current-location request returned nothing. */
  failure: LocationFailure | null;
}): LocationStatus {
  if (locating) return { headline: 'locating', note: null };
  const headline: LocationHeadline =
    source === 'location'
      ? 'current'
      : source === 'saved'
        ? 'saved'
        : source === 'map' || source === 'suggestion'
          ? 'pinned'
          : 'none';
  if (headline === 'none') return { headline, note: failure ?? 'hint' };
  if (failure === 'denied') return { headline, note: 'deniedKept' };
  if (failure === 'unavailable') return { headline, note: 'unavailableKept' };
  return { headline, note: null };
}

export const LOCATION_HEADLINE_KEY: Record<LocationHeadline, string> = {
  locating: 'account.locationLocating',
  saved: 'account.locationSaved',
  current: 'account.locationCurrent',
  pinned: 'account.locationPinned',
  none: 'account.useCurrentLocation',
};

export const LOCATION_NOTE_KEY: Record<Exclude<LocationNote, null>, string> = {
  hint: 'account.locationHint',
  denied: 'account.locationDenied',
  unavailable: 'account.locationUnavailable',
  deniedKept: 'account.locationDeniedKept',
  unavailableKept: 'account.locationUnavailableKept',
};
