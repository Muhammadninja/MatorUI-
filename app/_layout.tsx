import { Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import {
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import { ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppView } from '@/components/shared/app-view';
import GlobalModalHost from '@/components/shared/global-modal-host';
import { useColorScheme } from '@/components/useColorScheme';
import { CartProvider } from '@/contexts/cart.context';
import { ThemeProvider as AppThemeProvider, useThemeContext } from '@/contexts/theme.context';
import { UserProvider } from '@/contexts/user.context';
import { createNavigationTheme } from '@/themes';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Manrope_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AppThemeProvider>
          <UserProvider>
            <CartProvider>
              <RootNavigation />
              <GlobalModalHost />
            </CartProvider>
          </UserProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

function RootNavigation() {
  const colorScheme = useColorScheme();
  const { scheme, tokens } = useThemeContext();
  const resolvedScheme = scheme ?? (colorScheme === 'dark' ? 'dark' : 'light');
  const navigationTheme = createNavigationTheme(resolvedScheme);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(tokens.background).catch(() => undefined);

    if (Platform.OS === 'android') {
      try {
        NavigationBar.NavigationBar.setStyle(resolvedScheme === 'dark' ? 'dark' : 'light');
      } catch {
        // no-op when navigation bar API is unavailable
      }
    }
  }, [tokens.background, resolvedScheme]);

  return (
    <AppView flex={1} colorName="background">
      <StatusBar
        barStyle={resolvedScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <NavigationThemeProvider value={navigationTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: tokens.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="order-history" options={{ headerShown: false }} />
          <Stack.Screen name="shipping-addresses" options={{ headerShown: false }} />
          <Stack.Screen name="settings-security" options={{ headerShown: false }} />
          <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="payment-methods" options={{ headerShown: false }} />
        </Stack>
      </NavigationThemeProvider>
    </AppView>
  );
}
