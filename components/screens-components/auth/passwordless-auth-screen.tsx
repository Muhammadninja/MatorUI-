import { router, useNavigation } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Dimensions, Pressable, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalConsentNote } from '@/components/screens-components/auth/legal-consent-note';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { useAcceptLegal, useLegalDocuments } from '@/hooks/use-legal';
import { getApiBaseUrl } from '@/config/api';
import { ApiError } from '@/services/api-client';
import {
  LEGAL_ACCEPTANCE_REQUIRED,
  legalDocumentSlug,
  type LegalDocumentType,
  type LegalRegistrationVersions,
} from '@/types/legal';
import { triggerHaptic } from '@/utils/haptics';
import {
  DEFAULT_OTP_LENGTH,
  normalizeOtpInput,
  otpAutofillProps,
  otpPlaceholder,
  resolveOtpLength,
} from '@/utils/otp-input';

/** Turn a request/verify failure into a user-facing description. A 429
 *  (global rate limit) gets an explicit "too many attempts" message that
 *  honors the server's `Retry-After` cooldown; everything else surfaces the
 *  backend's own message. */
function describeAuthError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | undefined {
  if (err instanceof ApiError && err.isRateLimited) {
    return err.retryAfterSeconds
      ? t('auth.tooManyAttemptsRetry', { seconds: err.retryAfterSeconds })
      : t('auth.tooManyAttempts');
  }
  return err instanceof Error ? err.message : undefined;
}

/** DEMO/E2E prefill so the offline Maestro suite stays buttons-only (no typing).
 *  Only used against a demo backend — a real remote backend starts on an empty
 *  field so users type their own number (no seeded demo phone in production). */
const DEMO_PHONE = '+998 90 123 45 67';

/** Remembers the last phone typed so a simulator reload doesn't wipe it. */
const LAST_PHONE_KEY = 'mator.last_phone';

/** True only for a DEMO backend: the pure offline mock (no base URL) or the
 *  local E2E mock server (localhost). A real remote backend — dev, staging, or
 *  prod (api.mator.uz) — is NOT demo, so the phone field starts empty. Evaluated
 *  once at module load (env-driven, never changes at runtime). */
const IS_DEMO_AUTH: boolean = (() => {
  const base = getApiBaseUrl();
  if (base === null) return true; // pure offline mock
  return /\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|\/|$)/i.test(base); // E2E mock server
})();

/** Minimal sanity check: E.164-ish — an optional leading '+' then 9–15 digits
 *  (an Uzbek MSISDN is +998 + 9 digits = 12). We keep this loose on purpose; the
 *  backend is the source of truth for validity, this only stops obviously-empty
 *  or too-short submissions. */
function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/[^\d]/g, '');
  return /^\+?\d[\d\s()-]*$/.test(raw.trim()) && digits.length >= 9 && digits.length <= 15;
}

/** How long the backdrop ignores taps once the sheet opens, about as long as it
 *  takes to slide in. The Log in button sits where this backdrop lands, so without
 *  it a repeated tap closes the sheet it just opened and the button reads as dead. */
const BACKDROP_ARM_MS = 700;

/** Covers the sheet's 180 ms fade-out. The screen unmounts before the fade ends,
 *  so a Back in this window would otherwise pop the screen underneath. */
const LEAVE_BACK_GUARD_MS = 300;

/** Ignore Back until the sheet has faded. This outlives the unmounting screen. */
function swallowBackDuringFade() {
  const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
  setTimeout(() => subscription.remove(), LEAVE_BACK_GUARD_MS);
}

/** Leave the auth sheet, returning to whatever screen pushed it. */
function leaveSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/explore');
}

/**
 * Unified phone-number auth, presented as a small bottom sheet (the route is a
 * `transparentModal`, see `app/(auth)/_layout.tsx`). One flow for everyone — no
 * separate "sign in" vs "create account": the user enters their phone, taps
 * Next, and we text a one-time code. Existing numbers are matched to their
 * account; new numbers get one created (backend decides from `purpose`).
 *
 * Two phases in the same sheet: phone → code. On success we `router.back()` to
 * wherever the flow was triggered (e.g. the purchase gate returns to the item).
 *
 * DEMO/E2E: the mock `requestOtp` returns a `devCode` we auto-fill so the offline
 * suite stays buttons-only; a real backend omits it and the user types the code.
 */
