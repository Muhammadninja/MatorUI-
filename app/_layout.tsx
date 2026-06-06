import { Manrope_600SemiBold } from '@expo-google-fonts/manrope';
import {
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { requireNativeModule } from 'expo-modules-core';
import { ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { LogBox, Platform, StatusBar } from 'react-native';

// Android Fast Refresh / activity-lifecycle races can bubble bare
// `java.lang.reflect.InvocationTargetException` text through the JS log bridge
// (expo-modules-core's NativeJSLogger). They're dev-only noise — no inner
// stack, no impact on production. Suppress the LogBox overlay for them.
if (Platform.OS === 'android') {
  LogBox.ignoreLogs([/InvocationTargetException/]);
}
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppToastHost } from '@/components/shared/app-toast';
import { AppView } from '@/components/shared/app-view';
import GlobalModalHost from '@/components/shared/global-modal-host';
import LikesListSuggestionHost from '@/components/shared/likes-list-suggestion-host';
import { useColorScheme } from '@/components/useColorScheme';
import { CartProvider } from '@/contexts/cart.context';
import { LikesProvider } from '@/contexts/likes.context';
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
              <LikesProvider>
                <RootNavigation />
                <GlobalModalHost />
                <LikesListSuggestionHost />
                <AppToastHost />
              </LikesProvider>
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
      // ExpoNavigationBar.setStyle can throw OR reject with
      // "current activity is no longer available" / InvocationTargetException
      // during Fast Refresh and background↔foreground transitions. We wrap the
      // whole call in a Promise so both synchronous throws and async rejections
      // are absorbed by the same `.catch`.
      Promise.resolve()
        .then(() => {
          const nativeModule = requireNativeModule('ExpoNavigationBar') as {
            setStyle?: (style: string) => Promise<unknown> | void;
          };
          return nativeModule.setStyle?.(
            resolvedScheme === 'dark' ? 'dark' : 'light',
          );
        })
        .catch(() => undefined);
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
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: tokens.background },
            statusBarTranslucent: true,
            statusBarBackgroundColor: 'transparent',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              animationDuration: 180,
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
        </Stack>
      </NavigationThemeProvider>
    </AppView>
  );
}
