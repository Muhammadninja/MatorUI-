import { router } from 'expo-router';
import { BadgeCheck, Check, Tag } from 'lucide-react-native';
import { Image, Linking, ScrollView, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { usePlacements } from '@/hooks/use-placements';
import { DEFAULT_CERTIFIED_BADGES, type MatorCertifiedPlacement } from '@/mocks/mator-catalog';
import { triggerHaptic } from '@/utils/haptics';

/**
 * MATOR Certified — a horizontal carousel of certified / sponsored placement
 * cards, sitting between "Shop by vehicle" and "Shop by category" on Explore.
 *
 * This is a MONETIZABLE slot: each card is a generic `MatorCertifiedPlacement`
 * (a certified category like "Certified Batteries", a verified dealer, or a sold
 * ad unit), and a tap routes by its `target`. Layout/copy per the certified
 * handoff. Seeded from local constants today; maps onto a future
 * `GET /v1/placements` endpoint without changing this component.
 */
export default function CertifiedSection() {
  const { tokens, scheme } = useThemeContext();
  const dark = scheme === 'dark';
  const { placements } = usePlacements();

  const openAll = () => {
    triggerHaptic('selection');
    // The premium MATOR Certified catalogue (all certified parts, all systems).
    router.push({ pathname: '/catalog/parts', params: { categoryLabel: 'MATOR Certified' } });
  };

  const open = (p: MatorCertifiedPlacement) => {
    triggerHaptic('selection');
    const t = p.target;
    switch (t.kind) {
      case 'catalogue':
        // The premium catalogue view — scoped by part quality (OEM/GM) or a
        // search term, never a car-system category.
        router.push({
          pathname: '/catalog/parts',
          params: { categoryLabel: t.label, certified: t.certified, q: t.query },
        });
        break;
      case 'dealer':
        // No dealer-scoped filter on the backend yet — open the premium
        // catalogue labeled for the dealer. Add a dealer filter when it exists.
        router.push({ pathname: '/catalog/parts', params: { categoryLabel: t.label } });
        break;
      case 'category':
        router.push({ pathname: '/category', params: { cat: t.id, label: t.label } });
        break;
      case 'search':
        router.push({ pathname: '/search', params: { q: t.query } });
        break;
      case 'url':
        void Linking.openURL(t.href);
        break;
    }
  };

  // Hide the whole slot until placements resolve, so the header never sits over
  // an empty carousel (the hook falls back to the bundled seed on error).
  if (placements.length === 0) return null;

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
        <AppPressableView onPress={openAll} androidRipple={false} accessibilityRole="button">
          <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.textMuted }}>
            See all ›
          </AppText>
        </AppPressableView>
      </AppView>
      <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: -8 }}>
        Verified dealers. Genuine parts, guaranteed fitment & returns.
      </AppText>

      {/* Placement carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingVertical: 2 }}
        style={{ marginHorizontal: -20 }}
      >
        {placements.map((p) => {
          const badges = p.badges ?? [...DEFAULT_CERTIFIED_BADGES];
          return (
            <AppPressableView
              key={p.id}
              onPress={() => open(p)}
              androidRipple={false}
              accessibilityRole="button"
              accessibilityLabel={`${p.title}, MATOR certified`}
              rounded={18}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ width: 224, overflow: 'hidden' }}
            >
              {/* Colored brand banner */}
              <View style={{ height: 74, overflow: 'hidden', backgroundColor: p.visual.color }}>
                <View style={{ position: 'absolute', right: -18, top: -18, width: 72, height: 72, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                <View style={{ position: 'absolute', right: 14, bottom: -22, width: 52, height: 52, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                {/* Sponsored tag for sold slots */}
                {p.sponsor?.sponsored ? (
                  <AppView rounded={5} px={6} py={2} style={{ position: 'absolute', top: 8, right: 10, backgroundColor: 'rgba(0,0,0,0.28)' }}>
                    <AppText family="accent" weight="bold" style={{ fontSize: 9, letterSpacing: 0.3, color: tokens.white }}>
                      SPONSORED
                    </AppText>
                  </AppView>
                ) : null}
                <AppView row align="center" gap={11} px={14} style={{ height: 74 }}>
                  <AppView center rounded={12} style={{ width: 42, height: 42, backgroundColor: tokens.white, overflow: 'hidden' }}>
                    {p.visual.imageUrl ? (
                      <Image source={{ uri: p.visual.imageUrl }} style={{ width: 42, height: 42 }} resizeMode="contain" />
                    ) : (
                      <AppText family="heading" weight="bold" style={{ fontSize: 20, color: p.visual.color }}>
                        {p.visual.monogram ?? p.title.charAt(0)}
                      </AppText>
                    )}
                  </AppView>
                  <AppView flex={1}>
                    <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 15, color: tokens.white }}>
                      {p.title}
                    </AppText>
                    {p.subtitle ? (
                      <AppText family="accent" weight="semibold" numberOfLines={1} style={{ fontSize: 10.5, color: `${tokens.white}d9`, marginTop: 1 }}>
                        {p.subtitle}
                      </AppText>
                    ) : null}
                  </AppView>
                </AppView>
              </View>

              {/* Badge rows */}
              <AppView p={12} gap={7}>
                {badges[0] ? (
                  <AppView row align="center" gap={6}>
                    <AppView center rounded={999} style={{ width: 18, height: 18, backgroundColor: tokens.info }}>
                      <Check size={11} strokeWidth={3} color={tokens.white} />
                    </AppView>
                    <AppText family="accent" weight="bold" style={{ fontSize: 11.5, letterSpacing: 0.2, color: tokens.text }}>
                      {badges[0]}
                    </AppText>
                  </AppView>
                ) : null}
                {badges[1] ? (
                  <AppView row align="center" gap={6}>
                    <AppView center rounded={999} style={{ width: 18, height: 18, backgroundColor: tokens.success }}>
                      <Tag size={10} strokeWidth={2.6} color={tokens.white} />
                    </AppView>
                    <AppText family="accent" weight="bold" style={{ fontSize: 11.5, letterSpacing: 0.2, color: tokens.text }}>
                      {badges[1]}
                    </AppText>
                    <AppView rounded={5} px={6} py={2} style={{ marginLeft: 'auto', backgroundColor: `${tokens.success}${dark ? '29' : '1a'}` }}>
                      <AppText family="accent" weight="bold" style={{ fontSize: 10, color: tokens.success }}>
                        GUARANTEED
                      </AppText>
                    </AppView>
                  </AppView>
                ) : null}
              </AppView>
            </AppPressableView>
          );
        })}
      </ScrollView>
    </AppView>
  );
}
