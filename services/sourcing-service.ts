/**
 * Customer-facing sourcing offers.
 *
 * A "found part" notification (`type: sourcing_offer`) deep-links to
 * `/sourcing/offer/<id>`; that screen loads the full offer here. Auth-gated on
 * the backend (the offer must belong to the caller), so `apiClient` attaches the
 * bearer automatically.
 */
import { apiClient } from '@/services/api-client';

/** Why a customer declined an offer (matches the backend enum). */
export type SourcingOfferDeclineReason =
  | 'TOO_EXPENSIVE'
  | 'FOUND_CHEAPER'
  | 'NO_LONGER_NEEDED'
  | 'OTHER';

export type SourcingOfferDetail = {
  id: string;
  ticketId: string;
  partName: string | null;
  /** Vehicle the part was requested for (from the ticket's chat-extracted data). */
  vehicleBrand: string | null;
  vehicleModel: string | null;
  price: number;
  currency: string;
  /** NEW | USED | OEM | AFTERMARKET | UNKNOWN */
  condition: string;
  /** IN_STOCK | ON_ORDER | UNKNOWN */
  availability: string;
  etaDays: number | null;
  note: string | null;
  images: string[];
  sellerUsername: string | null;
  /** SENT | ACCEPTED | DECLINED | EXPIRED */
  status: string;
  declineReason: SourcingOfferDeclineReason | null;
  createdAt: string;
};

export function fetchSourcingOffer(
  id: string,
  signal?: AbortSignal,
): Promise<SourcingOfferDetail> {
  return apiClient.get<SourcingOfferDetail>(
    `/v1/sourcing/offers/${encodeURIComponent(id)}`,
    { signal },
  );
}

/** Buy: add the offer to the cart (server-side) + mark it accepted. Refresh the
 *  cart context afterwards to reflect the new line. */
export function acceptSourcingOffer(id: string): Promise<unknown> {
  return apiClient.post(`/v1/sourcing/offers/${encodeURIComponent(id)}/accept`);
}

/** Decline the offer with a reason (+ optional note for OTHER). */
export function rejectSourcingOffer(
  id: string,
  reason: SourcingOfferDeclineReason,
  note?: string,
): Promise<unknown> {
  return apiClient.post(`/v1/sourcing/offers/${encodeURIComponent(id)}/reject`, {
    reason,
    ...(note ? { note } : {}),
  });
}
