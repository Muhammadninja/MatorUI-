import { router } from 'expo-router';
import { ArrowUpRight, Sparkles, Tag } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Promo / campaign banner slot on the explore landing.
 *
 * Mock data while the campaigns backend is being wired — when the
 * `usePromoCampaigns()` hook lands, swap the constant below for a call
 * to it and pull every field (`headline`, `body`, `imageUrl`, `href`,
 * `accentLabel`) from the live response.
 */
/** Build the promo campaign copy with translated strings. `t` comes from
 *  the caller so the copy re-resolves when the language changes. The
 *  `imageSeed` and `href` are not user-facing and stay stable. */
function buildMockCampaign(t: (key: string) => string) {
  return {
    accentLabel: t('search.promoAccentLabel'),
    headline: t('search.promoHeadline'),
    body: t('search.promoBody'),
    ctaLabel: t('search.promoCta'),
    imageSeed: 'matorui-suspension-promo',
    href: '/item-detail/mator-elite',
  };
}

export default function SearchPromoBanner() {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const MOCK_CAMPAIGN = useMemo(() => buildMockCampaign(t), [t]);

  const handlePress = () => {
    triggerHaptic('selection');
    router.push(MOCK_CAMPAIGN.href as never);
  };

  return (
    <AppView px="lg" pt="lg">
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={t('search.promoBannerA11y', {
          headline: MOCK_CAMPAIGN.headline,
          cta: MOCK_CAMPAIGN.ctaLabel,
        })}
        style={({ pressed }) => ({
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: pressed ? 0.95 : 1,
          ...Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.28 : 0.08,
              shadowRadius: 18,
            },
            android: { elevation: 6 },
          }),
        })}
      >
        <View style={{ flexDirection: 'row', height: 148 }}>
          {/* Imagery — uses the picsum seed for variety until real
           *  campaign artwork lands. Absolute fill so it follows the
           *  row height instead of pushing it to the source's intrinsic
           *  dimensions. */}
          <View style={{ width: 124, position: 'relative' }}>
            <AppImage
              source={{
                uri: `https://picsum.photos/seed/${MOCK_CAMPAIGN.imageSeed}/320/360`,
              }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              alt={MOCK_CAMPAIGN.headline}
            />
            {/* Brand tint overlay keeps the imagery feeling like a
             *  controlled marketing surface rather than stock photo. */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `${tokens.brand}1F` },
              ]}
            />
          </View>

          <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 8 }}>
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: `${tokens.brand}1F`,
                borderWidth: 1,
                borderColor: `${tokens.brand}40`,
              }}
            >
              <Sparkles size={10} strokeWidth={2.4} color={tokens.brand} />
              <AppText
                textVariant="caption"
                weight="bold"
                style={{
                  color: tokens.brand,
                  letterSpacing: 0.4,
                  lineHeight: 12,
                  includeFontPadding: false,
                }}
              >
                {MOCK_CAMPAIGN.accentLabel}
              </AppText>
            </View>

            <AppText
              textVariant="bodySemibold"
              family="heading"
              weight="bold"
              numberOfLines={2}
              style={{ lineHeight: 20 }}
            >
              {MOCK_CAMPAIGN.headline}
            </AppText>
            <AppText
              textVariant="bodyXs"
              colorName="gray400"
              numberOfLines={1}
              style={{ lineHeight: 16 }}
            >
              {MOCK_CAMPAIGN.body}
            </AppText>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              <Tag size={11} strokeWidth={2.4} color={tokens.brand} />
              <AppText
                textVariant="caption"
                weight="semibold"
                style={{
                  color: tokens.brand,
                  lineHeight: 14,
                  includeFontPadding: false,
                }}
              >
                {MOCK_CAMPAIGN.ctaLabel}
              </AppText>
              <ArrowUpRight size={11} strokeWidth={2.4} color={tokens.brand} />
            </View>
          </View>
        </View>
      </Pressable>
    </AppView>
  );
}
