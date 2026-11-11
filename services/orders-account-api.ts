/** Live account/address/delivery endpoints shared by the orders transport. */
import { apiClient } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';
import { parseCoverageGeometry } from '@/services/delivery-coverage';
import { parsePickupPoints } from '@/services/pickup-points';
import type { ShippingQuoteRequest } from '@/services/orders-api';
import type {
  Address, AddressInput, AddressSearchQuery, AddressSuggestion, AddressSuggestions,
  DeliveryCoverageInfo, DeliveryPoint, PaymentMethod, PaymentMethodInput,
  PickupPoint, PointDescription, ShippingOption,
} from '@/services/orders-service';

/**
 * Backend address shape (from the live OpenAPI `/docs-json` → CreateAddressDto /
 * address entity, verified 2026-07-23). The wire model is UZ-centric and totally
 * different from the app's `{ label, line1, city }`: an address needs `full_text` or
 * `lat`+`lng`; `line1`/`city`/`name` do not exist (sending them → 400 "property X
 * should not exist" on the strict `forbidNonWhitelisted` DTO).
 */
type RawAddress = {
  id: string;
  label?: string | null;
  region_code?: string | null;
  district?: string | null;
  street?: string | null;
  full_text?: string | null;
  landmark?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_default?: boolean | null;
};

/**
 * Map the app's address (`line1` = street and house, `city` = city line) onto the
 * backend `CreateAddressDto`. `full_text` is composed from those; `street`/`district`
 * carry the parts so a read round-trips back to line1/city. `name` is dropped (no
 * backend field). A point with no words sends no text at all, and the server describes
 * it itself. Accepted keys only: full_text, label, region_code, district, street, lat,
 * lng, is_default.
 */
function toAddressBody(input: AddressInput): Record<string, unknown> {
  const line1 = input.line1.trim();
  const city = input.city.trim();
  const fullText = [line1, city].filter(Boolean).join(', ');
  const label = input.label.trim() || line1;
  const body: Record<string, unknown> = {};
  if (fullText) body.full_text = fullText;
  if (label) body.label = label;
  if (line1) body.street = line1;
  if (city) body.district = city;
  if (input.landmark !== undefined) body.landmark = input.landmark.trim() || null;
  if (input.lat !== undefined && input.lng !== undefined) {
    body.lat = input.lat;
    body.lng = input.lng;
  }
  debugLog('address', '→ wire body (mapped to backend DTO)', body);
  return body;
}

/** A point saved with no words is stored under its own coordinates, for the operator and
 *  the courier. That is not a street to show the buyer. */
const COORDINATES_TEXT = /^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/;

/** Map a backend `RawAddress` back onto the app's `Address`. */
function mapRawAddress(raw: RawAddress): Address {
  const written = raw.full_text && !COORDINATES_TEXT.test(raw.full_text) ? raw.full_text : null;
  return {
    id: raw.id,
    label: raw.label ?? raw.street ?? written ?? 'Address',
    line1: raw.street ?? written ?? '',
    city: raw.district ?? raw.region_code ?? '',
    landmark: raw.landmark ?? null,
    isDefault: raw.is_default ?? false,
    lat: raw.lat ?? null,
    lng: raw.lng ?? null,
  };
}

