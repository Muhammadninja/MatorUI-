/**
 * Transport contract for the AI chat + conversation persistence APIs.
 * Implement once for the mock environment (`MockChatTransport`, below),
 * once for HTTP (stub at the bottom), and swap by reassigning the
 * `chatTransport` constant.
 *
 * Mirrors `cart-api.ts` / `orders-api.ts`: same swap-once pattern,
 * AbortSignal on reads, AsyncIterable for streaming.
 */
import type {
  AiChatConversationSummary,
  AiChatFeedbackInput,
  AiChatSendMessageRequest,
  AiChatToolCall,
  ChatStreamEvent,
} from '@/types/ai-chat';

// ── Interface ────────────────────────────────────────────────────────

export interface ChatTransport {
  listConversations(signal?: AbortSignal): Promise<AiChatConversationSummary[]>;
  getConversation(
    id: string,
    signal?: AbortSignal,
  ): Promise<AiChatConversationSummary | null>;
  deleteConversation(id: string): Promise<void>;
  /**
   * Async-iterable stream of events. Caller `for await`s. Aborting the
   * provided AbortSignal throws AbortError mid-iteration; partial state
   * the caller already pushed to the UI is left as-is.
   */
  streamMessage(
    input: AiChatSendMessageRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>;
  submitFeedback(input: AiChatFeedbackInput): Promise<void>;
}

export const AI_CHAT_API_BASE_PATH = '/v1/chatbot';

// ── Internal helpers ─────────────────────────────────────────────────

const PER_TOKEN_MS = 30;
const TOOL_RUNNING_MS = 600;
const TOOL_FINISH_MS = 250;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function buildVehiclePrefix(
  vehicleContext: AiChatSendMessageRequest['vehicleContext'],
): string {
  return vehicleContext?.selectedCarName
    ? `For your ${vehicleContext.selectedCarName}, `
    : '';
}

/**
 * Decide which (if any) tools the agent should invoke for a given user
 * message. Real agent: model decides. Mock: keyword routing. Returning
 * an empty array means "answer with text only."
 */
function planToolCalls(message: string): AiChatToolCall[] {
  const lower = message.toLowerCase();
  const calls: AiChatToolCall[] = [];

  if (lower.includes('order') || lower.includes('track')) {
    calls.push({
      id: makeId('tc'),
      name: 'lookup_order',
      args: { query: 'latest_in_transit' },
      status: 'pending',
      label: 'Looking up your latest in-transit order',
    });
  }
  if (lower.includes('find') || lower.includes('search') || lower.includes('part')) {
    calls.push({
      id: makeId('tc'),
      name: 'search_parts',
      args: { query: message },
      status: 'pending',
      label: `Searching catalogue for "${message.slice(0, 40)}${message.length > 40 ? '…' : ''}"`,
    });
  }
  if (lower.includes('fit') || lower.includes('compatib')) {
    calls.push({
      id: makeId('tc'),
      name: 'check_fitment',
      args: { query: message },
      status: 'pending',
      label: 'Checking fitment against your selected vehicle',
    });
  }
  if (lower.includes('add to cart') || lower.includes('buy this')) {
    calls.push({
      id: makeId('tc'),
      name: 'add_to_cart',
      args: { productId: 'inferred-from-context' },
      status: 'pending',
      label: 'Adding the recommended part to your cart',
    });
  }
  return calls;
}

/**
 * Generate the canned reply body. Centralized so the mock keyword
 * routing is in ONE place — the keyword table changes when the real
 * agent ships (this whole function gets deleted).
 */
function buildReplyBody(
  message: string,
  vehicleContext: AiChatSendMessageRequest['vehicleContext'],
): string {
  const normalized = message.toLowerCase();
  const prefix = buildVehiclePrefix(vehicleContext);
  if (normalized.includes('order') || normalized.includes('track')) {
    return `${prefix}I checked your account and your most recent in-transit order looks healthy. You can track it directly from the chip below.`;
  }
  if (normalized.includes('fit') || normalized.includes('upgrade') || normalized.includes('build') || normalized.includes('part')) {
    return `${prefix}I pulled candidate parts that match your build. Share a budget or any preferred brand and I can narrow it further.`;
  }
  if (normalized.includes('deal') || normalized.includes('discount')) {
    return `${prefix}I sorted the active promos by relevance to your saved vehicle and cart. The top one applies automatically at checkout.`;
  }
  if (normalized.includes('return') || normalized.includes('warranty')) {
    return `${prefix}I can guide returns and warranty claims once you tell me which order this is about.`;
  }
  return `${prefix}I can help with fitment, order tracking, returns, and product comparisons. What would you like to dig into?`;
}

/** Result a successfully-completed tool call resolves with. The shape
 *  here mirrors what a real agent backend would return: status + result
 *  block with an optional `deepLink` the client renders as a chip. */
function buildToolResult(
  toolCall: AiChatToolCall,
): { result: NonNullable<AiChatToolCall['result']> } {
  switch (toolCall.name) {
    case 'lookup_order':
      return {
        result: {
          summary: 'ORD-8790 · Out for delivery · Arrives 14:30 - 15:00',
          deepLink: { label: 'Track this order', href: '/track-order?orderId=ORD-8790' },
        },
      };
    case 'search_parts':
      return {
        result: {
          summary: 'Top match: Mator Elite, fits your build.',
          deepLink: {
            label: 'Open result',
            href: '/item-detail/mator-elite',
          },
        },
      };
    case 'identify_part':
      return {
        result: {
          summary: 'Identified as a Garrett GTX3582R turbocharger.',
          deepLink: { label: 'View part', href: '/item-detail/aero-coupe-s' },
        },
      };
    case 'check_fitment':
      return {
        result: {
          summary: 'Compatible, confirmed against your vehicle profile.',
        },
      };
    case 'add_to_cart':
      return {
        result: {
          summary: 'Added 1 item to your cart.',
          deepLink: { label: 'Open cart', href: '/cart' },
        },
      };
    case 'apply_promo':
      return { result: { summary: 'Promo code applied at checkout.' } };
    default:
      return { result: { summary: 'Tool completed.' } };
  }
}

// ── Seed conversation history ────────────────────────────────────────

const SEED_CONVERSATIONS: AiChatConversationSummary[] = [
  {
    id: 'chat-history-1',
    title: 'BMW F30 brake fitment',
    preview: 'Confirmed 340mm front rotor options for your F30 build.',
    updatedAt: '2026-06-03T20:12:00Z',
    vehicleContext: {
      makeId: 'bmw',
      modelId: '3-series',
      trimId: 'f30-340i',
      selectedCarName: 'BMW 340i F30',
    },
    messages: [
      {
        id: 'history-user-1',
        role: 'user',
        body: 'Will this brake kit fit my BMW 340i F30?',
        caption: 'Yesterday',
        createdAt: '2026-06-03T20:10:00Z',
      },
      {
        id: 'history-assistant-1',
        role: 'assistant',
        title: 'Mator AI',
        body: 'For your BMW 340i F30, start with rotor diameter, caliper clearance, and wheel size. A 340mm front kit is the safest baseline unless your car already has the M Sport package.',
        caption: 'Yesterday',
        createdAt: '2026-06-03T20:10:06Z',
      },
    ],
  },
];

// ── Mock transport ───────────────────────────────────────────────────

export class MockChatTransport implements ChatTransport {
  private conversations: Map<string, AiChatConversationSummary>;
  private feedback: { messageId: string; kind: string; note?: string }[] = [];

