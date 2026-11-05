/**
 * The arithmetic of the delivery map, kept apart from the screen. The destination is the point
 * under the fixed marker at the centre of the map, so moving the map moves the destination.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { DeliveryCoverageInfo, DeliveryPoint } from '@/services/orders-service';

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/**
 * Where the map opens when nothing better is known: only where the camera points, the whole
 * country so the buyer can find their way in. It says nothing about where couriers go, and a
 * point is never taken from it: nothing is selected until the buyer moves or taps.
 */
export const OVERVIEW_REGION: MapRegion = {
  latitude: 41.3,
  longitude: 64.6,
  latitudeDelta: 10,
  longitudeDelta: 16,
};

/** Close enough to tell one building from the next. */
export const STREET_DELTA = 0.005;

/** Where a tap on a zoomed-out map lands: close enough to go on from. */
export const TAP_DELTA = 0.02;

/**
 * Zoomed out further than this, one pixel of the map is hundreds of metres, and a point
 * chosen there would send the courier to the wrong place. The buyer zooms in first.
 */
export const MAX_CONFIRM_DELTA = 0.1;

/** About a metre, below which nothing the map reports means anything. */
const NOISE_DEGREES = 0.00001;
/** About one screen pixel of the area showing. The map snaps its centre to pixels. */
const PIXEL_SHARE = 0.003;

export function regionAround(point: DeliveryPoint, delta: number = STREET_DELTA): MapRegion {
  return {
    latitude: point.lat,
    longitude: point.lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/** The camera for a delivery area, with a little room around it. */
export function regionOfBounds(bounds: NonNullable<DeliveryCoverageInfo['bounds']>): MapRegion {
  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLng + bounds.maxLng) / 2,
    latitudeDelta: (bounds.maxLat - bounds.minLat) * 1.2,
    longitudeDelta: (bounds.maxLng - bounds.minLng) * 1.2,
  };
}

export function centerOf(region: MapRegion): DeliveryPoint {
  return { lat: region.latitude, lng: region.longitude };
}

/** Whether the map is showing this point at its centre, to within a pixel at this zoom. */
export function isCenteredOn(point: DeliveryPoint, region: MapRegion): boolean {
  const near = (delta: number) => Math.max(NOISE_DEGREES, delta * PIXEL_SHARE);
  return (
    Math.abs(point.lat - region.latitude) < near(region.latitudeDelta) &&
    Math.abs(point.lng - region.longitude) < near(region.longitudeDelta)
  );
}

/** Whether the map is close enough for a point chosen on it to be a real place. */
export function isCloseEnoughToChoose(region: MapRegion): boolean {
  return region.latitudeDelta <= MAX_CONFIRM_DELTA;
}

/**
 * Whether this build can draw a map. iOS uses Apple Maps, which needs nothing. On Android
 * react-native-maps uses Google Maps, and without a key baked into the build the native map
 * crashes the app as soon as it opens, so the app has to know before drawing one.
 */
export function isMapAvailable(): boolean {
  if (Platform.OS !== 'android') return true;
  const extra = Constants.expoConfig?.extra as { googleMapsConfigured?: boolean } | undefined;
  return extra?.googleMapsConfigured === true;
}

/** A search's map context: where the map looks, roughly. No more exact than it needs to be. */
export function roughCenter(point: DeliveryPoint): { nearLat: number; nearLng: number } {
  return {
    nearLat: Math.round(point.lat * 100) / 100,
    nearLng: Math.round(point.lng * 100) / 100,
  };
}