type RawAddressSuggestion = {
  id?: string | number | null;
  title?: string | null;
  subtitle?: string | null;
  city?: string | null;
  district?: string | null;
  street?: string | null;
  house_number?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** One suggestion, or nothing when it has no real point to save: picking it could not
 *  be priced, so it must not be offered. */
function mapRawSuggestion(raw: RawAddressSuggestion): AddressSuggestion[] {
  if (
    !raw.title ||
    typeof raw.lat !== 'number' ||
    !Number.isFinite(raw.lat) ||
    typeof raw.lng !== 'number' ||
    !Number.isFinite(raw.lng)
  ) {
    return [];
  }
  return [
    {
      id: String(raw.id ?? `${raw.lat},${raw.lng}`),
      title: raw.title,
      subtitle: raw.subtitle ?? null,
      city: raw.city ?? null,
      district: raw.district ?? null,
      street: raw.street ?? null,
      houseNumber: raw.house_number ?? null,
      lat: raw.lat,
      lng: raw.lng,
    },
  ];
}

/**
 * Normalize a collection response to a plain array. The backend wraps
 * collections in a `{ items: [...] }` envelope (confirmed on `GET /v1/categories`),
 * but older/other endpoints may return a bare array — accept either. Anything
 * unexpected (an error object slipped through with a 200, a null, a string)
 * degrades to `[]` so the screen renders its empty state instead of crashing
 * with "undefined is not a function" when it calls `.map` / `.find` / `.filter`.
 */
export function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    for (const key of ['items', 'data', 'results']) {
      const v = (raw as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

export class HttpOrdersAccountTransport {
  async listAddresses(signal?: AbortSignal): Promise<Address[]> {
    const raw = asList<RawAddress>(await apiClient.get<unknown>('/v1/account/addresses', { signal }));
    return raw.map(mapRawAddress);
  }

  async searchAddresses(
    query: AddressSearchQuery,
    signal?: AbortSignal,
  ): Promise<AddressSuggestions> {
    // What was typed and where the map is looking, which is all a search needs.
    const params = Object.entries({
      street: query.street,
      house: query.house,
      city: query.city,
      lang: query.lang,
      ...(query.mode === 'search' ? { mode: 'search' } : {}),
      ...(query.nearLat !== undefined && query.nearLng !== undefined
        ? { near_lat: String(query.nearLat), near_lng: String(query.nearLng) }
        : {}),
    })
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    const raw = await apiClient.get<{ items?: unknown; attribution?: string | null }>(
      `/v1/addresses/suggestions?${params}`,
      { signal },
    );
    return {
      items: asList<RawAddressSuggestion>(raw?.items).flatMap(mapRawSuggestion),
      attribution: raw?.attribution ?? null,
    };
  }

  async describePoint(
    point: DeliveryPoint,
    lang: string,
    signal?: AbortSignal,
  ): Promise<PointDescription> {
    const raw = await apiClient.get<{
      address?: {
        city?: string | null;
        district?: string | null;
        street?: string | null;
        house_number?: string | null;
      } | null;
      within_coverage?: boolean | null;
      attribution?: string | null;
    }>(`/v1/addresses/reverse?lat=${point.lat}&lng=${point.lng}&lang=${encodeURIComponent(lang)}`, {
      signal,
    });
    return {
      address: raw?.address
        ? {
            city: raw.address.city ?? null,
            district: raw.address.district ?? null,
            street: raw.address.street ?? null,
            houseNumber: raw.address.house_number ?? null,
          }
        : null,
      withinCoverage: raw?.within_coverage ?? null,
      attribution: raw?.attribution ?? null,
    };
  }

  async getDeliveryCoverage(signal?: AbortSignal): Promise<DeliveryCoverageInfo> {
    const raw = await apiClient.get<{
      configured?: boolean;
      bounds?: { min_lat: number; min_lng: number; max_lat: number; max_lng: number } | null;
      geometry?: unknown;
    }>('/v1/shipping/coverage', { signal });
    return {
      configured: raw?.configured === true,
      bounds: raw?.bounds
        ? {
            minLat: raw.bounds.min_lat,
            minLng: raw.bounds.min_lng,
            maxLat: raw.bounds.max_lat,
            maxLng: raw.bounds.max_lng,
          }
        : null,
      polygons: parseCoverageGeometry(raw?.geometry),
    };
  }

  async createAddress(input: AddressInput): Promise<Address> {
    const raw = await apiClient.post<RawAddress>('/v1/addresses', toAddressBody(input));
    return mapRawAddress(raw);
  }

  async updateAddress(id: string, input: AddressInput): Promise<Address> {
    const raw = await apiClient.patch<RawAddress>(
      `/v1/addresses/${encodeURIComponent(id)}`,
      toAddressBody(input),
    );
    return mapRawAddress(raw);
  }

  removeAddress(id: string): Promise<void> {
    return apiClient.delete<void>(`/v1/addresses/${encodeURIComponent(id)}`);
  }

  setDefaultAddress(id: string): Promise<void> {
    return apiClient.post<void>(`/v1/addresses/${encodeURIComponent(id)}/default`);
  }

  async listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]> {
    return asList<PaymentMethod>(
      await apiClient.get<unknown>('/v1/account/payment-methods', { signal }),
    );
  }

  createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod> {
    return apiClient.post<PaymentMethod>('/v1/payment-methods', input);
  }

  updatePaymentMethod(id: string, input: PaymentMethodInput): Promise<PaymentMethod> {
    return apiClient.patch<PaymentMethod>(
      `/v1/payment-methods/${encodeURIComponent(id)}`,
      input,
    );
  }

  removePaymentMethod(id: string): Promise<void> {
    return apiClient.delete<void>(`/v1/payment-methods/${encodeURIComponent(id)}`);
  }

  setDefaultPaymentMethod(id: string): Promise<void> {
    return apiClient.post<void>(`/v1/payment-methods/${encodeURIComponent(id)}/default`);
  }

  async getShippingQuote(
    req: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]> {
    const raw = await apiClient.post<{
      options?: {
        type?: string;
        label?: string;
        available?: boolean;
        price_uzs?: number | null;
        quote_id?: string | null;
        unavailable_reason?: { code?: string | null; message?: string | null } | null;
      }[];
    }>(
      '/v1/shipping/quote',
      { delivery_address_id: req.addressId, delivery_method: 'courier' },
      { signal },
    );
    // The backend answers pickup and Mator's courier, each saying whether it can be had. One it
    // cannot deliver comes with the reason and no price, and is kept as such, so the checkout
    // can say why: never read as free. Of the rest, an option with no real price is dropped
    // rather than read as free, so the checkout treats it as no quote at all. So is a price
    // with no quote behind it: the order would only be refused. Zero has none, because there
    // is nothing to deliver. An older backend states no `available` and lists only what it
    // priced, which reads the same way.
    return (raw?.options ?? []).flatMap((o): ShippingOption[] => {
      const key = o.type ?? 'courier';
      const label = o.label ?? '';
      if (o.available === false) {
        const code = o.unavailable_reason?.code;
        return [
          {
            key,
            label,
            available: false,
            price: null,
            quoteId: null,
            unavailableCode: typeof code === 'string' && code ? code : null,
          },
        ];
      }
      const price = o.price_uzs;
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return [];
      const quoteId = o.quote_id || null;
      if (price > 0 && !quoteId) return [];
      return [{ key, label, price, quoteId }];
    });
  }

  async getPickupPoints(signal?: AbortSignal): Promise<PickupPoint[]> {
    const raw = await apiClient.get<{ pickup_points?: unknown }>('/v1/shipping/pickup-points', {
      signal,
    });
    return parsePickupPoints(raw?.pickup_points);
  }
}
