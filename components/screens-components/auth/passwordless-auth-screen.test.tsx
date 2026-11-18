/**
 * Sign-in sheet — regression tests for the registration QA pass.
 *
 *   1. Keyboard: avoidance runs on BOTH platforms (it was iOS-only, so on
 *      Android the keyboard covered the phone field), and the sheet scrolls.
 *   2. SMS language: request-otp carries the language chosen on
 *      /select-language (the backend texted Uzbek to everyone without it).
 *   3. Consent: every document the Legal API returns is listed on BOTH steps —
 *      the phone step used to hardcode Terms + Privacy only.
 *   4. Legal links push the (auth)-stack document route, so Back returns to
 *      this sheet (see tests/legal-integration.test.ts for the router side).
 *   5. Backdrop: a repeated tap on Log in must not close the sheet it just opened.
 *   6. Dismissal: Back, backdrop and close can only leave the sheet once, or the
 *      second one pops the screen underneath.
 *
 * Renders the real screen with its collaborators stubbed, the same way
 * `vehicle-detail-screen.test.tsx` does.
 */
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));

const mocks = vi.hoisted(() => ({
  language: 'ru' as 'en' | 'ru' | 'uz',
  push: vi.fn(),
  back: vi.fn(),
  focused: true,
  backHandlers: [] as (() => boolean)[],
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  documents: [] as unknown[],
  staging: false,
  stagingLookup: vi.fn(),
  toasts: [] as string[],
  os: 'android' as 'android' | 'ios',
}));

vi.mock('expo-router', () => ({
  router: {
    push: mocks.push,
    back: mocks.back,
    replace: vi.fn(),
    canGoBack: () => true,
  },
  useNavigation: () => ({ isFocused: () => mocks.focused }),
}));
vi.mock('@/modules/sms-user-consent', () => ({ SmsUserConsent: null }));
vi.mock('react-native', () => ({
  Animated: {
    Value: class {
      constructor(public v: number) {}
    },
    spring: () => ({ start: () => {} }),
    View: host('animated-view'),
  },
  BackHandler: {
    addEventListener: (_event: string, handler: () => boolean) => {
      mocks.backHandlers.push(handler);
      return {
        remove: () => {
          mocks.backHandlers = mocks.backHandlers.filter((h) => h !== handler);
        },
      };
    },
  },
  Dimensions: { get: () => ({ width: 392, height: 762 }) },
  Pressable: host('backdrop'),
  ScrollView: host('scroll'),
  // Android — the platform of the QA report. RN's own KeyboardAvoidingView is
  // stubbed so a regression back to it renders (and fails the keyboard test)
  // instead of crashing the whole file.
  Platform: { get OS() { return mocks.os; }, select: (o: Record<string, unknown>) => o.android ?? o.default },
  KeyboardAvoidingView: host('rn-keyboard-avoiding-view'),
}));
vi.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: host('keyboard-avoiding-view'),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => null, setItem: async () => undefined },
}));
vi.mock('lucide-react-native', () => ({ ArrowLeft: () => null, X: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text-field', () => ({ default: host('field') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));

vi.mock('@/config/api', () => ({ getApiBaseUrl: () => 'https://api.test' }));
vi.mock('@/services/api-client', () => ({ ApiError: class ApiError extends Error {} }));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));
vi.mock('@/services/staging-access', () => ({ isStagingBuild: () => mocks.staging }));
vi.mock('@/services/staging-otp-inbox', () => ({ fetchStagingOtpCode: mocks.stagingLookup }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    info: (m: string) => mocks.toasts.push(m),
    danger: (m: string) => mocks.toasts.push(m),
    success: (m: string) => mocks.toasts.push(m),
  }),
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: {}, scheme: 'dark' }),
}));
vi.mock('@/contexts/language.context', () => ({
  useLanguageContext: () => ({ language: mocks.language }),
}));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({
    requestOtp: mocks.requestOtp,
    verifyOtp: mocks.verifyOtp,
    isLoading: false,
  }),
}));
vi.mock('@/hooks/use-legal', () => ({
  useLegalDocuments: () => ({
    state: mocks.documents.length ? 'success' : 'loading',
    documents: mocks.documents,
    byType: () => null,
    error: null,
    refresh: () => {},
  }),
  useAcceptLegal: () => ({ accept: async () => ({}), isPending: false, error: null }),
}));

