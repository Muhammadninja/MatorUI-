import { router } from 'expo-router';
import { ArrowLeft, CreditCard } from 'lucide-react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function CheckoutScreen() {
  const { scheme, tokens } = useThemeContext();

  return (
    <ScreenShell>
      <AppView mt={14} px={16} gap={16}>
        <AppView row align="center" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
            <AppPressableView
              row
              align="center"
              androidRipple={false}
              onPress={() => router.back()}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
          </AppView>

          <AppText
            textVariant="title"
            family="heading"
            weight="bold"
            style={{ textAlign: 'center' }}
          >
            Checkout
          </AppText>

          <AppView style={{ flex: 1, alignItems: 'flex-end' }}>
            <AppView
              center
              rounded={36}
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: scheme === 'dark' ? tokens.gray100 : tokens.background,
              }}
            >
              <CreditCard
                size={16}
                strokeWidth={2.1}
                color={scheme === 'dark' ? tokens.white : tokens.gray400}
              />
            </AppView>
          </AppView>
        </AppView>

        <AppView
          rounded={24}
          px={16}
          py={16}
          gap={10}
          style={{
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          }}
        >
          <AppText textVariant="subtitle" family="accent">
            Checkout flow placeholder
          </AppText>
          <AppText textVariant="bodySm" colorName="gray400">
            This screen is ready for address selection, payment methods, totals, and order
            confirmation.
          </AppText>
          <AppButton
            title="Back to cart"
            kind="secondary"
            size="sm"
            onPress={() => router.back()}
          />
        </AppView>
      </AppView>
    </ScreenShell>
  );
}
