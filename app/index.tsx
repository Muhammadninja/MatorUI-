import 'expo-dev-client';
import { Redirect } from 'expo-router';

import { useLanguageContext } from '@/contexts/language.context';

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

  if (!isHydrated) return null;

  return <Redirect href={hasChosen ? '/explore' : '/select-language?mode=onboarding'} />;
}
