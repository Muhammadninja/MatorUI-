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
      <AppView row align="center" justify="space-between" px={16} py="md" gap="md">
        <AppView flex={1} gap={3}>
          <AppText textVariant="h3" weight="bold" colorName="text" accessibilityRole="header">
            {resolvedTitle}
          </AppText>
          {subtitle ? (
            <AppText family="default" colorName="textMuted" style={{ fontSize: 13 }}>
              {subtitle}
            </AppText>
          ) : null}
        </AppView>

        {/* White outlined add button (48×48, radius 12). Icon-only keeps
         *  it language-proof; the label lives on the a11y layer. Hidden in the
         *  empty/guest states (no `onAddPress`), which offer their own add
         *  routes, so a second affordance here would be redundant. */}
        {onAddPress ? (
          <AppPressableView
            center
            rounded={12}
            colorName="card"
            borderWidth={1}
            borderName="border"
            androidRipple
            onPress={onAddPress}
            accessibilityRole="button"
            accessibilityLabel={t('garage.addVehicle')}
            accessibilityHint={t('garage.addVehicleHint')}
            style={{ width: 48, height: 48, flexShrink: 0 }}
          >
            <Plus size={22} strokeWidth={2.4} color={tokens.brand} />
          </AppPressableView>
        ) : null}
      </AppView>
    </AppView>
  );
}

export default GarageHeader;
