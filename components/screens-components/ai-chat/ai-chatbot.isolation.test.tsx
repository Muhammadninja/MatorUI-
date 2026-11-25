/**
 * Whose chat is on screen. Renders the real chat over stubbed visuals and an
 * in-memory phone storage, so a remount is a cold launch.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (run: () => void) =>
  run();

const m = vi.hoisted(() => ({
  disk: new Map<string, string>(),
  push: vi.fn(),
  user: { profile: null as null | { id: string }, isHydrating: false },
  vehicle: { hydrating: false },
  send: vi.fn(),
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => m.disk.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.disk.set(k, v),
    removeItem: async (k: string) => void m.disk.delete(k),
  },
}));
vi.mock('expo-router', () => ({
  router: { push: m.push },
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
}));
vi.mock('expo-blur', () => ({ BlurView: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-native', () => ({
  ActionSheetIOS: {},
  Keyboard: { addListener: () => ({ remove: () => {} }), dismiss: () => {} },
  Platform: { OS: 'ios' },
  Pressable: m.host('pressable'),
  ScrollView: m.host('scroll'),
  StyleSheet: { create: <T,>(s: T) => s, absoluteFill: {} },
  View: m.host('rn-view'),
}));
vi.mock('react-native-keyboard-controller', () => ({ KeyboardStickyView: m.host('sticky') }));
vi.mock('lucide-react-native', () => ({
  ChevronDown: () => null,
  MoreVertical: () => null,
  RefreshCw: () => null,
  Sparkles: () => null,
  ThumbsDown: () => null,
  ThumbsUp: () => null,
}));
vi.mock('@/components/screens-components/ai-chat/ai-chat-composer', () => ({
  default: m.host('composer'),
}));
vi.mock('@/components/screens-components/ai-chat/ai-chat-message-bubble', () => ({
  default: m.host('bubble'),
}));
vi.mock('@/components/screens-components/ai-chat/ai-chat-part-links', () => ({
  AiChatPartLinks: () => null,
}));
vi.mock('@/components/screens-components/ai-chat/ai-chat-typing-dots', () => ({
  default: () => null,
}));
vi.mock('@/components/screens-components/ai-chat/composer-blur-wrapper', () => ({
  default: m.host('wrapper'),
}));
vi.mock('@/components/screens-components/screen-shell', () => ({ default: m.host('shell') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: m.host('button') }));
vi.mock('@/components/shared/app-icon-button', () => ({ AppIconButton: () => null }));
vi.mock('@/components/shared/app-text', () => ({ AppText: m.host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: m.host('view'),
  AppPressableView: m.host('view-pressable'),
}));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({
    profile: m.user.profile,
    isAuthenticated: m.user.profile !== null,
    isHydrating: m.user.isHydrating,
  }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({ currentActiveVehicle: null, isHydrating: m.vehicle.hydrating }),
}));
vi.mock('@/hooks/use-global-modal', () => ({
  useGlobalModal: () => ({ openConfirm: () => {}, openActionSheet: () => {} }),
}));
vi.mock('@/services/toast-service', () => ({ toastService: { info: () => {}, danger: () => {} } }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/services/chat-api', () => ({
  chatTransport: {
    listConversations: async () => [],
    submitFeedback: async () => {},
    streamMessage: (input: unknown, signal?: AbortSignal) => m.send(input, signal),
  },
}));

import AiChatbot from './ai-chatbot';

const done = (extra: Record<string, unknown> = {}) => ({
  type: 'done',
  conversationId: 'c',
  suggestions: [],
  replyId: `reply-${Math.random()}`,
  title: 'Mator AI',
  createdAt: new Date().toISOString(),
  ...extra,
});
function replyWith(text: string, extra: Record<string, unknown> = {}) {
  return async function* () {
    yield { type: 'token', value: text };
    yield done(extra);
  };
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
/** Long enough for the debounced save to reach the phone's storage. */
const saved = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
  });

let r: ReactTestRenderer;
async function launch() {
  await act(async () => {
    r = create(<AiChatbot />);
  });
  await settle();
}
async function rerender() {
  await act(async () => {
    r.update(<AiChatbot />);
  });
  await settle();
}
async function become(id: string | null) {
  m.user.profile = id ? { id } : null;
  await rerender();
}
const composer = () => r.root.find((n) => (n.type as unknown) === 'composer');
const visible = () =>
  r.root.findAll((n) => (n.type as unknown) === 'bubble').map((n) => n.props.body as string);
