import { useEffect, useState } from 'react';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { PaymentMethod, PaymentMethodInput } from '@/services/orders-service';

export type CardFormValues = PaymentMethodInput;

export type CardFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Present = edit mode (fields prefilled); absent = add mode. */
  initial?: PaymentMethod | null;
  onSubmit: (values: CardFormValues) => void;
};

const EMPTY: CardFormValues = { brand: '', last4: '', exp: '' };

/** Add / edit a payment card via a bottom-sheet form. */
export default function CardFormSheet({ visible, onClose, initial, onSubmit }: CardFormSheetProps) {
  const [values, setValues] = useState<CardFormValues>(EMPTY);

  useEffect(() => {
    if (visible) {
      setValues(initial ? { brand: initial.brand, last4: initial.last4, exp: initial.exp } : EMPTY);
    }
  }, [visible, initial]);

  const set = (key: keyof CardFormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  // Format raw digits into MM/YY, clamping the month to 01-12 and the length to 4 digits.
  const setExp = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    let formatted = digits;
    if (digits.length >= 2) {
      let mm = digits.slice(0, 2);
      const monthNum = parseInt(mm, 10);
      if (monthNum === 0) mm = '01';
      else if (monthNum > 12) mm = '12';
      formatted = digits.length > 2 ? `${mm}/${digits.slice(2)}` : mm;
    }
    set('exp')(formatted);
  };

  const canSave = Boolean(
    values.brand.trim() &&
      /^\d{4}$/.test(values.last4.trim()) &&
      /^(0[1-9]|1[0-2])\/\d{2}$/.test(values.exp.trim()),
  );

  const handleSave = () => {
    if (!canSave) return;
    onSubmit({ brand: values.brand.trim(), last4: values.last4.trim(), exp: values.exp.trim() });
    onClose();
  };

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} heightFraction={0.8}>
      <AppView gap={14} px={20} pb={8}>
        <AppText family="heading" weight="bold" style={{ fontSize: 20, lineHeight: 26 }} colorName="text">
          {initial ? 'Edit card' : 'Add card'}
        </AppText>
        <AppTextField label="Card brand" placeholder="Visa" value={values.brand} onChangeText={set('brand')} autoCapitalize="words" autoCorrect={false} {...field} />
        <AppTextField
          label="Last 4 digits"
          placeholder="4821"
          value={values.last4}
          onChangeText={(v) => set('last4')(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          autoCorrect={false}
          {...field}
        />
        <AppTextField
          label="Expiry (MM/YY)"
          placeholder="08/27"
          value={values.exp}
          onChangeText={setExp}
          keyboardType="number-pad"
          autoCorrect={false}
          {...field}
        />
        <AppButton title={initial ? 'Save changes' : 'Add card'} kind="brand" size="lg" fullWidth disabled={!canSave} onPress={handleSave} />
      </AppView>
    </AppBottomSheet>
  );
}
