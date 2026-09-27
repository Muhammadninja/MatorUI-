import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type AddVehicleStepIndicatorProps = {
  total: number;
  current: number;
  label?: string;
};

export function AddVehicleStepIndicator({
  total,
  current,
  label,
}: AddVehicleStepIndicatorProps) {
  const { t } = useTranslation();
  return (
    <AppView gap="sm" px={20} pb="xs">
      <AppView row align="center" justify="space-between" gap={10}>
        <AppText
          textVariant="caption"
          family="accent"
          colorName="gray400"
          transform="uppercase"
        >
          {t('addVehicle.stepProgress', { current, total })}
        </AppText>
        {label ? (
          <AppText textVariant="bodySemibold" colorName="text">
            {label}
          </AppText>
        ) : null}
      </AppView>
      <AppView row gap={6}>
        {Array.from({ length: total }).map((_, i) => (
          <AppView
            key={i}
            flex={1}
            rounded={999}
            colorName={i < current ? 'brand' : 'border'}
            style={{ height: 4 }}
          />
        ))}
      </AppView>
    </AppView>
  );
}

export default AddVehicleStepIndicator;