async function say(text: string, reply: string, extra?: Record<string, unknown>) {
  m.send.mockImplementationOnce(() => ({ [Symbol.asyncIterator]: replyWith(reply, extra) }));
  await act(async () => composer().props.onChangeText(text));
  await act(async () => {
    composer().props.onSend();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await settle();
}

beforeEach(() => {
  m.disk.clear();
  m.send.mockReset();
  m.push.mockReset();
  m.user.profile = null;
  m.user.isHydrating = false;
  m.vehicle.hydrating = false;
});

describe('A → sign-out → guest → B → A', () => {
  test('each person sees only their own chat, and A gets theirs back', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    await say('secret of A', 'reply to A');
    await saved();
    expect(visible()).toEqual(['secret of A', 'reply to A']);

    await become(null);
    expect(visible()).toEqual([]);
    await say('guest question', 'reply to guest');
    await saved();
    expect(visible()).toEqual(['guest question', 'reply to guest']);

    await become('B');
    expect(visible()).toEqual([]);
    await say('secret of B', 'reply to B');
    await saved();
    expect(visible()).toEqual(['secret of B', 'reply to B']);

    await become('A');
    expect(visible()).toEqual(['secret of A', 'reply to A']);
  });

  test('a cold launch at each step restores the right person', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    await say('secret of A', 'reply to A');
    await saved();

    for (const [who, expected] of [
      [null, []],
      ['B', []],
      ['A', ['secret of A', 'reply to A']],
    ] as const) {
      act(() => r.unmount());
      m.user.profile = who ? { id: who } : null;
      await launch();
      expect(visible()).toEqual(expected);
    }
  });

  test('A → B directly, with no guest step, also isolates', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    await say('secret of A', 'reply');
    await saved();
    await become('B');
    await saved();
    expect(visible()).toEqual([]);
    expect([...m.disk.values()].filter((v) => v.includes('secret of A'))).toHaveLength(1);
    expect(m.disk.has('ai-chat:v2:A')).toBe(true);
    expect(m.disk.has('ai-chat:v2:B')).toBe(true);
  });

  test('the previous account is gone in the same render, with no frame showing it', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    await say('secret of A', 'reply');

    const frames: string[][] = [];
    const seen = (): void => {
      frames.push(visible());
    };
    m.user.profile = null;
    act(() => r.update(<AiChatbot />));
    seen();
    await settle();
    seen();
    expect(frames).toEqual([[], []]);
  });

  test('the typed draft does not cross over', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    await act(async () => composer().props.onChangeText('half-typed by A'));
    await become(null);
    expect(composer().props.value).toBe('');
  });
});

describe('stored data', () => {
  test('a chat from before accounts is removed, not shown to anyone', async () => {
    m.disk.set(
      'ai-chat:v1',
      JSON.stringify({ v: 1, messages: [{ id: '1', role: 'user', body: 'old' }] }),
    );
    await launch();
    expect(visible()).toEqual([]);
    expect(m.disk.has('ai-chat:v1')).toBe(false);
  });

  test('nothing loads until auth settles, so nobody sees the wrong chat at boot', async () => {
    m.disk.set(
      'ai-chat:v2:guest',
      JSON.stringify({
        v: 1,
        conversationId: null,
        messages: [{ id: '1', role: 'user', body: 'guest' }],
      }),
    );
    m.disk.set(
      'ai-chat:v2:A',
      JSON.stringify({
        v: 1,
        conversationId: null,
        messages: [{ id: '2', role: 'user', body: 'A' }],
      }),
    );
    m.user.isHydrating = true;
    await launch();
    expect(visible()).toEqual([]);
    m.user.isHydrating = false;
    m.user.profile = { id: 'A' };
    await rerender();
    expect(visible()).toEqual(['A']);
  });

  test('a guest chat is removed at sign-in, so the next guest cannot see it', async () => {
    await launch();
    await say('guest question', 'reply');
    await saved();
    expect(m.disk.has('ai-chat:v2:guest')).toBe(true);
    await become('A');
    await settle();
    expect(m.disk.has('ai-chat:v2:guest')).toBe(false);
    await become(null);
    expect(visible()).toEqual([]);
  });
});

