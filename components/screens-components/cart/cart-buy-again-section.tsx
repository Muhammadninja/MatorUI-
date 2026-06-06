import { router } from 'expo-router';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export default function CartBuyAgainSection() {
  const { tokens } = useThemeContext();

  const handleViewOrders = () => {
    triggerHaptic('selection');
    router.push('/order-history');
  };

  return (
    <AppView gap={10}>
      <AppView row align="center" justify="space-between">
        <AppText textVariant="bodySm" weight="semibold">
          Buy again
        </AppText>
        <AppPressableView
          androidRipple={false}
          onPress={handleViewOrders}
        >
          <AppText
            textVariant="bodyXs"
            weight="medium"
            style={{ color: tokens.gray400, textDecorationLine: 'underline' }}
          >
            Orders
          </AppText>
        </AppPressableView>
      </AppView>

      <AppText textVariant="bodyXs" colorName="gray400">
        Past orders will appear here so you can re-order in one tap.
      </AppText>
    </AppView>
  );
}
