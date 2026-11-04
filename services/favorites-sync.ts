import type { FavoritesTransport } from '@/services/favorites-api';
import { FavoritesStorage, validPartId, type FavoritesSnapshot } from '@/services/likes-storage';

export type FavoritesView = {
  likedIds: Set<string>;
  hasEverLiked: boolean;
  isHydrated: boolean;
  isSyncing: boolean;
  pendingIds: Set<string>;
  error: string | null;
};

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Favorites session ended'));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Favorites session ended'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** One immutable owner/session. Durable desired-state operations are replayed
 * idempotently; stopped sessions may finish storage writes, never HTTP writes. */
export class FavoritesSync {
  private active = true;
  private controller = new AbortController();
  private listeners = new Set<(view: FavoritesView) => void>();
  private initialized?: Promise<void>;
  private localTail: Promise<unknown> = Promise.resolve();
  private network?: Promise<void>;
  private dirty = false;
  private sequence = 0;
  private version = -1;
  private intents = new Map<string, { liked: boolean; sequence: number }>();
  private stored?: FavoritesSnapshot;
  private view: FavoritesView = {
    likedIds: new Set(),
    hasEverLiked: false,
    isHydrated: false,
    isSyncing: false,
    pendingIds: new Set(),
    error: null,
  };

  constructor(
    private readonly ownerId: string | null,
    private readonly storage: FavoritesStorage,
    private readonly transport?: FavoritesTransport,
    private readonly retryDelays: readonly number[] = [500, 1500],
    private readonly pause = wait,
    private readonly isCurrentSession: () => boolean = () => true,
  ) {}

  snapshot(): FavoritesView {
    return this.view;
  }
  subscribe(listener: (view: FavoritesView) => void): () => void {
    this.listeners.add(listener);
    listener(this.view);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(patch: Partial<FavoritesView> = {}): void {
    if (!this.active || !this.isCurrentSession()) return;
    const likedIds = new Set(this.stored?.record.ids ?? []);
    for (const [id, intent] of this.intents) {
      if (intent.liked) likedIds.add(id);
      else likedIds.delete(id);
    }
    this.view = {
      ...this.view,
      likedIds,
      hasEverLiked:
        this.view.hasEverLiked || this.stored?.record.hasEverLiked === true || likedIds.size > 0,
      pendingIds: new Set([
        ...Object.keys(this.stored?.record.pending ?? {}),
        ...this.intents.keys(),
      ]),
      ...patch,
    };
    for (const listener of this.listeners) listener(this.view);
  }

  private accept(snapshot: FavoritesSnapshot): void {
    if (snapshot.record.version < this.version) return;
    this.version = snapshot.record.version;
    this.stored = snapshot;
    this.emit();
  }

  private ready(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.storage
        .open(this.ownerId)
        .then((snapshot) => {
          this.accept(snapshot);
          this.emit({ isHydrated: true, error: null });
        })
        .catch((error: unknown) => {
          this.initialized = undefined;
          this.emit({
            isHydrated: true,
            error: error instanceof Error ? error.message : 'Favorites storage unavailable',
          });
          throw error;
        });
    }
    return this.initialized;
  }

  async start(): Promise<void> {
    try {
      await this.ready();
      await this.sync();
    } catch {
      /* State contains the recoverable storage error; no network was sent. */
    }
  }

  toggle(id: string): boolean {
    if (!this.active || !this.isCurrentSession() || !validPartId(id)) return false;
    const liked = !this.view.likedIds.has(id);
    const sequence = ++this.sequence;
    this.intents.set(id, { liked, sequence });
    this.emit({ hasEverLiked: true });
    this.persistIntent(id, sequence);
    return liked;
  }

  private persistIntent(id: string, sequence: number): void {
    const task = this.localTail
      .catch(() => undefined)
      .then(async () => {
        await this.ready();
        const intent = this.intents.get(id);
        if (intent?.sequence !== sequence) return;
        const snapshot = await this.storage.setDesired(this.ownerId, id, intent.liked);
        if (this.intents.get(id)?.sequence === sequence) this.intents.delete(id);
        this.accept(snapshot);
        this.dirty = true;
      });
    this.localTail = task;
    void task.then(
      () => {
        if (this.active) void this.sync();
      },
      (error: unknown) => {
        this.emit({
          error: error instanceof Error ? error.message : 'Favorites storage unavailable',
        });
      },
    );
  }

  /** Explicit retry also retries any intent whose persistence failed. */
  async retry(): Promise<void> {
    try {
      await this.ready();
      for (const [id, intent] of this.intents) this.persistIntent(id, intent.sequence);
      await this.localTail;
      await this.sync();
    } catch {
      /* A failed durable write must never be followed by HTTP. */
    }
  }

  private current(): void {
    if (!this.active || !this.isCurrentSession() || this.controller.signal.aborted)
      throw new Error('Favorites session ended');
  }

  private async roundTrip(): Promise<void> {
    await this.localTail;
    this.current();
    if (this.ownerId === null || !this.transport) return;
    const snapshot = await this.storage.readOwner(this.ownerId);
    for (const [id, intent] of Object.entries(snapshot.record.pending)) {
      this.current();
      await this.transport.set(id, intent.liked, this.controller.signal);
      this.current();
      this.accept(await this.storage.acknowledge(this.ownerId, id, intent.revision));
    }
    this.current();
    const ids = await this.transport.fetchAll(this.controller.signal);
    this.current();
    this.accept(await this.storage.applyRemote(this.ownerId, ids));
  }

  sync(): Promise<void> {
    if (!this.active || !this.isCurrentSession() || this.ownerId === null || !this.transport)
      return Promise.resolve();
    this.dirty = true;
    if (this.network) return this.network;
    const work = (async () => {
      this.emit({ isSyncing: true });
      do {
        this.dirty = false;
        try {
          await this.ready();
          await this.localTail;
        } catch {
          break;
        }
        for (let attempt = 0; ; attempt++) {
          try {
            await this.roundTrip();
            this.emit({ error: null });
            break;
          } catch (error) {
            if (!this.active) return;
            if (attempt >= this.retryDelays.length) {
              this.emit({
                error: error instanceof Error ? error.message : 'Favorites sync failed',
              });
              // Durable operations remain available to a later retry/restart.
              this.dirty = false;
              return;
            }
            await this.pause(this.retryDelays[attempt], this.controller.signal);
          }
        }
      } while (this.active && this.dirty);
    })()
      .catch((error: unknown) => {
        this.emit({ error: error instanceof Error ? error.message : 'Favorites sync failed' });
      })
      .finally(() => {
        this.network = undefined;
        this.emit({ isSyncing: false });
      });
    this.network = work;
    return work;
  }

  stop(): void {
    this.active = false;
    this.controller.abort();
    this.listeners.clear();
  }
}
