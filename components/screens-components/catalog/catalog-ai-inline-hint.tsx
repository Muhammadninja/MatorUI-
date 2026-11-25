import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { openMatorAIShopping, type MatorAIEntrySource } from '@/utils/mator-ai-shopping';

type Props = {
  categoryId?: string;
  categoryLabel?: string;
  query?: string;
  filters?: Record<string, unknown>;
};

/** A single compact discovery action between complete catalog rows. */
export default function CatalogAIInlineHint({ categoryId, categoryLabel, query, filters }: Props) {
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

  const onPress = () => {
    if (openedRef.current) return;
    openedRef.current = true;
    setOpened(true);
    resetTimer.current = setTimeout(() => {
      resetTimer.current = null;
      openedRef.current = false;
      setOpened(false);
    }, 900);
    const vehicle = currentActiveVehicle?.vehicle;
    openMatorAIShopping(
      {
        source: 'category_inline' satisfies MatorAIEntrySource,
        intent: 'find_part',
        categoryId,
        categoryLabel,
        searchQuery: query,
        filters,
        vehicle: vehicle
          ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
          : undefined,
      },
      i18n.language,
    );
  };

  return (
    <AppPressableView
      testID="catalog-ai-inline-hint"
      onPress={onPress}
      disabled={opened}
      accessibilityRole="button"
      accessibilityLabel={`${t('catalog.aiInlineTitle')}. ${t('catalog.aiInlineCta')}`}
      row
      align="center"
      justify="space-between"
      gap={12}
      rounded={14}
      px={14}
      py={12}
      style={{
        minHeight: 88,
        backgroundColor: tokens.brandSoft,
        borderWidth: 1,
        borderColor: tokens.brandBg,
        opacity: opened ? 0.72 : 1,
      }}
    >
      <AppView flex={1} gap={4}>
        <AppText family="heading" weight="bold" style={{ fontSize: 14, color: tokens.text }}>
          {t('catalog.aiInlineTitle')}
        </AppText>
        <AppText textVariant="bodyXs" colorName="textMuted">
          {t('catalog.aiInlineBody')}
        </AppText>
      </AppView>
      <AppView
        rounded={999}
        px={11}
        py={8}
        style={{ backgroundColor: tokens.brandBg, minHeight: 40, justifyContent: 'center' }}
      >
        <AppText
          family="accent"
          weight="bold"
          style={{ color: tokens.onBrand, fontSize: 11, textAlign: 'center' }}
        >
          {t('catalog.aiInlineCta')}
        </AppText>
      </AppView>
    </AppPressableView>
  );
}
