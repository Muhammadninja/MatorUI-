import { Link, Tabs } from 'expo-router';
import { Bell, BotMessageSquare, Car, Search, ShoppingCart, UserRound } from 'lucide-react-native';

import Tab_Bar from '@/components/customs/Tab_Bar';
import { AppPressableView } from '@/components/shared/app-view';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { tokens } = useThemeContext();
  const { itemCount } = useCartContext();

  const visibleIconMap = {
    index: Search,
    garage: Car,
    cart: ShoppingCart,
    profile: UserRound,
    'ai-chat': BotMessageSquare,
  } as const;

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }) => (
        <Tab_Bar
          activeKey={state.routes[state.index]?.name}
          items={state.routes
            .filter((route) => route.name !== 'two')
            .map((route) => {
              const descriptor = descriptors[route.key];
              const title =
                typeof descriptor.options.title === 'string'
                  ? descriptor.options.title
                  : route.name;
              const Icon = visibleIconMap[route.name as keyof typeof visibleIconMap];

              return {
                key: route.name,
                label: title,
                onPress: () => navigation.navigate(route.name),
                badgeLabel:
                  route.name === 'cart' && itemCount > 0
                    ? itemCount > 99
                      ? '99+'
                      : String(itemCount)
                    : undefined,
                icon: (isActive: boolean) =>
                  Icon ? (
                    <Icon
                      size={18}
                      strokeWidth={2.2}
                      color={isActive ? tokens.text : tokens.gray400}
                    />
                  ) : null,
              };
            })}
        />
      )}
      screenOptions={{
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
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
      <Tabs.Screen
        name="garage"
        options={{
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
