import { CreditCard, Headphones, Package, Repeat2 } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

const QUICK_ACTIONS = [
  {
    key: 'orders',
    title: 'Your Orders',
    subtitle: 'Track active deliveries and recent purchases',
    Icon: Package,
  },
  {
    key: 'buy-again',
    title: 'Buy Again',
    subtitle: 'Reorder filters, oils, and essentials in one tap',
    Icon: Repeat2,
  },
  {
    key: 'payments',
    title: 'Wallet',
    subtitle: 'Cards, COD preferences, and billing methods',
    Icon: CreditCard,
  },
  {
    key: 'support',
    title: 'Support',
    subtitle: 'Warranty, returns, and order assistance',
    Icon: Headphones,
  },
] as const;

export default function ProfileQuickActions() {
  const { tokens } = useThemeContext();

  return (
    <AppView gap={10}>
      <AppText textVariant="subtitle" family="accent" colorName="text">
        Shortcuts
      </AppText>

      <AppView row gap={10} style={{ flexWrap: 'wrap' }}>
        {QUICK_ACTIONS.map(({ key, title, subtitle, Icon }) => (
          <AppPressableView
            key={key}
            rounded={24}
            px={14}
            py={14}
            androidRipple={false}
            pressedOpacity={0.88}
            pressedScale={0.99}
            style={{
              width: '48.5%',
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.card,
            }}
            onPress={() => triggerHaptic('selection')}
          >
            <AppView gap="md">
              <AppView
                center
                rounded={18}
                style={{
                  width: 42,
                  height: 42,
                  backgroundColor: tokens.brandBg,
                }}
              >
                <Icon size={18} strokeWidth={2.1} color={tokens.onBrand} />
              </AppView>
              <AppView gap="xs">
                <AppText textVariant="bodySemibold" colorName="text">
                  {title}
                </AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  {subtitle}
                </AppText>
              </AppView>
            </AppView>
          </AppPressableView>
        ))}
      </AppView>
    </AppView>
  );
}