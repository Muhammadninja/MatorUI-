import { apiClient } from '@/services/api-client';

type SourcingCapabilities = {
  contract_version?: number;
  ticket_submission_enabled?: boolean;
};

/** The backend guarantees sign-in enforcement and request ids from this version. */
const REQUIRED_CONTRACT_VERSION = 2;
const CONFIRMED_FOR_MS = 5 * 60_000;

let confirmedAt = 0;

/**
 * Whether the deployed backend supports this chat. An older one would create a
 * ticket for any message, guests included, so anything short of a clear yes stops
 * the app from sending at all. A no isn't remembered, so a deploy takes effect on
 * the next message.
 */
export async function sourcingChatSupported(signal?: AbortSignal): Promise<boolean> {
  if (Date.now() - confirmedAt < CONFIRMED_FOR_MS) return true;
  try {
    const capabilities = await apiClient.get<SourcingCapabilities>('/v1/sourcing/capabilities', {
      signal,
      skipAuth: true,
      skipLanguage: true,
      maxRetries: 0,
    });
    if ((capabilities.contract_version ?? 0) < REQUIRED_CONTRACT_VERSION) return false;
    confirmedAt = Date.now();
    return true;
  } catch (err) {
    if (signal?.aborted) throw err;
    return false;
  }
}

/** For tests. */
export function resetSourcingCapabilities(): void {
  confirmedAt = 0;
}
