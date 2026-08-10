import { CreditCard, Headphones, Package, Repeat2 } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

function buildQuickActions(t: (key: string) => string) {
  return [
    {
      key: 'orders',
      title: t('profileCards.quickOrdersTitle'),
      subtitle: t('profileCards.quickOrdersSub'),
      Icon: Package,
    },
    {
      key: 'buy-again',
      title: t('profileCards.quickBuyAgainTitle'),
      subtitle: t('profileCards.quickBuyAgainSub'),
      Icon: Repeat2,
    },
    {
      key: 'payments',
      title: t('profileCards.quickWalletTitle'),
      subtitle: t('profileCards.quickWalletSub'),
      Icon: CreditCard,
    },
    {
      key: 'support',
      title: t('profileCards.quickSupportTitle'),
      subtitle: t('profileCards.quickSupportSub'),
      Icon: Headphones,
    },
  ] as const;
}

export default function ProfileQuickActions() {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const quickActions = React.useMemo(() => buildQuickActions(t), [t]);

  return (
    <AppView gap={10}>
      <AppText textVariant="subtitle" family="accent" colorName="text">
        {t('profileCards.shortcuts')}
      </AppText>

      <AppView row gap={10} style={{ flexWrap: 'wrap' }}>
        {quickActions.map(({ key, title, subtitle, Icon }) => (
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