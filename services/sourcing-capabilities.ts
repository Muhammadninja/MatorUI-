import { apiClient } from '@/services/api-client';

type SourcingCapabilities = {
  contract_version?: number;
  ticket_submission_enabled?: boolean;
  /** The chat records a product page's photo request (X-Chat-Intent). */
  photo_requests?: boolean;
};

/** The backend guarantees sign-in enforcement and request ids from this version. */
const REQUIRED_CONTRACT_VERSION = 2;
const CONFIRMED_FOR_MS = 5 * 60_000;

let confirmedAt = 0;
let confirmed: SourcingCapabilities | null = null;

/**
 * Whether the deployed backend supports this chat. An older one would create a
 * ticket for any message, guests included, so anything short of a clear yes stops
 * the app from sending at all. A no isn't remembered, so a deploy takes effect on
 * the next message.
 */
export async function sourcingChatSupported(signal?: AbortSignal): Promise<boolean> {
  return (await supportedCapabilities(signal)) !== null;
}

/**
 * Whether the backend answers a photo request as one. An older backend reads it
 * as a part search and lists the very product the customer is looking at.
 */
export async function photoRequestsSupported(signal?: AbortSignal): Promise<boolean> {
  return (await supportedCapabilities(signal))?.photo_requests === true;
}

async function supportedCapabilities(signal?: AbortSignal): Promise<SourcingCapabilities | null> {
  if (confirmed && Date.now() - confirmedAt < CONFIRMED_FOR_MS) return confirmed;
  try {
    const capabilities = await apiClient.get<SourcingCapabilities>('/v1/sourcing/capabilities', {
      signal,
      skipAuth: true,
      skipLanguage: true,
      maxRetries: 0,
    });
    if ((capabilities.contract_version ?? 0) < REQUIRED_CONTRACT_VERSION) return null;
    confirmed = capabilities;
    confirmedAt = Date.now();
    return capabilities;
  } catch (err) {
    if (signal?.aborted) throw err;
    return null;
  }
}

/** For tests. */
export function resetSourcingCapabilities(): void {
  confirmedAt = 0;
  confirmed = null;
}
