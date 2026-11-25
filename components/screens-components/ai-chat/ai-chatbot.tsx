import { BlurView } from 'expo-blur';
import {
  ChevronDown,
  MoreVertical,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';

import AiChatComposer from '@/components/screens-components/ai-chat/ai-chat-composer';
import AiChatMessageBubble from '@/components/screens-components/ai-chat/ai-chat-message-bubble';
import { AiChatPartLinks } from '@/components/screens-components/ai-chat/ai-chat-part-links';
import AiChatTypingDots from '@/components/screens-components/ai-chat/ai-chat-typing-dots';
import ComposerBlurWrapper from '@/components/screens-components/ai-chat/composer-blur-wrapper';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppButton } from '@/components/shared/app-button';
import { AppIconButton } from '@/components/shared/app-icon-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { useSourcingSignInGate } from '@/hooks/use-sourcing-sign-in-gate';
import { chatTransport } from '@/services/chat-api';
import { composeSourcingBody } from '@/services/sourcing-chat-reply';
import { clearStoredChat, loadChat, saveChat, type ChatOwner } from '@/services/chat-storage';
import type { Vehicle } from '@/services/garage-service';
import { toastService } from '@/services/toast-service';
import type {
  AiChatConversationSummary,
  AiChatMessage,
  AiChatPartGroup,
  AiChatPartsClarification,
  AiChatSourcingState,
  AiChatToolCall,
  AiChatVehicleContext,
} from '@/types/ai-chat';
import { triggerHaptic } from '@/utils/haptics';
import { router, useLocalSearchParams } from 'expo-router';

/** Handoff §16 suggestion chips — tap fills the composer. Built via a
 *  factory so the labels re-resolve when the language changes. */
function buildSuggestionChips(t: (key: string) => string) {
  return [
    { key: 'brakes', label: t('aiChat.chipBrakes') },
    { key: 'oil', label: t('aiChat.chipOilFilter') },
    { key: 'engine', label: t('aiChat.chipCheckEngine') },
    { key: 'spark', label: t('aiChat.chipSparkPlugs') },
  ];
}

type StreamingReply = {
  id: string;
  body: string;
  toolCalls: AiChatToolCall[];
};

/** A screen-local mid-timeline note pinned to a position by afterId. */
type SystemNote = { id: string; label: string; afterId: string };

type TimelineEntry =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'message'; key: string; message: AiChatMessage }
  | { kind: 'system'; key: string; label: string };

