import 'expo-dev-client';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { useLanguageContext } from '@/contexts/language.context';
import { traceStartup } from '@/services/e2e-startup-trace';

/**
 * Entry-point gate. The branded splash is now a full-screen overlay owned by
 * the root layout (it covers everything until its cross-fade completes), so
 * this entry point just decides the real first route as soon as the persisted
 * language choice has hydrated: the language picker on first launch, or
 * straight to Explore once a language has been chosen.
 *
 * While hydration is pending we render nothing — the splash overlay is on top,
 * so there is no flash of an unsettled route behind it.
 */
export default function RootIndex() {
  const { isHydrated, hasChosen } = useLanguageContext();
  useEffect(() => {
    traceStartup('index-gate', { hydrated: isHydrated, chosen: hasChosen });
  }, [isHydrated, hasChosen]);

  // Returning users go back DOWN to the `(tabs)` the root stack already holds
  // (its initialRouteName). A `<Redirect>` replaced this route with a second
  // `(tabs)` on top: two tab navigators, so `canGoBack()` was always true and
  // a back past a tab's root landed on the hidden copy.
  useFocusEffect(
    useCallback(() => {
      if (isHydrated && hasChosen) router.dismissTo('/explore');
    }, [isHydrated, hasChosen]),
  );

  if (!isHydrated || hasChosen) return null;

  return <Redirect href="/select-language?mode=onboarding" />;
}
