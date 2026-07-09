import { router } from 'expo-router';
import { BadgeCheck, Check, Tag } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { MATOR_DEALERS } from '@/mocks/mator-catalog';
import { triggerHaptic } from '@/utils/haptics';

/**
 * MATOR Certified — a horizontal carousel of verified-dealer storefront
 * cards, sitting between "Shop by vehicle" and "Shop by category" on Explore.
 * Each card has a colored brand banner (logo monogram + dealer name + order
 * count) over stacked "MATOR CERTIFIED" and "LOWEST PRICE · GUARANTEED"
 * badge rows. Tapping a card (or "See all") opens the Category listing
 * labeled for that dealer. Layout/copy per the certified handoff.
 */
export default function CertifiedSection() {
  const { tokens, scheme } = useThemeContext();
  const dark = scheme === 'dark';

  const open = (label: string) => {
    triggerHaptic('selection');
    router.push({ pathname: '/category', params: { cat: 'All', label } });
  };

  return (
    <AppView gap={12}>
      {/* Section header */}
      <AppView row align="center" gap={10}>
        <AppView center rounded={999} style={{ width: 22, height: 22, backgroundColor: tokens.info }}>
          <BadgeCheck size={14} strokeWidth={2.6} color={tokens.white} />
        </AppView>
        <AppText family="heading" weight="bold" style={{ flex: 1, fontSize: 18, color: tokens.text }}>
          MATOR Certified
        </AppText>
        <AppPressableView onPress={() => open('MATOR Certified')} androidRipple={false} accessibilityRole="button">
          <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
            See all ›
          </AppText>
        </AppPressableView>
      </AppView>
      <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: -8 }}>
        Verified dealers. Genuine parts, guaranteed fitment & returns.
      </AppText>

      {/* Storefront carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingVertical: 2 }}
        style={{ marginHorizontal: -20 }}
      >
        {MATOR_DEALERS.map((d) => (
          <AppPressableView
            key={d.id}
            onPress={() => open(d.name)}
            androidRipple={false}
            accessibilityRole="button"
            accessibilityLabel={`${d.name}, MATOR certified dealer`}
            rounded={18}
            colorName="card"
            borderWidth={1}
            borderName="border"
            style={{ width: 224, overflow: 'hidden' }}
          >
            {/* Colored brand banner */}
            <View style={{ height: 74, overflow: 'hidden', backgroundColor: d.color }}>
              <View
                style={{
                  position: 'absolute',
                  right: -18,
                  top: -18,
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 14,
                  bottom: -22,
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}
              />
              <AppView row align="center" gap={11} px={14} style={{ height: 74 }}>
                <AppView center rounded={12} style={{ width: 42, height: 42, backgroundColor: tokens.white }}>
                  <AppText family="heading" weight="bold" style={{ fontSize: 20, color: d.color }}>
                    {d.initial}
                  </AppText>
                </AppView>
                <AppView flex={1}>
                  <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 15, color: tokens.white }}>
                    {d.name}
                  </AppText>
                  <AppText family="accent" weight="semibold" style={{ fontSize: 10.5, color: `${tokens.white}d9`, marginTop: 1 }}>
                    {d.orders} orders · {d.years}y
                  </AppText>
                </AppView>
              </AppView>
            </View>

            {/* Badge rows */}
            <AppView p={12} gap={7}>
              <AppView row align="center" gap={6}>
                <AppView center rounded={999} style={{ width: 18, height: 18, backgroundColor: tokens.info }}>
                  <Check size={11} strokeWidth={3} color={tokens.white} />
                </AppView>
                <AppText family="accent" weight="bold" style={{ fontSize: 11.5, letterSpacing: 0.2, color: tokens.text }}>
                  MATOR CERTIFIED
                </AppText>
              </AppView>
              <AppView row align="center" gap={6}>
                <AppView center rounded={999} style={{ width: 18, height: 18, backgroundColor: tokens.success }}>
                  <Tag size={10} strokeWidth={2.6} color={tokens.white} />
                </AppView>
                <AppText family="accent" weight="bold" style={{ fontSize: 11.5, letterSpacing: 0.2, color: tokens.text }}>
                  LOWEST PRICE
                </AppText>
                <AppView
                  rounded={5}
                  px={6}
                  py={2}
                  style={{ marginLeft: 'auto', backgroundColor: `${tokens.success}${dark ? '29' : '1a'}` }}
                >
                  <AppText family="accent" weight="bold" style={{ fontSize: 10, color: tokens.success }}>
                    GUARANTEED
                  </AppText>
                </AppView>
              </AppView>
            </AppView>
          </AppPressableView>
        ))}
      </ScrollView>
    </AppView>
  );
}