function formatDateLabel(iso: string, t: (key: string) => string, now = Date.now()): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return t('aiChat.dateToday');
  const d = new Date(ts);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return t('aiChat.dateToday');
  if (diffDays === 1) return t('aiChat.dateYesterday');
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dateBucket(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'unknown';
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A guest's message waiting for sign-in. The only thing that survives it. */
type HeldRequest = { assistantMessageId: string; userMessageId: string; body: string };

/** What the endpoint is told about the car selected in the garage. */
function selectedVehicleContext(vehicle: Vehicle | null | undefined): AiChatVehicleContext | null {
  if (!vehicle) return null;
  return {
    makeId: vehicle.brandId ?? '',
    modelId: vehicle.modelId ?? '',
    trimId: '',
    selectedCarName: [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' '),
    vehicleId: vehicle.id,
    vin: vehicle.vin || undefined,
  };
}

export default function AiChatbot() {
  const routeParams = useLocalSearchParams<{
    shoppingPrompt?: string | string[];
    shoppingProductId?: string | string[];
  }>();
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const suggestionChips = useMemo(() => buildSuggestionChips(t), [t]);
  const { openConfirm, openActionSheet } = useGlobalModal();
  const { currentActiveVehicle, isHydrating: vehicleHydrating } = useActiveVehicle();
  const { isAuthenticated, profile, isHydrating: authHydrating } = useUserContext();
  // Undefined until auth has settled, so nothing loads for the wrong person.
  const chatOwner: ChatOwner | undefined = authHydrating ? undefined : (profile?.id ?? null);
  const [historyItems, setHistoryItems] = useState<AiChatConversationSummary[]>([]);

  // Load conversations from the transport. Real backend pushes the full
  // list; the mock returns a single seeded conversation. The state is
  // updated on mount and whenever the user clears / sends so the most
  // recent activity is reachable.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    chatTransport
      .listConversations(controller.signal)
      .then((items) => {
        if (!cancelled) setHistoryItems(items);
      })
      .catch(() => {
        // Silent — history is a convenience, not a blocker.
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const [draft, setDraft] = useState('');
  const handledShoppingPrompt = useRef<string | null>(null);
  // A photo-request draft from a product page, until it is sent. Its first line
  // marks it: a message that no longer carries it is an ordinary question.
  const photoDraftRef = useRef<{ marker: string; productId: string } | null>(null);
  // Which sent messages were photo requests, so a retry or a send held for
  // sign-in goes out as one too.
  const photoByMessageRef = useRef(new Map<string, string>());
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<StreamingReply | null>(null);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const [failedUserMessageIds, setFailedUserMessageIds] = useState<Set<string>>(() => new Set());
  const [systemNotes, setSystemNotes] = useState<SystemNote[]>([]);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  // Bumped when the person changes, so a reply still on its way can tell that it
  // belongs to a session that's over.
  const sessionRef = useRef(0);
  const [sessionOwner, setSessionOwner] = useState(chatOwner);
  const [hydratedOwner, setHydratedOwner] = useState<ChatOwner | undefined>(undefined);
  const shoppingPrompt = Array.isArray(routeParams.shoppingPrompt)
    ? routeParams.shoppingPrompt[0]
    : routeParams.shoppingPrompt;
  const shoppingProductId = Array.isArray(routeParams.shoppingProductId)
    ? routeParams.shoppingProductId[0]
    : routeParams.shoppingProductId;
  useEffect(() => {
    if (
      !shoppingPrompt ||
      handledShoppingPrompt.current === shoppingPrompt ||
      hydratedOwner !== chatOwner
    )
      return;
    handledShoppingPrompt.current = shoppingPrompt;
    photoDraftRef.current = shoppingProductId
      ? { marker: shoppingPrompt.split('\n')[0]!.trim(), productId: shoppingProductId }
      : null;
    if (!draft.trim()) setDraft(shoppingPrompt);
    else {
      openConfirm({
        title: t('aiChat.shoppingContextTitle'),
        message: t('aiChat.shoppingContextBody'),
        confirmLabel: t('aiChat.addContext'),
        cancelLabel: t('common.cancel'),
        onConfirm: () =>
          setDraft((latest) => [latest.trim(), shoppingPrompt].filter(Boolean).join('\n\n')),
      });
    }
  }, [shoppingPrompt, shoppingProductId, hydratedOwner, chatOwner, openConfirm, t, draft]);
  // During render, not in an effect: an effect would commit one frame showing the
  // previous account's messages to the next person.
  if (sessionOwner !== chatOwner) {
    sessionRef.current += 1;
    setSessionOwner(chatOwner);
    setHydratedOwner(undefined);
    setDraft('');
    setMessages([]);
    setConversationId(null);
    setStreamingReply(null);
    setLastSuggestions([]);
    setFailedUserMessageIds(new Set());
    setSystemNotes([]);
    setShowScrollToLatest(false);
  }

  const abortRef = useRef<AbortController | null>(null);
  // Synchronous in-flight gate. `isSending` is derived from render state
  // (streamingReply !== null) and is captured stale in the sendMessage
  // closure, so two sends in the same tick both see false and race —
  // overwriting abortRef and orphaning the first stream. This ref is the
  // authoritative concurrency gate, set/cleared imperatively.
  const sendingRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const isAtBottomRef = useRef(true);
  // Mirror of `messages` so we can snapshot the conversation as send-time
  // history without adding `messages` to sendMessage's deps (which would
  // re-create the streaming callback on every token).
  const messagesRef = useRef<AiChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Persist the conversation across refresh/relaunch ────────────────
  // The sourcing endpoint is stateless, so without this the thread is lost on
  // reload. Hydrate each person's own turns when they arrive, then debounce-save.
  const previousOwnerRef = useRef<ChatOwner | undefined>(undefined);
  useEffect(() => {
    // Whatever was in flight belonged to the previous person.
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;

    const previousOwner = previousOwnerRef.current;
    previousOwnerRef.current = chatOwner;
    if (chatOwner === undefined) return;
    // A guest's chat ends at sign-in: the next guest on this phone mustn't see it.
    if (previousOwner === null && chatOwner !== null) void clearStoredChat(null);

    let cancelled = false;
    void (async () => {
      const stored = await loadChat(chatOwner);
      if (cancelled) return;
      if (stored && stored.messages.length > 0) {
        // By id: hydration can run again over messages already on screen (a
        // dev Fast Refresh re-runs effects with state kept), and an earlier
        // duplicate may already be saved. Two rows with one id break the list.
        setMessages((current) => {
          const seen = new Set<string>();
          return [...stored.messages, ...current].filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
        });
        if (stored.conversationId) setConversationId(stored.conversationId);
      }
      setHydratedOwner(chatOwner);
    })();
    return () => {
      cancelled = true;
    };
  }, [chatOwner]);

  useEffect(() => {
    if (chatOwner === undefined || hydratedOwner !== chatOwner) return;
    const timer = setTimeout(() => {
      void saveChat(chatOwner, { messages, conversationId });
    }, 400);
    return () => clearTimeout(timer);
  }, [chatOwner, hydratedOwner, messages, conversationId]);
  const isSending = streamingReply !== null;

  // ── Scroll plumbing ─────────────────────────────────────────────────
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
      const atBottom = distanceFromBottom < 48;
      isAtBottomRef.current = atBottom;
      setShowScrollToLatest(!atBottom && messages.length > 0);
    },
    [messages.length],
  );

  // ── Send / stream ───────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      text: string,
      options: {
        retryUserId?: string;
        replaceLastAssistant?: boolean;
        removeAssistantId?: string;
        /** Keeps a held message's id, and so its request id, in a new session. */
        messageId?: string;
      } = {},
    ) => {
      const trimmed = text.trim();
      // Authoritative synchronous guard — see sendingRef declaration.
      if (!trimmed || sendingRef.current || chatOwner === undefined) return;
      sendingRef.current = true;
      const session = sessionRef.current;

      const { retryUserId, replaceLastAssistant, removeAssistantId, messageId } = options;
      triggerHaptic('selection');
      setDraft('');

      // Doubles as the request id, so it has to stay unique and survive retries.
      const finalUserId =
        retryUserId ?? messageId ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const photoDraft = photoDraftRef.current;
      if (!retryUserId && !messageId && photoDraft && trimmed.includes(photoDraft.marker)) {
        photoByMessageRef.current.set(finalUserId, photoDraft.productId);
        photoDraftRef.current = null;
      }
      const photoRequestProductId = photoByMessageRef.current.get(finalUserId);
      if (!retryUserId) {
        setMessages((current) => [
          ...current,
          {
            id: finalUserId,
            role: 'user',
            caption: t('aiChat.captionNow'),
            body: trimmed,
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        // Retrying / regenerating — clear the prior failure marker.
        setFailedUserMessageIds((s) => {
          if (!s.has(retryUserId)) return s;
          const next = new Set(s);
          next.delete(retryUserId);
          return next;
        });
      }

      if (removeAssistantId) {
        setMessages((current) => current.filter((m) => m.id !== removeAssistantId));
      }
      if (replaceLastAssistant) {
        // Regenerate: drop the previous assistant reply so the new one
        // visually replaces it in place.
        setMessages((current) => {
          for (let i = current.length - 1; i >= 0; i -= 1) {
            if (current[i]!.role === 'assistant') {
              return [...current.slice(0, i), ...current.slice(i + 1)];
            }
          }
          return current;
        });
      }
      // User just sent — pin them to the latest content even if they had
      // scrolled up reading older messages. Subsequent token scrolls
      // follow the same "at bottom" rail.
      isAtBottomRef.current = true;
      setShowScrollToLatest(false);
      scrollToEnd();

      const replyDraft: StreamingReply = {
        id: `assistant-${Date.now()}`,
        body: '',
        toolCalls: [],
      };
      setStreamingReply(replyDraft);
      setLastSuggestions([]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let body = '';
        let replyId = replyDraft.id;
        let title = t('aiChat.assistantName');
        let createdAt = new Date().toISOString();
        let suggestions: string[] = [];
        let convoId = conversationId;
        let partGroups: AiChatPartGroup[] | undefined;
        let sourcing: AiChatSourcingState | undefined;
        let partsClarification: AiChatPartsClarification | undefined;
        let chatUnavailable = false;
        let photoRequestPending = false;
        const toolCallMap = new Map<string, AiChatToolCall>();

        const stream = chatTransport.streamMessage(
          {
            conversationId,
            message: trimmed,
            // A different car is a different request, even for the same message.
            requestId: `${finalUserId}:${currentActiveVehicle?.vehicleId ?? 'none'}`,
            userMessageId: finalUserId,
            isAuthenticated,
            photoRequestProductId,
            vehicleContext: selectedVehicleContext(currentActiveVehicle?.vehicle),
            // Snapshot the prior turns (pre-append: this fires before the ref
            // effect runs) so the endpoint remembers earlier context.
            history: messagesRef.current.slice(-10).map((m) => ({ role: m.role, content: m.body })),
          },
          controller.signal,
        );

        for await (const event of stream) {
          if (sessionRef.current !== session) return;
          if (event.type === 'token') {
            body += event.value;
            setStreamingReply({
              id: replyDraft.id,
              body,
              toolCalls: Array.from(toolCallMap.values()),
            });
            if (isAtBottomRef.current) scrollToEnd(false);
          } else if (event.type === 'tool_call_start') {
            toolCallMap.set(event.toolCall.id, event.toolCall);
            setStreamingReply({
              id: replyDraft.id,
              body,
              toolCalls: Array.from(toolCallMap.values()),
            });
            if (isAtBottomRef.current) scrollToEnd(false);
          } else if (event.type === 'tool_call_update') {
            const existing = toolCallMap.get(event.toolCallId);
            if (existing) {
              toolCallMap.set(event.toolCallId, {
                ...existing,
                status: event.status,
                result: event.result ?? existing.result,
                errorMessage: event.errorMessage ?? existing.errorMessage,
              });
              setStreamingReply({
                id: replyDraft.id,
                body,
                toolCalls: Array.from(toolCallMap.values()),
              });
              if (isAtBottomRef.current) scrollToEnd(false);
            }
          } else {
            convoId = event.conversationId;
            suggestions = event.suggestions;
            replyId = event.replyId;
            title = event.title;
            createdAt = event.createdAt;
            partGroups = event.partGroups;
            sourcing = event.sourcing;
            partsClarification = event.partsClarification;
            chatUnavailable = event.chatUnavailable ?? false;
            photoRequestPending = event.photoRequestPending ?? false;
          }
        }

        if (sessionRef.current !== session) return;
        const finalToolCalls = Array.from(toolCallMap.values());
        const completed: AiChatMessage = {
          id: replyId,
          role: 'assistant',
          title,
          body: chatUnavailable
            ? t('aiChat.temporarilyUnavailable')
            : photoRequestPending
              ? t('aiChat.photoNotYetAvailable')
              : composeSourcingBody({ text: body, sourcing, partsClarification }, t),
          caption: t('aiChat.captionNow'),
          createdAt,
          toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
          partGroups,
          sourcing,
        };
        setStreamingReply(null);
        setMessages((current) => [...current, completed]);
        setConversationId(convoId ?? 'chat-active');
        setLastSuggestions(suggestions);
        scrollToEnd();
      } catch (err) {
        if (sessionRef.current !== session) return;
        const aborted =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError');
        setStreamingReply(null);
        if (aborted) {
          // Stop-generating: leave any partial reply pinned in the
          // streamingReply as a final message? No — discard. The user
          // chose to stop; they don't want half a sentence committed.
          return;
        }
        triggerHaptic('error');
        setFailedUserMessageIds((s) => {
          const next = new Set(s);
          next.add(finalUserId);
          return next;
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        // Release the synchronous gate so the next send is allowed once
        // this stream completes or aborts. A newer session owns it by then.
        if (sessionRef.current === session) sendingRef.current = false;
      }
    },
    [chatOwner, conversationId, currentActiveVehicle, isAuthenticated, isSending, scrollToEnd, t],
  );

  const submitHeldRequest = useCallback(
    (held: HeldRequest) => {
      // Still in the thread if this person was signed in all along. After sign-in
      // the guest's thread is gone, so this message starts the account's.
      const inThread = messagesRef.current.some((m) => m.id === held.userMessageId);
      void sendMessage(
        held.body,
        inThread
          ? { retryUserId: held.userMessageId, removeAssistantId: held.assistantMessageId }
          : { messageId: held.userMessageId },
      );
    },
    [sendMessage],
  );
  const requestHeldSubmit = useSourcingSignInGate<HeldRequest>({
    isAuthenticated,
    ready: chatOwner !== undefined && hydratedOwner === chatOwner && !vehicleHydrating,
    submit: submitHeldRequest,
  });
  const holdRequest = useCallback(
    (assistant: AiChatMessage) => {
      const userMessageId =
        assistant.sourcing?.status === 'sign_in_required'
          ? assistant.sourcing.userMessageId
          : undefined;
      const original = messagesRef.current.find((m) => m.id === userMessageId);
      if (!original) return;
      requestHeldSubmit({
        assistantMessageId: assistant.id,
        userMessageId: original.id,
        body: original.body,
      });
    },
    [requestHeldSubmit],
  );

  const stopGenerating = useCallback(() => {
    triggerHaptic('selection');
    abortRef.current?.abort();
  }, []);

  const retryFailed = useCallback(
    (message: AiChatMessage) => {
      if (isSending) return;
      void sendMessage(message.body, { retryUserId: message.id });
    },
    [isSending, sendMessage],
  );

  const regenerateLastReply = useCallback(() => {
    if (isSending) return;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i]!;
      if (m.role === 'user') {
        triggerHaptic('selection');
        void sendMessage(m.body, { retryUserId: m.id, replaceLastAssistant: true });
        return;
      }
    }
  }, [isSending, messages, sendMessage]);

  const handleEmptyComposerTap = useCallback(() => {
    triggerHaptic('error');
  }, []);

  /**
   * Quick-prompt and follow-up taps now FILL the composer instead of
   * sending immediately. Lets the user append context ("Upgrades for my
   * build under $2k") before pressing send.
   */
  const fillDraft = useCallback(
    (label: string) => {
      triggerHaptic('selection');
      setDraft(label);
      scrollToEnd();
    },
    [scrollToEnd],
  );

  // Tappable avatars — the parent owns the affordances so the bubble
  // component stays presentational.
  const handleAssistantAvatarPress = useCallback(() => {
    triggerHaptic('selection');
    toastService.info(t('aiChat.assistantName'), {
      description: t('aiChat.assistantAbout'),
    });
  }, [t]);

  const handleUserAvatarPress = useCallback(() => {
    triggerHaptic('selection');
    router.push('/edit-profile');
  }, []);

  const submitFeedback = useCallback(
    async (message: AiChatMessage, kind: 'up' | 'down') => {
      triggerHaptic('selection');
      // Optimistic — flip the feedback flag locally; rollback on failure.
      setMessages((current) =>
        current.map((m) => (m.id === message.id ? { ...m, feedback: kind } : m)),
      );
      try {
        await chatTransport.submitFeedback({ messageId: message.id, kind });
      } catch {
        setMessages((current) =>
          current.map((m) => (m.id === message.id ? { ...m, feedback: null } : m)),
        );
        toastService.danger(t('aiChat.feedbackError'));
      }
    },
    [t],
  );

  // ── History / clear / overflow ──────────────────────────────────────
  const loadHistory = useCallback(() => {
    const latest = historyItems[0];
    if (!latest) return;
    setConversationId(latest.id);
    setMessages(latest.messages);
    setLastSuggestions([]);
    setFailedUserMessageIds(new Set());
    setSystemNotes([]);
    scrollToEnd(false);
  }, [historyItems, scrollToEnd]);

  const requestLoadHistory = useCallback(() => {
    triggerHaptic('selection');
    if (messages.length === 0) {
      loadHistory();
      return;
    }
    openConfirm({
      title: t('aiChat.openPreviousTitle'),
      message: t('aiChat.openPreviousMessage'),
      confirmLabel: t('aiChat.open'),
      cancelLabel: t('common.cancel'),
      onConfirm: loadHistory,
    });
  }, [loadHistory, messages.length, openConfirm, t]);

  const performClear = useCallback(() => {
    triggerHaptic('warning');
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setStreamingReply(null);
    setLastSuggestions([]);
    setFailedUserMessageIds(new Set());
    setSystemNotes([]);
    setDraft('');
    if (chatOwner !== undefined) void clearStoredChat(chatOwner);
  }, [chatOwner]);

  const requestClear = useCallback(() => {
    if (messages.length === 0 && !streamingReply) return;
    openConfirm({
      title: t('aiChat.clearTitle'),
      message: t('aiChat.clearMessage'),
      confirmLabel: t('aiChat.clear'),
      cancelLabel: t('common.cancel'),
      onConfirm: performClear,
    });
  }, [messages.length, openConfirm, performClear, streamingReply, t]);

  const openOverflowMenu = useCallback(() => {
    triggerHaptic('selection');
    const openLabel = t('aiChat.menuOpenPrevious');
    const clearLabel = t('aiChat.menuClear');
    const cancelLabel = t('common.cancel');
    const options = [openLabel, clearLabel, cancelLabel];
    const destructiveIndex = 1;
    const cancelIndex = 2;

    const handlePick = (index?: number) => {
      if (index === 0) requestLoadHistory();
      else if (index === 1) requestClear();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
        },
        (index) => handlePick(index),
      );
      return;
    }
    // Android: our own left-aligned bottom sheet instead of Alert.alert, whose
    // Material buttons are right-aligned / center-justified.
    openActionSheet({
      title: t('aiChat.chatOptions'),
      options: [
        { label: openLabel, onPress: () => handlePick(0) },
        { label: clearLabel, destructive: true, onPress: () => handlePick(1) },
      ],
      cancelLabel,
    });
  }, [openActionSheet, requestClear, requestLoadHistory, t]);

  // ── Timeline assembly: weave date pills + system notes into messages.
  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];
    const notesByAfterId = new Map<string, SystemNote[]>();
    for (const n of systemNotes) {
      const arr = notesByAfterId.get(n.afterId) ?? [];
      arr.push(n);
      notesByAfterId.set(n.afterId, arr);
    }

    let lastBucket: string | null = null;
    for (const m of messages) {
      const bucket = dateBucket(m.createdAt);
      if (bucket !== lastBucket) {
        entries.push({
          kind: 'date',
          key: `date-${bucket}`,
          label: formatDateLabel(m.createdAt, t),
        });
        lastBucket = bucket;
      }
      entries.push({ kind: 'message', key: m.id, message: m });
      const pinned = notesByAfterId.get(m.id);
      if (pinned) {
        for (const note of pinned) {
          entries.push({ kind: 'system', key: note.id, label: note.label });
        }
      }
    }
    return entries;
  }, [messages, systemNotes, t]);

  const latestAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]!.role === 'assistant') return messages[i]!.id;
    }
    return null;
  }, [messages]);

  // ── Cleanup any in-flight stream on unmount ─────────────────────────
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── Telegram-style: keep the latest message above the keyboard ──────
  // When the keyboard appears, scroll-to-end so the user's just-typed
  // message + the in-flight response are still visible. Without this,
  // KeyboardAvoidingView shrinks the timeline but leaves the scroll
  // offset stale, so the latest content can slide above the visible
  // area.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      isAtBottomRef.current = true;
      scrollToEnd();
    });
    return () => sub.remove();
  }, [scrollToEnd]);

  const [composerHeight, setComposerHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, (e) => setKeyboardHeight(e.endCoordinates.height)),
      Keyboard.addListener(hide, () => setKeyboardHeight(0)),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, []);

  // ── Render ──────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0 || streamingReply !== null;

  // Names the selected car without claiming anything fits it: fitment is only
  // known per part. Model only, to keep the header compact.
  const activeVehicleModel = currentActiveVehicle?.vehicle?.model ?? null;
  const onlineLabel = activeVehicleModel
    ? t('aiChat.selectedVehicle', { model: activeVehicleModel })
    : null;

  return (
    <ScreenShell>
      <AppView flex={1} pt={6}>
        {/* Handoff §16 header: brand "AI" avatar + "Parts Assistant" + online status */}
        <AppView
          row
          align="center"
          justify="space-between"
          px="lg"
          py="md"
          borderBottomWidth={1}
          borderTopWidth={1}
          borderColor={tokens.border}
        >
          <AppView flex={1} row align="center" gap={10}>
            {/* Mator AI brand monogram avatar */}
            <AppView
              center
              rounded={999}
              style={{
                width: 36,
                height: 36,
                backgroundColor: tokens.brand,
              }}
            >
              <AppText
                textVariant="caption"
                family="accent"
                weight="bold"
                style={{ color: tokens.onBrand, fontSize: 16, letterSpacing: 0.2 }}
              >
                M
              </AppText>
            </AppView>

            {/* Title + status row */}
            <AppView flex={1} gap={1}>
              <AppText
                textVariant="bodySemibold"
                family="heading"
                weight="bold"
                colorName="text"
                style={{ lineHeight: 18 }}
              >
                {t('aiChat.assistantName')}
              </AppText>
              <AppView row align="center" gap={4}>
                {/* Online dot */}
                <AppView
                  rounded={999}
                  style={{ width: 7, height: 7, backgroundColor: tokens.success }}
                />
                <AppText
                  textVariant="caption"
                  family="accent"
                  weight="semibold"
                  style={{ color: tokens.success, lineHeight: 14, flexShrink: 1 }}
                >
                  {t('aiChat.online')}
                  {onlineLabel ? ` · ${onlineLabel}` : ''}
                </AppText>
              </AppView>
            </AppView>
          </AppView>

          <AppIconButton
            Icon={MoreVertical}
            onPress={openOverflowMenu}
            accessibilityLabel={t('aiChat.chatOptions')}
          />
        </AppView>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            // Tight to the edges — bubbles sit close to the corners so
            // the assistant card has room to breathe and the user's
            // message hugs the right side.
            paddingHorizontal: 8,
            paddingTop: 24,
            // The composer takes its own space below this list, so only the
            // keyboard has to be cleared: the sticky view lifts the composer
            // over the list by exactly the keyboard's height.
            paddingBottom: keyboardHeight + 16,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (isAtBottomRef.current) scrollToEnd(false);
          }}
          // The list shrinks as the composer grows, which changes no content size.
          onLayout={() => {
            if (isAtBottomRef.current) scrollToEnd(false);
          }}
        >
          {!hasMessages ? (
            <AppView gap="xl">
              {/* Empty-state anchor + greeting */}
              <AppView gap={14} align="center">
                <AppView
                  center
                  rounded={999}
                  colorName="backgroundSecondary"
                  borderName="border"
                  borderWidth={1}
                  style={{ width: 64, height: 64 }}
                >
                  <Sparkles size={24} strokeWidth={2} color={tokens.brand} />
                </AppView>
                <AppView gap="xs" align="center">
                  <AppText
                    textVariant="h4"
                    family="heading"
                    weight="bold"
                    colorName="text"
                    align="center"
                  >
                    {t('aiChat.greetingTitle')}
                  </AppText>
                  <AppText
                    textVariant="bodySm"
                    colorName="text"
                    align="center"
                    style={{ lineHeight: 22, maxWidth: 320 }}
                  >
                    {t('aiChat.greetingSubtitle')}
                  </AppText>
                </AppView>
              </AppView>

              {/* Handoff §16 suggestion chips */}
              <AppView gap="md">
                <AppText
                  textVariant="bodySm"
                  family="accent"
                  weight="semibold"
                  colorName="textMuted"
                  style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}
                >
                  {t('aiChat.tryAsking')}
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                >
                  {suggestionChips.map((item) => (
                    <AppPressableView
                      key={item.key}
                      rounded={999}
                      px="md"
                      py={10}
                      onPress={() => fillDraft(item.label)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      style={{
                        borderWidth: 1,
                        borderColor: tokens.border,
                        backgroundColor: tokens.card,
                      }}
                    >
                      <AppText textVariant="bodySm" weight="semibold" colorName="text">
                        {item.label}
                      </AppText>
                    </AppPressableView>
                  ))}
                </ScrollView>
              </AppView>

              {/* AI disclaimer */}
              <AppText textVariant="bodyXs" colorName="gray400" style={{ lineHeight: 18 }}>
                {t('aiChat.disclaimerLong')}
              </AppText>
            </AppView>
          ) : (
            <AppView gap={14}>
              <AppView gap="md">
                {timeline.map((entry) => {
                  if (entry.kind === 'date') {
                    return <DatePill key={entry.key} label={entry.label} />;
                  }
                  if (entry.kind === 'system') {
                    return <SystemDivider key={entry.key} label={entry.label} />;
                  }
                  const message = entry.message;
                  const failed = message.role === 'user' && failedUserMessageIds.has(message.id);
                  const isLatestAssistant =
                    message.role === 'assistant' && message.id === latestAssistantId;
                  return (
                    <AppView key={entry.key} gap={6}>
                      <AiChatMessageBubble
                        role={message.role}
                        title={message.title}
                        body={message.body}
                        caption={message.caption}
                        toolCalls={message.toolCalls}
                        onAvatarPress={
                          message.role === 'assistant'
                            ? handleAssistantAvatarPress
                            : handleUserAvatarPress
                        }
                      />
                      {message.partGroups?.length ? (
                        <AiChatPartLinks groups={message.partGroups} />
                      ) : null}
                      {message.sourcing?.status === 'sign_in_required' ? (
                        <AppView style={{ paddingLeft: 40 }}>
                          <AppButton
                            testID="chat-sourcing-submit"
                            title={t(
                              isAuthenticated ? 'aiChat.submitRequest' : 'aiChat.signInToSubmit',
                            )}
                            kind="brand"
                            size="lg"
                            fullWidth
                            disabled={isSending}
                            onPress={() => holdRequest(message)}
                          />
                        </AppView>
                      ) : null}
                      {failed ? (
                        <AppView row justify="flex-end">
                          <Pressable
                            onPress={() => retryFailed(message)}
                            accessibilityRole="button"
                            accessibilityLabel={t('aiChat.retryMessage')}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              borderRadius: 999,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderWidth: 1,
                              borderColor: tokens.error,
                              backgroundColor: `${tokens.error}14`,
                              opacity: pressed ? 0.85 : 1,
                            })}
                          >
                            <RefreshCw size={12} strokeWidth={2.4} color={tokens.error} />
                            <AppText
                              textVariant="caption"
                              weight="semibold"
                              style={{
                                color: tokens.error,
                                lineHeight: 14,
                                includeFontPadding: false,
                              }}
                            >
                              {t('aiChat.tapToRetry')}
                            </AppText>
                          </Pressable>
                        </AppView>
                      ) : null}
                      {isLatestAssistant && !streamingReply ? (
                        <AppView row gap={6} style={{ paddingLeft: 40 }}>
                          {message.sourcing ? null : (
                            <Pressable
                              onPress={regenerateLastReply}
                              accessibilityRole="button"
                              accessibilityLabel={t('aiChat.regenerateResponse')}
                              style={({ pressed }) => ({
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                borderRadius: 999,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: tokens.border,
                                backgroundColor: tokens.card,
                                opacity: pressed ? 0.85 : 1,
                              })}
                            >
                              <RefreshCw size={12} strokeWidth={2.4} color={tokens.gray400} />
                              <AppText
                                textVariant="caption"
                                weight="semibold"
                                colorName="gray400"
                                style={{ lineHeight: 14, includeFontPadding: false }}
                              >
                                {t('aiChat.regenerate')}
                              </AppText>
                            </Pressable>
                          )}
                          <FeedbackButton
                            active={message.feedback === 'up'}
                            kind="up"
                            onPress={() => void submitFeedback(message, 'up')}
                          />
                          <FeedbackButton
                            active={message.feedback === 'down'}
                            kind="down"
                            onPress={() => void submitFeedback(message, 'down')}
                          />
                        </AppView>
                      ) : null}
                    </AppView>
                  );
                })}

                {streamingReply ? (
                  streamingReply.body || streamingReply.toolCalls.length > 0 ? (
                    <AiChatMessageBubble
                      role="assistant"
                      title={t('aiChat.assistantName')}
                      body={streamingReply.body}
                      caption={streamingReply.body ? t('aiChat.captionTyping') : undefined}
                      toolCalls={
                        streamingReply.toolCalls.length > 0 ? streamingReply.toolCalls : undefined
                      }
                      onAvatarPress={handleAssistantAvatarPress}
                    />
                  ) : (
                    <AssistantTypingPlaceholder />
                  )
                ) : null}

                {!streamingReply && lastSuggestions.length > 0 ? (
                  <AppView gap="sm" mt={6}>
                    <AppText textVariant="bodyXs" colorName="gray400">
                      {t('aiChat.followUp')}
                    </AppText>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                    >
                      {lastSuggestions.map((s) => (
                        <AppPressableView
                          key={s}
                          rounded={999}
                          px={12}
                          py={6}
                          onPress={() => fillDraft(s)}
                          accessibilityRole="button"
                          accessibilityLabel={s}
                          style={{
                            borderWidth: 1,
                            borderColor: tokens.border,
                            backgroundColor: tokens.card,
                          }}
                        >
                          <AppText textVariant="bodyXs" weight="semibold">
                            {s}
                          </AppText>
                        </AppPressableView>
                      ))}
                    </ScrollView>
                  </AppView>
                ) : null}
              </AppView>
            </AppView>
          )}
        </ScrollView>

        {/* Scroll-to-latest floating button */}
        {showScrollToLatest ? (
          <AppView
            style={{
              position: 'absolute',
              right: 16,
              bottom: keyboardHeight + composerHeight + 12,
            }}
            pointerEvents="box-none"
          >
            <AppPressableView
              center
              rounded={999}
              onPress={() => scrollToEnd()}
              accessibilityRole="button"
              accessibilityLabel={t('aiChat.scrollToLatest')}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.card,
              }}
            >
              <ChevronDown size={18} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          </AppView>
        ) : null}

        {/* Sits below the list and grows with its text, which shrinks the list.
         *  When the keyboard opens, KeyboardStickyView slides it up, and the
         *  list's bottom padding keeps the latest message above it. */}
        <KeyboardStickyView onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}>
          <ComposerBlurWrapper>
            <AiChatComposer
              value={draft}
              onChangeText={setDraft}
              onSend={() => {
                void sendMessage(draft);
              }}
              onEmptyTap={handleEmptyComposerTap}
              isSending={isSending}
              onStop={stopGenerating}
            />
            {/* Persistent AI disclosure — visible across empty state AND
             *  active chat (issue #23 from UX critique). */}
            <AppView px="md" pt={2} pb={4}>
              <AppText textVariant="caption" colorName="textMuted" align="center">
                {t('aiChat.disclaimerShort')}
              </AppText>
            </AppView>
          </ComposerBlurWrapper>
        </KeyboardStickyView>
      </AppView>
    </ScreenShell>
  );
}

