/**
 * AI chat / copilot types. Transport-agnostic — the mock service and a
 * future HTTP transport both produce these shapes; UI components import
 * from here, never from a concrete service.
 *
 * Designed for a tool-using agent: the assistant streams natural
 * language *and* tool invocations the client can render inline.
 */

export type AiChatRole = 'assistant' | 'user';

export type AiChatVehicleContext = {
  makeId: string;
  modelId: string;
  trimId: string;
  selectedCarName: string;
};

// ── Tool calls ───────────────────────────────────────────────────────

/**
 * Canonical names for tools the agent may invoke. New tools should be
 * added here so the client can render a proper card; unknown names are
 * still handled gracefully via the generic card path.
 */
export type AiChatToolName =
  | 'lookup_order'
  | 'search_parts'
  | 'add_to_cart'
  | 'apply_promo'
  | 'check_fitment'
  | 'identify_part'
  | (string & {});

export type AiChatToolCallStatus = 'pending' | 'running' | 'success' | 'error';

export type AiChatToolCall = {
  /** Server-issued id; lets `tool_call_update` events target the right
   *  pending card without ambiguity. */
  id: string;
  name: AiChatToolName;
  /** Arbitrary JSON args the agent decided to call the tool with. */
  args: Record<string, unknown>;
  status: AiChatToolCallStatus;
  /** Pre-formatted display label ("Looking up order #M-12345"). */
  label: string;
  /** Result data once status === 'success'. */
  result?: {
    summary?: string;
    deepLink?: { label: string; href: string };
    payload?: unknown;
  };
  errorMessage?: string;
};

// ── Messages ─────────────────────────────────────────────────────────

export type AiChatMessage = {
  id: string;
  role: AiChatRole;
  body: string;
  caption?: string;
  title?: string;
  createdAt: string;
  /** Tool invocations the agent made to produce this reply. Rendered
   *  inline above the text body. */
  toolCalls?: AiChatToolCall[];
  /** User feedback rating for this assistant message. */
  feedback?: 'up' | 'down' | null;
};

export type AiChatConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  vehicleContext?: AiChatVehicleContext | null;
  messages: AiChatMessage[];
};

// ── Streaming protocol ───────────────────────────────────────────────

/**
 * Events emitted by `ChatTransport.streamMessage`. The server pushes
 * events over SSE / chunked HTTP; the mock yields the same shape over
 * an AsyncIterable so the UI is transport-agnostic.
 *
 * Standard sequence for a simple reply:
 *   token × N → done
 *
 * Standard sequence for a tool-using reply:
 *   tool_call_start → tool_call_update(running)
 *     → tool_call_update(success|error) → token × N → done
 */
export type ChatStreamEvent =
  | { type: 'token'; value: string }
  | { type: 'tool_call_start'; toolCall: AiChatToolCall }
  | {
      type: 'tool_call_update';
      toolCallId: string;
      status: AiChatToolCallStatus;
      result?: AiChatToolCall['result'];
      errorMessage?: string;
    }
  | {
      type: 'done';
      conversationId: string;
      suggestions: string[];
      replyId: string;
      title: string;
      createdAt: string;
    };

// ── Request / response ──────────────────────────────────────────────

export type AiChatSendMessageRequest = {
  conversationId?: string | null;
  message: string;
  vehicleContext?: AiChatVehicleContext | null;
  /** Prior turns, oldest→newest, so the stateless endpoint keeps context. */
  history?: { role: AiChatRole; content: string }[];
};

/**
 * Non-streaming response shape (compat with the previous `sendMessage`
 * function). Streaming consumers should use `ChatStreamEvent` instead.
 */
export type AiChatSendMessageResponse = {
  conversationId: string;
  reply: AiChatMessage;
  suggestions: string[];
};

// ── Feedback ────────────────────────────────────────────────────────

export type AiChatFeedbackKind = 'up' | 'down';

export type AiChatFeedbackInput = {
  messageId: string;
  kind: AiChatFeedbackKind;
  /** Optional free-text note from the user explaining the rating. */
  note?: string;
};
