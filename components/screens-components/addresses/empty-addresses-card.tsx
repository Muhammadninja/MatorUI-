import { MapPinOff, Plus } from 'lucide-react-native';

import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type EmptyAddressesCardProps = {
  onAdd: () => void;
};

/** Empty state shown when the user has no saved addresses yet. Includes
 *  a primary CTA into the new-address form. */
export default function EmptyAddressesCard({ onAdd }: EmptyAddressesCardProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView
      rounded={20}
      center
      py="xxl"
      px="xl"
      gap="md"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
      }}
    >
      <AppView
        center
        rounded={999}
        style={{ width: 56, height: 56, backgroundColor: tokens.backgroundSecondary }}
      >
        <MapPinOff size={22} strokeWidth={2} color={tokens.gray400} />
      </AppView>
      <AppView align="center" gap="xs">
        <AppText textVariant="bodySemibold">{t('addresses.emptyTitle')}</AppText>
        <AppText
          textVariant="bodySm"
          colorName="gray400"
          style={{ textAlign: 'center', maxWidth: 240 }}
        >
          {t('addresses.emptySubtitle')}
        </AppText>
      </AppView>
      <AppPressableView
        androidRipple={false}
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={t('addresses.addNew')}
        row
        align="center"
        gap="sm"
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: tokens.brand,
        }}
      >
        <Plus size={14} strokeWidth={2.4} color={tokens.onBrand} />
        <AppText weight="semibold" style={{ color: tokens.onBrand }}>
          {t('addresses.addAddress')}
        </AppText>
      </AppPressableView>
    </AppView>
  );
}
