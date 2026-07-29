import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '@/components/screens-components/catalog/brand-logo';
import { brandColor } from '@/components/screens-components/catalog/brand-meta';
import { CategoryRowsSkeleton } from '@/components/screens-components/catalog/category-grid-skeleton';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useMakes, useModels } from '@/hooks/use-vehicle-catalog';

/** Catalog categories the listings are actually bucketed by. */
/**
 * Make (`make`) — a branded hero + the real models for the chosen brand
 * (`UZ_BRANDS` / `UZ_MODELS`). Tapping a model opens the catalog systems
 * screen for that make + model. Reachable from Explore's "Shop by vehicle".
 */
export default function MakeScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { make: makeParam } = useLocalSearchParams<{ make?: string }>();

  const brandId = makeParam ?? '';
  // Live from GET /v1/reference (admin-managed). `makes` resolves the display
  // name for the hero; `useModels` drives the list. Both fall back to the
  // bundled catalog on error, so the screen never renders blank.
  const { makes } = useMakes();
  const { state: modelsState, models } = useModels(brandId);
  const make = makes.find((m) => m.id === brandId);
  const label = make?.name ?? makeParam ?? 'Vehicle';
  const logoUrl = make?.logoUrl ?? null;
  const color = brandColor(brandId);
  const loading = modelsState === 'loading';

  const openModel = (modelLabel: string) =>
    router.push({
      pathname: '/catalog',
      params: { make: label, model: modelLabel, brandId },
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
            <BrandLogo logoUrl={logoUrl} name={label} size={36} color={color} />
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
        {loading ? (
          <CategoryRowsSkeleton showIcon={false} count={4} />
        ) : models.length === 0 ? (
          <AppText
            family="default"
            style={{ fontSize: 14, color: tokens.textMuted, paddingVertical: 12 }}
          >
            No models available for {label} yet.
          </AppText>
        ) : (
          <AppView>
            {models.map((m, i) => (
              <AppPressableView
                key={m.id}
                onPress={() => openModel(m.name)}
                androidRipple={false}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${m.name}`}
                row
                align="center"
                gap={12}
                style={{
                  paddingVertical: 18,
                  borderBottomWidth: i < models.length - 1 ? 1 : 0,
                  borderBottomColor: tokens.divider,
                }}
              >
                <AppView flex={1}>
                  <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text }}>
                    {label} {m.name}
                  </AppText>
                </AppView>
                <ChevronRight size={22} strokeWidth={2.2} color={tokens.textMuted} />
              </AppPressableView>
            ))}
          </AppView>
        )}
      </ScrollView>
    </AppView>
  );
}
