import { beforeEach, describe, expect, test, vi } from 'vitest';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/services/api-client', () => ({ apiClient: { post, get } }));
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

import { SourcingChatTransport } from './chat-api';
import { resetSourcingCapabilities } from './sourcing-capabilities';
import type { AiChatSendMessageRequest, ChatStreamEvent } from '@/types/ai-chat';

const VEHICLE = {
  makeId: 'chevrolet',
  modelId: 'cobalt',
  trimId: '',
  selectedCarName: 'Chevrolet Cobalt 2026',
  vehicleId: 'v-1',
  vin: 'XUFCB6950K0000017',
};

async function send(input: Partial<AiChatSendMessageRequest>) {
  const events: ChatStreamEvent[] = [];
  const request = { message: 'radiator kerak', requestId: 'user-1', ...input };
  for await (const event of new SourcingChatTransport().streamMessage(request)) events.push(event);
  return events;
}

const done = (events: ChatStreamEvent[]) => {
  const last = events[events.length - 1];
  if (last?.type !== 'done') throw new Error('no done event');
  return last;
};

beforeEach(() => {
  post.mockReset().mockResolvedValue({ intent: 'GENERAL_QUESTION', reply_text: 'ok' });
  get.mockReset().mockResolvedValue({ contract_version: 2, ticket_submission_enabled: true });
  resetSourcingCapabilities();
});

describe('what is sent', () => {
  test('only the message and history, with no VIN or text hint', async () => {
    await send({ vehicleContext: VEHICLE, isAuthenticated: true, history: [] });
    const body = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['history', 'message']);
    expect(body.message).toBe('radiator kerak');
    expect(JSON.stringify(body)).not.toContain(VEHICLE.vin);
  });

  test('request id and vehicle id travel as headers', async () => {
    await send({ vehicleContext: VEHICLE });
    expect(post.mock.calls[0]![2].headers).toEqual({
      'Idempotency-Key': 'user-1',
      'X-Selected-Vehicle-Id': 'v-1',
    });
  });

  test('a retry of the same message keeps its request id', async () => {
    await send({});
    await send({});
    expect(post.mock.calls.map((c) => c[2].headers['Idempotency-Key'])).toEqual([
      'user-1',
      'user-1',
    ]);
  });

  test('a photo request names its part in headers, not the body', async () => {
    await send({ photoRequestProductId: 'part_stock_6567' });
    expect(post.mock.calls[0]![2].headers).toEqual({
      'Idempotency-Key': 'user-1',
      'X-Chat-Intent': 'request_photo',
      'X-Product-Id': 'part_stock_6567',
    });
    expect(Object.keys(post.mock.calls[0]![1]).sort()).toEqual(['history', 'message']);
  });

  test('without a vehicle no vehicle header is sent', async () => {
    await send({});
    expect(post.mock.calls[0]![2].headers).toEqual({ 'Idempotency-Key': 'user-1' });
  });

  test('allows the model time to answer', async () => {
    await send({});
    expect(post.mock.calls[0]![2].timeoutMs).toBeGreaterThan(15_000);
  });

  test('a held request names the message to send after sign-in', async () => {
    post.mockResolvedValue({ intent: 'SOURCING_AUTH_REQUIRED', all_parts_accounted: true });
    const events = await send({ userMessageId: 'user-9', requestId: 'user-9:none' });
    expect(done(events).sourcing).toMatchObject({ userMessageId: 'user-9' });
  });
});

describe('until the backend confirms it supports this chat', () => {
  test.each([
    ['an old backend with no such endpoint', () => get.mockRejectedValue(new Error('404'))],
    ['an older contract', () => get.mockResolvedValue({ contract_version: 1 })],
    ['an empty answer', () => get.mockResolvedValue({})],
  ])('%s: nothing is sent', async (_name, arrange) => {
    arrange();
    const events = await send({ isAuthenticated: true });
    expect(post).not.toHaveBeenCalled();
    expect(done(events).chatUnavailable).toBe(true);
    expect(done(events).sourcing).toBeUndefined();
  });

  test('a later deploy takes effect on the next message', async () => {
    get.mockRejectedValueOnce(new Error('404'));
    await send({});
    expect(post).not.toHaveBeenCalled();
    get.mockResolvedValue({ contract_version: 2 });
    await send({});
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('a confirmed backend is not asked again on every message', async () => {
    await send({});
    await send({});
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('what comes back', () => {
  test('no confirmation is issued when the request fails', async () => {
    post.mockRejectedValue(new Error('Request timed out.'));
    await expect(send({ isAuthenticated: true })).rejects.toThrow('Request timed out.');
  });

  test('the server promise is not shown for a ticket', async () => {
    post.mockResolvedValue({
      intent: 'CREATE_SOURCING_TICKET',
      reply_text: 'в течение 15 минут',
      ticket_id: 't1',
    });
    const events = await send({ isAuthenticated: true });
    expect(events.filter((e) => e.type === 'token')).toEqual([]);
    expect(done(events).sourcing?.status).toBe('received');
  });

  test('catalog matches arrive as links, not text', async () => {
    post.mockResolvedValue({
      intent: 'FOUND_IN_STOCK',
      reply_text: 'Нашёл',
      items: [{ id: 'p1', title: 'Фильтр', price: '50 000 сум' }],
    });
    const events = await send({});
    const text = events.flatMap((e) => (e.type === 'token' ? [e.value] : [])).join('');
    expect(text).toBe('Нашёл');
    expect(done(events).partGroups?.[0]?.links[0]?.id).toBe('p1');
  });
});
