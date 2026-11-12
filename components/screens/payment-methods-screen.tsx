import { ScrollView } from 'react-native';

import { useTranslation } from 'react-i18next';

import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { PaymentOptionMark } from '@/components/screens-components/checkout/checkout-sections';
import { PAYMENT_OPTIONS } from '@/constants/payment-options';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Payment methods — informational. Mator supports three fixed methods for the
 * Uzbek market (Payme, Terminal, Cash), chosen at checkout rather than stored
 * on the account, so there is nothing to add or manage here.
 */
export default function PaymentMethodsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={t('paymentMethods.title')} fallbackHref="/profile" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 12, paddingHorizontal: 16 }}
      >
        <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, marginBottom: 4 }}>
          {t('paymentMethods.intro')}
        </AppText>

        {PAYMENT_OPTIONS.map((opt) => {
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
              {opt.logo ? (
                <PaymentOptionMark option={opt} width={76} iconSize={22} color={tokens.text} />
              ) : (
                <AppView center rounded={12} colorName="backgroundSecondary" style={{ width: 56, height: 44 }}>
                  <PaymentOptionMark option={opt} width={56} iconSize={22} color={tokens.text} />
                </AppView>
              )}
              <AppView flex={1}>
                {/* A provider logo already names the method. */}
                {opt.logo ? null : (
                  <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
                    {t(opt.labelKey)}
                  </AppText>
                )}
                <AppText
                  family="default"
                  accessibilityLabel={opt.logo ? `${t(opt.labelKey)}. ${t(opt.descriptionKey)}` : undefined}
                  style={{ fontSize: 13, color: tokens.textMuted, marginTop: opt.logo ? 0 : 2 }}
                >
                  {t(opt.descriptionKey)}
                </AppText>
              </AppView>
            </AppView>
          );
        })}
      </ScrollView>
    </AppView>
  );
}