import PasswordlessAuthScreen from './passwordless-auth-screen';
import { legalDocumentSlug, type LegalDocument, type LegalDocumentType } from '@/types/legal';

const doc = (type: LegalDocumentType, title: string): LegalDocument => ({
  type,
  version: 1,
  locale: 'ru',
  title,
  content: 'body',
  content_format: 'markdown',
  effective_at: '2026-08-31T00:00:00.000Z',
  is_required: true,
});

const TYPES: LegalDocumentType[] = ['TERMS_OF_USE', 'PRIVACY_POLICY', 'PERSONAL_DATA_CONSENT'];

beforeEach(() => {
  mocks.staging = false;
  mocks.stagingLookup.mockReset();
  mocks.toasts = [];
  mocks.os = 'android';
  mocks.language = 'ru';
  mocks.focused = true;
  mocks.backHandlers = [];
  mocks.push.mockReset();
  mocks.back.mockReset();
  mocks.requestOtp.mockReset().mockResolvedValue({ otpToken: 'otp_1', expiresIn: 300 });
  mocks.verifyOtp.mockReset();
  mocks.documents = [
    doc('TERMS_OF_USE', 'Пользовательское соглашение'),
    doc('PRIVACY_POLICY', 'Политика конфиденциальности'),
    doc('PERSONAL_DATA_CONSENT', 'Согласие на обработку персональных данных'),
  ];
});

async function renderSheet() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<PasswordlessAuthScreen />);
  });
  const byTestID = (id: string): ReactTestInstance =>
    r.root.find((n) => typeof n.type === 'string' && n.props.testID === id);
  const linksWithPrefix = (prefix: string) =>
    r.root
      .findAll(
        (n) =>
          n.type === 'text' &&
          typeof n.props.testID === 'string' &&
          n.props.testID.startsWith(prefix) &&
          n.props.accessibilityRole === 'link',
      )
      .map((n) => n.props.testID as string);

  const typePhone = async (value: string) => {
    await act(async () => byTestID('auth-phone-field').props.onChangeText(value));
  };
  const sendCode = async () => {
    await act(async () => {
      await byTestID('auth-send-code-btn').props.onPress();
    });
  };
  return { r, byTestID, linksWithPrefix, typePhone, sendCode };
}

