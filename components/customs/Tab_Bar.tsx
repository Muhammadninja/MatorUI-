import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, StyleSheet } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type TabBarItem = {
  key: string;
  label: string;
  icon?: ReactNode | ((isActive: boolean) => ReactNode);
  onPress?: () => void;
  badgeLabel?: string;
  disabled?: boolean;
};

export type TabBarProps = {
  items?: TabBarItem[];
  activeKey?: string;
};

const PREVIEW_ITEMS: TabBarItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'discover', label: 'Discover' },
  { key: 'profile', label: 'Profile' },
];

function TabBarAnimatedIcon({ icon, isActive }: { icon: ReactNode; isActive: boolean }) {
  const scale = useRef(new Animated.Value(isActive ? 1.12 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.12 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [isActive, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{icon}</Animated.View>;
}

export default function Tab_Bar({ items = PREVIEW_ITEMS, activeKey = 'home' }: TabBarProps) {
  const { scheme, tokens } = useThemeContext();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (isKeyboardVisible) {
    return null;
  }

  return (
    <AppView style={styles.container} colorName="background">
      <AppView
        row
        style={styles.bar}
        colorName="background"
        borderTopWidth={1}
        borderName="divider"
        px={10}
        pt={2}
        pb={28}
        gap={4}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const icon = typeof item.icon === 'function' ? item.icon(isActive) : item.icon;

          return (
            <AppView key={item.key} style={styles.itemSlot}>
              <AppView
                style={[
                  styles.indicator,
                  {
                    backgroundColor: scheme === 'dark' ? tokens.white : tokens.black,
                    borderColor: scheme === 'dark' ? tokens.white : tokens.black,
                  },
                  !isActive ? styles.indicatorHidden : undefined,
                ]}
              />
              <AppPressableView
                onPress={item.onPress}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                disabled={item.disabled}
                rounded={18}
                androidRipple={false}
                pressedOpacity={0.7}
                pressedScale={1}
                style={styles.item}
                hitSlop={10}
              >
                <AppView style={styles.itemContent}>
                  <AppView style={styles.iconWrap}>
                    {icon ? <TabBarAnimatedIcon icon={icon} isActive={isActive} /> : null}
                    {item.badgeLabel ? (
                      <AppView
                        center
                        rounded={36}
                        style={[
                          styles.badge,
                          {
                            backgroundColor: scheme === 'dark' ? tokens.white : tokens.black,
                          },
                        ]}
                      >
                        <AppText
                          textVariant="bodyXs"
                          weight="bold"
                          style={{ color: scheme === 'dark' ? tokens.black : tokens.white }}
                        >
                          {item.badgeLabel}
                        </AppText>
                      </AppView>
                    ) : null}
                  </AppView>
                </AppView>
              </AppPressableView>
            </AppView>
          );
        })}
      </AppView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
  },
  itemSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  indicator: {
    width: 50,
    height: 8,
    borderWidth: 1,
    borderRadius: 36,
    marginBottom: 1,
    borderTopRightRadius: 4,
    borderTopLeftRadius: 4,
  },
  indicatorHidden: {
    opacity: 0,
  },
  item: {
    width: '100%',
    minHeight: 44,
  },
  itemContent: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -16,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
  },
});
