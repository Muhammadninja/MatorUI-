import {
  GARAGE_SOCKET_CHANNEL,
  GARAGE_SOCKET_EVENTS,
  garageService,
  type GarageSocketEvent,
} from '@/services/garage-service';

/**
 * Native-WebSocket consumer for the garage realtime channel.
 * Pure transport — no React. The hook layer (`hooks/use-garage-realtime`)
 * is the only thing UI code touches. This module is responsible for:
 *
 *   - connection lifecycle (open, close, reconnect with backoff)
 *   - heartbeat (ping every 30s; if server doesn't ack a pong within
 *     45s, close-and-reconnect so a half-open socket doesn't black-hole
 *     events)
 *   - message decoding + envelope validation (drops malformed frames
 *     silently — the wire is untrusted)
 *   - dispatch into `garageService.applyRealtimeEvent(event)` so the
 *     in-memory cache mutates and downstream subscribers re-render
 *
 * Backoff: 1s → 2s → 4s → 8s → 30s cap. Jitter ±25% prevents thundering
 * herds against the realtime gateway on a mass-disconnect.
 */

export type RealtimeListener = (event: GarageSocketEvent) => void;
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed';
export type ConnectionStateListener = (state: ConnectionState) => void;

export type GarageRealtimeConfig = {
  /** WebSocket endpoint. Typically `wss://api.mator.uz/realtime`. */
  url: string;
  /** Bearer token resolver — called fresh on every connect so a
   *  rotated token gets picked up by the next reconnect. */
  getAuthToken: () => Promise<string | null> | string | null;
  /** Authenticated user id, used in the channel name `garage:{userId}`. */
  userId: string;
};

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export class GarageRealtimeClient {
  private socket: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private listeners = new Set<RealtimeListener>();
  private stateListeners = new Set<ConnectionStateListener>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitClose = false;
  private config: GarageRealtimeConfig | null = null;

  configure(config: GarageRealtimeConfig): void {
    this.config = config;
  }

  start(): void {
    if (!this.config) {
      if (__DEV__) {
        console.warn('GarageRealtimeClient.start() called before configure()');
      }
      return;
    }
    if (this.state === 'open' || this.state === 'connecting') return;
    this.explicitClose = false;
    void this.connect();
  }

  stop(): void {
    this.explicitClose = true;
    this.clearTimers();
    if (this.socket) {
      // 1000 = normal closure
      try {
        this.socket.close(1000, 'Client stop');
      } catch {
        // Already closing — ignore.
      }
      this.socket = null;
    }
    this.setState('closed');
  }

  subscribe(listener: RealtimeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onConnectionStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  // ── Internals ──────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    if (!this.config) return;
    this.setState('connecting');
    let token: string | null = null;
    try {
      token = await this.config.getAuthToken();
    } catch {
      token = null;
    }
    if (this.explicitClose) return;
    const url = this.buildUrl(token);
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('open');
      this.send({
        type: 'subscribe',
        channel: this.buildChannelName(),
        events: GARAGE_SOCKET_EVENTS,
      });
      this.startHeartbeat();
    };

    socket.onmessage = (msg: { data: unknown }) => {
      this.handleMessage(msg.data);
    };

    socket.onerror = () => {
      // Errors precede an onclose — let onclose drive reconnection.
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.socket = null;
      if (this.explicitClose) {
        this.setState('closed');
        return;
      }
      this.setState('closed');
      this.scheduleReconnect();
    };
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string' || raw.length === 0) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const envelope = parsed as Record<string, unknown>;

    // Server pong — reset heartbeat timeout.
    if (envelope.type === 'pong') {
      this.armHeartbeatTimeout();
      return;
    }

    if (envelope.type !== 'event') return;
    const payload = envelope.payload;
    if (!isGarageSocketEvent(payload)) return;
    this.dispatch(payload);
  }

  private dispatch(event: GarageSocketEvent): void {
    // Cache mutation first — listeners that re-render off the garage
    // service will already see the new state by the time their event
    // listeners fire below.
    garageService.applyRealtimeEvent(event);
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (err) {
        if (__DEV__) console.warn('Realtime listener threw:', err);
      }
    });
  }

  private send(frame: object): void {
    if (this.socket?.readyState !== 1 /* OPEN */) return;
    try {
      this.socket.send(JSON.stringify(frame));
    } catch {
      // Socket died mid-write — close handler will reconnect.
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.armHeartbeatTimeout();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', t: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private armHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutTimer) clearTimeout(this.heartbeatTimeoutTimer);
    this.heartbeatTimeoutTimer = setTimeout(() => {
      // Server hasn't ack'd a ping inside the window — kill the
      // socket so onclose fires and we reconnect cleanly.
      try {
        this.socket?.close(4000, 'Heartbeat timeout');
      } catch {
        // ignore — close handler still runs
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.explicitClose) return;
    if (this.reconnectTimer) return;
    const base = Math.min(
      INITIAL_BACKOFF_MS * 2 ** this.reconnectAttempt,
      MAX_BACKOFF_MS,
    );
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(0, base + jitter);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private clearTimers(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateListeners.forEach((l) => l(next));
  }

  private buildChannelName(): string {
    if (!this.config) return GARAGE_SOCKET_CHANNEL;
    return `${GARAGE_SOCKET_CHANNEL}:${this.config.userId}`;
  }

  private buildUrl(token: string | null): string {
    if (!this.config) return '';
    const url = new URL(this.config.url);
    if (token) url.searchParams.set('access_token', token);
    url.searchParams.set('channel', this.buildChannelName());
    return url.toString();
  }
}

export const garageRealtime = new GarageRealtimeClient();

function isGarageSocketEvent(value: unknown): value is GarageSocketEvent {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (typeof o.event !== 'string') return false;
  if (!GARAGE_SOCKET_EVENTS.includes(o.event as GarageSocketEvent['event'])) return false;
  if (typeof o.snapshotVersion !== 'string') return false;
  if (typeof o.timestamp !== 'string') return false;
  return true;
}
