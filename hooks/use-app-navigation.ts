import { router, useNavigation, useNavigationContainerRef, useSegments, type Href } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Back taps closer together than this are one tap. The screen is still
 *  animating out after the first, and a second `back` would pop the screen
 *  underneath it — from a tab's root that jumps to Explore (tabs go back to
 *  their first route). */
const BACK_TAP_GUARD_MS = 600;

/**
 * Back-button handler that acts once per screen. Ignores taps that land while
 * the screen is already leaving; falls back to `fallbackHref` when there is
 * nothing to go back to (cold start / deep link straight into the screen).
 */
export function useGoBack(fallbackHref?: string) {
  const navigation = useNavigation();
  const lastTapRef = useRef(0);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < BACK_TAP_GUARD_MS) return;
    lastTapRef.current = now;
    if (!navigation.isFocused()) return;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) router.replace(fallbackHref as Href);
  }, [navigation, fallbackHref]);
}

/**
 * Switch to a tab's root screen from anywhere. Inside the tabs a plain
 * `navigate` switches tab. From a ROOT-stack screen (order history, track
 * order, offers…) `navigate` would push a whole second tab navigator on top,
 * so it pops back to the existing one instead.
 */
export function useGoToTab() {
  const inTabs = useSegments()[0] === '(tabs)';
  return useCallback(
    (href: '/explore' | '/garage' | '/cart' | '/profile') => {
      if (inTabs) router.navigate(href);
      else router.dismissTo(href);
    },
    [inTabs],
  );
}

/**
 * Start navigation over on Explore with fresh tab stacks — after the account
 * changes (sign out, account deletion), nothing from the previous session
 * should stay on a tab. `__root` is Expo Router's slot above app/_layout; its
 * `(tabs)` opens on Explore.
 */
export function useResetToExplore() {
  const rootNavigation = useNavigationContainerRef();
  return useCallback(() => {
    if (rootNavigation.getRootState()?.routeNames?.includes('__root')) {
      rootNavigation.reset({ index: 0, routes: [{ name: '__root', state: { index: 0, routes: [{ name: '(tabs)' }] } }] });
    } else {
      router.replace('/explore');
    }
  }, [rootNavigation]);
}
