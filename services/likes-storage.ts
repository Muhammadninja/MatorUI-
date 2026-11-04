import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredLikes = { ids: string[]; hasEverLiked: boolean };
export type FavoriteIntent = { liked: boolean; revision: number };
export type FavoriteRecord = StoredLikes & {
  version: number;
  pending: Record<string, FavoriteIntent>;
};
export type FavoritesSnapshot = { record: FavoriteRecord };
type Document = { v: 2; owners: Record<string, FavoriteRecord> };
export type LikesStorageIO = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const KEY = 'likes:v2';
const LEGACY_KEY = 'likes:v1';
const empty = (): FavoriteRecord => ({ ids: [], hasEverLiked: false, version: 0, pending: {} });
const unique = (values: string[]) => [...new Set(values)];
const ownerKey = (ownerId: string | null) => (ownerId === null ? 'guest' : `user:${ownerId}`);
export const validPartId = (id: unknown): id is string =>
  typeof id === 'string' && id.length > 0 && id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

/**
 * Per-owner favorite journals, keyed by account id (or the guest
 * namespace). The pre-sync `likes:v1` list was device-global across every
 * guest and account that ever used the app, with no provenance — there is
 * no safe rule to decide which account it "belongs" to. It is therefore
 * never read or merged here: every owner starts from their own empty
 * journal. The original bytes stay untouched and reachable only through
 * `readArchive`, for a possible future explicit, user-confirmed recovery
 * flow (not implemented — that UI and its policy are a separate decision).
 */
export class FavoritesStorage {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly io: LikesStorageIO = AsyncStorage) {}

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.tail.then(operation);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async read(): Promise<Document> {
    const raw = await this.io.getItem(KEY);
    if (!raw) return { v: 2, owners: {} };
    const doc = JSON.parse(raw) as Document;
    if (doc.v !== 2 || !doc.owners || typeof doc.owners !== 'object' || Array.isArray(doc.owners))
      throw new Error('Saved favorites need recovery');
    for (const record of Object.values(doc.owners)) {
      if (
        !record ||
        !ids(record.ids) ||
        typeof record.hasEverLiked !== 'boolean' ||
        !Number.isSafeInteger(record.version) ||
        record.version < 0 ||
        !record.pending ||
        typeof record.pending !== 'object' ||
        Array.isArray(record.pending)
      )
        throw new Error('Saved favorites need recovery');
      for (const [id, op] of Object.entries(record.pending)) {
        if (
          !validPartId(id) ||
          !op ||
          typeof op.liked !== 'boolean' ||
          !Number.isSafeInteger(op.revision) ||
          op.revision < 0 ||
          op.revision > record.version
        )
          throw new Error('Saved favorites need recovery');
      }
    }
    return doc;
  }

  private snapshot(doc: Document, ownerId: string | null): FavoritesSnapshot {
    const record = doc.owners[ownerKey(ownerId)] ?? empty();
    return {
      record: {
        ...record,
        ids: [...record.ids],
        pending: Object.fromEntries(
          Object.entries(record.pending).map(([id, op]) => [id, { ...op }]),
        ),
      },
    };
  }

  private async write(doc: Document): Promise<void> {
    await this.io.setItem(KEY, JSON.stringify(doc));
  }

  open(ownerId: string | null): Promise<FavoritesSnapshot> {
    return this.run(async () => {
      const doc = await this.read();
      doc.owners[ownerKey(ownerId)] ??= empty();
      await this.write(doc);
      return this.snapshot(doc, ownerId);
    });
  }

  readOwner(ownerId: string | null): Promise<FavoritesSnapshot> {
    return this.run(async () => this.snapshot(await this.read(), ownerId));
  }

  setDesired(ownerId: string | null, id: string, liked: boolean): Promise<FavoritesSnapshot> {
    if (!validPartId(id)) return Promise.reject(new Error('Invalid favorite product ID'));
    return this.run(async () => {
      const doc = await this.read();
      const record = (doc.owners[ownerKey(ownerId)] ??= empty());
      record.version++;
      record.ids = liked ? unique([...record.ids, id]) : record.ids.filter((value) => value !== id);
      record.hasEverLiked ||= liked;
      if (ownerId !== null)
        record.pending = { ...record.pending, [id]: { liked, revision: record.version } };
      await this.write(doc);
      return this.snapshot(doc, ownerId);
    });
  }

  acknowledge(ownerId: string, id: string, revision: number): Promise<FavoritesSnapshot> {
    return this.run(async () => {
      const doc = await this.read();
      const record = (doc.owners[ownerKey(ownerId)] ??= empty());
      if (record.pending[id]?.revision === revision) delete record.pending[id];
      record.version++;
      await this.write(doc);
      return this.snapshot(doc, ownerId);
    });
  }

  applyRemote(ownerId: string, remoteIds: string[]): Promise<FavoritesSnapshot> {
    return this.run(async () => {
      const doc = await this.read();
      const record = (doc.owners[ownerKey(ownerId)] ??= empty());
      const next = new Set(remoteIds);
      for (const [id, op] of Object.entries(record.pending)) {
        if (op.liked) next.add(id);
        else next.delete(id);
      }
      record.ids = [...next];
      record.hasEverLiked ||= next.size > 0;
      record.version++;
      await this.write(doc);
      return this.snapshot(doc, ownerId);
    });
  }

  /**
   * Read-only view of the pre-sync, device-global `likes:v1` list, if one
   * exists. Never merged into any owner and never written back — a pure
   * archive read. Does not participate in `open`, `setDesired` or sync.
   */
  async readArchive(): Promise<StoredLikes> {
    const raw = await this.io.getItem(LEGACY_KEY);
    if (!raw) return { ids: [], hasEverLiked: false };
    const value = JSON.parse(raw) as { v?: number; ids?: unknown; hasEverLiked?: boolean };
    if (value.v !== 1 || !ids(value.ids)) throw new Error('Legacy favorites need recovery');
    return { ids: unique(value.ids), hasEverLiked: Boolean(value.hasEverLiked) };
  }
}

export const favoritesStorage = new FavoritesStorage();

// Compatibility exports address only the new guest namespace.
export async function loadLikes(): Promise<StoredLikes | null> {
  return (await favoritesStorage.open(null)).record;
}
export async function saveLikes(state: StoredLikes): Promise<void> {
  const current = (await favoritesStorage.open(null)).record;
  for (const id of new Set([...current.ids, ...state.ids]))
    await favoritesStorage.setDesired(null, id, state.ids.includes(id));
}