describe('keyboard', () => {
  test('avoids the keyboard on every platform, not just iOS', async () => {
    const { r } = await renderSheet();
    const kav = r.root.find((n) => (n.type as string) === 'keyboard-avoiding-view');
    // Not platform-gated: `undefined` here is what left Android uncovered.
    expect(kav.props.behavior).toBe('padding');
    // The sheet already pads for the bottom inset the keyboard covers.
    expect(kav.props.keyboardVerticalOffset).toBe(-34);
  });

  test('the sheet scrolls when it is squeezed, and taps go through', async () => {
    const { r } = await renderSheet();
    const scroll = r.root.find((n) => (n.type as string) === 'scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    // The phone field lives inside the scrollable content.
    expect(scroll.findAll((n) => n.props.testID === 'auth-phone-field').length).toBeGreaterThan(0);
  });
});

describe('language → phone → OTP', () => {
  test('each new auth sheet starts empty after an earlier account used it', async () => {
    const first = await renderSheet();
    expect(first.byTestID('auth-phone-field').props.value).toBe('');
    await first.typePhone('+998900000001');
    await first.sendCode();
    await act(async () => first.r.unmount());
    const next = await renderSheet();
    expect(next.byTestID('auth-phone-field').props.value).toBe('');
    expect(next.byTestID('auth-send-code-btn').props.disabled).toBe(true);
  });

  test.each(['ru', 'uz', 'en'] as const)(
    'language %s is sent as lang on request-otp',
    async (lang) => {
      mocks.language = lang;
      const { typePhone, sendCode } = await renderSheet();
      await typePhone('+998 90 123 45 67');
      await sendCode();

      expect(mocks.requestOtp).toHaveBeenCalledTimes(1);
      expect(mocks.requestOtp.mock.calls[0]![0]).toMatchObject({
        channel: 'phone',
        identifier: '+998 90 123 45 67',
        lang,
      });
    },
  );

  test.each(['ru', 'uz', 'en'] as const)('language %s is sent again on resend', async (lang) => {
    mocks.language = lang;
    const { r, typePhone, sendCode } = await renderSheet();
    await typePhone('+998 90 123 45 67');
    await sendCode();

    const resend = r.root.find(
      (n) => (n.type as string) === 'pressable' && n.props.accessibilityLabel === 'auth.resendCode',
    );
    await act(async () => {
      await resend.props.onPress();
    });
    expect(mocks.requestOtp).toHaveBeenCalledTimes(2);
    // Same language on both requests — it is read from the app-wide
    // LanguageProvider at each call, not captured once or defaulted.
    expect(mocks.requestOtp.mock.calls.map((c) => c[0].lang)).toEqual([lang, lang]);
  });
});

describe('OTP field', () => {
  async function openOtp(otpLength?: number) {
    mocks.requestOtp.mockResolvedValue({ otpToken: 'otp_1', expiresIn: 300, otpLength });
    const sheet = await renderSheet();
    await sheet.typePhone('+998 90 123 45 67');
    await sheet.sendCode();
    const enter = async (value: string) => {
      await act(async () => sheet.byTestID('auth-otp-field').props.onChangeText(value));
    };
    return { ...sheet, enter };
  }

  test('asks for autofill with this platform\'s hint only, and is focused', async () => {
    const { byTestID } = await openOtp();
    const field = byTestID('auth-otp-field').props;
    expect(field.autoComplete).toBe('sms-otp');
    expect(field.importantForAutofill).toBe('yes');
    expect(field.textContentType).toBeUndefined();
    expect(field.autoFocus).toBe(true);
    // A native maxLength would cut a pasted "483 917" before it can be cleaned.
    expect(field.maxLength).toBeUndefined();
  });

  test('a filled code waits for the tap that is also the consent', async () => {
    const { byTestID, enter } = await openOtp();
    await enter('483917');
    expect(byTestID('auth-otp-field').props.value).toBe('483917');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(false);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  test('a filled code verifies the same way as a typed one', async () => {
    mocks.verifyOtp.mockResolvedValue(undefined);
    const { byTestID, enter } = await openOtp();
    await enter('483 917');
    await act(async () => {
      await byTestID('auth-verify-btn').props.onPress();
    });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.verifyOtp.mock.calls[0]![0]).toMatchObject({ otpToken: 'otp_1', code: '483917' });
  });

  test('backspace disarms the button and correction re-arms it', async () => {
    const { byTestID, enter } = await openOtp();
    await enter('483917');
    await enter('48391');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(true);
    await enter('483910');
    expect(byTestID('auth-otp-field').props.value).toBe('483910');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(false);
  });

  test('follows the length the backend reports', async () => {
    const { byTestID, enter } = await openOtp(4);
    expect(byTestID('auth-otp-field').props.placeholder).toBe('1234');
    await enter('123');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(true);
    await enter('12345');
    expect(byTestID('auth-otp-field').props.value).toBe('1234');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(false);
  });

  test('on iOS, one native field offers the SMS code above the number pad', async () => {
    mocks.os = 'ios';
    const { r, byTestID } = await openOtp();
    const field = byTestID('auth-otp-field').props;
    expect(field.textContentType).toBe('oneTimeCode');
    expect(field.autoComplete).toBeUndefined();
    expect(field.keyboardType).toBe('number-pad');
    expect(field.autoFocus).toBe(true);
    expect(r.root.findAll((n) => (n.type as string) === 'field')).toHaveLength(1);
  });

  test('a whole code arriving in one event fills the field, domain-bound SMS included', async () => {
    const { byTestID, enter } = await openOtp();
    await enter('Your Mator verification code is 483917.\n\n@mator.uz #483917');
    expect(byTestID('auth-otp-field').props.value).toBe('483917');
    await enter('12');
    await enter('12750361');
    expect(byTestID('auth-otp-field').props.value).toBe('750361');
  });

  test('resend clears the old code and verifies against the new request', async () => {
    mocks.verifyOtp.mockResolvedValue(undefined);
    const { r, byTestID, enter } = await openOtp();
    await enter('483917');
    mocks.requestOtp.mockResolvedValue({ otpToken: 'otp_2', expiresIn: 300 });
    const resend = r.root.find(
      (n) => (n.type as string) === 'pressable' && n.props.accessibilityLabel === 'auth.resendCode',
    );
    await act(async () => {
      await resend.props.onPress();
    });
    expect(byTestID('auth-otp-field').props.value).toBe('');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(true);
    await enter('750361');
    await act(async () => {
      await byTestID('auth-verify-btn').props.onPress();
    });
    expect(mocks.verifyOtp.mock.calls[0]![0]).toMatchObject({ otpToken: 'otp_2', code: '750361' });
  });

  test('assumes 6 digits when the backend reports no usable length', async () => {
    const { byTestID, enter } = await openOtp(99);
    await enter('12345');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(true);
    await enter('123456');
    expect(byTestID('auth-verify-btn').props.disabled).toBe(false);
  });
});

describe('legal documents on the registration sheet', () => {
  test('phone step lists all three documents from the Legal API', async () => {
    const { linksWithPrefix } = await renderSheet();
    expect(linksWithPrefix('auth-phone-legal-')).toEqual(TYPES.map((t) => `auth-phone-legal-${t}`));
  });

  test('OTP step lists all three documents too', async () => {
    const { linksWithPrefix, typePhone, sendCode } = await renderSheet();
    await typePhone('+998 90 123 45 67');
    await sendCode();
    expect(linksWithPrefix('auth-legal-')).toEqual(TYPES.map((t) => `auth-legal-${t}`));
  });

  test('shows only what the backend returned — nothing is padded in', async () => {
    mocks.documents = [doc('TERMS_OF_USE', 'Terms')];
    const { linksWithPrefix } = await renderSheet();
    expect(linksWithPrefix('auth-phone-legal-')).toEqual(['auth-phone-legal-TERMS_OF_USE']);
  });

  test.each(TYPES)(
    'opening %s pushes the (auth)-stack document route, not the Profile tab route',
    async (type) => {
      const { byTestID } = await renderSheet();
      await act(async () => byTestID(`auth-phone-legal-${type}`).props.onPress());

      expect(mocks.push).toHaveBeenCalledTimes(1);
      expect(mocks.push).toHaveBeenCalledWith({
        pathname: '/legal/[type]',
        params: { type: legalDocumentSlug(type) },
      });
      // The sheet itself is never dismissed on the way.
      expect(mocks.back).not.toHaveBeenCalled();
    },
  );

  // The router side (the sheet stays mounted under the document, same route
  // key) is pinned in tests/registration-legal-navigation.test.ts; this pins
  // that opening a document does nothing to the sheet's own state.
  test('the OTP step keeps phone, code and step across a legal detour', async () => {
    const { r, byTestID, typePhone, sendCode } = await renderSheet();
    await typePhone('+998 90 123 45 67');
    await sendCode();
    await act(async () => byTestID('auth-otp-field').props.onChangeText('483917'));
    await act(async () => byTestID('auth-legal-PERSONAL_DATA_CONSENT').props.onPress());

    expect(mocks.push).toHaveBeenCalledWith({
      pathname: '/legal/[type]',
      params: { type: 'personal_data_consent' },
    });
    // Still on the OTP step, with the typed code…
    expect(byTestID('auth-otp-field').props.value).toBe('483917');
    // …and the CTA still armed for it.
    expect(byTestID('auth-verify-btn').props.disabled).toBe(false);
    // Back to the phone step: the number is still there.
    const backToPhone = r.root.find(
      (n) => (n.type as string) === 'pressable' && n.props.accessibilityLabel === 'auth.back',
    );
    await act(async () => backToPhone.props.onPress());
    expect(byTestID('auth-phone-field').props.value).toBe('+998 90 123 45 67');
  });
});

describe('backdrop', () => {
  // The button that opens this sheet sits where its backdrop lands, so a repeated
  // tap on Log in closed the sheet it had just opened and read as a dead button.
  test('ignores the tap that lands while the sheet is still arriving', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const { r } = await renderSheet();
      now.mockReturnValue(1_699);
      await act(async () => r.root.findByType('backdrop' as never).props.onPress());
      expect(mocks.back).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
  });

  test('closes the sheet once it has arrived', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const { r } = await renderSheet();
      now.mockReturnValue(1_700);
      await act(async () => r.root.findByType('backdrop' as never).props.onPress());
      expect(mocks.back).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });

  test('the close button works straight away', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const { byTestID } = await renderSheet();
      await act(async () => byTestID('auth-close-btn').props.onPress());
      expect(mocks.back).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });
});