describe('a reply still on its way', () => {
  /** A stream held open until the test releases it. */
  function pending() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let aborted = false;
    m.send.mockImplementationOnce((_input: unknown, signal: AbortSignal) => {
      signal.addEventListener('abort', () => (aborted = true));
      return {
        async *[Symbol.asyncIterator]() {
          await gate;
          yield { type: 'token', value: 'late reply for A' };
          yield done();
        },
      };
    });
    return { release: () => release(), wasAborted: () => aborted };
  }
  async function startSend(text: string) {
    await act(async () => composer().props.onChangeText(text));
    await act(async () => {
      composer().props.onSend();
    });
    await settle();
  }

  test('is cancelled and discarded when the account changes', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    const stream = pending();
    await startSend('asked by A');

    await become('B');
    expect(stream.wasAborted()).toBe(true);
    await act(async () => stream.release());
    await saved();

    expect(visible()).toEqual([]);
    expect(m.disk.get('ai-chat:v2:B') ?? '').not.toContain('late reply');
    expect(composer().props.isSending).toBe(false);
  });

  test('does not block the next person from sending', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    const stream = pending();
    await startSend('asked by A');
    await become('B');

    await say('asked by B', 'reply to B');
    expect(visible()).toEqual(['asked by B', 'reply to B']);
    await act(async () => stream.release());
    await settle();
    expect(visible()).toEqual(['asked by B', 'reply to B']);
  });

  test('two rapid send taps create only one chat and sourcing request', async () => {
    await launch();
    const stream = pending();
    await act(async () => composer().props.onChangeText('find a brake pad'));
    await act(async () => {
      composer().props.onSend();
      composer().props.onSend();
    });
    await settle();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send.mock.calls[0]![0]).toMatchObject({ message: 'find a brake pad' });
    await act(async () => stream.release());
    await settle();
  });

  test('a failure from the old session leaves no failed marker behind', async () => {
    m.user.profile = { id: 'A' };
    await launch();
    let fail!: (err: Error) => void;
    const gate = new Promise<void>((_, reject) => (fail = reject));
    m.send.mockImplementationOnce(() => ({
      async *[Symbol.asyncIterator]() {
        await gate;
      },
    }));
    await startSend('asked by A');
    await become('B');
    await act(async () => fail(new Error('timed out')));
    await settle();
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'aiChat.retryMessage')).toEqual([]);
  });
});

describe('the guest draft through OTP sign-in', () => {
  const HELD = { status: 'sign_in_required', parts: ['радиатор'] };

  async function guestHoldsRequest() {
    await launch();
    await say('earlier guest chat', 'reply');
    m.send.mockImplementationOnce((input: { userMessageId: string }) => ({
      [Symbol.asyncIterator]: replyWith('', {
        sourcing: { ...HELD, userMessageId: input.userMessageId },
      }),
    }));
    await act(async () => composer().props.onChangeText('нужен радиатор'));
    await act(async () => {
      composer().props.onSend();
    });
    await settle();
    const button = r.root.find(
      (n) => (n.type as unknown) === 'button' && n.props.testID === 'chat-sourcing-submit',
    );
    await act(async () => button.props.onPress());
  }

  test('only the held message crosses over, and it is sent once', async () => {
    await guestHoldsRequest();
    expect(m.push).toHaveBeenCalledWith('/sign-in?gate=1');
    const guestRequestId = m.send.mock.calls[1]![0].requestId as string;

    m.send.mockImplementationOnce(() => ({
      [Symbol.asyncIterator]: replyWith('confirmed'),
    }));
    await become('A');
    await settle();

    expect(m.send).toHaveBeenCalledTimes(3);
    const sent = m.send.mock.calls[2]![0];
    expect(sent.message).toBe('нужен радиатор');
    expect(sent.requestId).toBe(guestRequestId);
    expect(sent.isAuthenticated).toBe(true);
    // Nothing else from the guest went with it.
    expect(sent.history).toEqual([]);
    expect(visible()).toEqual(['нужен радиатор', 'confirmed']);
  });

  test('waits for the account’s saved chat and selected vehicle', async () => {
    m.disk.set(
      'ai-chat:v2:A',
      JSON.stringify({
        v: 1,
        conversationId: null,
        messages: [{ id: 'old', role: 'user', body: 'A history' }],
      }),
    );
    await guestHoldsRequest();
    m.vehicle.hydrating = true;
    await become('A');
    await settle();
    expect(m.send).toHaveBeenCalledTimes(2);

    m.send.mockImplementationOnce(() => ({ [Symbol.asyncIterator]: replyWith('confirmed') }));
    m.vehicle.hydrating = false;
    await rerender();
    await settle();
    expect(m.send).toHaveBeenCalledTimes(3);
    expect(m.send.mock.calls[2]![0].history).toEqual([{ role: 'user', content: 'A history' }]);
    expect(visible()).toEqual(['A history', 'нужен радиатор', 'confirmed']);
  });

  test('signing in without asking carries nothing', async () => {
    await launch();
    await say('guest question', 'reply');
    await act(async () => composer().props.onChangeText('typed by guest'));
    await become('A');
    await settle();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(visible()).toEqual([]);
    expect(composer().props.value).toBe('');
  });
});
