import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppTextField } from '@/components/shared/app-text-field';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { MANUAL_NAME_MAX } from '@/services/manual-vehicle';

export type ManualNameErrors = { make?: string; model?: string };

/**
 * "Not in the list": the owner types the model, and the make too when the
 * catalog has no such make. A listed make stays the picked one (shown, not
 * editable here). The note says up front that parts can't be matched exactly
 * for a car the catalog doesn't know.
 */
export function VehicleManualEntry({
  catalogMakeName,
  makeName,
  modelName,
  errors,
  disabled,
  onChangeMake,
  onChangeModel,
}: {
  /** The picked catalog make, or null when the make is typed too. */
  catalogMakeName: string | null;
  makeName: string;
  modelName: string;
  errors: ManualNameErrors;
  disabled?: boolean;
  onChangeMake: (value: string) => void;
  onChangeModel: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 12 }}>
      {catalogMakeName ? (
        <AppText family="default" style={{ fontSize: 15, color: tokens.textMuted }}>
          {t('vehiclePicker.manualMakeListed', { make: catalogMakeName })}
        </AppText>
      ) : (
        <AppTextField
          testID="manual-make-field"
          label={t('vehiclePicker.manualMakeLabel')}
          placeholder={t('vehiclePicker.manualMakePlaceholder')}
          value={makeName}
          onChangeText={onChangeMake}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={MANUAL_NAME_MAX + 20}
          errorText={errors.make}
          disabled={disabled}
        />
      )}
      <AppTextField
        testID="manual-model-field"
        label={t('vehiclePicker.manualModelLabel')}
        placeholder={t('vehiclePicker.manualModelPlaceholder')}
        value={modelName}
        onChangeText={onChangeModel}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={MANUAL_NAME_MAX + 20}
        errorText={errors.model}
        disabled={disabled}
        autoFocus={Boolean(catalogMakeName)}
      />
      <AppView testID="manual-fit-note" row gap={8} rounded={12} colorName="backgroundSecondary" style={{ padding: 12 }}>
        <Info size={16} strokeWidth={2.2} color={tokens.textMuted} style={{ marginTop: 2 }} />
        <AppText family="default" style={{ flex: 1, fontSize: 13, lineHeight: 18, color: tokens.textMuted }}>
          {t('vehiclePicker.manualFitNote')}
        </AppText>
      </AppView>
    </ScrollView>
  );
}

export default VehicleManualEntry;
