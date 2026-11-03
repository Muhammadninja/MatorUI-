export type ToastKind = 'success' | 'danger' | 'warning' | 'info';

export type ToastInput = {
  /** Stable ID. Auto-generated if omitted. */
  id?: string;
  kind: ToastKind;
  /** Short headline. Keep under ~40 chars. */
  title: string;
  /** Optional second line. */
  description?: string;
  /** Auto-dismiss delay in ms. Pass 0 to disable. Defaults by kind; a toast
   *  with an action stays until dismissed. */
  duration?: number;
  /** Optional action label rendered on the right. */
  actionLabel?: string;
  /** Called when the user taps the action. */
  onAction?: () => void;
};

export type Toast = Required<Pick<ToastInput, 'id' | 'kind' | 'title' | 'duration'>> &
  Omit<ToastInput, 'id' | 'kind' | 'title' | 'duration'>;

type ToastListener = (toasts: readonly Toast[]) => void;

/** Brief confirmations clear quickly; anything the user may need to act on
 *  stays long enough to read. */
const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3000,
  info: 4000,
  warning: 5000,
  danger: 6000,
};

/**
 * Singleton bus for app-wide toasts. Designed to be callable from anywhere
 * — API error handlers, auth guards, services — without React state plumbing.
 * One toast shows at a time: a new one replaces the current one, so rapid
 * actions (tapping "Add to cart" 20 times) never pile up over the screen.
 * The `<AppToastHost />` subscribes and renders it.
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
      duration: input.duration ?? (input.actionLabel ? 0 : DEFAULT_DURATION[input.kind]),
      description: input.description,
      actionLabel: input.actionLabel,
      onAction: input.onAction,
    };
    this.toasts = [toast];
    this.emit();
    return id;
  }

  success(title: string, opts?: Omit<ToastInput, 'kind' | 'title'>): string {
    return this.show({ ...opts, kind: 'success', title });
  }

  danger(title: string, opts?: Omit<ToastInput, 'kind' | 'title'>): string {
    return this.show({ ...opts, kind: 'danger', title });
  }

  warning(title: string, opts?: Omit<ToastInput, 'kind' | 'title'>): string {
    return this.show({ ...opts, kind: 'warning', title });
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
