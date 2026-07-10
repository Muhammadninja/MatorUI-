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
    Alert,
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

import AiChatComposer from '@/components/screens-components/ai-chat/ai-chat-composer';
import AiChatMessageBubble from '@/components/screens-components/ai-chat/ai-chat-message-bubble';
import AiChatTypingDots from '@/components/screens-components/ai-chat/ai-chat-typing-dots';
import ComposerBlurWrapper from '@/components/screens-components/ai-chat/composer-blur-wrapper';
import VehicleContextBar from '@/components/screens-components/ai-chat/vehicle-context-bar';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppIconButton } from '@/components/shared/app-icon-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { chatTransport } from '@/services/chat-api';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { toastService } from '@/services/toast-service';
import type {
    AiChatConversationSummary,
    AiChatMessage,
    AiChatToolCall,
    AiChatVehicleContext,
} from '@/types/ai-chat';
import { triggerHaptic } from '@/utils/haptics';
import { router } from 'expo-router';

/** Handoff §16 suggestion chips — tap fills the composer. */
const SUGGESTION_CHIPS = [
  { key: 'brakes', label: 'Brakes squeaking' },
  { key: 'oil', label: 'Need an oil filter' },
  { key: 'engine', label: 'Check engine light' },
  { key: 'spark', label: 'Best spark plugs' },
] as const;

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

