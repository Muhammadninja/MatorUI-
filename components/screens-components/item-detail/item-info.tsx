import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogItem, CatalogItemSpec } from '@/services/catalog-service';

/** Section heading used between the Item Detail blocks. */
export function ItemSectionTitle({ title }: { title: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppText family="heading" weight="bold" style={{ fontSize: 16.5, color: tokens.text }}>
      {title}
    </AppText>
  );
}

/** One soft-tinted trust / status chip — the label carries it, no glyph. */
function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <AppView rounded={999} px={11} py={5} style={{ backgroundColor: bg }}>
      <AppText family="accent" weight="bold" style={{ fontSize: 11.5, color }}>
        {label}
      </AppText>
    </AppView>
  );
}

/**
 * Trust chips: the seller's admin-toggled MATOR Certified and lowest-price
 * flags, plus an out-of-stock warning. Every chip is backed by a real catalog
 * field — nothing renders when the backend sends nothing.
 */
export function ItemTrustRow({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const outOfStock = /out of stock/i.test(item.status ?? '');

  // Nothing to say → no empty row. "In stock" deliberately has no chip: it is
  // the default for every listing, so it would be noise on every product.
  if (!outOfStock && !item.certified && !item.lowestPrice) return null;

  return (
    <AppView row wrap gap={7}>
      {outOfStock ? (
        <Chip label={t('itemDetail.outOfStock')} color={tokens.error} bg={`${tokens.error}1a`} />
      ) : null}
      {item.certified ? (
        <Chip label={t('catalog.matorCertified')} color={tokens.success} bg={tokens.successSoft} />
      ) : null}
      {item.lowestPrice ? (
        <Chip label={t('catalog.lowestPrice')} color={tokens.info} bg={tokens.infoSoft} />
      ) : null}
    </AppView>
  );
}

/** Label / value spec table — the catalog's own `specs`, plus any oil rows. */
export function ItemSpecTable({ specs }: { specs: CatalogItemSpec[] }) {
  const { tokens } = useThemeContext();
  if (specs.length === 0) return null;

  return (
    <AppView rounded={18} colorName="backgroundSecondary" style={{ overflow: 'hidden' }}>
      {specs.map((row, i) => (
        <AppView
          key={`${row.label}-${i}`}
          row
          align="center"
          justify="space-between"
          gap={16}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: i < specs.length - 1 ? 1 : 0,
            borderBottomColor: tokens.divider,
          }}
        >
          <AppText family="default" style={{ flex: 1, fontSize: 13, color: tokens.textMuted }}>
            {row.label}
          </AppText>
          <AppText
            family="accent"
            weight="semibold"
            style={{ flex: 1, fontSize: 13, color: tokens.text, textAlign: 'right' }}
          >
            {row.value}
          </AppText>
        </AppView>
      ))}
    </AppView>
  );
}

/**
 * Backend-supplied feature bullets (`part.features`), set as a plain hanging
 * list: a hairline dash in the margin, the sentence doing the work.
 */
export function ItemFeatureList({ features }: { features: string[] }) {
  const { tokens } = useThemeContext();
  if (features.length === 0) return null;

  return (
    <AppView gap={8}>
      {features.map((f) => (
        <AppView key={f} row align="flex-start" gap={10}>
          <AppView
            rounded={999}
            style={{ width: 10, height: 1.5, marginTop: 9, backgroundColor: tokens.textMuted }}
          />
          <AppText
            family="default"
            style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: tokens.text }}
          >
            {f}
          </AppText>
        </AppView>
      ))}
    </AppView>
  );
}

/**
 * Vehicles this part is listed to fit (`part.fits`). Universal listings carry
 * an empty array and render nothing — they get the "fits all" badge instead.
 */
export function ItemFitList({ fits }: { fits: NonNullable<CatalogItem['fits']> }) {
  const { tokens } = useThemeContext();
  const labels = fits
    .map((f) => [f.makeName ?? f.makeSlug, f.modelName ?? f.modelSlug].filter(Boolean).join(' '))
    .filter((l) => l.length > 0);
  const unique = Array.from(new Set(labels));
  if (unique.length === 0) return null;

  return (
    <AppView row wrap gap={7}>
      {unique.map((label) => (
        <AppView
          key={label}
          rounded={999}
          px={11}
          py={6}
          colorName="backgroundSecondary"
          borderWidth={1}
          borderName="border"
        >
          <AppText family="accent" weight="semibold" style={{ fontSize: 12, color: tokens.text }}>
            {label}
          </AppText>
        </AppView>
      ))}
    </AppView>
  );
}
