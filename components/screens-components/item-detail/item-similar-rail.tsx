import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import ImageBox from '@/components/screens-components/home/image-box';
import { splitPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useCatalogList } from '@/hooks/use-catalog-list';
import type { CatalogItem } from '@/services/catalog-service';
import { openItemDetail } from '@/utils/nav';

const CARD_WIDTH = 150;
const MAX_CARDS = 8;

export type ItemSimilarRailProps = {
  /** The part being viewed — excluded from its own rail. */
  currentId: string;
  /** Category to pull alternatives from (`part.category.id`). */
  categoryId?: string;
  /** Active garage vehicle, so the alternatives are ones that fit it. */
  make?: string;
  model?: string;
};

/**
 * "Similar parts" rail — a real `GET /v1/catalog/parts` call scoped to this
 * part's category and, when the garage has one, the active vehicle. It gives a
 * shopper who rejected THIS part somewhere to go instead of back to search,
 * and it's the fallback surface when the part is out of stock.
 *
 * Renders nothing until the request succeeds with at least one other part, so
 * it never reserves empty space or flashes a skeleton over the buy path. Only
 * mount it when there is a scope (category or vehicle) — the hook fires on
 * mount.
 */
export function ItemSimilarRail({ currentId, categoryId, make, model }: ItemSimilarRailProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const { state, items } = useCatalogList({
    page: 1,
    pageSize: 12,
    category: categoryId,
    make,
    model,
  });

  if (state !== 'success') return null;
  const others = items.filter((p) => p.id !== currentId).slice(0, MAX_CARDS);
  if (others.length === 0) return null;

  return (
    <AppView gap={11}>
      <AppText family="heading" weight="bold" style={{ fontSize: 16.5, color: tokens.text }}>
        {t('itemDetail.similarTitle')}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 4 }}
      >
        {others.map((p) => (
          <SimilarCard key={p.id} item={p} />
        ))}
      </ScrollView>
    </AppView>
  );
}

/** One compact alternative. Tapping warms its detail payload, then navigates. */
function SimilarCard({ item }: { item: CatalogItem }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const brand = (item.brand ?? item.description?.split('·')[0])?.trim();
  const amount = splitPrice(item.price).amount || item.price;

  return (
    <AppPressableView
      onPress={() => openItemDetail(item.id)}
      androidRipple={false}
      pressedOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      gap={8}
      rounded={16}
      p={8}
      colorName="backgroundSecondary"
      style={{ width: CARD_WIDTH }}
    >
      <ImageBox
        label={item.title}
        uri={item.images?.[0]}
        height={104}
        radius={11}
        contentFit="contain"
        backgroundColor={tokens.white}
      />
      {brand ? (
        <AppText
          family="accent"
          weight="bold"
          style={{
            fontSize: 9.5,
            letterSpacing: 0.9,
            color: tokens.textMuted,
            textTransform: 'uppercase',
          }}
        >
          {brand}
        </AppText>
      ) : null}
      <AppText
        family="default"
        weight="semibold"
        style={{ fontSize: 12.5, lineHeight: 16, color: tokens.text }}
      >
        {item.title}
      </AppText>
      <AppView row align="baseline" gap={4}>
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 14, letterSpacing: -0.2, color: tokens.text }}
        >
          {amount}
        </AppText>
        <AppText
          family="accent"
          weight="semibold"
          style={{ fontSize: 10, color: tokens.textMuted }}
        >
          {t('common.currency')}
        </AppText>
      </AppView>
    </AppPressableView>
  );
}

export default ItemSimilarRail;
