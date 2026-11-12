// The realtime access token must travel in the WebSocket handshake's
// subprotocol header, never in the URL: URLs are written to proxy access logs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GarageRealtimeClient, WS_BEARER_PROTOCOL } from '@/services/garage-realtime';

type Opened = { url: string; protocols?: string | string[] };

describe('garage realtime handshake', () => {
  const opened: Opened[] = [];
  const original = globalThis.WebSocket;

  beforeEach(() => {
    opened.length = 0;
    class FakeSocket {
      readyState = 0;
      constructor(url: string, protocols?: string | string[]) {
        opened.push({ url, protocols });
      }
      close() {}
      send() {}
    }
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  afterEach(() => {
    vi.stubGlobal('WebSocket', original);
  });

  it('sends the token as a subprotocol and keeps it out of the URL', async () => {
    const client = new GarageRealtimeClient();
    client.configure({
      url: 'wss://api.example.test/realtime',
      getAuthToken: () => 'header.payload.signature',
      userId: 'usr_1',
    });
    client.start();
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    client.stop();

    const [{ url, protocols }] = opened;
    expect(protocols).toEqual([WS_BEARER_PROTOCOL, 'header.payload.signature']);
    expect(url).not.toContain('header.payload.signature');
    expect(url).not.toContain('token=');
    expect(new URL(url).searchParams.get('channel')).toContain('usr_1');
  });
});
