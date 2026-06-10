/**
 * Integration tests for the chat transport — covers the streaming
 * protocol the smart-agent backend will produce: token chunks, tool
 * call lifecycle (start → running → success), conversation persistence,
 * and feedback submission.
 *
 * Same convention as the other *-flow tests: pure-logic, React-free,
 * runs under Vitest in Node.
 */
import { beforeEach, describe, expect, test } from 'vitest';

import { MockChatTransport } from './chat-api';
import type {
  AiChatConversationSummary,
  AiChatSendMessageRequest,
  AiChatToolCall,
  ChatStreamEvent,
} from '@/types/ai-chat';

const SIMPLE_REQUEST: AiChatSendMessageRequest = {
  conversationId: null,
  message: 'Hello there',
  vehicleContext: null,
};

const ORDER_REQUEST: AiChatSendMessageRequest = {
  conversationId: null,
  message: 'Where is my order?',
  vehicleContext: null,
};

const SEARCH_REQUEST: AiChatSendMessageRequest = {
  conversationId: null,
  message: 'find me a turbo for my build',
  vehicleContext: {
    makeId: 'subaru',
    modelId: 'wrx',
    trimId: 'sti',
    selectedCarName: '2020 Subaru WRX STI',
  },
};

async function collectStream(
  stream: AsyncIterable<ChatStreamEvent>,
): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const evt of stream) out.push(evt);
  return out;
}

describe('MockChatTransport — conversation persistence', () => {
  test('listConversations returns the seeded entry sorted newest-first', async () => {
    const t = new MockChatTransport();
    const list = await t.listConversations();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.id).toBe('chat-history-1');
    expect(list[0]!.messages.length).toBe(2);
  });

  test('getConversation returns the same shape for a known id', async () => {
    const t = new MockChatTransport();
    const c = await t.getConversation('chat-history-1');
    expect(c).not.toBeNull();
    expect(c!.vehicleContext?.makeId).toBe('bmw');
  });

  test('getConversation returns null for an unknown id', async () => {
    const t = new MockChatTransport();
    const c = await t.getConversation('nope');
    expect(c).toBeNull();
  });

  test('deleteConversation removes the entry from subsequent reads', async () => {
    const t = new MockChatTransport();
    await t.deleteConversation('chat-history-1');
    const c = await t.getConversation('chat-history-1');
    expect(c).toBeNull();
    const list = await t.listConversations();
    expect(list.find((x) => x.id === 'chat-history-1')).toBeUndefined();
  });
});

describe('MockChatTransport — streaming protocol', () => {
  let transport: MockChatTransport;
  beforeEach(() => {
    transport = new MockChatTransport();
  });

  test('simple message yields tokens then a done event', async () => {
    const events = await collectStream(transport.streamMessage(SIMPLE_REQUEST));
    const types = events.map((e) => e.type);
    // No tool-call events for "hello there".
    expect(types.filter((t) => t.startsWith('tool_call'))).toEqual([]);
    expect(types.filter((t) => t === 'token').length).toBeGreaterThan(2);
    expect(types[types.length - 1]).toBe('done');
  });

  test('done event carries replyId, suggestions, title, createdAt, conversationId', async () => {
    const events = await collectStream(transport.streamMessage(SIMPLE_REQUEST));
    const done = events[events.length - 1];
    expect(done.type).toBe('done');
    if (done.type !== 'done') throw new Error('expected done');
    expect(done.replyId).toMatch(/^assistant-/);
    expect(done.suggestions.length).toBeGreaterThan(0);
    expect(done.title).toBe('Matorui Assistant');
    expect(done.conversationId).toBeTruthy();
    expect(typeof done.createdAt).toBe('string');
  });

  test('order-related message triggers a lookup_order tool call lifecycle', async () => {
    const events = await collectStream(transport.streamMessage(ORDER_REQUEST));
    const starts = events.filter((e) => e.type === 'tool_call_start');
    expect(starts.length).toBeGreaterThanOrEqual(1);
    const start = starts[0];
    if (start.type !== 'tool_call_start') throw new Error('expected start');
    expect(start.toolCall.name).toBe('lookup_order');
    expect(start.toolCall.status).toBe('pending');

    // The same tool call id appears in subsequent updates.
    const updates = events.filter(
      (e): e is Extract<ChatStreamEvent, { type: 'tool_call_update' }> =>
        e.type === 'tool_call_update' && e.toolCallId === start.toolCall.id,
    );
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates[0]!.status).toBe('running');
    expect(updates[updates.length - 1]!.status).toBe('success');
    expect(updates[updates.length - 1]!.result?.summary).toBeTruthy();
    expect(updates[updates.length - 1]!.result?.deepLink?.href).toContain('/track-order');
  });

  test('search-related message triggers a search_parts tool call', async () => {
    const events = await collectStream(transport.streamMessage(SEARCH_REQUEST));
    const start = events.find((e) => e.type === 'tool_call_start');
    expect(start?.type).toBe('tool_call_start');
    if (start?.type !== 'tool_call_start') throw new Error('expected start');
    expect(start.toolCall.name).toBe('search_parts');
  });

  test('tool calls in a message all complete before token streaming begins', async () => {
    const events = await collectStream(transport.streamMessage(ORDER_REQUEST));
    const firstToken = events.findIndex((e) => e.type === 'token');
    const lastToolUpdate = events.reduce(
      (acc, e, i) => (e.type === 'tool_call_update' ? i : acc),
      -1,
    );
    expect(firstToken).toBeGreaterThan(lastToolUpdate);
  });

  test('AbortSignal cancels mid-stream', async () => {
    const controller = new AbortController();
    const stream = transport.streamMessage(SIMPLE_REQUEST, controller.signal);
    const iter = stream[Symbol.asyncIterator]();
    // Read one event, then abort.
    await iter.next();
    controller.abort();
    await expect(iter.next()).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('MockChatTransport — feedback', () => {
  test('submitFeedback resolves', async () => {
    const t = new MockChatTransport();
    await expect(
      t.submitFeedback({ messageId: 'm-1', kind: 'up' }),
    ).resolves.toBeUndefined();
    await expect(
      t.submitFeedback({ messageId: 'm-2', kind: 'down', note: 'wrong part' }),
    ).resolves.toBeUndefined();
  });
});

describe('Tool call shapes', () => {
  test('every tool call start event carries the contract fields', async () => {
    const t = new MockChatTransport();
    const events = await collectStream(t.streamMessage(ORDER_REQUEST));
    for (const e of events) {
      if (e.type !== 'tool_call_start') continue;
      const tc: AiChatToolCall = e.toolCall;
      expect(tc.id).toBeTruthy();
      expect(tc.name).toBeTruthy();
      expect(tc.label).toBeTruthy();
      expect(tc.status).toBe('pending');
      expect(typeof tc.args).toBe('object');
    }
  });
});

describe('Conversation snapshot integrity', () => {
  test('seeded conversation matches the AiChatConversationSummary shape', async () => {
    const t = new MockChatTransport();
    const list = await t.listConversations();
    const c: AiChatConversationSummary = list[0]!;
    expect(c.id).toBeTruthy();
    expect(typeof c.title).toBe('string');
    expect(typeof c.preview).toBe('string');
    expect(typeof c.updatedAt).toBe('string');
    expect(Array.isArray(c.messages)).toBe(true);
    expect(c.messages.every((m) => m.id && m.role && m.body)).toBe(true);
  });
});
