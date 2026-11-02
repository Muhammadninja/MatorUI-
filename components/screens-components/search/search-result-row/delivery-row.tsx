import { Truck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { SEARCH_FONT } from './fonts';
import type { CardVariant } from './variant';

export default function DeliveryRow({ delivery }: { delivery: CardVariant['delivery'] }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  // Kind → theme token. Free tiers ride `tokens.success` so the green
  // tracks the active theme (lighter in dark, darker in light); the
  // standard tier rides `tokens.gray400` for a balanced muted gray that
  // also follows the theme.
  const color = delivery.kind === 'free' ? tokens.success : tokens.textMuted;
  return (
    <AppView row align="center" gap="xs">
      <Truck size={12} strokeWidth={2} color={color} />
      <AppText
        textVariant="bodyXs"
        weight="semibold"
        style={{ color, fontFamily: SEARCH_FONT.semibold, fontSize: 10 }}
      >
        {t(delivery.labelKey)}
      </AppText>
    </AppView>
  );
}
