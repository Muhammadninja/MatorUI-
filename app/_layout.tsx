import {
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { Raleway_800ExtraBold } from '@expo-google-fonts/raleway';
import { useFonts } from 'expo-font';
import { requireNativeModule } from 'expo-modules-core';
import { ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { LogBox, Platform, StatusBar } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Android Fast Refresh / activity-lifecycle races can bubble bare
// `java.lang.reflect.InvocationTargetException` text through the JS log bridge
// (expo-modules-core's NativeJSLogger). They're dev-only noise — no inner
// stack, no impact on production. Suppress the LogBox overlay for them.
if (Platform.OS === 'android') {
  LogBox.ignoreLogs([/InvocationTargetException/]);
}

// RNSScreens emits this warning from -[RNSScreenView setStatusBarStyle:] when
// the running binary's Info.plist still has `UIViewControllerBasedStatusBarAppearance`
// set to NO. We've flipped it to YES in `ios/matorui/Info.plist` AND in
// `app.json` (under `ios.infoPlist`) so any future `expo prebuild` keeps it,
// but until the dev binary is rebuilt at least once after that change, the
// installed simulator app still has the old plist baked in — and react-navigation
// re-fires the warning on every screen transition. Silencing it here keeps the
// dev console clean during that transitional window and protects against any
// future stray emission from RNScreens.
LogBox.ignoreLogs([/UIViewControllerBasedStatusBarAppearance/]);

import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/services/query-client';
import { initSentry } from '@/services/sentry';

// Fire Sentry init at module-eval, before any component renders, so the
// first JS-thrown error of the session is captured. No-op when DSN is
// missing (local dev), so this is safe to call unconditionally.
initSentry();

import { AppToastHost } from '@/components/shared/app-toast';
import { AppView } from '@/components/shared/app-view';
import GlobalModalHost from '@/components/shared/global-modal-host';
import LikesListSuggestionHost from '@/components/shared/likes-list-suggestion-host';
import SplashOverlay from '@/components/screens/splash-screen';
import { useColorScheme } from '@/components/useColorScheme';
import AppGateHost from '@/components/shared/app-gate-host';
import { useDeviceRegistration } from '@/hooks/use-device-registration';
import { ActiveVehicleProvider } from '@/contexts/active-vehicle.context';
import { CartProvider } from '@/contexts/cart.context';
import { LanguageProvider } from '@/contexts/language.context';
import { LikesProvider } from '@/contexts/likes.context';
import { SearchUIProvider } from '@/contexts/search-ui.context';
import { ThemeProvider as AppThemeProvider, useThemeContext } from '@/contexts/theme.context';
import { UserProvider } from '@/contexts/user.context';
import { createNavigationTheme } from '@/themes';

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  // First-launch routing is handled by a Redirect inside RootNavigation
  // (drives the user to /select-language when no language is set).
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
    Raleway_800ExtraBold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Splash hide-async now lives in RootNavigation so it can also wait
  // for the language hydration. We only block render here on fonts.

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

/** Registers this install for push once signed in, and routes notification taps.
 *  Renders nothing; lives inside UserProvider so it can read auth state. */
function NotificationsRegistrar() {
  useDeviceRegistration();
  return null;
}

function RootLayoutNav() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AppThemeProvider>
          <QueryClientProvider client={queryClient}>
            <LanguageProvider>
              <UserProvider>
                <CartProvider>
                  <LikesProvider>
                    <ActiveVehicleProvider>
                      <SearchUIProvider>
                        <NotificationsRegistrar />
                        <RootNavigation />
                        <GlobalModalHost />
                        <LikesListSuggestionHost />
                        <AppToastHost />
                        <AppGateHost />
                      </SearchUIProvider>
                    </ActiveVehicleProvider>
                  </LikesProvider>
                </CartProvider>
              </UserProvider>
            </LanguageProvider>
          </QueryClientProvider>
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

  // The branded splash is a full-screen overlay rendered on top of the whole
  // navigator. It owns the native-launch-screen handoff (`hideAsync` on its
  // first paint) and cross-fades itself out, then calls back here to unmount.
  const [splashVisible, setSplashVisible] = useState(true);

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
      {/* RN's <StatusBar/> calls RCTStatusBarManager.setStyle imperatively,
       *  which throws on iOS when `UIViewControllerBasedStatusBarAppearance`
       *  is YES (we set it YES so react-navigation native-stack can drive
       *  the status bar per-screen). Keep this component Android-only.
       *  iOS status bar style is set via Stack `screenOptions.statusBarStyle`
       *  + per-route `Stack.Screen options.statusBarStyle` below. */}
      {Platform.OS === 'android' ? (
        <StatusBar
          barStyle={resolvedScheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
      ) : null}
      <NavigationThemeProvider value={navigationTheme}>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: tokens.background },
            statusBarTranslucent: true,
            statusBarBackgroundColor: 'transparent',
            // iOS reads UIStatusBarStyle per-screen via native-stack — without
            // this, every screen falls back to dark content and the wifi/SIM
            // icons disappear in dark mode. Drives Android too.
            statusBarStyle: resolvedScheme === 'dark' ? 'light' : 'dark',
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="vin-finder"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
            }}
          />
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
              // Auth is a bottom sheet presented OVER the screen that triggered
              // it. The group must be a transparent modal so its scrim reveals
              // that screen behind it — otherwise the opaque group background
              // (theme background = white in light mode) reads as a full new
              // screen. The inner sign-in screen is itself a transparentModal.
              presentation: 'transparentModal',
              animation: 'fade',
              animationDuration: 180,
              gestureEnabled: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              gestureDirection: 'vertical',
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
            }}
          />
          <Stack.Screen
            name="track-order"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
            }}
          />
        </Stack>
      </NavigationThemeProvider>
      {splashVisible ? (
        <SplashOverlay onFinish={() => setSplashVisible(false)} />
      ) : null}
    </AppView>
  );
}
