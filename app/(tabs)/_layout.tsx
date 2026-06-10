import { Link, Tabs } from 'expo-router';
import { Bell, BotMessageSquare, Car, Compass, ShoppingCart, UserRound } from 'lucide-react-native';

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
  '(explore)': { label: 'Explore', icon: Compass, primary: 'explore' },
  '(garage)': { label: 'Garage', icon: Car, primary: 'garage' },
  '(cart)': { label: 'Cart', icon: ShoppingCart, primary: 'cart' },
  '(profile)': { label: 'Profile', icon: UserRound, primary: 'profile' },
  '(ai-chat)': { label: 'AI Chat', icon: BotMessageSquare, primary: 'ai-chat' },
} as const;

type TabKey = keyof typeof TAB_META;

export default function TabLayout() {
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
        // (e.g. /track-order under (cart), /item-detail under (explore)).
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

                return {
                  key: route.name,
                  label: title,
                  onPress: () => navigation.navigate(route.name),
                  badgeLabel:
                    route.name === '(cart)' && itemCount > 0
                      ? itemCount > 99
                        ? '99+'
                        : String(itemCount)
                      : undefined,
                  icon: (isActive: boolean) => (
                    <Icon
                      size={18}
                      strokeWidth={2.2}
                      color={isActive ? tokens.text : tokens.gray400}
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
      }}
    >
      <Tabs.Screen
        name="(explore)"
        options={{
          title: 'Explore',
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
      <Tabs.Screen name="(garage)" options={{ title: 'Garage', headerShown: false }} />
      <Tabs.Screen name="(cart)" options={{ title: 'Cart', headerShown: false }} />
      <Tabs.Screen name="(profile)" options={{ title: 'Profile', headerShown: false }} />
      <Tabs.Screen name="(ai-chat)" options={{ title: 'AI Chat', headerShown: false }} />
    </Tabs>
  );
}
