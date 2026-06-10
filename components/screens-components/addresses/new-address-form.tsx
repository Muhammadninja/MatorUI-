import { useState } from 'react';

import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import AppKeyboardController from '@/components/shared/keyboard-controller/app-keyboard-controller';
import { useThemeContext } from '@/contexts/theme.context';
import {
  EMPTY_ADDRESS_DRAFT,
  isAddressDraftValid,
  type AddressDraft,
} from '@/utils/shipping-addresses';

export type NewAddressFormProps = {
  /** Fired with the validated draft when the user taps Save. The parent
   *  owns the persisted list and decides id + isDefault. */
  onSubmit: (draft: AddressDraft) => void;
  onCancel: () => void;
};

/** New-address sub-screen — its own header + form, owns the draft state.
 *  The parent screen routes between this and the list view; this
 *  component never knows about the list. */
export default function NewAddressForm({ onSubmit, onCancel }: NewAddressFormProps) {
  const { tokens } = useThemeContext();
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const isValid = isAddressDraftValid(draft);

  const update = (field: keyof AddressDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title="New Address"
        onBack={onCancel}
        backAccessibilityLabel="Cancel new address"
      />
      <AppView flex={1} style={{ paddingTop: 8 }}>
        <AppView px="lg" gap="xs">
          <AppText textVariant="bodySm" colorName="gray400">
            Add a delivery location for future orders.
          </AppText>
        </AppView>

        <AppKeyboardController
          fillContainer
          showToolbar={false}
          offset={120}
          kStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        >
          <AppView gap="md">
            <AppTextField
              label="Label"
              placeholder="Home, Work, Garage..."
              value={draft.label}
              onChangeText={(v) => update('label', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <AppTextField
              label="Recipient"
              placeholder="Full name"
              value={draft.name}
              onChangeText={(v) => update('name', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <AppTextField
              label="Address line 1"
              placeholder="Street address"
              value={draft.line1}
              onChangeText={(v) => update('line1', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <AppTextField
              label="Address line 2"
              placeholder="City, state, ZIP, country"
              value={draft.line2}
              onChangeText={(v) => update('line2', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </AppView>

          <AppView row align="center" gap="sm" mt="xl">
            <AppPressableView
              center
              androidRipple={false}
              onPress={onCancel}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.backgroundSecondary,
              }}
            >
              <AppText textVariant="bodySemibold" weight="semibold" colorName="gray400">
                Cancel
              </AppText>
            </AppPressableView>

            <AppPressableView
              center
              androidRipple={false}
              onPress={() => isValid && onSubmit(draft)}
              disabled={!isValid}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 8,
                backgroundColor: tokens.brand,
                opacity: isValid ? 1 : 0.5,
              }}
            >
              <AppText
                textVariant="bodySemibold"
                weight="semibold"
                style={{ color: tokens.onBrand }}
              >
                Save address
              </AppText>
            </AppPressableView>
          </AppView>
        </AppKeyboardController>
      </AppView>
    </AppView>
  );
}
