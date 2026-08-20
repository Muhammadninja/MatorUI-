import { useTranslation } from 'react-i18next';
import { CarFront, Plus } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Ghost "slot" placeholder for the garage.
 *
 * Instead of a full empty-state card, this reads as an *empty vehicle
 * slot* — a dashed card the width/shape of a real tile with a faint car
 * silhouette — hinting that a car belongs here. Tapping it adds a
 * vehicle (guests get routed to auth by the caller's `onAdd`).
 */
export type GaragePlaceholderTileProps = {
  onAdd?: () => void;
};

export function GaragePlaceholderTile({ onAdd }: GaragePlaceholderTileProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppPressableView
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={t('garage.addVehicle')}
      accessibilityHint={t('garage.addVehicleHint')}
      rounded={18}
      colorName="backgroundSecondary"
      style={{
        borderWidth: 1.5,
        borderColor: tokens.border,
        borderStyle: 'dashed',
        overflow: 'hidden',
      }}
    >
      {/* Faint car silhouette — the "a car goes here" cue. */}
      <AppView style={{ height: 130 }} center>
        <CarFront size={40} strokeWidth={1.75} color={tokens.gray400} />
      </AppView>

      {/* Hint row mirroring a real tile's info block. */}
      <AppView row align="center" px={16} pt={14} pb={16} gap={12}>
        <AppView flex={1} gap={3}>
          <AppText family="heading" weight="bold" colorName="textMuted" style={{ fontSize: 16 }}>
            {t('garage.addVehicle')}
          </AppText>
          <AppText textVariant="bodySm" colorName="textMuted" numberOfLines={1}>
            {t('garage.emptyBody')}
          </AppText>
        </AppView>
        <AppView
          center
          rounded={999}
          borderWidth={1}
          borderName="border"
          style={{ width: 40, height: 40 }}
        >
          <Plus size={20} strokeWidth={2.2} color={tokens.textMuted} />
        </AppView>
      </AppView>
    </AppPressableView>
  );
}

export default GaragePlaceholderTile;
