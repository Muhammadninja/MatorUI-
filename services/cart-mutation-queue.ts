type MutationTicket = { id: string; revision: number; epoch: number };

/** Orders HTTP writes and identifies responses that still belong to the UI. */
export class CartMutationQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private epoch = 0;
  private revisions = new Map<string, number>();
  private counts = new Map<string, number>();
  private version = 0;

  readVersion(): number { return this.version; }

  invalidate(newSession = false) {
    this.version += 1;
    this.epoch += 1;
    this.revisions.clear();
    this.counts.clear();
    // A different session must not wait on the old account's network calls.
    if (newSession) this.tail = Promise.resolve();
  }

  begin(id: string): MutationTicket {
    this.version += 1;
    // Clearing supersedes every older item response, not only this key.
    if (id === 'cart') this.invalidate();
    const revision = (this.revisions.get(id) ?? 0) + 1;
    this.revisions.set(id, revision);
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1);
    return { id, revision, epoch: this.epoch };
  }

  isLatest(ticket: MutationTicket): boolean {
    return ticket.epoch === this.epoch && this.revisions.get(ticket.id) === ticket.revision;
  }

  enqueue<T>(ticket: MutationTicket, send: () => Promise<T>): Promise<T | undefined> {
    return this.read(() => ticket.epoch === this.epoch ? send() : Promise.resolve(undefined));
  }

  /** Reads wait for earlier writes so they cannot observe pre-mutation state. */
  read<T>(send: () => Promise<T>): Promise<T | undefined> {
    const epoch = this.epoch;
    const result = this.tail.then(() => epoch === this.epoch ? send() : undefined);
    // A rejected earlier write must not stop later writes from reaching the API.
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  /** True only after the final request for this item's current epoch settles. */
  finish(ticket: MutationTicket): boolean {
    if (ticket.epoch !== this.epoch) return false;
    const remaining = (this.counts.get(ticket.id) ?? 1) - 1;
    if (remaining > 0) this.counts.set(ticket.id, remaining);
    else this.counts.delete(ticket.id);
    return remaining === 0;
  }
}