// ComposerBlurWrapper lives in its own file:
//   ./composer-blur-wrapper.tsx
// (Extracted as part of the monolith-split refactor.)

function FeedbackButton({
  active,
  kind,
  onPress,
}: {
  active: boolean;
  kind: 'up' | 'down';
  onPress: () => void;
}) {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const Icon = kind === 'up' ? ThumbsUp : ThumbsDown;
  const color = active ? tokens.brand : tokens.gray400;
  return (
    <AppPressableView
      center
      rounded={999}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={kind === 'up' ? t('aiChat.goodResponse') : t('aiChat.badResponse')}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{
        width: 26,
        height: 26,
        borderWidth: 1,
        borderColor: active ? tokens.brand : tokens.border,
        backgroundColor: active ? `${tokens.brand}14` : tokens.card,
      }}
    >
      <Icon size={11} strokeWidth={2.4} color={color} />
    </AppPressableView>
  );
}

function DatePill({ label }: { label: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppView
      align="center"
      rounded={999}
      px="md"
      py={6}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        alignSelf: 'center',
      }}
    >
      <AppText textVariant="caption" colorName="gray400">
        {label}
      </AppText>
    </AppView>
  );
}

function SystemDivider({ label }: { label: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" gap={10} style={{ paddingVertical: 6 }}>
      <AppView style={{ flex: 1, height: 1, backgroundColor: tokens.divider }} />
      <AppText
        textVariant="caption"
        family="accent"
        weight="semibold"
        colorName="gray400"
        align="center"
        style={{ maxWidth: 240, textAlign: 'center' }}
      >
        {label}
      </AppText>
      <AppView style={{ flex: 1, height: 1, backgroundColor: tokens.divider }} />
    </AppView>
  );
}

function AssistantTypingPlaceholder() {
  const { tokens } = useThemeContext();
  return (
    <AppView row align="flex-end" gap="sm" style={{ width: '100%' }}>
      <AppView
        center
        rounded={999}
        style={{
          width: 32,
          height: 32,
          backgroundColor: tokens.backgroundSecondary,
          marginBottom: 2,
        }}
      >
        <AppText textVariant="caption" family="accent" weight="semibold" colorName="text">
          MA
        </AppText>
      </AppView>
      <AppView
        px={14}
        py={12}
        style={{
          borderTopLeftRadius: 4,
          borderTopRightRadius: 16,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
        }}
      >
        <AiChatTypingDots />
      </AppView>
    </AppView>
  );
}
