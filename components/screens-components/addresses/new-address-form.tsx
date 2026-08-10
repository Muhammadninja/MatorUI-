import { useState } from 'react';

import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const isValid = isAddressDraftValid(draft);

  const update = (field: keyof AddressDraft, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title={t('addresses.newAddressTitle')}
        onBack={onCancel}
        backAccessibilityLabel={t('addresses.cancelNewAddress')}
      />
      <AppView flex={1} style={{ paddingTop: 8 }}>
        <AppView px="lg" gap="xs">
          <AppText textVariant="bodySm" colorName="gray400">
            {t('addresses.newAddressHint')}
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
              label={t('addresses.label')}
              placeholder={t('addresses.labelPlaceholder')}
              value={draft.label}
              onChangeText={(v) => update('label', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <AppTextField
              label={t('addresses.recipient')}
              placeholder={t('addresses.recipientPlaceholder')}
              value={draft.name}
              onChangeText={(v) => update('name', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <AppTextField
              label={t('addresses.line1')}
              placeholder={t('addresses.line1Placeholder')}
              value={draft.line1}
              onChangeText={(v) => update('line1', v)}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <AppTextField
              label={t('addresses.line2')}
              placeholder={t('addresses.line2Placeholder')}
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
                {t('common.cancel')}
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
                {t('addresses.saveAddress')}
              </AppText>
            </AppPressableView>
          </AppView>
        </AppKeyboardController>
      </AppView>
    </AppView>
  );
}
