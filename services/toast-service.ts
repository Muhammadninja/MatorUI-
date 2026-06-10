export type ToastKind = 'success' | 'danger' | 'info';

export type ToastInput = {
  /** Stable ID. Auto-generated if omitted. */
  id?: string;
  kind: ToastKind;
  /** Short headline. Keep under ~40 chars. */
  title: string;
  /** Optional second line. */
  description?: string;
  /** Auto-dismiss delay in ms. Pass 0 to disable. Default 3500. */
  duration?: number;
  /** Optional action label rendered on the right. */
  actionLabel?: string;
  /** Called when the user taps the action. */
  onAction?: () => void;
};

export type Toast = Required<Pick<ToastInput, 'id' | 'kind' | 'title' | 'duration'>> &
  Omit<ToastInput, 'id' | 'kind' | 'title' | 'duration'>;

type ToastListener = (toasts: readonly Toast[]) => void;

const DEFAULT_DURATION = 3500;
/** Hard cap on simultaneous toasts. Beyond this, the oldest is dropped
 *  from the queue when a new one comes in. Prevents a stream of
 *  add-to-cart confirmations from blanketing the screen. */
const MAX_TOASTS = 3;

/**
 * Singleton bus for app-wide toasts. Designed to be callable from anywhere
 * — API error handlers, auth guards, services — without React state plumbing.
 * The `<AppToastHost />` subscribes and renders the active stack.
 */
class ToastService {
  private toasts: Toast[] = [];
  private listeners = new Set<ToastListener>();
  private counter = 0;

  /** Subscribe to the live toast list. Returns an unsubscribe fn. */
  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(input: ToastInput): string {
    const id = input.id ?? this.nextId();
    const toast: Toast = {
      id,
      kind: input.kind,
      title: input.title,
      duration: input.duration ?? DEFAULT_DURATION,
      description: input.description,
      actionLabel: input.actionLabel,
      onAction: input.onAction,
    };
    // Replace if the same id already exists — keeps callers idempotent.
    const existingIdx = this.toasts.findIndex((t) => t.id === id);
    if (existingIdx >= 0) {
      this.toasts = [
        ...this.toasts.slice(0, existingIdx),
        toast,
        ...this.toasts.slice(existingIdx + 1),
      ];
    } else {
      this.toasts = [...this.toasts, toast];
    }
    // Enforce the visible-stack cap. Without this, rapid-fire callers
    // (e.g. tapping "Add to cart" 20 times) blanket the screen.
    if (this.toasts.length > MAX_TOASTS) {
      this.toasts = this.toasts.slice(-MAX_TOASTS);
    }
    this.emit();
    return id;
  }

  success(title: string, opts?: Omit<ToastInput, 'kind' | 'title'>): string {
    return this.show({ ...opts, kind: 'success', title });
  }

  danger(title: string, opts?: Omit<ToastInput, 'kind' | 'title'>): string {
    return this.show({ ...opts, kind: 'danger', title });
  }

  info(title: string, opts?: Omit<ToastInput, 'kind' | 'title'>): string {
    return this.show({ ...opts, kind: 'info', title });
  }

  dismiss(id: string): void {
    const next = this.toasts.filter((t) => t.id !== id);
    if (next.length === this.toasts.length) return;
    this.toasts = next;
    this.emit();
  }

  dismissAll(): void {
    if (this.toasts.length === 0) return;
    this.toasts = [];
    this.emit();
  }

  private emit(): void {
    const snapshot = this.toasts;
    this.listeners.forEach((l) => l(snapshot));
  }

  private nextId(): string {
    this.counter += 1;
    return `t_${this.counter}_${this.toasts.length}`;
  }
}

export const toastService = new ToastService();
export default toastService;