  constructor(seed: AiChatConversationSummary[] = SEED_CONVERSATIONS) {
    this.conversations = new Map(seed.map((c) => [c.id, c]));
  }

  async listConversations(signal?: AbortSignal): Promise<AiChatConversationSummary[]> {
    await delay(120, signal);
    return Array.from(this.conversations.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async getConversation(
    id: string,
    signal?: AbortSignal,
  ): Promise<AiChatConversationSummary | null> {
    await delay(80, signal);
    return this.conversations.get(id) ?? null;
  }

  async deleteConversation(id: string): Promise<void> {
    await delay(60);
    this.conversations.delete(id);
  }

  async submitFeedback(input: AiChatFeedbackInput): Promise<void> {
    await delay(40);
    this.feedback.push({ messageId: input.messageId, kind: input.kind, note: input.note });
  }

  streamMessage(
    input: AiChatSendMessageRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const message = input.message;
    const vehicleContext = input.vehicleContext;
    const conversationId = input.conversationId ?? 'chat-active';
    const replyId = makeId('assistant');
    const toolCalls = planToolCalls(message);
    const body = buildReplyBody(message, vehicleContext);

    return {
      async *[Symbol.asyncIterator]() {
        // ── Tool calls ──────────────────────────────────────────────
        for (const tc of toolCalls) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          yield { type: 'tool_call_start', toolCall: tc };
          await delay(TOOL_FINISH_MS, signal);
          yield {
            type: 'tool_call_update',
            toolCallId: tc.id,
            status: 'running',
          };
          await delay(TOOL_RUNNING_MS, signal);
          const finished = buildToolResult(tc);
          yield {
            type: 'tool_call_update',
            toolCallId: tc.id,
            status: 'success',
            result: finished.result,
          };
        }

        // ── Token stream ────────────────────────────────────────────
        const tokens = body.match(/\S+\s*/g) ?? [body];
        for (const token of tokens) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          await delay(PER_TOKEN_MS, signal);
          yield { type: 'token', value: token };
        }

        // ── Done ────────────────────────────────────────────────────
        yield {
          type: 'done',
          conversationId,
          suggestions: [
            'Check part fitment',
            'Track orders',
            'What upgrades fit my build?',
          ],
          replyId,
          title: 'Mator AI',
          createdAt: new Date().toISOString(),
        };
      },
    };
  }
}

// ── HTTP transport (stub) ────────────────────────────────────────────

/**
 * Drop-in HTTP transport. Wire `getAuthToken` to UserContext, set
 * `baseUrl` from env, and assign an instance to the `chatTransport`
 * export at the bottom of this file.
 *
 * Endpoint contract (also documented in the chat backend spec):
 *   GET    {base}/conversations                  → AiChatConversationSummary[]
 *   GET    {base}/conversations/:id              → AiChatConversationSummary
 *   DELETE {base}/conversations/:id              → 204
 *   POST   {base}/messages                       → text/event-stream of ChatStreamEvent
 *   POST   {base}/messages/:id/feedback          → 204  (body: { kind, note? })
 *
 * Streaming response: server-sent events, one ChatStreamEvent per
 * `data:` line, terminated by `event: done\ndata: {...}\n\n`.
 */
import { getApiBaseUrl, getAuthToken, shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';

/**
 * HTTP impl. The non-streaming endpoints flow through the unified
 * `apiClient`. `streamMessage` is the exception — it consumes
 * server-sent-events line-by-line, so it has to talk to fetch directly
 * (apiClient is JSON-only). The SSE path still reads `getAuthToken()`
 * from `config/api.ts` so auth is consistent.
 */
export class HttpChatTransport implements ChatTransport {
  async listConversations(signal?: AbortSignal): Promise<AiChatConversationSummary[]> {
    return apiClient.get<AiChatConversationSummary[]>(
      `${AI_CHAT_API_BASE_PATH}/conversations`,
      { signal },
    );
  }

  async getConversation(
    id: string,
    signal?: AbortSignal,
  ): Promise<AiChatConversationSummary | null> {
    try {
      return await apiClient.get<AiChatConversationSummary>(
        `${AI_CHAT_API_BASE_PATH}/conversations/${encodeURIComponent(id)}`,
        { signal },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async deleteConversation(id: string): Promise<void> {
    await apiClient.delete(
      `${AI_CHAT_API_BASE_PATH}/conversations/${encodeURIComponent(id)}`,
    );
  }

  async submitFeedback(input: AiChatFeedbackInput): Promise<void> {
    await apiClient.post(
      `${AI_CHAT_API_BASE_PATH}/messages/${encodeURIComponent(input.messageId)}/feedback`,
      { kind: input.kind, note: input.note },
    );
  }

  streamMessage(
    input: AiChatSendMessageRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    return {
      async *[Symbol.asyncIterator]() {
        const baseUrl = getApiBaseUrl();
        if (!baseUrl) throw new Error('No API base URL configured for chat streaming.');
        const token = await getAuthToken();
        const res = await fetch(`${baseUrl}${AI_CHAT_API_BASE_PATH}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(input),
          signal,
        });
        if (!res.ok || !res.body) throw new Error(`Chat API ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const evt = JSON.parse(dataLine.slice(5).trim()) as ChatStreamEvent;
            yield evt;
          }
        }
      },
    };
  }
}

// ── Live sourcing transport ──────────────────────────────────────────

/** Path of the live single-shot support/sourcing endpoint (mator.uz/Backend
 *  `@Controller('api/ai-chat')` + `@Post('message')`). */
const SOURCING_CHAT_PATH = '/api/ai-chat/message';

/** Response of POST /api/ai-chat/message. */
type SourcingChatResponse = {
  reply_text: string;
  intent: 'SEARCH_PART' | 'CREATE_SOURCING_TICKET' | 'GENERAL_QUESTION' | 'FOUND_IN_STOCK';
  extracted_data?: unknown;
  items?: { id: string; title: string; price: string; category: string | null }[];
};

/**
 * Adapts the LIVE sourcing endpoint to the streaming ChatTransport the UI
 * expects. That endpoint is single-shot JSON — stateless, no SSE, no tools —
 * so:
 *   - conversations are local-only (no server history) → list/get return empty;
 *   - the reply is fake-streamed token-by-token for a natural feel;
 *   - FOUND_IN_STOCK `items` are appended to the reply as a plain list (rich
 *     product cards via the tool-call card path are a follow-up).
 * The endpoint is public, so no auth token is required.
 */
export class SourcingChatTransport implements ChatTransport {
  async listConversations(): Promise<AiChatConversationSummary[]> {
    return [];
  }

  async getConversation(): Promise<AiChatConversationSummary | null> {
    return null;
  }

  async deleteConversation(): Promise<void> {
    // Nothing persisted server-side — no-op.
  }

  async submitFeedback(): Promise<void> {
    // The sourcing endpoint has no feedback route yet — no-op.
  }

  streamMessage(
    input: AiChatSendMessageRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const conversationId = input.conversationId ?? 'chat-active';
    const replyId = makeId('assistant');
    // The mobile vehicle context carries no VIN; surface the selected car name
    // as a text hint so the extractor still resolves brand/model.
    const message = input.vehicleContext?.selectedCarName
      ? `${input.message}\n\n[Автомобиль: ${input.vehicleContext.selectedCarName}]`
      : input.message;
    // Prior turns give the stateless endpoint memory (vehicle/part from earlier
    // messages), so it stops re-asking for details already provided.
    const history = input.history;

    return {
      async *[Symbol.asyncIterator]() {
        // Guard blank input locally — the endpoint 400s on empty and 503s on
        // whitespace-only, neither of which is worth a round-trip. Prompt the
        // user instead of surfacing a network error.
        if (!input.message.trim()) {
          yield { type: 'token', value: 'Напишите, какую запчасть вы ищете 🙂' };
          yield {
            type: 'done',
            conversationId,
            suggestions: [],
            replyId,
            title: 'Mator AI',
            createdAt: new Date().toISOString(),
          };
          return;
        }

        const res = await apiClient.post<SourcingChatResponse>(
          SOURCING_CHAT_PATH,
          { message, history },
          { signal },
        );

        let text = res.reply_text ?? '';
        if (res.intent === 'FOUND_IN_STOCK' && res.items?.length) {
          const lines = res.items.map((it) => `• ${it.title} — ${it.price}`).join('\n');
          text = text ? `${text}\n\n${lines}` : lines;
        }

        // Fake-stream the reply token-by-token to match the streaming UI.
        const tokens = text.match(/\S+\s*/g) ?? [text];
        for (const token of tokens) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          await delay(PER_TOKEN_MS, signal);
          yield { type: 'token', value: token };
        }

        yield {
          type: 'done',
          conversationId,
          suggestions: [],
          replyId,
          title: 'Mator AI',
          createdAt: new Date().toISOString(),
        };
      },
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────

/**
 * Flips on `shouldUseHttpTransport('chat')` — a base URL is configured AND
 * 'chat' is in the `EXPO_PUBLIC_HTTP_DOMAINS` allowlist (or the allowlist is
 * unset). The live HTTP path is the single-shot sourcing endpoint;
 * `HttpChatTransport` (SSE `/v1/chatbot`) is retained for when the richer
 * streaming chat backend ships.
 */
export const chatTransport: ChatTransport = shouldUseHttpTransport('chat')
  ? new SourcingChatTransport()
  : new MockChatTransport();