export default function PasswordlessAuthScreen() {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useTranslation();
  // The language picked on /select-language (persisted, app-wide). The OTP
  // SMS is sent in it — see `RequestOtpInput.lang`.
  const { language } = useLanguageContext();
  const { requestOtp, verifyOtp, isLoading } = useUserContext();

  // Slide the panel up over the (fading) scrim on mount so the screen underneath
  // stays put, matching the app's other bottom sheets.
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const openedAt = useRef(Date.now());

  // The sheet stays on screen while it fades out, so Back, the backdrop and the
  // close button can all still fire. Only the first may pop: a second one would
  // take the customer off the screen underneath.
  const navigation = useNavigation();
  const leaving = useRef(false);
  const dismiss = () => {
    if (leaving.current || !navigation.isFocused()) return;
    leaving.current = true;
    swallowBackDuringFade();
    leaveSheet();
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Not focused means Back belongs to a legal document above this sheet.
      if (!leaving.current && navigation.isFocused()) {
        leaving.current = true;
        swallowBackDuringFade();
      }
      return false;
    });
    return () => subscription.remove();
  }, [navigation]);
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 90,
      friction: 12,
    }).start();
  }, [translateY]);

  const [phase, setPhase] = useState<'phone' | 'otp'>('phone');
  // Real remote backends start empty (users type their number); the demo/E2E
  // mock prefills the demo phone so the offline suite stays buttons-only.
  const [phone, setPhone] = useState(IS_DEMO_AUTH ? DEMO_PHONE : '');
  const [code, setCode] = useState('');
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH);
  const [otpToken, setOtpToken] = useState<string | null>(null);

  // ── Legal consent ────────────────────────────────────────────────────
  // Consent is collected HERE and nowhere else: tapping "Agree & continue" is
  // the acceptance. There are no checkboxes and no post-login acceptance
  // sheet — a signed-in user is never interrupted on reload.
  //
  // Versions come from the backend; the app never hardcodes one. The docs
  // query is public, so it resolves before the user has a session.
  const {
    documents: legalDocuments,
    state: legalState,
    refresh: refreshLegal,
  } = useLegalDocuments();
  const { accept } = useAcceptLegal();

  /**
   * The `legal` block for verify-otp, built from the fetched document versions.
   *
   * Always sent when the documents have loaded — never gated on whether the
   * user looks like an existing account. The backend requires it for a new
   * registration and ignores it for a sign-in, so withholding it client-side
   * could only ever break a legitimate signup. Undefined only when the
   * documents request hasn't resolved — consent is never faked from a version
   * the client didn't read off the backend.
   */
  const legalVersions = (): LegalRegistrationVersions | undefined => {
    const versionOf = (type: LegalDocumentType) =>
      legalDocuments.find((d) => d.type === type)?.version;
    const terms = versionOf('TERMS_OF_USE');
    const privacy = versionOf('PRIVACY_POLICY');
    const consent = versionOf('PERSONAL_DATA_CONSENT');
    if (terms === undefined || privacy === undefined || consent === undefined) return undefined;
    return {
      terms_version: terms,
      privacy_version: privacy,
      personal_data_consent_version: consent,
    };
  };

  /** Push the document onto the (auth) stack, over this sheet — NOT the
   *  Profile-tab /terms · /privacy · /personal-data-consent routes, which would
   *  mount a second (tabs) navigator whose Back lands on Explore and strands
   *  this sheet underneath. See app/(auth)/legal/[type].tsx. */
  const openLegalDoc = (type: LegalDocumentType) => {
    triggerHaptic('selection');
    router.push({ pathname: '/legal/[type]', params: { type: legalDocumentSlug(type) } });
  };

  // Prefill the last-used number on reload (real backends only — demo already
  // seeds its own). So the simulator "remembers" the account across reloads.
  useEffect(() => {
    if (IS_DEMO_AUTH) return;
    AsyncStorage.getItem(LAST_PHONE_KEY)
      .then((saved) => {
        if (saved) setPhone(saved);
      })
      .catch(() => undefined);
  }, []);

  const phoneValid = isValidPhone(phone);

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  const sendCode = async () => {
    if (isLoading) return;
    const identifier = phone.trim();
    if (!isValidPhone(identifier)) {
      triggerHaptic('error');
      toast.danger(identifier ? t('auth.enterValidPhone') : t('auth.enterPhone'));
      return;
    }
    try {
      const { otpToken: token, otpLength: length, devCode } = await requestOtp({
        channel: 'phone',
        identifier,
        // Unified flow: the backend upserts by phone. See file header.
        purpose: 'sign-in',
        lang: language,
      });
      triggerHaptic('success');
      setOtpToken(token);
      setOtpLength(resolveOtpLength(length));
      // Remember this number so a reload prefills it next time.
      AsyncStorage.setItem(LAST_PHONE_KEY, identifier).catch(() => undefined);
      // DEMO/E2E: auto-fill the code the mock handed back. Real backends omit it.
      setCode(devCode ?? '');
      setPhase('otp');
      toast.info(t('auth.codeSentTo', { phone: identifier }));
    } catch (err) {
      triggerHaptic('error');
      toast.danger(t('auth.couldNotSend'), { description: describeAuthError(err, t) });
    }
  };

  /**
   * Record the tap as an acceptance of every loaded document.
   *
   * `verify-otp` already carries the versions for a NEW account, but the
   * backend ignores that block for an existing one — which is exactly the case
   * the (now removed) post-login acceptance sheet used to cover. Posting the
   * same versions here means a returning user's tap is recorded too, so the
   * backend stops asking. Deliberately non-blocking: a failure here must never
   * turn a successful sign-in into an error.
   */
  const recordAcceptance = async () => {
    const acceptances = legalDocuments.map((d) => ({ type: d.type, version: d.version }));
    if (acceptances.length === 0) return;
    try {
      await accept(acceptances);
    } catch {
      // Ignored on purpose — see above.
    }
  };

  const verify = async () => {
    if (isLoading || !otpToken) return;
    try {
      await verifyOtp({ otpToken, code: code.trim(), legal: legalVersions() });
      void recordAcceptance();
      triggerHaptic('success');
      dismiss();
    } catch (err) {
      triggerHaptic('error');
      // A missing/stale acceptance is NOT an OTP failure — the code the user
      // typed may be perfectly valid. Keep them in the OTP phase (their code
      // stays entered), re-fetch the current documents, and point them at the
      // consent boxes instead of telling them the code didn't work.
      if (err instanceof ApiError && err.code === LEGAL_ACCEPTANCE_REQUIRED) {
        // The versions we sent were missing or stale (or the documents request
        // had not resolved). Re-fetch them so the next tap carries the current
        // ones, and keep the user on the OTP step with their code intact.
        refreshLegal();
        toast.danger(t('auth.legalRequiredTitle'), {
          description: t('auth.legalRequiredBody'),
        });
        return;
      }
      toast.danger(t('auth.codeDidNotWork'), { description: describeAuthError(err, t) });
    }
  };

  const resend = async () => {
    if (isLoading) return;
    try {
      const { otpToken: token, otpLength: length, devCode } = await requestOtp({
        channel: 'phone',
        identifier: phone.trim(),
        purpose: 'sign-in',
        lang: language,
      });
      setOtpToken(token);
      setOtpLength(resolveOtpLength(length));
      setCode(devCode ?? '');
      toast.info(t('auth.newCodeSent'));
    } catch (err) {
      toast.danger(t('auth.couldNotResend'), { description: describeAuthError(err, t) });
    }
  };

  const onBack = () => {
    triggerHaptic('selection');
    if (phase === 'otp') setPhase('phone');
    else dismiss();
  };

  const onBackdropPress = () => {
    if (Date.now() - openedAt.current >= BACKDROP_ARM_MS) dismiss();
  };

  return (
    <AppView
      flex={1}
      justify="flex-end"
      testID="sign-in-screen"
      // The top inset keeps a keyboard-squeezed sheet out of the status bar.
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', paddingTop: insets.top }}
    >
      {/* Backdrop — tap to dismiss. */}
      <Pressable
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onPress={onBackdropPress}
        accessibilityLabel={t('auth.dismiss')}
      />

      {/* Keyboard avoidance on BOTH platforms. RN's own KeyboardAvoidingView
          was iOS-only here (`behavior` undefined on Android), and with Android
          edge-to-edge the window no longer resizes for the IME — so the
          keyboard simply covered the phone field. keyboard-controller's
          version (its KeyboardProvider is mounted in the root layout) reads the
          real IME frame on both platforms.
          The negative offset hands back the bottom safe-area inset: the sheet
          already pads for it, and the keyboard covers that strip anyway.
          If the lifted sheet is taller than the space above the keyboard, it
          shrinks (flexShrink down the chain) and its content scrolls, so the
          field and the button stay reachable on small screens. */}
      <KeyboardAvoidingView
        behavior="padding"
        automaticOffset
        keyboardVerticalOffset={-insets.bottom}
        style={{ flexShrink: 1 }}
      >
        <Animated.View style={{ flexShrink: 1, transform: [{ translateY }] }}>
        <AppView
          roundedTop={28}
          style={{
            width: '100%',
            flexShrink: 1,
            overflow: 'hidden',
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          }}
        >
        <ScrollView
          style={{ flexGrow: 0 }}
          bounces={false}
          showsVerticalScrollIndicator={false}
          // First tap on "Next" / a legal link must act, not just close the keyboard.
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 16,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Drag handle */}
          <AppView center>
            <AppView rounded={999} style={{ width: 44, height: 5, backgroundColor: tokens.divider }} />
          </AppView>

          {/* Header row: back (otp phase only) + close */}
          <AppView row justify="space-between" align="center">
            {phase === 'otp' ? (
              <AppPressableView
                onPress={onBack}
                center
                rounded={999}
                accessibilityRole="button"
                accessibilityLabel={t('auth.back')}
                style={{ width: 34, height: 34, borderWidth: 1, borderColor: tokens.border }}
              >
                <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
              </AppPressableView>
            ) : (
              <AppView />
            )}
            <AppPressableView
              testID="auth-close-btn"
              onPress={() => {
                triggerHaptic('selection');
                dismiss();
              }}
              center
              rounded={999}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              style={{ width: 34, height: 34, borderWidth: 1, borderColor: tokens.border }}
            >
              <X size={16} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          </AppView>

          {phase === 'phone' ? (
            <>
              <AppView gap={6}>
                <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: tokens.text }}>
                  {t('auth.logInOrSignUp')}
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
                  {t('auth.phoneSubtitle')}
                </AppText>
              </AppView>

              <AppTextField
                testID="auth-phone-field"
                label={t('auth.phoneLabel')}
                placeholder="+998 90 123 45 67"
                value={phone}
                onChangeText={setPhone}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                {...field}
              />

              <AppButton
                testID="auth-send-code-btn"
                title={isLoading ? t('auth.sendingCode') : t('auth.next')}
                kind="brand"
                size="lg"
                fullWidth
                disabled={isLoading || !phoneValid}
                onPress={sendCode}
              />

              {/* Passive disclosure, NOT consent. `sendCode` already ships the
                  phone number to the backend and an SMS provider, so the user
                  must be told what they're agreeing to one step before the
                  binding tap on the OTP step. Unblocking by design: the act of
                  acceptance is the "Agree & continue" button, and nowhere
                  else. Lists every document the Legal API returned — it used
                  to hardcode Terms + Privacy and drop PERSONAL_DATA_CONSENT. */}
              <LegalConsentNote
                testID="auth-phone-legal-note"
                linkTestIDPrefix="auth-phone-legal-"
                prefix={t('auth.phoneLegalPrefix')}
                documents={legalDocuments}
                state={legalState}
                onOpen={openLegalDoc}
                onRetry={refreshLegal}
              />
            </>
          ) : (
            <>
              <AppView gap={6}>
                <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 28, color: tokens.text }}>
                  {t('auth.enterCode')}
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
                  {t('auth.codeSentDetail', { phone: phone.trim() })}
                </AppText>
              </AppView>

              <AppTextField
                testID="auth-otp-field"
                label={t('auth.verificationCodeLabel')}
                placeholder={otpPlaceholder(otpLength)}
                value={code}
                onChangeText={(v: string) =>
                  setCode((previous) => normalizeOtpInput(v, otpLength, previous))
                }
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                // Autofill only fills this field. It never submits: the button
                // below is also the legal consent, so that tap stays the user's.
                // Focused on arrival because the OS offers the code on focus.
                autoFocus
                {...otpAutofillProps()}
                {...field}
              />

              {/* Consent, as ONE explicit act: the button below is the
                  acceptance, and this line names every document that tap
                  accepts. Each title is tappable and opens the full text.
                  No checkboxes, and no separate acceptance sheet after
                  sign-in — see `recordAcceptance`, which accepts exactly the
                  documents this line names. */}
              <LegalConsentNote
                testID="auth-legal-note"
                linkTestIDPrefix="auth-legal-"
                prefix={t('auth.agreeNotePrefix')}
                documents={legalDocuments}
                state={legalState}
                onOpen={openLegalDoc}
                onRetry={refreshLegal}
              />

              {/* Sole control, and the consent itself: pressing it accepts the
                  documents named above. A failed documents request does not
                  disable it — the backend is the real gate and answers
                  LEGAL_ACCEPTANCE_REQUIRED, which `verify` handles. */}
              <AppButton
                testID="auth-verify-btn"
                title={isLoading ? t('auth.verifying') : t('auth.agreeAndContinue')}
                kind="brand"
                size="lg"
                fullWidth
                disabled={isLoading || code.length < otpLength}
                onPress={verify}
              />

              <AppPressableView
                onPress={resend}
                disabled={isLoading}
                center
                accessibilityRole="button"
                accessibilityLabel={t('auth.resendCode')}
              >
                <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
                  {t('auth.didntGetItResend')}
                </AppText>
              </AppPressableView>
            </>
          )}
        </ScrollView>
        </AppView>
        </Animated.View>
      </KeyboardAvoidingView>
    </AppView>
  );
}
