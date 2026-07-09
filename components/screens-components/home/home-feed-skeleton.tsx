import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Loading skeleton for the Explore landing. Mirrors the real layout's
 * geometry — a Top-Featured carousel row followed by a 2-column product
 * grid — so the loaded state slots in without a layout jump. Same pulse
 * convention as `SearchCatalogueSkeleton` (opacity 1 → 0.55 on the native
 * driver).
 */
export default function HomeFeedSkeleton() {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const block = isDark ? tokens.gray200 : tokens.gray100;

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  const bar = (width: number | string, height: number, radius = 6) => (
    <Animated.View
      style={{ width: width as number, height, borderRadius: radius, backgroundColor: block, opacity }}
    />
  );

  const featuredCard = (key: string) => (
    <AppView
      key={key}
      gap={10}
      rounded={16}
      p={12}
      colorName="card"
      borderWidth={1}
      borderName="border"
      style={{ width: 200 }}
    >
      {bar('100%', 110, 11)}
      {bar('80%', 14)}
      {bar('50%', 12)}
      {bar('40%', 16)}
    </AppView>
  );

  const gridCard = (key: string) => (
    <AppView
      key={key}
      gap={8}
      rounded={16}
      p={10}
      colorName="card"
      borderWidth={1}
      borderName="border"
      style={{ width: '47.5%', flexGrow: 1 }}
    >
      {bar('100%', 120, 11)}
      {bar('90%', 13)}
      {bar('55%', 12)}
      {bar('45%', 16)}
    </AppView>
  );

  return (
    <AppView px={20} gap={16} style={{ paddingTop: 4, paddingBottom: 28 }}>
      {/* Fit banner block */}
      {bar('100%', 54, 14)}

      {/* Category chip row */}
      <AppView row gap={8}>
        {bar(64, 34, 999)}
        {bar(72, 34, 999)}
        {bar(60, 34, 999)}
        {bar(80, 34, 999)}
      </AppView>

      {/* Top Featured */}
      {bar(140, 19)}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
      >
        {['f1', 'f2', 'f3'].map(featuredCard)}
      </ScrollView>

      {/* Grid */}
      {bar(100, 19)}
      <AppView row wrap gap={12}>
        {['g1', 'g2', 'g3', 'g4'].map(gridCard)}
      </AppView>
    </AppView>
  );
}
