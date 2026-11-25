import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { openMatorAIShopping } from '@/utils/mator-ai-shopping';

type Props = {
  categoryId?: string;
  categoryLabel?: string;
  onDismiss: () => void;
};

/** A concise category note shown only when product photography is explicitly planned. */
export default function CatalogPhotoAnnouncement({ categoryId, categoryLabel, onDismiss }: Props) {
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

  const askMatorAI = () => {
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
        source: 'category_inline',
        intent: 'find_part',
        categoryId,
        categoryLabel,
        vehicle: vehicle
          ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
          : undefined,
      },
      i18n.language,
    );
  };

  return (
    <AppView
      testID="catalog-photo-announcement"
      rounded={16}
      p={14}
      style={{ backgroundColor: tokens.productPlaceholderBackground }}
    >
      <AppView flex={1} gap={4}>
        <AppView row align="center" justify="space-between" gap={8}>
          <AppText family="heading" weight="bold" style={{ color: tokens.text, fontSize: 14 }}>
            {t('catalog.photoAnnouncementTitle')}
          </AppText>
          <AppPressableView
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('common.dismiss')}
            center
            rounded={999}
            p={14}
            androidRipple={false}
          >
            <X size={16} color={tokens.textMuted} />
          </AppPressableView>
        </AppView>
        <AppText textVariant="bodyXs" colorName="textMuted">
          {t('catalog.photoAnnouncementBody')}
        </AppText>
        <AppPressableView
          onPress={askMatorAI}
          disabled={opened}
          accessibilityRole="button"
          accessibilityLabel={t('catalog.photoAnnouncementCta')}
          row
          align="center"
          gap={4}
          style={{ alignSelf: 'flex-start', opacity: opened ? 0.65 : 1 }}
        >
          <AppText
            family="accent"
            weight="semibold"
            style={{ color: tokens.brandText, fontSize: 12 }}
          >
            {t('catalog.photoAnnouncementCta')}
          </AppText>
        </AppPressableView>
      </AppView>
    </AppView>
  );
}
