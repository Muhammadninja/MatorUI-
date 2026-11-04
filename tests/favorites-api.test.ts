import { beforeEach, describe, expect, it, vi } from 'vitest';
const { client, enabled, epoch } = vi.hoisted(() => ({
  client: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() },
  enabled: vi.fn(),
  epoch: { value: 0 },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/services/api-client', () => ({
  apiClient: client,
  getAuthRequestEpoch: () => epoch.value,
}));
vi.mock('@/config/api', () => ({ shouldUseHttpTransport: enabled }));
import { createFavoritesTransport, HttpFavoritesTransport } from '@/services/favorites-api';
const signal = new AbortController().signal;
beforeEach(() => vi.resetAllMocks());
describe('favorites HTTP contract', () => {
  it('rejects malformed IDs before HTTP', async () => {
    const api = new HttpFavoritesTransport();
    await expect(api.set('a/b', true, signal)).rejects.toThrow('Invalid favorite product ID');
    expect(client.put).not.toHaveBeenCalled();
  });
  it('rejects old-owner work even before provider cleanup can run', async () => {
    const api = new HttpFavoritesTransport();
    epoch.value++;
    await expect(api.set('private', true, signal)).rejects.toThrow('Favorites session changed');
    await expect(api.fetchAll(signal)).rejects.toThrow('Favorites session changed');
    expect(client.put).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
  });
  it('rejects delayed read and write acknowledgements after authentication changes', async () => {
    let releaseRead!: (value: unknown) => void;
    client.get.mockImplementationOnce(() => new Promise((resolve) => { releaseRead = resolve; }));
    const reading = new HttpFavoritesTransport().fetchAll(signal);
    epoch.value++;
    releaseRead({ items: [{ partId: 'private' }], nextPageToken: null });
    await expect(reading).rejects.toThrow('Favorites session changed');

    let releaseWrite!: (value: unknown) => void;
    client.put.mockImplementationOnce(() => new Promise((resolve) => { releaseWrite = resolve; }));
    const writing = new HttpFavoritesTransport().set('private', true, signal);
    epoch.value++;
    releaseWrite({ partId: 'private' });
    await expect(writing).rejects.toThrow('Favorites session changed');
  });
  it('keeps sync disabled until the real contract is verified, even with HTTP enabled', () => {
    enabled.mockReturnValue(false);
    expect(createFavoritesTransport()).toBeUndefined();
    enabled.mockReturnValue(true);
    expect(createFavoritesTransport()).toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });
  it('loads all cursor pages and encodes opaque tokens', async () => {
    client.get
      .mockResolvedValueOnce({ items: [{ partId: 'a' }], nextPageToken: '+/=' })
      .mockResolvedValueOnce({ items: [{ partId: 'b' }], nextPageToken: null });
    expect(await new HttpFavoritesTransport().fetchAll(signal)).toEqual(['a', 'b']);
    expect(client.get).toHaveBeenLastCalledWith('/v1/me/favorites?limit=50&pageToken=%2B%2F%3D', {
      signal,
      maxRetries: 0,
    });
  });
  it('rejects duplicate rows and cursor loops instead of accepting incomplete reads', async () => {
    client.get
      .mockResolvedValueOnce({ items: [{ partId: 'a' }], nextPageToken: 'next' })
      .mockResolvedValueOnce({ items: [{ partId: 'a' }], nextPageToken: null });
    await expect(new HttpFavoritesTransport().fetchAll(signal)).rejects.toThrow(
      'Invalid favorites page',
    );
    client.get.mockResolvedValue({ items: [], nextPageToken: 'loop' });
    await expect(new HttpFavoritesTransport().fetchAll(signal)).rejects.toThrow(
      'Repeated favorites cursor',
    );
  });
  it('uses idempotent writes', async () => {
    const api = new HttpFavoritesTransport();
    client.put.mockResolvedValue({ partId: 'a_b' });
    await api.set('a_b', true, signal);
    await api.set('a_b', false, signal);
    expect(client.put).toHaveBeenCalledWith('/v1/me/favorites/a_b', undefined, {
      signal,
      maxRetries: 0,
    });
    expect(client.delete).toHaveBeenCalledWith('/v1/me/favorites/a_b', { signal, maxRetries: 0 });
  });
});
