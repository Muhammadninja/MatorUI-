import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo, { hasBrandLogo, LOGO_BRANDS } from '@/components/screens-components/catalog/brand-logo';
import { brandColor, categoryBody } from '@/components/screens-components/catalog/brand-meta';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { CarIcon } from '@/components/shared/mator-icons';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { ListLoadingOverlay } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { UZ_BRANDS, UZ_MODELS } from '@/services/uz-vehicle-catalog';

/** Catalog categories the listings are actually bucketed by. */
const CATALOG_CATEGORIES = ['sedan', 'suv', 'coupe', 'truck'];

/**
 * Make (`make`) — a branded hero + the real models for the chosen brand
 * (`UZ_BRANDS` / `UZ_MODELS`). Tapping a model opens the Category listing
 * filtered by the model's body style. Reachable from Explore's "Shop by
 * vehicle".
 */
export default function MakeScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { make: makeParam } = useLocalSearchParams<{ make?: string }>();

  const uzBrand = UZ_BRANDS.find((b) => b.id === makeParam);
  const brandId = uzBrand?.id ?? makeParam ?? UZ_BRANDS[0].id;
  const label =
    uzBrand?.label ?? LOGO_BRANDS.find((b) => b.id === brandId)?.label ?? UZ_BRANDS[0].label;
  const models = UZ_MODELS.filter((m) => m.brandId === brandId);
  const color = brandColor(brandId);

  // Simulated fetch — a branded wheel overlay while models load.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 850);
    return () => clearTimeout(t);
  }, []);

  const openModel = (modelLabel: string, bodyStyle: string) =>
    router.push({
      pathname: '/category',
      params: {
        cat: CATALOG_CATEGORIES.includes(bodyStyle) ? bodyStyle : 'All',
        label: `${label} ${modelLabel}`,
      },
    });

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={label} fallbackHref="/explore" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom + 24, 40),
          gap: 16,
        }}
      >
        {/* Hero */}
        <AppView
          row
          align="center"
          gap={14}
          rounded={18}
          px={16}
          py={16}
          colorName="card"
          borderWidth={1}
          borderName="border"
        >
          <AppView
            center
            rounded={16}
            style={{ width: 54, height: 54, backgroundColor: tokens.white, borderWidth: 1, borderColor: tokens.border }}
          >
            {hasBrandLogo(label) ? (
              <BrandLogo name={label} size={36} />
            ) : (
              <AppText family="heading" weight="bold" style={{ fontSize: 24, color }}>
                {label.charAt(0)}
              </AppText>
            )}
          </AppView>
          <AppView flex={1}>
            <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text }}>
              {label}
            </AppText>
            <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
              Select your model to see listings
            </AppText>
          </AppView>
        </AppView>

        {/* Models */}
        <AppText
          family="accent"
          weight="bold"
          style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 2 }}
        >
          Models
        </AppText>
        <AppView>
          {models.map((m, i) => (
            <AppPressableView
              key={m.id}
              onPress={() => openModel(m.label, m.bodyStyle)}
              androidRipple={false}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${m.label}`}
              row
              align="center"
              gap={14}
              style={{
                paddingVertical: 15,
                borderBottomWidth: i < models.length - 1 ? 1 : 0,
                borderBottomColor: tokens.divider,
              }}
            >
              <AppView
                center
                rounded={11}
                colorName="backgroundSecondary"
                borderWidth={1}
                borderName="border"
                style={{ width: 40, height: 40 }}
              >
                <CarIcon body={categoryBody(m.bodyStyle)} size={26} color={color} />
              </AppView>
              <AppView flex={1}>
                <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>
                  {label} {m.label}
                </AppText>
                <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, textTransform: 'capitalize' }}>
                  {m.bodyStyle}
                </AppText>
              </AppView>
              <ChevronRight size={22} strokeWidth={2.2} color={tokens.textMuted} />
            </AppPressableView>
          ))}
        </AppView>
      </ScrollView>

      <ListLoadingOverlay visible={loading} label="Loading models…" />
    </AppView>
  );
}
