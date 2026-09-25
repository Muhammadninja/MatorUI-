import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import LegalDocumentScreen from '@/components/screens/legal-document-screen';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { legalDocumentTypeFromSlug } from '@/types/legal';

/**
 * A legal document opened FROM the sign-in sheet: `/legal/terms_of_use`,
 * `/legal/privacy_policy`, `/legal/personal_data_consent`.
 *
 * It lives in the (auth) stack, not at /terms · /privacy ·
 * /personal-data-consent in the Profile tab, so it is pushed ON TOP of the
 * sheet and Back pops straight back to it — the sheet stays mounted
 * underneath, so the typed phone, the code and the current step survive.
 *
 * Pushing one of the Profile routes from the sheet instead diverges at the
 * ROOT stack: expo-router pushes a second `(tabs)` navigator over the sheet
 * with the document as the only screen in its Profile stack. Back then falls
 * through to that navigator's tab history — Explore — and the sheet is left
 * buried under it, so registration had to start over.
 *
 * The Profile routes are unchanged and still serve Settings → Legal.
 * (tests/registration-legal-navigation.test.ts runs both flows through the
 * real route tree and routers.)
 */
export default function AuthLegalDocumentRoute() {
  const { t } = useTranslation();
  const { type: slug } = useLocalSearchParams<{ type?: string }>();
  // Untyped URL input: an exact slug or nothing — never a nearby document.
  const type = legalDocumentTypeFromSlug(slug);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {type ? (
        <LegalDocumentScreen type={type} fallbackHref="/sign-in" />
      ) : (
        // An unknown slug has nothing to render; Back still returns to the sheet.
        <AppView flex={1} colorName="background" testID="legal-document-unavailable">
          <AppSettingsHeader title="" fallbackHref="/sign-in" />
          <AppView flex={1} center px={24}>
            <AppText family="default" align="center" colorName="textMuted">
              {t('legal.unavailable')}
            </AppText>
          </AppView>
        </AppView>
      )}
    </>
  );
}