describe('dismissing once', () => {
  const pressHardwareBack = () => mocks.backHandlers[mocks.backHandlers.length - 1]();

  async function arrivedSheet() {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const sheet = await renderSheet();
    now.mockReturnValue(5_000);
    const backdrop = () => sheet.r.root.findByType('backdrop' as never).props.onPress();
    return { ...sheet, backdrop, restore: () => now.mockRestore() };
  }

  test('a second backdrop tap during the fade-out does not pop again', async () => {
    const { backdrop, restore } = await arrivedSheet();
    await act(async () => backdrop());
    await act(async () => backdrop());
    expect(mocks.back).toHaveBeenCalledTimes(1);
    restore();
  });

  test('backdrop then close only pops once', async () => {
    const { backdrop, byTestID, restore } = await arrivedSheet();
    await act(async () => backdrop());
    await act(async () => byTestID('auth-close-btn').props.onPress());
    expect(mocks.back).toHaveBeenCalledTimes(1);
    restore();
  });

  test('Back after the backdrop is swallowed, so the screen underneath stays', async () => {
    const { backdrop, restore } = await arrivedSheet();
    await act(async () => backdrop());
    expect(pressHardwareBack()).toBe(true);
    restore();
  });

  test('a backdrop tap after Back does not pop again', async () => {
    const { backdrop, restore } = await arrivedSheet();
    // Not handled here: the navigator performs this pop itself.
    expect(pressHardwareBack()).toBe(false);
    await act(async () => backdrop());
    expect(mocks.back).not.toHaveBeenCalled();
    restore();
  });

  // Measured on Android: the screen unmounts 60-250 ms after dismissal, while the
  // native fade is still on screen, so the guard has to outlive the component.
  test.each([
    ['the backdrop', async (s: Awaited<ReturnType<typeof arrivedSheet>>) => {
      await act(async () => s.backdrop());
    }],
    ['Back', async () => {
      expect(pressHardwareBack()).toBe(false);
    }],
  ])('Back during the fade-out after %s is swallowed, even once unmounted', async (_name, leave) => {
    const sheet = await arrivedSheet();
    vi.useFakeTimers();
    try {
      await leave(sheet);
      await act(async () => sheet.r.unmount());
      expect(pressHardwareBack()).toBe(true);
      // Once it has faded, Back belongs to the screen underneath again.
      vi.advanceTimersByTime(300);
      expect(mocks.backHandlers).toHaveLength(0);
    } finally {
      vi.useRealTimers();
      sheet.restore();
    }
  });

  test('Back on a legal document above the sheet leaves the sheet usable', async () => {
    const { backdrop, restore } = await arrivedSheet();
    mocks.focused = false;
    expect(pressHardwareBack()).toBe(false);
    mocks.focused = true;
    await act(async () => backdrop());
    expect(mocks.back).toHaveBeenCalledTimes(1);
    restore();
  });

  test('stops listening for Back when the sheet goes away', async () => {
    const { r, restore } = await arrivedSheet();
    expect(mocks.backHandlers).toHaveLength(1);
    await act(async () => r.unmount());
    expect(mocks.backHandlers).toHaveLength(0);
    restore();
  });
});

