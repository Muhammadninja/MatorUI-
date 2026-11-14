import {
  GARAGE_SOCKET_CHANNEL,
  GARAGE_SOCKET_EVENTS,
  garageService,
  type GarageSocketEvent,
} from '@/services/garage-service';
import { stagingAccessHeaders } from '@/services/staging-access';

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

/** Marker subprotocol; the token follows it. Must match the backend gateway. */
export const WS_BEARER_PROTOCOL = 'mator.bearer';

/** React Native's WebSocket takes handshake headers; the DOM typing does not say so. */
type NativeWebSocket = new (
  url: string,
  protocols: string[] | null,
  options: { headers: Record<string, string> },
) => WebSocket;

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

/**
 * Application close codes the realtime gateway sends (see backend WS spec).
 * Reconnecting on these won't help, so we stop instead of hammering:
 *   4400 invalid_channel · 4401 unauthorized · 4403 forbidden_channel
 *   4408 too_many_connections (>15 sockets for this user)
 * `4429 rate_limited` (>30 connects/60s per IP) is NOT terminal — we back
 * off hard and try again rather than give up.
 */
const TERMINAL_CLOSE_CODES = new Set([4400, 4401, 4403, 4408]);
const RATE_LIMITED_CLOSE_CODE = 4429;
/** Floor backoff applied after a 4429 so we respect the gateway's window. */
const RATE_LIMITED_BACKOFF_MS = 10_000;

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
    let token: string | null;
    try {
      token = await this.config.getAuthToken();
    } catch {
      // A THROW here is a transient failure to READ a token that likely exists —
      // NOT a genuine "signed out" (that resolves to `null`, handled below).
      // Connecting token-less would draw a terminal 4401 close and kill realtime
      // for the whole session, so back off and retry instead. `scheduleReconnect`
      // uses capped exponential backoff, so a persistent throw won't hot-loop.
      if (this.explicitClose) return;
      this.scheduleReconnect();
      return;
    }
    if (this.explicitClose) return;
    const url = this.buildUrl();
    let socket: WebSocket;
    try {
      // The access token rides in the `Sec-WebSocket-Protocol` handshake
      // header, not the URL: URLs end up in proxy access logs. The gateway
      // selects the marker protocol and never echoes the token.
      // Staging only: the proxy credential rides as a header (React Native's
      // third WebSocket argument); production sockets are opened as before.
      const proxy = stagingAccessHeaders();
      const protocols = token ? [WS_BEARER_PROTOCOL, token] : null;
      if (Object.keys(proxy).length) socket = new (WebSocket as unknown as NativeWebSocket)(url, protocols, { headers: proxy });
      else socket = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
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

    socket.onclose = (event?: { code?: number }) => {
      this.stopHeartbeat();
      this.socket = null;
      this.setState('closed');
      if (this.explicitClose) return;

      const code = event?.code;
      // Auth/channel/too-many-connections: retrying with the same token or
      // over the same over-subscribed user won't recover — stop cleanly so
      // the next explicit start() (re-auth, app foreground) tries again.
      if (code != null && TERMINAL_CLOSE_CODES.has(code)) {
        if (__DEV__) console.warn(`Realtime closed with terminal code ${code}; not reconnecting.`);
        return;
      }
      // Rate-limited: back off well past the gateway's per-IP window.
      if (code === RATE_LIMITED_CLOSE_CODE) {
        this.scheduleReconnect(RATE_LIMITED_BACKOFF_MS);
        return;
      }
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

  private scheduleReconnect(minDelayMs = 0): void {
    if (this.explicitClose) return;
    if (this.reconnectTimer) return;
    const base = Math.min(
      INITIAL_BACKOFF_MS * 2 ** this.reconnectAttempt,
      MAX_BACKOFF_MS,
    );
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    // `minDelayMs` lets a rate-limited (4429) close enforce a longer floor
    // than the current backoff step would otherwise pick.
    const delay = Math.max(minDelayMs, Math.max(0, base + jitter));
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

  private buildUrl(): string {
    if (!this.config) return '';
    const url = new URL(this.config.url);
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
