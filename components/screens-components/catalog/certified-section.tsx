import { router } from 'expo-router';
import { Check, Tag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { placements } = usePlacements();

  const open = (p: MatorCertifiedPlacement) => {
    triggerHaptic('selection');
    const tgt = p.target;
    switch (tgt.kind) {
      case 'catalogue':
        // The premium catalogue view — scoped by part quality (OEM/GM) or a
        // search term, never a car-system category.
        router.push({
          pathname: '/catalog/parts',
          params: { categoryLabel: tgt.label, certified: tgt.certified, q: tgt.query },
        });
        break;
      case 'dealer':
        // No dealer-scoped filter on the backend yet — open the premium
        // catalogue labeled for the dealer. Add a dealer filter when it exists.
        router.push({ pathname: '/catalog/parts', params: { categoryLabel: tgt.label } });
        break;
      case 'category':
        router.push({ pathname: '/category', params: { cat: tgt.id, label: tgt.label } });
        break;
      case 'search':
        router.push({ pathname: '/search', params: { q: tgt.query } });
        break;
      case 'url':
        void Linking.openURL(tgt.href);
        break;
    }
  };

  // Hide the whole slot until placements resolve, so the header never sits over
  // an empty carousel (the hook falls back to the bundled seed on error).
  if (placements.length === 0) return null;

  return (
    <AppView gap={12}>
      {/* Section header. The filled check-disc that sat beside the words said
       *  "certified" a second time, in a picture. */}
      <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
        {t('catalog.matorCertified')}
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
              accessibilityLabel={t('catalog.certifiedAccessibility', { title: p.title })}
              rounded={18}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ width: 224, overflow: 'hidden' }}
            >
              {/* The dealer's colour is a keyline and a monogram tile, not a
               *  filled banner with translucent discs floating in it. Those
               *  discs were decoration on a card whose job is to look
               *  trustworthy. */}
              <AppView row align="center" gap={11} px={14} pt={14} pb={12}>
                <AppView
                  center
                  rounded={12}
                  style={{
                    width: 42,
                    height: 42,
                    overflow: 'hidden',
                    backgroundColor: tokens.white,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  }}
                >
                  {p.visual.imageUrl ? (
                    <Image
                      source={{ uri: p.visual.imageUrl }}
                      style={{ width: 42, height: 42 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <AppText
                      family="heading"
                      weight="bold"
                      style={{ fontSize: 19, color: p.visual.color }}
                    >
                      {p.visual.monogram ?? p.title.charAt(0)}
                    </AppText>
                  )}
                </AppView>
                <AppView flex={1} gap={1}>
                  <AppText
                    family="heading"
                    weight="bold"
                    style={{ fontSize: 15, color: tokens.text }}
                  >
                    {p.title}
                  </AppText>
                  {p.subtitle ? (
                    <AppText
                      family="accent"
                      weight="semibold"
                      style={{ fontSize: 11, color: tokens.textMuted }}
                    >
                      {p.subtitle}
                    </AppText>
                  ) : null}
                </AppView>
                {p.sponsor?.sponsored ? (
                  <AppText
                    family="accent"
                    weight="bold"
                    transform="uppercase"
                    style={{ fontSize: 8.5, letterSpacing: 0.6, color: tokens.textMuted }}
                  >
                    {t('catalog.sponsored')}
                  </AppText>
                ) : null}
              </AppView>

              <AppView style={{ height: 1, backgroundColor: tokens.divider }} />

              {/* Claims as claims: a small tick and the words, in the colour
               *  that means them. Each line used to carry a filled disc with a
               *  glyph inside, which is a lot of furniture for two facts. */}
              <AppView px={14} py={12} gap={6}>
                {badges[0] ? (
                  <AppView row align="center" gap={7}>
                    <Check size={13} strokeWidth={3} color={tokens.info} />
                    <AppText
                      family="accent"
                      weight="bold"
                      style={{ flex: 1, fontSize: 11.5, letterSpacing: 0.2, color: tokens.text }}
                    >
                      {badges[0]}
                    </AppText>
                  </AppView>
                ) : null}
                {badges[1] ? (
                  <AppView row align="center" gap={7}>
                    <Tag size={12} strokeWidth={2.6} color={tokens.success} />
                    <AppText
                      family="accent"
                      weight="bold"
                      style={{ flex: 1, fontSize: 11.5, letterSpacing: 0.2, color: tokens.text }}
                    >
                      {badges[1]}
                    </AppText>
                    <AppText
                      family="accent"
                      weight="bold"
                      transform="uppercase"
                      style={{ fontSize: 9.5, letterSpacing: 0.5, color: tokens.success }}
                    >
                      {t('catalog.guaranteed')}
                    </AppText>
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
