import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageHeaderProps = {
  title?: string;
  /** Optional sub-line under the title (e.g. "3 vehicles · fit checked
   *  automatically"). Hidden when absent — empty/guest states omit it. */
  subtitle?: string;
  /** Add-vehicle tap. When omitted the + button is hidden entirely — the
   *  empty/guest states carry their own add affordances, so a second header
   *  affordance would be redundant. */
  onAddPress?: () => void;
};

export function GarageHeader({ title, subtitle, onAddPress }: GarageHeaderProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const resolvedTitle = title ?? t('garage.title');

  return (
    <AppView>
      <AppView row align="center" justify="space-between" px={20} py="lg" gap="md">
        <AppView flex={1} gap={3}>
          <AppText
            family="heading"
            weight="bold"
            colorName="text"
            numberOfLines={1}
            accessibilityRole="header"
            style={{ fontSize: 26, lineHeight: 32 }}
          >
            {resolvedTitle}
          </AppText>
          {subtitle ? (
            <AppText family="default" colorName="textMuted" numberOfLines={1} style={{ fontSize: 13 }}>
              {subtitle}
            </AppText>
          ) : null}
        </AppView>

        {/* Borderless card-fill add button (42×42, radius 13). Icon-only keeps
         *  it language-proof; the label lives on the a11y layer. Hidden in the
         *  empty/guest states (no `onAddPress`), which offer their own add
         *  routes, so a second affordance here would be redundant. */}
        {onAddPress ? (
          <AppPressableView
            center
            rounded={13}
            colorName="card"
            androidRipple
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel={t('garage.addVehicle')}
            accessibilityHint={t('garage.addVehicleHint')}
            style={{ width: 42, height: 42, flexShrink: 0 }}
          >
            <Plus size={22} strokeWidth={2.4} color={tokens.text} />
          </AppPressableView>
        ) : null}
      </AppView>

      {/* Hairline closing the header off from the scrolling content below.
       *  Inset to the page gutter rather than run edge-to-edge, so it reads as
       *  the underline of this block instead of a full-bleed divider. */}
      <AppView
        style={{ height: 1, marginHorizontal: 20, backgroundColor: tokens.border }}
      />
    </AppView>
  );
}

export default GarageHeader;
