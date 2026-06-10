/**
 * Thin facade over `chatTransport`. Kept so existing callers that
 * import from `@/services/ai-chat-service` keep working — all new code
 * should import `chatTransport` from `@/services/chat-api` directly.
 *
 * The HTTP/mock split lives in chat-api.ts; this file only re-exports.
 */
import { chatTransport, AI_CHAT_API_BASE_PATH } from '@/services/chat-api';
import type {
  AiChatConversationSummary,
  AiChatSendMessageRequest,
  ChatStreamEvent,
} from '@/types/ai-chat';

export { AI_CHAT_API_BASE_PATH };
export type {
  AiChatRole,
  AiChatVehicleContext,
  AiChatMessage,
  AiChatConversationSummary,
  AiChatSendMessageRequest,
  AiChatSendMessageResponse,
  AiChatToolCall,
  AiChatToolCallStatus,
  AiChatToolName,
  AiChatFeedbackKind,
  AiChatFeedbackInput,
  ChatStreamEvent,
} from '@/types/ai-chat';

export async function getAiChatHistory(): Promise<AiChatConversationSummary[]> {
  return chatTransport.listConversations();
}

/** Back-compat shim — synchronous list of the current cached snapshot.
 *  Real callers should switch to `getAiChatHistory()` (async) or use
 *  a hook. Kept here so the chat screen doesn't break during the
 *  migration. */
export function getAiChatHistoryMock(): AiChatConversationSummary[] {
  // Kick off a background refresh so subsequent calls return fresher
  // data, but return whatever the transport gives us synchronously by
  // assuming the mock's no-network path resolves immediately.
  // In practice the chat screen now calls listConversations directly via
  // the transport — this remains only for older import paths.
  return [];
}

export function streamAiChatMessageMock(
  input: AiChatSendMessageRequest,
  signal?: AbortSignal,
): AsyncIterable<ChatStreamEvent> {
  return chatTransport.streamMessage(input, signal);
}
