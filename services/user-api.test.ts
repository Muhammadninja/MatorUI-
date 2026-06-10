/**
 * user-api mock — getMe / updateMe round-trip.
 *
 * The mock keeps an in-memory profile so multiple calls within the same
 * suite see each other's writes (matches what a real /me endpoint does
 * within a single user session).
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => null,
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => false,
}));

import { userTransport } from './user-api';

describe('user-api mock', () => {
  test('getMe returns the seed profile shape', async () => {
    const me = await userTransport.getMe();
    expect(me).toMatchObject({
      id: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
      username: expect.any(String),
      email: expect.any(String),
      avatarUrl: null,
      memberSince: expect.any(String),
    });
  });

  test('updateMe applies a partial patch and returns the full updated profile', async () => {
    const before = await userTransport.getMe();
    const after = await userTransport.updateMe({
      firstName: 'Updated',
      lastName: 'Name',
    });
    expect(after.firstName).toBe('Updated');
    expect(after.lastName).toBe('Name');
    // Untouched fields preserved
    expect(after.email).toBe(before.email);
    expect(after.id).toBe(before.id);
  });

  test('updates persist across calls within the same session', async () => {
    await userTransport.updateMe({ firstName: 'Persisted' });
    const me = await userTransport.getMe();
    expect(me.firstName).toBe('Persisted');
  });

  test('avatarUrl can be set and cleared', async () => {
    const set = await userTransport.updateMe({ avatarUrl: 'https://cdn/x.jpg' });
    expect(set.avatarUrl).toBe('https://cdn/x.jpg');
    const cleared = await userTransport.updateMe({ avatarUrl: null });
    expect(cleared.avatarUrl).toBeNull();
  });
});
