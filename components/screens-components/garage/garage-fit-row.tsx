import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Borderless reassurance row — confirms every price/part on the app is
 * being checked against the active vehicle. Static (no interaction);
 * the green `verified` glyph is one of the two allowed accent uses.
 */
export function GarageFitRow() {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  // Success glyph medallion — a low-alpha wash of the theme's success token
  // (≈16% dark / ≈10% light) rather than a hardcoded green literal.
  const successWash = `${tokens.success}${isDark ? '29' : '1a'}`;

  return (
    <AppView row align="center" gap={11} rounded={16} colorName="card" style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
      <AppView center style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: successWash, flexShrink: 0 }}>
        <BadgeCheck size={18} strokeWidth={2.2} color={tokens.success} />
      </AppView>
      <AppView flex={1} style={{ minWidth: 0 }}>
        <AppText family="default" weight="semibold" colorName="text" style={{ fontSize: 13.5 }}>
          {t('garage.fitFilterOn')}
        </AppText>
        <AppText family="default" colorName="textMuted" numberOfLines={2} style={{ fontSize: 12, marginTop: 1 }}>
          {t('garage.fitFilterBody')}
        </AppText>
      </AppView>
    </AppView>
  );
}

export default GarageFitRow;
