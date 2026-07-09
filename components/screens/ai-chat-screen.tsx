import { router } from 'expo-router';
import { ArrowUp } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ImageBox from '@/components/screens-components/home/image-box';
import Rating from '@/components/screens-components/home/rating';
import { AppOemPill } from '@/components/shared/app-oem-pill';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { money, productById } from '@/mocks/mator-catalog';

/**
 * AI Chat — faithful rebuild of the prototype's `scChat` + `chatBubble`.
 *
 * Structure:
 *   • Header: brand "AI" avatar (40px, brandBg) + "Parts Assistant" (heading/700/17)
 *             + "● Online · fits your Camry" (success green, 12)
 *   • Message list: AI bubbles (card bg, bordered, left, borderBottomLeftRadius 4)
 *                   User bubbles (brandBg, right, borderBottomRightRadius 4)
 *                   AI replies can show an inline product card
 *   • Suggestion chips below the messages
 *   • Input bar: rounded field + circular brand send button (arrow-up icon)
 */

type ChatMessage = {
  id: string;
  who: 'ai' | 'me';
  text: string;
  /** Optional product id to show an inline product card (AI only). */
  product?: string;
};

const SEED_MESSAGES: ChatMessage[] = [
  {
    id: 'seed-0',
    who: 'ai',
    text: "Hi, I'm the Mator parts assistant. Tell me what's going on with your vehicle and I'll find the exact fit for your 2019 Toyota Camry.",
  },
];

const SUGGESTION_CHIPS = [
  'Brakes squeaking',
  'Need an oil filter',
  'Check engine light',
  'Best spark plugs',
] as const;

/**
 * Monotonic counter so every appended message gets a guaranteed-unique key,
 * even when two messages are created within the same millisecond (rapid
 * sends). `Date.now()` alone can collide and produce duplicate FlatList keys.
 */
