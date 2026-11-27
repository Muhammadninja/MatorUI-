import { useNavigation } from 'expo-router';
import { CarFront, Search, ShoppingBag, Sparkles, User } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useCartContext } from '@/contexts/cart.context';
import { useSearchUIContext } from '@/contexts/search-ui.context';
import { useThemeContext } from '@/contexts/theme.context';

import AppTabBar from './app-tab-bar';

export const TAB_META = {
  '(explore)': { titleKey: 'nav.explore', icon: Search, emphasized: false },
  '(garage)': { titleKey: 'nav.garage', icon: CarFront, emphasized: false },
  '(ai-chat)': { titleKey: 'nav.assistant', icon: Sparkles, emphasized: true },
  '(cart)': { titleKey: 'nav.cart', icon: ShoppingBag, emphasized: false },
  '(profile)': { titleKey: 'nav.profile', icon: User, emphasized: false },
} as const;

export type TabKey = keyof typeof TAB_META;

const TAB_ORDER = Object.keys(TAB_META) as TabKey[];

type TabNavigation = {
  navigate: (name: string) => void;
  isFocused: () => boolean;
  addListener: (event: 'focus' | 'blur', cb: () => void) => () => void;
};

/** Whether this screen's TAB is the selected one — not whether the screen
 *  itself is focused: during a back swipe the root is revealed while the
 *  pushed screen still holds stack focus, and the bar has to be there. */
function useIsTabSelected(tabs: TabNavigation | undefined): boolean {
  const [selected, setSelected] = useState(() => tabs?.isFocused() ?? true);
  useEffect(() => {
    if (!tabs) return;
    setSelected(tabs.isFocused());
    const offFocus = tabs.addListener('focus', () => setSelected(true));
    const offBlur = tabs.addListener('blur', () => setSelected(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [tabs]);
  return selected;
}

/**
 * The tab bar, drawn by the tab's ROOT screen instead of by the tab navigator.
 *
 * It used to be the navigator's `tabBar`, hidden in JS whenever the tab's
 * nested stack focused anything but its root. A stack only pops in JS after
 * the native transition finishes, so an iOS back swipe revealed the root with
 * no bar under it for the whole gesture and its settle — the "tab bar vanishes
 * for ~2 s" report. Owned by the root, the bar is part of the screen the
 * native stack covers and uncovers: pushed screens slide over it and a back
 * swipe drags it back into view, with no visibility state to lag behind.
 */
export function TabRootBar({ tab }: { tab: TabKey }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { itemCount } = useCartContext();
  const { isSearchActive } = useSearchUIContext();
  // Root screen → its nested stack → the tab navigator's screen for this tab.
  const tabs = useNavigation().getParent() as TabNavigation | undefined;
  const selected = useIsTabSelected(tabs);

  // The search surface needs the full screen; inactive tabs draw nothing, so
  // only one bar (and one Assistant glint loop) is ever live.
  if (isSearchActive || !selected) return null;

  return (
    <AppTabBar
      activeKey={tab}
      items={TAB_ORDER.map((key) => {
        const { titleKey, icon: Icon, emphasized } = TAB_META[key];
        return {
          key,
          label: t(titleKey),
          emphasized,
          onPress: () => tabs?.navigate(key),
          badgeLabel:
            key === '(cart)' && itemCount > 0
              ? itemCount > 99
                ? '99+'
                : String(itemCount)
              : undefined,
          icon: (isActive: boolean) =>
            emphasized ? (
              // Emphasized center button: white on light's deep teal, page ink
              // on dark's brighter teal (white there is 3.0:1).
              <Icon size={22} strokeWidth={2.2} color={tokens.onAssistantFab} />
            ) : (
              // One outline style for every tab: same size and stroke; the
              // active tab differs by colour (and the indicator bar) only.
              <Icon size={22} strokeWidth={2} color={isActive ? tokens.brand : tokens.textMuted} />
            ),
        };
      })}
    />
  );
}

/** A tab's root screen with the tab bar under it. */
export function withTabBar<P extends object>(Screen: ComponentType<P>, tab: TabKey) {
  function TabRootScreen(props: P) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Screen {...props} />
        </View>
        <TabRootBar tab={tab} />
      </View>
    );
  }
  TabRootScreen.displayName = `withTabBar(${Screen.displayName ?? Screen.name ?? 'Screen'})`;
  return TabRootScreen;
}
