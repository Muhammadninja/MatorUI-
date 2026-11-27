import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogItem, CatalogItemSpec } from '@/services/catalog-service';

/**
 * Section heading used between the Item Detail blocks. `count` rides at the end
 * in muted type: on a page of stacked sections, knowing a list is 4 rows or 40
 * before you reach it is the difference between scanning and scrolling blind.
 */
export function ItemSectionTitle({ title, count }: { title: string; count?: number }) {
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" gap={7}>
      <AppText textVariant="h4" weight="bold" style={{ color: tokens.text }}>
        {title}
      </AppText>
      {count != null && count > 0 ? (
        <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.textMuted }}>
          {count}
        </AppText>
      ) : null}
    </AppView>
  );
}

/** Hairline between two zones of the page, inset to the content column. */
export function ItemRule() {
  const { tokens } = useThemeContext();
  return <AppView style={{ height: 1, backgroundColor: tokens.divider }} />;
}

/** One soft-tinted trust / status chip — the label carries it, no glyph. */
function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <AppView rounded={8} px={8} py={4} style={{ backgroundColor: bg }}>
      <AppText weight="medium" style={{ fontSize: 12, lineHeight: 16, color }}>
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

  return (
    <AppView row wrap gap={7}>
      {outOfStock ? (
        <Chip label={t('itemDetail.outOfStock')} color={tokens.error} bg={tokens.errorSoft} />
      ) : null}
      {!outOfStock ? (
        <Chip label={t('itemDetail.inStock')} color={tokens.success} bg={tokens.successSoft} />
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

/**
 * Product rating + review count (`rating_avg` / `review_count`). These are
 * ADMIN-CURATED product scores, distinct from the dealer's own rating, and the
 * backend returns `null` until a part is actually rated — so this renders
 * nothing rather than an empty five-star row. Detail carried the fields all
 * along and never showed them; the listing row did.
 */
export function ItemRatingRow({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  if (rating == null || rating <= 0) return null;
  const filled = Math.round(rating);

  return (
    <AppView row align="center" gap={7}>
      <AppText family="accent" weight="bold" style={{ fontSize: 13, letterSpacing: 0.5 }}>
        <AppText style={{ color: tokens.rating }}>{'★'.repeat(Math.min(5, filled))}</AppText>
        <AppText style={{ color: tokens.gray300 }}>{'★'.repeat(Math.max(0, 5 - filled))}</AppText>
      </AppText>
      <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.text }}>
        {rating.toFixed(1)}
      </AppText>
      {reviewCount ? (
        <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
          {t('catalog.reviewCount', { count: reviewCount })}
        </AppText>
      ) : null}
    </AppView>
  );
}

/** Label / value spec table — the catalog's own `specs`, plus any oil rows. */
export function ItemSpecTable({
  specs,
  onCopy,
}: {
  specs: CatalogItemSpec[];
  onCopy?: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  if (specs.length === 0) return null;

  return (
    <AppView
      rounded={12}
      colorName="card"
      borderWidth={1}
      borderName="border"
      style={{ overflow: 'hidden' }}
    >
      {specs.map((row, i) => (
        <AppView
          key={`${row.label}-${i}`}
          gap={row.copyable ? 5 : 0}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: i < specs.length - 1 ? 1 : 0,
            borderBottomColor: tokens.divider,
          }}
        >
          {row.copyable ? (
            <>
              <AppText
                family="default"
                style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted }}
              >
                {row.label}
              </AppText>
              <AppView row align="center" gap={8}>
                <AppText
                  family="accent"
                  weight="semibold"
                  selectable
                  style={{
                    flex: 1,
                    flexShrink: 1,
                    fontSize: 14,
                    lineHeight: 20,
                    color: tokens.text,
                  }}
                >
                  {row.value}
                </AppText>
                {onCopy ? (
                  <AppPressableView
                    onPress={() => onCopy(row.value)}
                    accessibilityRole="button"
                    accessibilityLabel={t('itemDetail.copyIdentifier')}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Copy size={16} strokeWidth={1.8} color={tokens.brandText} />
                  </AppPressableView>
                ) : null}
              </AppView>
            </>
          ) : (
            <AppView row align="flex-start" justify="space-between" gap={16}>
              <AppText
                family="default"
                style={{ flex: 1, fontSize: 14, lineHeight: 20, color: tokens.textMuted }}
              >
                {row.label}
              </AppText>
              <AppText
                family="accent"
                weight="semibold"
                style={{
                  flex: 1,
                  fontSize: 14,
                  lineHeight: 20,
                  color: tokens.text,
                  textAlign: 'right',
                }}
              >
                {row.value}
              </AppText>
            </AppView>
          )}
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
            style={{ flex: 1, fontSize: 14, lineHeight: 19, color: tokens.text }}
          >
            {f}
          </AppText>
        </AppView>
      ))}
    </AppView>
  );
}

/** How many fitment chips show before the list folds. */
const VISIBLE_FITS = 12;

/**
 * Vehicles this part is listed to fit. Two backend lists feed it: `fits` is one
 * entry per MODEL, `makeFits` is make-level ("fits every Chevrolet") — an
 * imported dealer position whose source named a make but no model. A part can
 * carry either or both, and a listing with only make-level fitment used to
 * render an empty section. Universal listings carry neither and render nothing
 * — they get the "fits all" badge instead.
 */
export function ItemFitList({
  fits,
  makeFits = [],
}: {
  fits: NonNullable<CatalogItem['fits']>;
  makeFits?: NonNullable<CatalogItem['makeFits']>;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const [expanded, setExpanded] = useState(false);
  const modelLabels = fits
    .map((f) => [f.makeName ?? f.makeSlug, f.modelName ?? f.modelSlug].filter(Boolean).join(' '))
    .filter((l) => l.length > 0);
  // Make-level entries say so explicitly — "Chevrolet" alone would read as a
  // model the part fits, which is a narrower claim than the data makes.
  const makeLabels = makeFits
    .map((f) => f.makeName ?? f.makeSlug)
    .filter((m): m is string => !!m && m.length > 0)
    .map((make) => t('itemDetail.fitsAllModels', { make }));
  const unique = Array.from(new Set([...modelLabels, ...makeLabels]));
  if (unique.length === 0) return null;

  // A widely-fitting part can list dozens of vehicles, and a forty-chip wall
  // between the specs and the rest of the page is the single biggest source of
  // noise here. Show a readable first screenful; the rest is one tap away.
  const shown = expanded ? unique : unique.slice(0, VISIBLE_FITS);
  const hidden = unique.length - shown.length;

  return (
    <AppView gap={9}>
      <AppView row wrap gap={7}>
      {shown.map((label) => (
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
      {hidden > 0 || expanded ? (
        <AppPressableView
          onPress={() => setExpanded((v) => !v)}
          androidRipple={false}
          pressedOpacity={0.7}
          accessibilityRole="button"
          style={{ alignSelf: 'flex-start' }}
        >
          <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.text }}>
            {expanded
              ? t('itemDetail.fitsShowLess')
              : t('itemDetail.fitsShowAll', { count: hidden })}
          </AppText>
        </AppPressableView>
      ) : null}
    </AppView>
  );
}
