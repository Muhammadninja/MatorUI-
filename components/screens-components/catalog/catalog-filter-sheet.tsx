import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { CATALOG_REGIONS, type CatalogRegion } from '@/constants/catalog-regions';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogSortBy, FilterState } from '@/types/catalog-nav';

const SORTS: { key: CatalogSortBy; label: string }[] = [
  { key: 'price_asc', label: 'Price low → high' },
  { key: 'price_desc', label: 'Price high → low' },
];

export type CatalogFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  /** Brand options derived from the current result page. */
  brands: string[];
  onApply: (next: FilterState) => void;
};

/**
 * `CatalogFilterSheet` — the parts-screen "Filter & Sort" bottom sheet: price
 * sort, region (market of origin) multi-select, in-stock / OEM toggles, and a
 * brand multi-select. Edits a local draft; commits on Apply.
 */
export default function CatalogFilterSheet({
  visible,
  onClose,
  value,
  brands,
  onApply,
}: CatalogFilterSheetProps) {
  const { tokens } = useThemeContext();
  const [draft, setDraft] = useState<FilterState>(value);

  // Re-seed the draft from the committed value each time the sheet opens.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const toggleBrand = (b: string) =>
    setDraft((d) => ({
      ...d,
      brands: d.brands.includes(b) ? d.brands.filter((x) => x !== b) : [...d.brands, b],
    }));

  const toggleRegion = (r: CatalogRegion) =>
    setDraft((d) => ({
      ...d,
      regions: d.regions.includes(r) ? d.regions.filter((x) => x !== r) : [...d.regions, r],
    }));

  const reset: FilterState = {
    brands: [],
    regions: [],
    inStockOnly: false,
    oemOnly: false,
    gmOnly: false,
    sortBy: 'relevance',
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} heightFraction={0.82} expandable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 18 }}
      >
        <AppText family="heading" weight="bold" style={{ fontSize: 20, color: tokens.text }}>
          Filter & Sort
        </AppText>

        {/* Sort by price */}
        <AppView gap={10}>
          <SectionLabel>Sort by price</SectionLabel>
          <AppView row wrap gap={8}>
            {SORTS.map((s) => (
              <Pill
                key={s.key}
                label={s.label}
                active={draft.sortBy === s.key}
                // Tapping the active sort clears it back to the default order.
                onPress={() =>
                  setDraft((d) => ({ ...d, sortBy: d.sortBy === s.key ? 'relevance' : s.key }))
                }
              />
            ))}
          </AppView>
        </AppView>

        {/* Region (market of origin) */}
        <AppView gap={10}>
          <SectionLabel>Region</SectionLabel>
          <AppView row wrap gap={8}>
            {CATALOG_REGIONS.map((r) => (
              <Pill
                key={r.key}
                label={r.label}
                active={draft.regions.includes(r.key)}
                onPress={() => toggleRegion(r.key)}
              />
            ))}
          </AppView>
        </AppView>

        {/* Toggles */}
        <AppView gap={10}>
          <ToggleRow
            label="In stock only"
            checked={draft.inStockOnly}
            onToggle={() => setDraft((d) => ({ ...d, inStockOnly: !d.inStockOnly }))}
          />
          <ToggleRow
            label="OEM quality only"
            checked={draft.oemOnly}
            onToggle={() => setDraft((d) => ({ ...d, oemOnly: !d.oemOnly }))}
          />
          <ToggleRow
            label="GM only (Chevrolet / Ravon / Daewoo)"
            checked={draft.gmOnly}
            onToggle={() => setDraft((d) => ({ ...d, gmOnly: !d.gmOnly }))}
          />
        </AppView>

        {/* Brands */}
        {brands.length > 0 ? (
          <AppView gap={10}>
            <SectionLabel>Brands</SectionLabel>
            <AppView row wrap gap={8}>
              {brands.map((b) => (
                <Pill key={b} label={b} active={draft.brands.includes(b)} onPress={() => toggleBrand(b)} />
              ))}
            </AppView>
          </AppView>
        ) : null}

        <AppView gap={10} style={{ marginTop: 4 }}>
          <AppButton
            title="Apply filters"
            kind="brand"
            size="lg"
            fullWidth
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
          <AppButton title="Reset" kind="secondary" variant="outline" size="md" fullWidth onPress={() => setDraft(reset)} />
        </AppView>
      </ScrollView>
    </AppBottomSheet>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppText
      family="accent"
      weight="bold"
      style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}
    >
      {children}
    </AppText>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      rounded={999}
      px={14}
      py={8}
      borderWidth={1}
      style={{
        borderColor: active ? tokens.brandBg : tokens.border,
        backgroundColor: active ? tokens.brandBg : 'transparent',
      }}
    >
      <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: active ? tokens.onBrand : tokens.text }}>
        {label}
      </AppText>
    </AppPressableView>
  );
}

function ToggleRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={onToggle}
      androidRipple={false}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      row
      align="center"
      justify="space-between"
    >
      <AppText family="default" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>
        {label}
      </AppText>
      <AppView
        center
        rounded={7}
        borderWidth={1.5}
        style={{
          width: 24,
          height: 24,
          borderColor: checked ? tokens.brandBg : tokens.border,
          backgroundColor: checked ? tokens.brandBg : 'transparent',
        }}
      >
        {checked ? <Check size={15} strokeWidth={3} color={tokens.onBrand} /> : null}
      </AppView>
    </AppPressableView>
  );
}