describe('staging-only test code', () => {
  async function openOtp() {
    mocks.requestOtp.mockResolvedValue({ otpToken: 'req-1', expiresIn: 300 });
    const sheet = await renderSheet();
    await sheet.typePhone('+998 90 123 45 67');
    await sheet.sendCode();
    const button = () =>
      sheet.r.root.findAll(
        (n) => (n.type as string) === 'pressable' && n.props.testID === 'staging-get-test-code-btn',
      );
    return { ...sheet, button };
  }

  test('is absent from a production build', async () => {
    const { button } = await openOtp();
    expect(button()).toHaveLength(0);
    expect(mocks.stagingLookup).not.toHaveBeenCalled();
  });

  test('fills the code for this request without verifying or showing it', async () => {
    mocks.staging = true;
    mocks.stagingLookup.mockResolvedValue({ status: 'found', code: '483917' });
    const { byTestID, button } = await openOtp();
    await act(async () => {
      await button()[0]!.props.onPress();
    });
    expect(mocks.stagingLookup).toHaveBeenCalledWith('req-1');
    expect(byTestID('auth-otp-field').props.value).toBe('483917');
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.toasts.join(' ')).not.toContain('483917');
  });

  test('says so when there is no code, and leaves the field alone', async () => {
    mocks.staging = true;
    mocks.stagingLookup.mockResolvedValue({ status: 'unavailable' });
    const { byTestID, button } = await openOtp();
    await act(async () => {
      await button()[0]!.props.onPress();
    });
    expect(byTestID('auth-otp-field').props.value).toBe('');
    expect(mocks.toasts).toContain('Staging code inbox is not available for this device');
  });
});
