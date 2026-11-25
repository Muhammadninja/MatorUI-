/** Live HTTP transport and public contracts. Test doubles live under tests/support. */
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
import {
  photoRequestsSupported,
  sourcingChatSupported,
} from '@/services/sourcing-capabilities';
import { interpretSourcingReply, type SourcingChatResponse } from '@/services/sourcing-chat-reply';
import { apiClient, ApiError } from '@/services/api-client';
import { stagingAccessHeaders } from '@/services/staging-access';

/**
 * HTTP impl. The non-streaming endpoints flow through the unified
 * `apiClient`. `streamMessage` is the exception — it consumes
 * server-sent-events line-by-line, so it has to talk to fetch directly
 * (apiClient is JSON-only). The SSE path still reads `getAuthToken()`
 * from `config/api.ts` so auth is consistent.
 */
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
            ...stagingAccessHeaders(),
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

/** Longer than the default, since the reply waits on the model and the catalog.
 *  This only reduces false failures and is not duplicate protection: the server
 *  can still finish after the app gives up. */
const SOURCING_CHAT_TIMEOUT_MS = 45_000;

/**
 * Adapts the LIVE sourcing endpoint to the streaming ChatTransport the UI
 * expects. That endpoint is single-shot JSON — stateless, no SSE, no tools —
 * so:
 *   - conversations are local-only (no server history) → list/get return empty;
 *   - the reply is fake-streamed token-by-token for a natural feel;
 *   - what a reply means is decided by `interpretSourcingReply`, so catalog
 *     matches arrive as links and a request is confirmed only by a ticket id.
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
    const vehicle = input.vehicleContext;
    // Prior turns give the stateless endpoint memory (vehicle/part from earlier
    // messages), so it stops re-asking for details already provided. Sanitize to
    // the backend's per-item validation (`SendMessageDto.history`): drop empty
    // bodies (e.g. tool-call-only turns — `@IsNotEmpty` would 400 the whole
    // request), clamp each to 2000 chars (`@MaxLength`), and cap at the last 10
    // turns (`@ArrayMaxSize`).
    const history = (input.history ?? [])
      .filter((h) => h.content.trim().length > 0)
      .map((h) => ({ role: h.role, content: h.content.slice(0, 2000) }))
      .slice(-10);

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

        // Fail closed: an older backend would create a ticket for any message.
        if (!(await sourcingChatSupported(signal))) {
          yield {
            type: 'done',
            conversationId,
            suggestions: [],
            replyId,
            title: 'Mator AI',
            createdAt: new Date().toISOString(),
            chatUnavailable: true,
          };
          return;
        }

        // An older backend would treat a photo request as a part search and list
        // the very product the customer is looking at, so answer it here.
        if (input.photoRequestProductId && !(await photoRequestsSupported(signal))) {
          yield {
            type: 'done',
            conversationId,
            suggestions: [],
            replyId,
            title: 'Mator AI',
            createdAt: new Date().toISOString(),
            photoRequestPending: true,
          };
          return;
        }

        const res = await apiClient.post<SourcingChatResponse>(
          SOURCING_CHAT_PATH,
          // Clamp to the backend's `@MaxLength(2000)` so a long paste can't 400.
          // The backend reads the car from the vehicle id, so no VIN or text hint.
          { message: input.message.slice(0, 2000), history },
          // No `Accept-Language`: this endpoint detects the language from the
          // message text itself, and the reply (including category names) comes
          // back in whatever the buyer wrote. Sending a header here would be
          // claiming a language the user may not have typed in.
          {
            signal,
            skipLanguage: true,
            timeoutMs: SOURCING_CHAT_TIMEOUT_MS,
            headers: {
              ...(input.requestId ? { 'Idempotency-Key': input.requestId } : {}),
              ...(vehicle?.vehicleId ? { 'X-Selected-Vehicle-Id': vehicle.vehicleId } : {}),
              // A photo request names its part exactly; the backend answers it
              // without the model. Headers, because the body rejects new fields.
              ...(input.photoRequestProductId
                ? { 'X-Chat-Intent': 'request_photo', 'X-Product-Id': input.photoRequestProductId }
                : {}),
            },
          },
        );

        const reply = interpretSourcingReply(res, {
          isAuthenticated: input.isAuthenticated ?? false,
          userMessageId: input.userMessageId,
        });
        const text = reply.text;

        // Fake-stream the reply token-by-token to match the streaming UI.
        const tokens = text.match(/\S+\s*/g) ?? [];
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
          partGroups: reply.partGroups,
          sourcing: reply.sourcing,
          partsClarification: reply.partsClarification,
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
export const chatTransport: ChatTransport = new SourcingChatTransport();
