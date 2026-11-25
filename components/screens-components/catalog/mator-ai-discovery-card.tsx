import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { openMatorAIShopping, type MatorAIEntrySource } from '@/utils/mator-ai-shopping';

export default function MatorAIDiscoveryCard({
  source,
  categoryId,
  categoryLabel,
  query,
  filters,
  compact = false,
}: {
  source: MatorAIEntrySource;
  categoryId?: string;
  categoryLabel?: string;
  query?: string;
  filters?: Record<string, unknown>;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const [opened, setOpened] = useState(false);
  const openedRef = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );
  const vehicle = currentActiveVehicle?.vehicle;
  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
    : undefined;
  const title = compact ? t('catalog.aiInlineTitle') : t('catalog.aiDiscoveryTitle');
  const body = compact ? t('catalog.aiInlineBody') : t('catalog.aiDiscoveryBody');
  const onPress = () => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpened(true);
    resetTimer.current = setTimeout(() => {
      resetTimer.current = null;
      openedRef.current = false;
      setOpened(false);
    }, 900);
    openMatorAIShopping(
      {
        source,
        intent: 'find_part',
        categoryId,
        categoryLabel,
        searchQuery: query,
        filters,
        vehicle: vehicleLabel,
      },
      i18n.language,
    );
  };
  return (
    <AppView
      rounded={16}
      p={compact ? 14 : 18}
      gap={compact ? 8 : 12}
      style={{ backgroundColor: tokens.brandSoft, borderWidth: 1, borderColor: tokens.brandBg }}
    >
      <AppView row align="center" gap={8}>
        <AppView
          center
          rounded={9}
          style={{ width: 24, height: 24, backgroundColor: tokens.brandBg }}
        >
          <AppText family="accent" weight="bold" style={{ color: tokens.onBrand, fontSize: 9 }}>
            AI
          </AppText>
        </AppView>
        <AppText family="accent" weight="bold" style={{ color: tokens.brandText, fontSize: 13 }}>
          Mator AI
        </AppText>
      </AppView>
      <AppView gap={5}>
        <AppText
          family="heading"
          weight="bold"
          style={{ color: tokens.text, fontSize: compact ? 14 : 17 }}
        >
          {title}
        </AppText>
        <AppText textVariant="bodySm" colorName="textMuted">
          {body}
        </AppText>
      </AppView>
      <AppPressableView
        onPress={onPress}
        disabled={opened}
        testID={`mator-ai-${source}`}
        accessibilityRole="button"
        accessibilityLabel={t('catalog.aiDiscoveryCta')}
        center
        rounded={10}
        px={14}
        // Keep the touch target at 44pt through padding. AppPressableView treats
        // explicit minHeight as a sized control and lets its inner Pressable grow,
        // which can stretch this CTA to the full height of a flex parent.
        py={14}
        style={{ alignSelf: 'flex-start', backgroundColor: tokens.brandBg }}
      >
        <AppText family="accent" weight="bold" style={{ color: tokens.onBrand, fontSize: 13 }}>
          {t('catalog.aiDiscoveryCta')}
        </AppText>
      </AppPressableView>
    </AppView>
  );
}
