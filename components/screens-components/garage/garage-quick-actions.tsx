import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Gauge, ReceiptText, ScanLine } from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageQuickActionsProps = {
  /** Jump straight into the active vehicle's edit form (mileage focus). */
  onUpdateMileage: () => void;
  onPastOrders: () => void;
  onScanVin: () => void;
  onSavedParts: () => void;
  /** Current mileage of the active vehicle (already formatted, e.g.
   *  "67,420 mi"). Shown as the mileage tile's sub-line; falls back to a
   *  generic prompt when the vehicle has no mileage yet. */
  mileageLabel?: string;
};

type Action = {
  key: string;
  Icon: ComponentType<LucideProps>;
  label: string;
  sub: string;
  onPress: () => void;
};

function Tile({ Icon, label, sub, onPress }: Omit<Action, 'key'>) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      style={{ flexBasis: '48%', flexGrow: 1 }}
      rounded={16}
      colorName="card"
      androidRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      p={14}
      gap={8}
    >
      <Icon size={20} strokeWidth={2} color={tokens.text} />
      <AppText family="default" weight="semibold" colorName="text" numberOfLines={1} style={{ fontSize: 13.5 }}>
        {label}
      </AppText>
      <AppText family="default" colorName="textMuted" numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 15 }}>
        {sub}
      </AppText>
    </AppPressableView>
  );
}

/**
 * 2×2 grid of borderless card tiles. Every tile routes to a real
 * destination — Update mileage (active vehicle edit), Past orders and
 * Saved parts (root-hosted, so `back` returns to the garage), and Scan VIN
 * (add-vehicle).
 */
export function GarageQuickActions({
  onUpdateMileage,
  onPastOrders,
  onScanVin,
  onSavedParts,
  mileageLabel,
}: GarageQuickActionsProps) {
  const { t } = useTranslation();

  const actions: Action[] = [
    {
      key: 'mileage',
      Icon: Gauge,
      label: t('garage.qaUpdateMileage'),
      sub: mileageLabel || t('garage.qaUpdateMileageSub'),
      onPress: onUpdateMileage,
    },
    { key: 'orders', Icon: ReceiptText, label: t('garage.qaPastOrders'), sub: t('garage.qaPastOrdersSub'), onPress: onPastOrders },
    { key: 'scan', Icon: ScanLine, label: t('garage.qaScanVin'), sub: t('garage.qaScanVinSub'), onPress: onScanVin },
    { key: 'saved', Icon: Bookmark, label: t('garage.qaSavedParts'), sub: t('garage.qaSavedPartsSub'), onPress: onSavedParts },
  ];

  return (
    <AppView row style={{ flexWrap: 'wrap', gap: 10 }}>
      {actions.map(({ key, ...rest }) => (
        <Tile key={key} {...rest} />
      ))}
    </AppView>
  );
}

export default GarageQuickActions;
