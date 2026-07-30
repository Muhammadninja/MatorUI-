import { ScrollView } from 'react-native';

import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { PAYMENT_OPTIONS } from '@/constants/payment-options';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Payment methods — informational. Mator supports three fixed methods for the
 * Uzbek market (Payme, Terminal, Cash), chosen at checkout rather than stored
 * on the account, so there is nothing to add or manage here.
 */
export default function PaymentMethodsScreen() {
  const { tokens } = useThemeContext();

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Payment methods" fallbackHref="/profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 12, paddingHorizontal: 16 }}
      >
        <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, marginBottom: 4 }}>
          Choose how to pay when you place an order. No card is stored on your account.
        </AppText>

        {PAYMENT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <AppView
              key={opt.id}
              row
              align="center"
              gap={14}
              rounded={16}
              p={16}
              colorName="card"
              borderWidth={1}
              borderName="border"
            >
              <AppView center rounded={12} colorName="backgroundSecondary" style={{ width: 44, height: 44 }}>
                <Icon size={22} strokeWidth={2} color={tokens.text} />
              </AppView>
              <AppView flex={1}>
                <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
                  {opt.label}
                </AppText>
                <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}>
                  {opt.description}
                </AppText>
              </AppView>
            </AppView>
          );
        })}
      </ScrollView>
    </AppView>
  );
}
