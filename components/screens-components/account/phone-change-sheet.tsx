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

/** Loose E.164 check — "+" then 9–15 digits after normalizing. */
function isValidPhone(raw: string): boolean {
  return /^\+\d{9,15}$/.test(raw.replace(/[^\d+]/g, ''));
}

/**
 * Change the login phone number via the backend OTP flow:
 *   1. enter the new number → `requestPhoneChange` sends an OTP to it
 *   2. enter the code → `confirmPhoneChange` rebinds the account + swaps session
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
  const [busy, setBusy] = useState(false);

  // Reset each time the sheet (re)opens.
  useEffect(() => {
    if (visible) {
      setStep('phone');
      setPhone(currentPhone ?? '+998');
      setCode('');
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
      const { devCode } = await requestPhoneChange(phone);
      if (devCode) setCode(devCode); // dev/demo convenience
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
      await confirmPhoneChange(phone, code.trim());
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
    <AppBottomSheet visible={visible} onClose={onClose} expandable={false} heightFraction={0.44}>
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
              {t('account.otpHint', { phone })}
            </AppText>
            <AppTextField
              label={t('account.verificationCode')}
              placeholder="123456"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoCorrect={false}
            />
            <AppButton
              title={busy ? t('account.verifying') : t('account.verifyUpdate')}
              kind="brand"
              size="lg"
              fullWidth
              disabled={busy || code.length < 6}
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
