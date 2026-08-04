import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AiChatMessage } from '@/types/ai-chat';

/**
 * Local persistence for the AI-chat conversation.
 *
 * The sourcing chat endpoint is stateless (no server-side history), so the
 * conversation lived only in component state and vanished on refresh/relaunch.
 * We cache the finalized turns as a single versioned JSON blob so the thread
 * survives an app restart. Best-effort: any read/write error degrades to an
 * empty chat rather than crashing.
 */

const CHAT_STORAGE_KEY = 'ai-chat:v1';
const CHAT_SCHEMA_VERSION = 1;
/** Cap the persisted turns so the blob can't grow unbounded. */
const MAX_PERSISTED_MESSAGES = 60;

export type StoredChat = {
  messages: AiChatMessage[];
  conversationId: string | null;
};

type StoredEnvelope = {
  v: number;
  messages: AiChatMessage[];
  conversationId: string | null;
};

export async function loadChat(): Promise<StoredChat | null> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope>;
    if (
      !parsed ||
      parsed.v !== CHAT_SCHEMA_VERSION ||
      !Array.isArray(parsed.messages)
    ) {
      return null;
    }
    return {
      messages: parsed.messages,
      conversationId: parsed.conversationId ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveChat(chat: StoredChat): Promise<void> {
  try {
    const envelope: StoredEnvelope = {
      v: CHAT_SCHEMA_VERSION,
      messages: chat.messages.slice(-MAX_PERSISTED_MESSAGES),
      conversationId: chat.conversationId,
    };
    await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Best-effort — a persistence failure must never break the chat.
  }
}

export async function clearStoredChat(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
