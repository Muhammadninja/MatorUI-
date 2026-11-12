import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AiChatMessage } from '@/types/ai-chat';

/**
 * Local persistence for the AI-chat conversation.
 *
 * The sourcing chat endpoint is stateless (no server-side history), so the
 * conversation lived only in component state and vanished on refresh/relaunch.
 * We cache the finalized turns as a single versioned JSON blob so the thread
 * survives an app restart, one blob per account so nobody sees another
 * account's chat on a shared phone. Best-effort: any read/write error degrades to an
 * empty chat rather than crashing.
 */

/** Whose conversation this is: an account id, or null for a guest. */
export type ChatOwner = string | null;

const storageKey = (owner: ChatOwner) => `ai-chat:v2:${owner ?? 'guest'}`;
/** Had no owner, so it can't be shown to anyone safely. Removed on first load. */
const LEGACY_STORAGE_KEY = 'ai-chat:v1';
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

export async function loadChat(owner: ChatOwner): Promise<StoredChat | null> {
  try {
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = await AsyncStorage.getItem(storageKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope>;
    if (!parsed || parsed.v !== CHAT_SCHEMA_VERSION || !Array.isArray(parsed.messages)) {
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

export async function saveChat(owner: ChatOwner, chat: StoredChat): Promise<void> {
  try {
    const envelope: StoredEnvelope = {
      v: CHAT_SCHEMA_VERSION,
      messages: chat.messages.slice(-MAX_PERSISTED_MESSAGES),
      conversationId: chat.conversationId,
    };
    await AsyncStorage.setItem(storageKey(owner), JSON.stringify(envelope));
  } catch {
    // Best-effort — a persistence failure must never break the chat.
  }
}

export async function clearStoredChat(owner: ChatOwner): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(owner));
  } catch {
    // ignore
  }
}
