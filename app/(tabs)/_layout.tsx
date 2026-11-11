import { Link, Tabs } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppPressableView } from '@/components/shared/app-view';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useThemeContext } from '@/contexts/theme.context';

export const unstable_settings = {
  initialRouteName: '(explore)',
};

const NO_TAB_BAR = () => null;

export default function TabLayout() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <Tabs
      // Each tab's ROOT screen draws the bar (`withTabBar`), so the native
      // stack covers and uncovers it with the screen. Hiding it here from the
      // nested stack's JS state lagged the native back swipe: the root showed
      // with no bar until the pop landed.
      tabBar={NO_TAB_BAR}
      screenOptions={{
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        // Keep inactive tab screens rendered (don't freeze on blur) so
        // returning to a tab is instant instead of showing a brief blank
        // while the frozen screen re-renders.
        freezeOnBlur: false,
      }}
    >
      <Tabs.Screen
        name="(explore)"
        options={{
          title: t('nav.explore'),
          headerShown: false,
          headerRight: () => (
            <Link href="/modal" asChild>
              <AppPressableView rounded={36} p={8} androidRipple={false}>
                <Bell size={20} strokeWidth={2.2} color={tokens.text} />
              </AppPressableView>
            </Link>
          ),
        }}
      />
      <Tabs.Screen name="(garage)" options={{ title: t('nav.garage'), headerShown: false }} />
      <Tabs.Screen name="(ai-chat)" options={{ title: t('nav.assistant'), headerShown: false }} />
      <Tabs.Screen name="(cart)" options={{ title: t('nav.cart'), headerShown: false }} />
      <Tabs.Screen name="(profile)" options={{ title: t('nav.profile'), headerShown: false }} />
    </Tabs>
  );
}
