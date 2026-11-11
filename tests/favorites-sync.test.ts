import { describe, expect, it, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
import { FavoritesStorage, type LikesStorageIO } from '@/services/likes-storage';
import { FavoritesSync } from '@/services/favorites-sync';
import type { FavoritesTransport } from '@/services/favorites-api';

function fixture(legacy: string[] = []) {
  const values = new Map<string, string>();
  if (legacy.length)
    values.set('likes:v1', JSON.stringify({ v: 1, ids: legacy, hasEverLiked: true }));
  const io: LikesStorageIO = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  const storage = new FavoritesStorage(io);
  const rows = new Set<string>();
  const transport: FavoritesTransport = {
    fetchAll: vi.fn(async () => [...rows]),
    set: vi.fn(async (id, liked) => {
      if (liked) rows.add(id);
      else rows.delete(id);
    }),
  };
  const engine = (owner: string | null, retries: number[] = []) =>
    new FavoritesSync(owner, storage, transport, retries, async () => undefined);
  return { values, io, storage, rows, transport, engine };
}
async function settle(engine: FavoritesSync) {
  await engine.retry();
  await engine.sync();
}

describe('favorites legacy archive', () => {
  it('never merges the device-global likes:v1 list into any owner', async () => {
    const f = fixture(['old']);
    const original = f.values.get('likes:v1');
    const guest = await f.storage.open(null);
    expect(guest.record.ids).toEqual([]);
    const a = await f.storage.open('a');
    expect(a.record.ids).toEqual([]);
    expect(a.record.hasEverLiked).toBe(false);
    const b = await f.storage.open('b');
    expect(b.record.ids).toEqual([]);
    // The archive is readable independently and the original bytes are untouched.
    expect(await f.storage.readArchive()).toEqual({ ids: ['old'], hasEverLiked: true });
    expect(f.values.get('likes:v1')).toBe(original);
  });

  it('keeps the archive readable even though it never affects a running sync engine', async () => {
    const f = fixture(['old', 'other']);
    const engine = f.engine('a');
    await engine.start();
    expect([...engine.snapshot().likedIds]).toEqual([]);
    expect(f.transport.set).not.toHaveBeenCalled();
    expect(await f.storage.readArchive()).toEqual({ ids: ['old', 'other'], hasEverLiked: true });
  });

  it('reports a malformed legacy blob as recoverable without touching owner journals', async () => {
    const values = new Map<string, string>([['likes:v1', '{not json']]);
    const io: LikesStorageIO = {
      getItem: async (k) => values.get(k) ?? null,
      setItem: async (k, v) => {
        values.set(k, v);
      },
    };
    const storage = new FavoritesStorage(io);
    await expect(storage.readArchive()).rejects.toThrow();
    // A broken archive blob must not block ordinary opening/syncing.
    expect((await storage.open('a')).record.ids).toEqual([]);
  });
});

describe('favorites upgrade from the old single-key version', () => {
  it('starts every owner empty on first run after upgrading from a v1-only install', async () => {
    const f = fixture(['pre-upgrade-1', 'pre-upgrade-2']);
    // Simulates the very first `open()` after shipping v2 on a device that
    // only ever had the old `likes:v1` key — no v2 document exists yet.
    expect(f.values.get('likes:v2')).toBeUndefined();
    const guestBeforeAuth = await f.storage.open(null);
    expect(guestBeforeAuth.record.ids).toEqual([]);
    expect(f.values.get('likes:v2')).toBeDefined();
    const authed = await f.storage.open('new-account');
    expect(authed.record.ids).toEqual([]);
    expect(authed.record.hasEverLiked).toBe(false);
    // Old bytes are still there, exactly as before the upgrade.
    expect(f.values.get('likes:v1')).toBe(
      JSON.stringify({ v: 1, ids: ['pre-upgrade-1', 'pre-upgrade-2'], hasEverLiked: true }),
    );
    expect(await f.storage.readArchive()).toEqual({
      ids: ['pre-upgrade-1', 'pre-upgrade-2'],
      hasEverLiked: true,
    });
  });

  it('upgrades a device that already has a guest-only v1 list without granting it to the first signed-in account', async () => {
    const f = fixture(['guest-liked-before-upgrade']);
    const guest = f.engine(null);
    await guest.start();
    expect([...guest.snapshot().likedIds]).toEqual([]);
    guest.stop();
    const a = f.engine('a');
    await a.start();
    expect([...a.snapshot().likedIds]).toEqual([]);
    a.stop();
  });
});

describe('favorites account switching', () => {
  it('isolates two accounts across an A -> B -> A switch with no legacy bleed-through', async () => {
    // A separate backend-side row set per owner, like the real
    // bearer-scoped `/v1/me/favorites` endpoint, rather than the single
    // shared `rows` set the generic `fixture()` transport uses for
    // single-owner tests.
    const f = fixture(['ambient-legacy']);
    const backend = new Map<string, Set<string>>();
    const transportFor = (owner: string): FavoritesTransport => {
      const rows = backend.get(owner) ?? (backend.set(owner, new Set()).get(owner) as Set<string>);
      return {
        fetchAll: vi.fn(async () => [...rows]),
        set: vi.fn(async (id, liked) => {
          if (liked) rows.add(id);
          else rows.delete(id);
        }),
      };
    };
    const engineFor = (owner: string) => new FavoritesSync(owner, f.storage, transportFor(owner));

    const a1 = engineFor('a');
    await a1.start();
    a1.toggle('product-1');
    await settle(a1);
    expect([...backend.get('a')!]).toEqual(['product-1']);
    a1.stop();

    const b = engineFor('b');
    await b.start();
    expect([...b.snapshot().likedIds]).toEqual([]);
    b.toggle('product-3');
    await settle(b);
    expect([...backend.get('b')!]).toEqual(['product-3']);
    expect(backend.get('a')!.has('product-3')).toBe(false);
    b.stop();

    const a2 = engineFor('a');
    await a2.start();
    expect([...a2.snapshot().likedIds]).toEqual(['product-1']);
    expect(a2.snapshot().likedIds.has('product-3')).toBe(false);
    a2.stop();

    expect((await f.storage.readOwner('a')).record.ids).toEqual(['product-1']);
    expect((await f.storage.readOwner('b')).record.ids).toEqual(['product-3']);
    expect(await f.storage.readArchive()).toEqual({
      ids: ['ambient-legacy'],
      hasEverLiked: true,
    });
  });
});

describe('favorites session races and durable retries', () => {
  it('ignores an old authenticated read before cleanup when the auth epoch changes', async () => {
    const f = fixture(['archive-only']);
    let current = true;
    let release!: (ids: string[]) => void;
    f.transport.fetchAll = vi.fn(() => new Promise<string[]>((resolve) => { release = resolve; }));
    const old = new FavoritesSync('a', f.storage, f.transport, [], undefined, () => current);
    const starting = old.start();
    while (!release) await Promise.resolve();
    current = false;
    expect(old.toggle('late')).toBe(false);
    const next = new FavoritesSync('b', f.storage);
    await next.start();
    release(['private-old-response']);
    await starting;
    expect([...next.snapshot().likedIds]).toEqual([]);
    expect((await f.storage.readOwner('a')).record.ids).toEqual([]);
    expect(f.transport.set).not.toHaveBeenCalled();
    expect((await f.storage.readArchive()).ids).toEqual(['archive-only']);
    old.stop(); next.stop();
  });

  it('keeps a delayed old-owner local write in its original journal across a switch', async () => {
    const f = fixture(['archive-only']);
    const old = new FavoritesSync('a', f.storage);
    await old.start();
    const save = f.io.setItem;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const writing = new Promise<void>((resolve) => { entered = resolve; });
    f.io.setItem = async (key, value) => { entered(); await gate; await save(key, value); };
    old.toggle('accepted-before-switch');
    await writing;
    old.stop();
    const next = new FavoritesSync('b', f.storage);
    const starting = next.start();
    release();
    await starting;
    expect([...next.snapshot().likedIds]).toEqual([]);
    expect((await f.storage.readOwner('a')).record.ids).toEqual(['accepted-before-switch']);
    expect((await f.storage.readArchive()).ids).toEqual(['archive-only']);
    next.stop();
  });

  it('overlays rapid local changes over delayed hydration and persists them before HTTP', async () => {
    const f = fixture();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const read = f.io.getItem;
    let first = true;
    f.io.getItem = async (key) => {
      if (first) {
        first = false;
        await gate;
      }
      return read(key);
    };
    const engine = f.engine('a');
    const starting = engine.start();
    engine.toggle('new');
    engine.toggle('new');
    engine.toggle('final');
    release();
    await starting;
    await settle(engine);
    expect([...f.rows]).toEqual(['final']);
    expect(engine.snapshot().likedIds.has('new')).toBe(false);
  });
  it('retries a failed desired-state persistence before attempting its HTTP write', async () => {
    const f = fixture();
    const engine = f.engine('a');
    await engine.start();
    const save = f.io.setItem;
    let fail = true;
    f.io.setItem = async (key, value) => {
      if (fail) throw new Error('disk full');
      await save(key, value);
    };
    engine.toggle('p');
    await engine.retry();
    expect(f.transport.set).not.toHaveBeenCalled();
    expect(engine.snapshot().likedIds.has('p')).toBe(true);
    fail = false;
    await settle(engine);
    expect(f.rows.has('p')).toBe(true);
    expect(engine.snapshot().pendingIds.size).toBe(0);
  });
  it('keeps the latest rapid toggle during an in-flight PUT', async () => {
    const f = fixture();
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const blocked = new Promise<void>((r) => {
      release = r;
    });
    const write = f.transport.set;
    f.transport.set = vi.fn(async (id: string, liked: boolean, signal: AbortSignal) => {
      if (liked) {
        entered();
        await blocked;
      }
      await write(id, liked, signal);
    });
    const engine = f.engine('a');
    await engine.start();
    engine.toggle('p');
    await started;
    engine.toggle('p');
    release();
    await settle(engine);
    expect(f.rows.has('p')).toBe(false);
    expect(engine.snapshot().likedIds.has('p')).toBe(false);
    expect(engine.snapshot().pendingIds.size).toBe(0);
  });
  it('does not apply late reads or send pending old-owner writes after logout', async () => {
    const f = fixture();
    let release!: (ids: string[]) => void;
    f.transport.fetchAll = vi.fn(
      () =>
        new Promise<string[]>((r) => {
          release = r;
        }),
    );
    const old = f.engine('a');
    const start = old.start();
    while (!release) await Promise.resolve();
    old.stop();
    const guest = new FavoritesSync(null, f.storage);
    await guest.start();
    release(['private']);
    await start;
    expect([...guest.snapshot().likedIds]).toEqual([]);
    expect((await f.storage.readOwner('a')).record.ids).toEqual([]);
    expect(f.transport.set).not.toHaveBeenCalled();
  });
  it('preserves offline desired state for restart and bounds automatic retries', async () => {
    const f = fixture();
    const engine = f.engine('a', [0, 0]);
    await engine.start();
    f.transport.set = vi.fn(async () => {
      throw new Error('offline');
    });
    engine.toggle('p');
    await settle(engine);
    expect(engine.snapshot().error).toBe('offline');
    expect((await f.storage.readOwner('a')).record.pending.p.liked).toBe(true);
    engine.stop();
    f.transport.set = vi.fn(async (id, liked) => {
      if (liked) f.rows.add(id);
      else f.rows.delete(id);
    });
    const restarted = f.engine('a');
    await restarted.start();
    expect(f.rows.has('p')).toBe(true);
    expect(restarted.snapshot().pendingIds.size).toBe(0);
  });
  it('keeps guest local and isolates authenticated journals', async () => {
    const f = fixture();
    const guest = f.engine(null);
    await guest.start();
    guest.toggle('guest');
    await settle(guest);
    expect(f.transport.fetchAll).not.toHaveBeenCalled();
    expect(f.transport.set).not.toHaveBeenCalled();
    const a = f.engine('a');
    await a.start();
    expect(a.snapshot().likedIds.has('guest')).toBe(false);
    await f.storage.setDesired('a', 'private', true);
    expect((await f.storage.open('b')).record.ids).toEqual([]);
  });
});
