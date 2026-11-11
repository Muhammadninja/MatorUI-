import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, getAuthRequestEpoch } from '@/services/api-client';
import { validPartId } from '@/services/likes-storage';

export interface FavoritesTransport {
  fetchAll(signal: AbortSignal): Promise<string[]>;
  set(id: string, liked: boolean, signal: AbortSignal): Promise<void>;
}

export class HttpFavoritesTransport implements FavoritesTransport {
  private readonly epoch = getAuthRequestEpoch();
  private current(signal: AbortSignal): void {
    if (signal.aborted || this.epoch !== getAuthRequestEpoch())
      throw new DOMException('Favorites session changed', 'AbortError');
  }

  async fetchAll(signal: AbortSignal): Promise<string[]> {
    const ids = new Set<string>();
    const tokens = new Set<string>();
    let token: string | null = null;
    do {
      this.current(signal);
      const raw: { items?: { partId?: unknown; createdAt?: unknown }[]; nextPageToken?: unknown } =
        await apiClient.get(
          `/v1/me/favorites?limit=50${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`,
          { signal, maxRetries: 0 },
        );
      this.current(signal);
      if (!Array.isArray(raw?.items)) throw new Error('Invalid favorites response');
      for (const item of raw.items) {
        if (!validPartId(item.partId) || ids.has(item.partId))
          throw new Error('Invalid favorites page');
        ids.add(item.partId);
      }
      if (
        raw.nextPageToken != null &&
        (typeof raw.nextPageToken !== 'string' ||
          raw.nextPageToken.length === 0 ||
          raw.nextPageToken.length > 1024)
      )
        throw new Error('Invalid favorites cursor');
      token = (raw.nextPageToken as string | null) ?? null;
      if (token && tokens.has(token)) throw new Error('Repeated favorites cursor');
      if (token) tokens.add(token);
      if (tokens.size > 1000) throw new Error('Favorites pagination exceeded limit');
    } while (token);
    return [...ids];
  }

  async set(id: string, liked: boolean, signal: AbortSignal): Promise<void> {
    this.current(signal);
    if (!validPartId(id)) throw new Error('Invalid favorite product ID');
    const path = `/v1/me/favorites/${encodeURIComponent(id)}`;
    if (liked) {
      const response = await apiClient.put<{ partId?: unknown }>(path, undefined, {
        signal,
        maxRetries: 0,
      });
      if (response?.partId !== id) throw new Error('Invalid favorite acknowledgement');
    } else await apiClient.delete(path, { signal, maxRetries: 0 });
    this.current(signal);
  }
}

// Production returned 404 on 2026-11-04. Keep local account isolation usable
// without enabling writes against an unverified contract. Change only after
// authenticated owner-scoped pagination and write acknowledgements are verified.
export const FAVORITES_SYNC_CONTRACT_VERIFIED = false;
export const createFavoritesTransport = (): FavoritesTransport | undefined =>
  FAVORITES_SYNC_CONTRACT_VERIFIED && shouldUseHttpTransport('favorites')
    ? new HttpFavoritesTransport()
    : undefined;
