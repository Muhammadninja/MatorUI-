import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useGarage } from '@/hooks/use-garage';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle } from '@/services/garage-service';
import { optionYears } from '@/services/vehicle-images/generation';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Asks which generation a car is when its year belongs to two, using the options
 * the backend offered. The pick is saved on the vehicle (PATCH
 * `variant_model_id`), so it follows the owner to every device. It changes the
 * picture only, never which parts fit, and the copy says so.
 */
function VehicleGenerationChoice({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const toast = useToast();
  const { updateVehicle } = useGarage();
  const [saving, setSaving] = useState<string | null>(null);
  const generation = vehicle.generation;
  if (generation?.status !== 'choice_required') return null;

  const choose = async (id: string) => {
    if (saving) return;
    triggerHaptic('selection');
    setSaving(id);
    try {
      await updateVehicle(vehicle.id, { variantModelId: id });
    } catch {
      toast.danger(t('vehicleGeneration.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <AppView
      testID="vehicle-generation-choice"
      p="lg"
      gap="sm"
      rounded={16}
      colorName="vehicleBanner"
      borderWidth={1}
      borderName="vehicleBannerBorder"
    >
      <AppText textVariant="bodySemibold" style={{ color: tokens.onVehicleBanner }}>
        {t('vehicleGeneration.title', { model: vehicle.model })}
      </AppText>
      {/* The banner's own ink at 70%, as on the selected-vehicle card above. */}
      <AppText textVariant="bodySm" style={{ color: `${tokens.onVehicleBanner}B3` }}>
        {t('vehicleGeneration.body', { year: vehicle.year })}
      </AppText>
      <AppView row gap="sm" wrap>
        {generation.options.map((option) => {
          const years = optionYears(option);
          return (
            <AppButton
              key={option.id}
              testID={`vehicle-generation-option-${option.id}`}
              title={years ? `${option.name} · ${years}` : option.name}
              kind="secondary"
              size="md"
              loading={saving === option.id}
              disabled={saving !== null}
              onPress={() => void choose(option.id)}
            />
          );
        })}
      </AppView>
    </AppView>
  );
}

export default memo(VehicleGenerationChoice);