let messageSeq = 0;
function nextId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${Date.now()}-${messageSeq}`;
}

/**
 * Simulated AI replies keyed to known chip labels. Any other input gets a
 * generic acknowledgement. Second reply also attaches a relevant product card.
 */
function getAiReply(text: string): ChatMessage {
  const id = nextId('ai');
  const lower = text.toLowerCase();

  if (lower.includes('brake') || lower.includes('squeak')) {
    return {
      id,
      who: 'ai',
      text: 'Squeaky brakes usually mean worn pads or glazed rotors. For your 2019 Camry I recommend these ceramic pads. They dramatically cut brake dust and noise.',
      product: 'p1',
    };
  }
  if (lower.includes('oil filter')) {
    return {
      id,
      who: 'ai',
      text: 'The genuine Toyota oil filter is the safest choice for your Camry 2.5L. It meets OEM specs and ships today.',
      product: 'p2',
    };
  }
  if (lower.includes('check engine') || lower.includes('engine light')) {
    return {
      id,
      who: 'ai',
      text: 'A check engine light on the 2019 Camry 2.5L often points to spark plugs, an O2 sensor, or a loose gas cap. Let me help you narrow it down. Have you noticed any misfires or rough idle?',
    };
  }
  if (lower.includes('spark plug')) {
    return {
      id,
      who: 'ai',
      text: 'The Denso Iridium TT plug (SK20R11) is the OEM-equivalent for your Camry 2.5L. Iridium tips give you a precise spark and a 60k-mile service life.',
      product: 'p3',
    };
  }

  return {
    id,
    who: 'ai',
    text: `Got it. Let me look that up for your 2019 Camry. Can you share any more detail about the issue or the part you need?`,
  };
}

export default function AiChatScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_MESSAGES);
  const [input, setInput] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // While the keyboard is up it already covers the home-indicator area, so the
  // input's safe-area bottom padding must collapse — otherwise it leaves a gap
  // between the field and the keyboard.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const sendChat = useCallback((text?: string) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: nextId('me'), who: 'me', text: trimmed };
    const aiReply = getAiReply(trimmed);

    setMessages((prev) => [...prev, userMsg, aiReply]);
    setInput('');

    // Scroll to end after state settles.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [input]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <ChatBubble message={item} tokens={tokens} />,
    [tokens],
  );

  const canSend = input.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <AppView flex={1} colorName="background" style={{ paddingTop: insets.top }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <AppView
          row
          align="center"
          gap={12}
          px="lg"
          style={{
            paddingTop: 6,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: tokens.divider,
          }}
        >
          {/* "AI" avatar */}
          <AppView
            center
            rounded={999}
            style={{
              width: 40,
              height: 40,
              backgroundColor: tokens.brandBg,
            }}
          >
            <AppText
              family="heading"
              weight="bold"
              style={{ fontSize: 13, color: tokens.onBrand }}
            >
              AI
            </AppText>
          </AppView>

          {/* Title + status */}
          <AppView>
            <AppText
              family="heading"
              weight="bold"
              style={{ fontSize: 17, color: tokens.text }}
            >
              Parts Assistant
            </AppText>
            <AppText
              family="default"
              style={{ fontSize: 12, color: tokens.success }}
            >
              ● Online · fits your Camry
            </AppText>
          </AppView>
        </AppView>

        {/* ── Message list + chips ─────────────────────────────────── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 14,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 4 }}
              style={{ marginTop: 4 }}
            >
              {SUGGESTION_CHIPS.map((chip) => (
                <AppPressableView
                  key={chip}
                  onPress={() => sendChat(chip)}
                  rounded={999}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: tokens.card,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={chip}
                >
                  <AppText
                    family="accent"
                    weight="semibold"
                    style={{ fontSize: 12.5, color: tokens.text }}
                  >
                    {chip}
                  </AppText>
                </AppPressableView>
              ))}
            </ScrollView>
          }
          renderItem={renderItem}
          ItemSeparatorComponent={() => <AppView style={{ height: 0 }} />}
        />

        {/* ── Input bar ────────────────────────────────────────────── */}
        <AppView
          row
          align="center"
          gap={10}
          colorName="background"
          style={{
            borderTopWidth: 1,
            borderTopColor: tokens.divider,
            paddingHorizontal: 16,
            paddingTop: 12,
            // Collapse the safe-area padding while the keyboard covers it.
            paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 16),
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Describe the issue or part…"
            placeholderTextColor={tokens.textMuted}
            onSubmitEditing={() => sendChat()}
            returnKeyType="send"
            style={{
              flex: 1,
              backgroundColor: tokens.backgroundSecondary,
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 999,
              paddingHorizontal: 18,
              paddingVertical: 13,
              fontFamily: undefined,
              fontSize: 14,
              color: tokens.text,
            }}
          />
          <AppPressableView
            onPress={() => sendChat()}
            disabled={!canSend}
            center
            rounded={999}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 46,
              height: 46,
              backgroundColor: tokens.brandBg,
              flexShrink: 0,
              opacity: canSend ? 1 : 0.5,
            }}
          >
            <ArrowUp size={22} strokeWidth={2.2} color={tokens.onBrand} />
          </AppPressableView>
        </AppView>
      </AppView>
    </KeyboardAvoidingView>
  );
}

// ── Chat bubble ──────────────────────────────────────────────────────────────

type BubbleProps = {
  message: ChatMessage;
  tokens: ReturnType<typeof useThemeContext>['tokens'];
};

const ChatBubble = memo(function ChatBubble({ message: m, tokens }: BubbleProps) {
  const isMe = m.who === 'me';

  const bubble = (
    <AppView
      style={{
        maxWidth: '82%',
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        backgroundColor: isMe ? tokens.brandBg : tokens.card,
        borderWidth: isMe ? 0 : 1,
        borderColor: tokens.border,
        borderRadius: 18,
        borderBottomRightRadius: isMe ? 4 : 18,
        borderBottomLeftRadius: isMe ? 18 : 4,
        paddingHorizontal: 15,
        paddingVertical: 12,
      }}
    >
      <AppText
        family="default"
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: isMe ? tokens.onBrand : tokens.text,
        }}
      >
        {m.text}
      </AppText>
    </AppView>
  );

  if (!m.product) {
    return <AppView style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>{bubble}</AppView>;
  }

  const p = productById(m.product);
  if (!p) {
    return <AppView style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>{bubble}</AppView>;
  }

  return (
    <AppView style={{ alignItems: 'flex-start' }}>
      {bubble}
      <AppPressableView
        onPress={() => router.push(`/item-detail/${p.id}`)}
        accessibilityRole="button"
        accessibilityLabel={p.title}
        style={{
          alignSelf: 'flex-start',
          maxWidth: '82%',
          marginTop: 8,
          flexDirection: 'row',
          gap: 12,
          backgroundColor: tokens.card,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 16,
          padding: 10,
        }}
      >
        <AppView style={{ width: 64, flexShrink: 0 }}>
          <ImageBox label={p.img} height={64} radius={10} small />
        </AppView>
        <AppView style={{ flex: 1 }}>
          <AppText
            family="default"
            weight="semibold"
            style={{ fontSize: 13, lineHeight: 17, color: tokens.text }}
            numberOfLines={2}
          >
            {p.title}
          </AppText>
          <AppView style={{ marginTop: 4 }}>
            <AppOemPill oem={p.oem} />
          </AppView>
          <AppView
            row
            align="center"
            justify="space-between"
            style={{ marginTop: 6 }}
          >
            <AppText
              family="heading"
              weight="bold"
              style={{ fontSize: 15, color: tokens.text }}
            >
              {money(p.price)}
            </AppText>
            <Rating value={p.rating} size={11} />
          </AppView>
        </AppView>
      </AppPressableView>
    </AppView>
  );
});
