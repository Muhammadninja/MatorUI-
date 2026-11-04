import { beforeEach, describe, expect, test, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/services/api-client', () => ({ apiClient: { post } }));
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

import { SourcingChatTransport } from './chat-api';
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
});

describe('what is sent', () => {
  test('body holds only fields the endpoint accepts, since it rejects unknown ones', async () => {
    await send({ vehicleContext: VEHICLE, isAuthenticated: true, history: [] });
    const body = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['history', 'message', 'vin']);
    expect(body.vin).toBe(VEHICLE.vin);
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

  test('the vehicle hint adds no Cyrillic, so an Uzbek message stays Uzbek', async () => {
    await send({ vehicleContext: VEHICLE });
    const { message } = post.mock.calls[0]![1] as { message: string };
    expect(message).toContain('Chevrolet Cobalt 2026');
    expect(message).not.toMatch(/[Ѐ-ӿ]/);
  });

  test('without a vehicle nothing is added', async () => {
    await send({});
    expect(post.mock.calls[0]![1].message).toBe('radiator kerak');
    expect(post.mock.calls[0]![2].headers).toEqual({ 'Idempotency-Key': 'user-1' });
  });

  test('allows the model time to answer', async () => {
    await send({});
    expect(post.mock.calls[0]![2].timeoutMs).toBeGreaterThan(15_000);
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
