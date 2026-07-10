import { useEffect, useState } from 'react';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { Address, AddressInput } from '@/services/orders-service';

export type AddressFormValues = AddressInput;

export type AddressFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Present = edit mode (fields prefilled); absent = add mode. */
  initial?: Address | null;
  onSubmit: (values: AddressFormValues) => void;
};

const EMPTY: AddressFormValues = { label: '', name: '', line1: '', city: '' };

/** Add / edit an address via a bottom-sheet form. */
export default function AddressFormSheet({ visible, onClose, initial, onSubmit }: AddressFormSheetProps) {
  const [values, setValues] = useState<AddressFormValues>(EMPTY);

  // Reset the form whenever the sheet (re)opens, from the edited address or empty.
  useEffect(() => {
    if (visible) {
      setValues(
        initial
          ? {
              label: initial.label,
              name: initial.name ?? '',
              line1: initial.line1,
              city: initial.city,
            }
          : EMPTY,
      );
    }
  }, [visible, initial]);

  const set = (key: keyof AddressFormValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const canSave = Boolean(
    values.label.trim() && values.name.trim() && values.line1.trim() && values.city.trim(),
  );

  const handleSave = () => {
    if (!canSave) return;
    onSubmit({
      label: values.label.trim(),
      name: values.name.trim(),
      line1: values.line1.trim(),
      city: values.city.trim(),
    });
    onClose();
  };

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} heightFraction={0.85}>
      <AppView gap={14} px={20} pb={8}>
        <AppText family="heading" weight="bold" style={{ fontSize: 20, lineHeight: 26 }} colorName="text">
          {initial ? 'Edit address' : 'Add address'}
        </AppText>
        <AppTextField label="Label" placeholder="Home" value={values.label} onChangeText={set('label')} autoCapitalize="words" {...field} />
        <AppTextField label="Full name" placeholder="Alex Marino" value={values.name} onChangeText={set('name')} autoCapitalize="words" {...field} />
        <AppTextField label="Street address" placeholder="2140 Chestnut St, Apt 6" value={values.line1} onChangeText={set('line1')} autoCapitalize="words" {...field} />
        <AppTextField label="City, State ZIP" placeholder="Philadelphia, PA 19103" value={values.city} onChangeText={set('city')} autoCapitalize="words" {...field} />
        <AppButton title={initial ? 'Save changes' : 'Add address'} kind="brand" size="lg" fullWidth disabled={!canSave} onPress={handleSave} />
      </AppView>
    </AppBottomSheet>
  );
}
