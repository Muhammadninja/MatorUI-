import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Terms & Conditions — a plain, scrollable legal page reached from Settings.
 * The section copy below is a starting scaffold; replace it with the finalized
 * legal text (or point the screen at a hosted document) before release.
 */
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By creating an account or using the Mator app you agree to these Terms & Conditions. If you do not agree, please stop using the app.',
  },
  {
    heading: '2. Using the App',
    body: 'Mator connects buyers with sellers of automotive parts and oils. You are responsible for the accuracy of the information you provide and for keeping your account secure.',
  },
  {
    heading: '3. Orders & Payments',
    body: 'Prices are shown in the currency indicated in the app and may change. An order is a request to purchase; it is confirmed once the seller accepts it. Payment terms are shown at checkout.',
  },
  {
    heading: '4. Fitment & Compatibility',
    body: 'Compatibility indicators are provided for guidance only. Please confirm that a part fits your specific vehicle before purchasing. Universal items are marked as such.',
  },
  {
    heading: '5. Returns & Cancellations',
    body: 'Return and cancellation rights depend on the seller and applicable law. Contact support or the seller for help with an order.',
  },
  {
    heading: '6. Privacy',
    body: 'We process your data to operate the app and fulfil your orders. See our Privacy Policy for details on what we collect and how it is used.',
  },
  {
    heading: '7. Contact',
    body: 'Questions about these terms? Reach us through the support options in the app.',
  },
];

export default function TermsScreen() {
  const { tokens } = useThemeContext();

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Terms & Conditions" fallbackHref="/settings-security" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, paddingHorizontal: 20 }}
      >
        <AppView gap={18}>
          <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
            Please read these terms carefully before using Mator.
          </AppText>

          {SECTIONS.map((s) => (
            <AppView key={s.heading} gap={6}>
              <AppText family="heading" weight="bold" style={{ fontSize: 15.5, color: tokens.text }}>
                {s.heading}
              </AppText>
              <AppText family="default" style={{ fontSize: 13.5, lineHeight: 20, color: tokens.textMuted }}>
                {s.body}
              </AppText>
            </AppView>
          ))}
        </AppView>
      </AppScrollView>
    </AppView>
  );
}
