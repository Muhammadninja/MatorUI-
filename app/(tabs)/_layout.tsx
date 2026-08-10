import { Link, Tabs } from 'expo-router';
import { Bell, Car, Search, ShoppingBag, Sparkles, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import AppTabBar from '@/components/shared/app-tab-bar';
import { AppPressableView } from '@/components/shared/app-view';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { useCartContext } from '@/contexts/cart.context';
import { useSearchUIContext } from '@/contexts/search-ui.context';
import { useThemeContext } from '@/contexts/theme.context';

export const unstable_settings = {
  initialRouteName: '(explore)',
};

const TAB_META = {
  '(explore)': { label: 'Explore', icon: Search, primary: 'explore', emphasized: false },
  '(garage)': { label: 'Garage', icon: Car, primary: 'garage', emphasized: false },
  '(ai-chat)': { label: 'Assistant', icon: Sparkles, primary: 'ai-chat', emphasized: true },
  '(cart)': { label: 'Cart', icon: ShoppingBag, primary: 'cart', emphasized: false },
  '(profile)': { label: 'Profile', icon: User, primary: 'profile', emphasized: false },
} as const;

type TabKey = keyof typeof TAB_META;

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { tokens } = useThemeContext();
  const { itemCount } = useCartContext();
  const { isSearchActive } = useSearchUIContext();

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }) => {
        // Hide tab bar when search is active on the explore tab (input
        // focused or results showing) — the search surface needs the
        // full screen and the tab bar would just compete with results.
        if (isSearchActive) return null;

        // Hide tab bar when the active tab is showing a secondary stack screen
        // (e.g. /item-detail under (explore)). Note: /track-order lives on
        // the root stack (above the tabs), so it covers the tab bar without
        // needing this check.
        const activeRoute = state.routes[state.index];
        const activeTabKey = activeRoute?.name as TabKey | undefined;
        if (activeTabKey && activeTabKey in TAB_META) {
          const childState = activeRoute.state as
            | { index?: number; routes: { name: string }[] }
            | undefined;
          const focusedChild = childState
            ? childState.routes[childState.index ?? childState.routes.length - 1]?.name
            : undefined;
          const primary = TAB_META[activeTabKey].primary;
          const onPrimary = !focusedChild || focusedChild === primary;
          if (!onPrimary) return null;
        }

        return (
          <AppTabBar
            activeKey={state.routes[state.index]?.name}
            items={state.routes
              .filter((route): route is typeof route & { name: TabKey } => route.name in TAB_META)
              .map((route) => {
                const descriptor = descriptors[route.key];
                const meta = TAB_META[route.name];
                const title =
                  typeof descriptor.options.title === 'string'
                    ? descriptor.options.title
                    : meta.label;
                const Icon = meta.icon;
                const { emphasized } = meta;
                // Emphasized center button sits on the indigo accent circle in
                // both themes, so its icon stays white for contrast (not the
                // theme-inverted on-brand color, which would be black in dark).
                const emphasizedIconColor = tokens.white;

                return {
                  key: route.name,
                  label: title,
                  emphasized,
                  onPress: () => navigation.navigate(route.name),
                  badgeLabel:
                    route.name === '(cart)' && itemCount > 0
                      ? itemCount > 99
                        ? '99+'
                        : String(itemCount)
                      : undefined,
                  icon: (isActive: boolean) =>
                    emphasized ? (
                      <Icon size={22} strokeWidth={2.2} color={emphasizedIconColor} />
                    ) : (
                      <Icon
                        size={18}
                        strokeWidth={isActive ? 2.6 : 2.2}
                        color={isActive ? tokens.text : tokens.textMuted}
                      />
                    ),
                };
              })}
          />
        );
      }}
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