function formatDateLabel(iso: string, now = Date.now()): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Today';
  const d = new Date(ts);
  const today = new Date(now);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dateBucket(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'unknown';
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatVehicleFromGarage(v: {
  year: number;
  make: string;
  model: string;
  trim?: string;
}): AiChatVehicleContext {
  return {
    makeId: v.make.toLowerCase(),
    modelId: v.model.toLowerCase(),
    trimId: v.trim?.toLowerCase() ?? '',
    selectedCarName: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`,
  };
}

export default function AiChatbot() {
  const { tokens } = useThemeContext();
  const { openConfirm } = useGlobalModal();
  const { primaryVehicle } = useGarage();
  const { currentActiveVehicle } = useActiveVehicle();
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
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [vehicleContext, setVehicleContext] = useState<AiChatVehicleContext | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<StreamingReply | null>(null);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const [failedUserMessageIds, setFailedUserMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [systemNotes, setSystemNotes] = useState<SystemNote[]>([]);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Synchronous in-flight gate. `isSending` is derived from render state
  // (streamingReply !== null) and is captured stale in the sendMessage
  // closure, so two sends in the same tick both see false and race —
  // overwriting abortRef and orphaning the first stream. This ref is the
  // authoritative concurrency gate, set/cleared imperatively.
  const sendingRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const isAtBottomRef = useRef(true);
  const isSending = streamingReply !== null;

  // ── Garage autofill ─────────────────────────────────────────────────
  // On first mount, if no vehicle context is set and the user has a
  // primary vehicle in their Garage, preselect it so the assistant has
  // context without forcing the picker.
  const garageAutofilledRef = useRef(false);
  useEffect(() => {
    if (garageAutofilledRef.current) return;
    if (vehicleContext) return;
    if (!primaryVehicle) return;
    setVehicleContext(formatVehicleFromGarage(primaryVehicle));
    garageAutofilledRef.current = true;
  }, [primaryVehicle, vehicleContext]);

  // ── Scroll plumbing ─────────────────────────────────────────────────
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
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
      options: { retryUserId?: string; replaceLastAssistant?: boolean } = {},
    ) => {
      const trimmed = text.trim();
      // Authoritative synchronous guard — see sendingRef declaration.
      if (!trimmed || sendingRef.current) return;
      sendingRef.current = true;

      const { retryUserId, replaceLastAssistant } = options;
      triggerHaptic('selection');
      setDraft('');

      const finalUserId = retryUserId ?? `user-${Date.now()}`;
      if (!retryUserId) {
        setMessages((current) => [
          ...current,
          {
            id: finalUserId,
            role: 'user',
            caption: 'Now',
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
        let title = 'Mator AI';
        let createdAt = new Date().toISOString();
        let suggestions: string[] = [];
        let convoId = conversationId;
        const toolCallMap = new Map<string, AiChatToolCall>();

        const stream = chatTransport.streamMessage(
          { conversationId, message: trimmed, vehicleContext },
          controller.signal,
        );

        for await (const event of stream) {
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
          }
        }

        const finalToolCalls = Array.from(toolCallMap.values());
        const completed: AiChatMessage = {
          id: replyId,
          role: 'assistant',
          title,
          body,
          caption: 'Now',
          createdAt,
          toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        };
        setStreamingReply(null);
        setMessages((current) => [...current, completed]);
        setConversationId(convoId ?? 'chat-active');
        setLastSuggestions(suggestions);
        scrollToEnd();
      } catch (err) {
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
        // this stream completes or aborts.
        sendingRef.current = false;
      }
    },
    [conversationId, isSending, scrollToEnd, vehicleContext],
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

  // ── Vehicle picker — insert a system note when context changes mid-chat
  const openVehicleSelector = useCallback(() => {
    triggerHaptic('selection');
    modalService.openModal('carSelection', {
      initialMake: vehicleContext?.makeId ?? '',
      initialModel: vehicleContext?.modelId ?? '',
      initialTrim: vehicleContext?.trimId ?? '',
      onSelect: (selection: AiChatVehicleContext) => {
        const isSwap =
          messages.length > 0 &&
          vehicleContext?.selectedCarName !== selection.selectedCarName;
        setVehicleContext(selection);
        if (isSwap) {
          const lastMessage = messages[messages.length - 1]!;
          setSystemNotes((current) => [
            ...current,
            {
              id: `swap-${Date.now()}`,
              label: `Switched to ${selection.selectedCarName} for the rest of this chat`,
              afterId: lastMessage.id,
            },
          ]);
        }
        triggerHaptic('success');
      },
    });
  }, [messages, vehicleContext]);

  const clearVehicleContext = useCallback(() => {
    triggerHaptic('selection');
    if (vehicleContext && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]!;
      setSystemNotes((current) => [
        ...current,
        {
          id: `swap-${Date.now()}`,
          label: 'Vehicle context cleared for the rest of this chat',
          afterId: lastMessage.id,
        },
      ]);
    }
    setVehicleContext(null);
  }, [messages, vehicleContext]);

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
    toastService.info('Mator AI', {
      description: 'AI assistant for parts, fitment, and orders. Answers improve as the backend tools come online.',
    });
  }, []);

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
        toastService.danger('Could not submit feedback');
      }
    },
    [],
  );

  // ── History / clear / overflow ──────────────────────────────────────
  const loadHistory = useCallback(() => {
    const latest = historyItems[0];
    if (!latest) return;
    setConversationId(latest.id);
    setMessages(latest.messages);
    setVehicleContext(latest.vehicleContext ?? null);
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
      title: 'Open previous chat?',
      message: 'Your current conversation will be replaced.',
      confirmLabel: 'Open',
      cancelLabel: 'Cancel',
      onConfirm: loadHistory,
    });
  }, [loadHistory, messages.length, openConfirm]);

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
  }, []);

  const requestClear = useCallback(() => {
    if (messages.length === 0 && !streamingReply) return;
    openConfirm({
      title: 'Clear this conversation?',
      message: 'All messages in this chat will be removed.',
      confirmLabel: 'Clear',
      cancelLabel: 'Cancel',
      onConfirm: performClear,
    });
  }, [messages.length, openConfirm, performClear, streamingReply]);

  const openOverflowMenu = useCallback(() => {
    triggerHaptic('selection');
    const options = ['Open previous chat', 'Clear conversation', 'Cancel'];
    const destructiveIndex = options.indexOf('Clear conversation');
    const cancelIndex = options.indexOf('Cancel');

    const handlePick = (label?: string) => {
      if (label === 'Open previous chat') requestLoadHistory();
      else if (label === 'Clear conversation') requestClear();
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
        },
        (index) => handlePick(options[index]),
      );
      return;
    }
    Alert.alert('Chat options', undefined, [
      { text: 'Open previous chat', onPress: () => handlePick('Open previous chat') },
      {
        text: 'Clear conversation',
        style: 'destructive',
        onPress: () => handlePick('Clear conversation'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [requestClear, requestLoadHistory]);

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
          label: formatDateLabel(m.createdAt),
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
  }, [messages, systemNotes]);

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

  // ── Render ──────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0 || streamingReply !== null;

  // Build the "fits your X" suffix from the real active vehicle.
  // Only show the model name (not full year+make+model) to keep the
  // header compact, matching handoff copy "● Online · fits your Camry".
  const activeVehicleModel = currentActiveVehicle?.vehicle?.model ?? null;
  const onlineLabel = activeVehicleModel
    ? `fits your ${activeVehicleModel}`
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
          <AppView row align="center" gap={10}>
            {/* Brand "AI" avatar */}
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
                weight="semibold"
                style={{ color: tokens.onBrand, fontSize: 11, letterSpacing: 0.4 }}
              >
                AI
              </AppText>
            </AppView>

            {/* Title + status row */}
            <AppView gap={1}>
              <AppText
                textVariant="bodySemibold"
                family="heading"
                weight="bold"
                colorName="text"
                style={{ lineHeight: 18 }}
              >
                Parts Assistant
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
                  style={{ color: tokens.success, lineHeight: 14 }}
                >
                  Online{onlineLabel ? ` · ${onlineLabel}` : ''}
                </AppText>
              </AppView>
            </AppView>
          </AppView>

          <AppIconButton
            Icon={MoreVertical}
            onPress={openOverflowMenu}
            accessibilityLabel="Chat options"
          />
        </AppView>

        {/* Always-visible vehicle context bar. Doubles as the entry
         *  point to the picker (replaces the composer's Car button)
         *  and as the indicator of what context the assistant is
         *  using right now. */}
        <VehicleContextBar
          label={vehicleContext?.selectedCarName ?? null}
          onChange={openVehicleSelector}
          onClear={clearVehicleContext}
        />

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
            // Composer is absolutely overlaid via KeyboardStickyView,
            // so reserve ~120dp here for: composer (50) + disclosure
            // (18) + safe-area cushion (50). Messages can still scroll
            // behind the composer so the BlurView has content to blur.
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          onContentSizeChange={() => {
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
                    Hello! I&apos;m your Mator AI assistant.
                  </AppText>
                  <AppText
                    textVariant="bodySm"
                    colorName="text"
                    align="center"
                    style={{ lineHeight: 22, maxWidth: 320 }}
                  >
                    Tell me about your vehicle so I can give personalized parts and fitment help.
                  </AppText>
                  {vehicleContext?.selectedCarName ? (
                    <AppText textVariant="bodyXs" style={{ color: tokens.brand }}>
                      Vehicle selected: {vehicleContext.selectedCarName}
                    </AppText>
                  ) : null}
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
                  Try asking
                </AppText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 12 }}
                >
                  {SUGGESTION_CHIPS.map((item) => (
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
                      <AppText
                        textVariant="bodySm"
                        weight="semibold"
                        colorName="text"
                        numberOfLines={1}
                      >
                        {item.label}
                      </AppText>
                    </AppPressableView>
                  ))}
                </ScrollView>
              </AppView>

              {/* AI disclaimer */}
              <AppText
                textVariant="bodyXs"
                colorName="gray400"
                style={{ lineHeight: 18 }}
              >
                My answers are powered by AI, so I may not always get things right.
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
                  const failed =
                    message.role === 'user' && failedUserMessageIds.has(message.id);
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
                      {failed ? (
                        <AppView row justify="flex-end">
                          <Pressable
                            onPress={() => retryFailed(message)}
                            accessibilityRole="button"
                            accessibilityLabel="Retry message"
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
                              style={{ color: tokens.error, lineHeight: 14, includeFontPadding: false }}
                            >
                              Tap to retry
                            </AppText>
                          </Pressable>
                        </AppView>
                      ) : null}
                      {isLatestAssistant && !streamingReply ? (
                        <AppView row gap={6} style={{ paddingLeft: 40 }}>
                          <Pressable
                            onPress={regenerateLastReply}
                            accessibilityRole="button"
                            accessibilityLabel="Regenerate response"
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
                              Regenerate
                            </AppText>
                          </Pressable>
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
                      title="Mator AI"
                      body={streamingReply.body}
                      caption={streamingReply.body ? 'Typing' : undefined}
                      toolCalls={
                        streamingReply.toolCalls.length > 0
                          ? streamingReply.toolCalls
                          : undefined
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
                      Follow up
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
              bottom: 96,
            }}
            pointerEvents="box-none"
          >
            <AppPressableView
              center
              rounded={999}
              onPress={() => scrollToEnd()}
              accessibilityRole="button"
              accessibilityLabel="Scroll to latest message"
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

        {/* Composer is absolutely overlaid on the ScrollView's bottom
         *  via KeyboardStickyView. The ScrollView extends BEHIND it
         *  (with paddingBottom reserved below), so the BlurView in
         *  ComposerBlurWrapper actually has something to blur. When the
         *  keyboard opens, KeyboardStickyView slides the composer up;
         *  the ScrollView's automaticallyAdjustKeyboardInsets keeps the
         *  latest message visible above the keyboard. */}
        <KeyboardStickyView>
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
              <AppText
                textVariant="caption"
                colorName="gray400"
                align="center"
                style={{ fontSize: 10, lineHeight: 14 }}
              >
                Powered by AI · may make mistakes
              </AppText>
            </AppView>
          </ComposerBlurWrapper>
        </KeyboardStickyView>
      </AppView>
    </ScreenShell>
  );
}

// ComposerBlurWrapper + VehicleContextBar moved to their own files:
//   ./composer-blur-wrapper.tsx
//   ./vehicle-context-bar.tsx
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
  const Icon = kind === 'up' ? ThumbsUp : ThumbsDown;
  const color = active ? tokens.brand : tokens.gray400;
  return (
    <AppPressableView
      center
      rounded={999}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={kind === 'up' ? 'Good response' : 'Bad response'}
      hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
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
