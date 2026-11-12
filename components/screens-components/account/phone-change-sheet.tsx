import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { useTranslation } from 'react-i18next';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/contexts/user.context';
import {
  DEFAULT_OTP_LENGTH,
  normalizeOtpInput,
  otpAutofillProps,
  otpPlaceholder,
  resolveOtpLength,
} from '@/utils/otp-input';

/** Loose E.164 check — "+" then 9–15 digits after normalizing. */
function isValidPhone(raw: string): boolean {
  return /^\+\d{9,15}$/.test(raw.replace(/[^\d+]/g, ''));
}

/**
 * Change the login phone number via the backend OTP flow:
 *   1. enter the new number → `requestPhoneChange` sends an OTP to it and, when the
 *      account has a number, another to that one
 *   2. enter the codes → `confirmPhoneChange` rebinds the account + swaps session
 */
export function PhoneChangeSheet({
  visible,
  onClose,
  currentPhone,
}: {
  visible: boolean;
  onClose: () => void;
  currentPhone: string | null;
}) {
  const { t } = useTranslation();
  const { requestPhoneChange, confirmPhoneChange } = useUserContext();
  const toast = useToast();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState(currentPhone ?? '+998');
  const [code, setCode] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [currentRequired, setCurrentRequired] = useState(false);
  const [currentMasked, setCurrentMasked] = useState('');
  const [otpLength, setOtpLength] = useState(DEFAULT_OTP_LENGTH);
  const [busy, setBusy] = useState(false);

  // Reset each time the sheet (re)opens.
  useEffect(() => {
    if (visible) {
      setStep('phone');
      setPhone(currentPhone ?? '+998');
      setCode('');
      setCurrentCode('');
      setCurrentRequired(false);
      setCurrentMasked('');
      setOtpLength(DEFAULT_OTP_LENGTH);
      setBusy(false);
    }
  }, [visible, currentPhone]);

  const sendCode = async () => {
    if (!isValidPhone(phone)) {
      toast.danger(t('account.invalidPhone'));
      return;
    }
    setBusy(true);
    try {
      const request = await requestPhoneChange(phone);
      setOtpLength(resolveOtpLength(request.otpLength));
      setCode(request.devCode ?? ''); // dev/demo convenience
      setCurrentCode(request.devCurrentCode ?? '');
      setCurrentRequired(request.currentPhoneOtpRequired);
      setCurrentMasked(request.currentPhoneMasked ?? '');
      setStep('otp');
      toast.info(t('account.codeSent', { phone }));
    } catch (err) {
      toast.danger(t('account.codeSendFailed'), {
        description: (err as Error)?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await confirmPhoneChange(phone, code.trim(), currentRequired ? currentCode.trim() : undefined);
      toast.success(t('account.phoneUpdated'));
      onClose();
    } catch (err) {
      toast.danger(t('account.codeInvalid'), {
        description: (err as Error)?.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} expandable={false} heightFraction={step === 'otp' && currentRequired ? 0.62 : 0.44}>
      <AppView flex={1} px={20} pb={6} gap={14}>
        <AppText family="heading" weight="bold" style={{ fontSize: 20, lineHeight: 26 }} colorName="text">
          {t('account.changePhoneTitle')}
        </AppText>

        {step === 'phone' ? (
          <>
            <AppText family="default" colorName="textMuted" style={{ fontSize: 13, marginTop: -4 }}>
              {t('account.phoneStepHint')}
            </AppText>
            <AppTextField
              label={t('account.newPhone')}
              placeholder="+998 90 123 45 67"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            <AppButton
              title={busy ? t('account.sending') : t('account.sendCode')}
              kind="brand"
              size="lg"
              fullWidth
              disabled={busy || !isValidPhone(phone)}
              onPress={sendCode}
            />
          </>
        ) : (
          <>
            <AppText family="default" colorName="textMuted" style={{ fontSize: 13, marginTop: -4 }}>
              {currentRequired
                ? t('account.otpHintBoth', { phone, current: currentMasked })
                : t('account.otpHint', { phone })}
            </AppText>
            <AppTextField
              label={t(currentRequired ? 'account.newPhoneCode' : 'account.verificationCode')}
              placeholder={otpPlaceholder(otpLength)}
              value={code}
              onChangeText={(v) => setCode((previous) => normalizeOtpInput(v, otpLength, previous))}
              keyboardType="number-pad"
              autoCorrect={false}
              {...otpAutofillProps()}
            />
            {currentRequired ? (
              <AppTextField
                label={t('account.currentPhoneCode', { current: currentMasked })}
                placeholder={otpPlaceholder(otpLength)}
                value={currentCode}
                onChangeText={(v) => setCurrentCode(v.replace(/\D/g, '').slice(0, otpLength))}
                keyboardType="number-pad"
                autoCorrect={false}
              />
            ) : null}
            <AppButton
              title={busy ? t('account.verifying') : t('account.verifyUpdate')}
              kind="brand"
              size="lg"
              fullWidth
              disabled={busy || code.length < otpLength || (currentRequired && currentCode.length < otpLength)}
              onPress={verify}
            />
            <Pressable onPress={() => setStep('phone')} disabled={busy} accessibilityRole="button">
              <AppText family="accent" weight="bold" colorName="brandBg" style={{ fontSize: 13, textAlign: 'center' }}>
                {t('account.useDifferentNumber')}
              </AppText>
            </Pressable>
          </>
        )}
      </AppView>
    </AppBottomSheet>
  );
}
