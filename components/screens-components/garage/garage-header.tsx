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
   *  empty/guest states cue "add" through the placeholder tile instead, so a
   *  second header affordance would be redundant. */
  onAddPress?: () => void;
};

export function GarageHeader({ title, subtitle, onAddPress }: GarageHeaderProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const resolvedTitle = title ?? t('garage.title');

  return (
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

      {/* Borderless card-fill add button (42×42, radius 13) — replaces the old
       *  "+ Add" pill. Icon-only keeps it language-proof; label on a11y layer.
       *  Hidden in empty/guest states (no `onAddPress`) — the placeholder tile
       *  is the add affordance there. */}
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
  );
}

export default GarageHeader;
