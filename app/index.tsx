import 'expo-dev-client';
import { Redirect } from 'expo-router';

import { useLanguageContext } from '@/contexts/language.context';

/**
 * Entry-point gate. First launch (no language chosen yet) routes the
 * user to the language picker; otherwise the explore tab.
 */
export default function RootIndex() {
  const { isHydrated, hasChosen } = useLanguageContext();
  // Wait for hydration before deciding — otherwise we'd flash /explore
  // on first launch and then yank to /select-language.
  if (!isHydrated) return null;
  if (!hasChosen) {
    return <Redirect href="/select-language?mode=onboarding" />;
  }
  return <Redirect href="/explore" />;
}
