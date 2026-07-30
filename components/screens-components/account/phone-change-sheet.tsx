import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

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
      toast.danger('Enter a valid phone number');
      return;
    }
    setBusy(true);
    try {
      const { devCode } = await requestPhoneChange(phone);
      if (devCode) setCode(devCode); // dev/demo convenience
      setStep('otp');
      toast.info(`Code sent to ${phone}`);
    } catch (err) {
      toast.danger('Could not send the code', {
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
      toast.success('Phone number updated');
      onClose();
    } catch (err) {
      toast.danger('That code did not work', {
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
          Change phone number
        </AppText>

        {step === 'phone' ? (
          <>
            <AppText family="default" colorName="textMuted" style={{ fontSize: 13, marginTop: -4 }}>
              We&apos;ll text a verification code to the new number.
            </AppText>
            <AppTextField
              label="New phone number"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
            <AppButton
              title={busy ? 'Sending…' : 'Send code'}
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
              Enter the 6-digit code sent to {phone}.
            </AppText>
            <AppTextField
              label="Verification code"
              placeholder="123456"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoCorrect={false}
            />
            <AppButton
              title={busy ? 'Verifying…' : 'Verify & update'}
              kind="brand"
              size="lg"
              fullWidth
              disabled={busy || code.length < 6}
              onPress={verify}
            />
            <Pressable onPress={() => setStep('phone')} disabled={busy} accessibilityRole="button">
              <AppText family="accent" weight="bold" colorName="brandBg" style={{ fontSize: 13, textAlign: 'center' }}>
                Use a different number
              </AppText>
            </Pressable>
          </>
        )}
      </AppView>
    </AppBottomSheet>
  );
}
