import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { Address, AddressInput } from '@/services/orders-service';
import { debugLog } from '@/services/debug-log';

export type AddressFormValues = AddressInput;

export type AddressFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Present = edit mode (fields prefilled); absent = add mode. */
  initial?: Address | null;
  onSubmit: (values: AddressFormValues) => void;
};

const EMPTY: AddressFormValues = { label: '', name: '', line1: '', city: '' };

/**
 * Add / edit an address via a bottom-sheet form.
 *
 * The sheet is a fixed, compact height (`expandable={false}`) with the fields
 * in a ScrollView and the save button pinned below it — so when the keyboard
 * opens the fields scroll under it while the button stays reachable. Swipe the
 * drag handle down to dismiss.
 */
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

  const canSave = Boolean(values.line1.trim() && values.city.trim());

  const handleSave = () => {
    if (!canSave) return;
    // The "Label" and "Full name" fields were removed from the form. Keep any
    // existing label on edit; for a new address fall back to the street line so
    // the display title (checkout / address list) isn't blank.
    const label = values.label.trim() || values.line1.trim();
    const payload: AddressFormValues = {
      label,
      name: values.name.trim(),
      line1: values.line1.trim(),
      city: values.city.trim(),
    };
    // Log exactly what the user entered before it goes to the backend, so the
    // values are visible in the console (tag `[mator:address]`).
    debugLog('address', `form submit (${initial ? 'edit' : 'add'})`, payload);
    onSubmit(payload);
    onClose();
  };

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} expandable={false} heightFraction={0.4}>
      <AppView flex={1} px={20} pb={6}>
        <AppText family="heading" weight="bold" style={{ fontSize: 20, lineHeight: 26, marginBottom: 6 }} colorName="text">
          {initial ? 'Edit address' : 'Add address'}
        </AppText>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingTop: 6, paddingBottom: 14 }}
        >
          <AppTextField label="Street address" placeholder="2140 Chestnut St, Apt 6" value={values.line1} onChangeText={set('line1')} autoCapitalize="words" {...field} />
          <AppTextField label="City, State ZIP" placeholder="Philadelphia, PA 19103" value={values.city} onChangeText={set('city')} autoCapitalize="words" {...field} />
        </ScrollView>

        <AppButton title={initial ? 'Save changes' : 'Add address'} kind="brand" size="lg" fullWidth disabled={!canSave} onPress={handleSave} />
      </AppView>
    </AppBottomSheet>
  );
}
