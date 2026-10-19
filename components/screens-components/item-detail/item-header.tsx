import { ArrowLeft, Heart, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated } from 'react-native';

import { AppOemPill } from '@/components/shared/app-oem-pill';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { noBreakDigits } from '@/utils/format-price';

/** Circular control floating over the gallery. */
function GlassButton({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={onPress}
      center
      rounded={999}
      androidRipple={false}
      pressedOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 40,
        height: 40,
        backgroundColor: tokens.scrim,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
      }}
    >
      {children}
    </AppPressableView>
  );
}

export type ItemFloatingControlsProps = {
  /** Distance from the top of the screen (safe-area inset + breathing room). */
  top: number;
  isFavorite: boolean;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
};

/**
 * Back / share / favourite, floating over the gallery. The pucks are filled
 * with the theme-independent `scrim` so they read against the white photo tile
 * in BOTH themes — and still against the title bar once it fades in.
 */
export function ItemFloatingControls({
  top,
  isFavorite,
  onBack,
  onShare,
  onToggleFavorite,
}: ItemFloatingControlsProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView
      row
      align="center"
      justify="space-between"
      px="lg"
      style={{ position: 'absolute', left: 0, right: 0, top }}
    >
      <GlassButton onPress={onBack} accessibilityLabel={t('itemDetail.back')}>
        <ArrowLeft size={21} strokeWidth={2.3} color={tokens.white} />
      </GlassButton>
      <AppView row align="center" gap={10}>
        <GlassButton onPress={onShare} accessibilityLabel={t('itemDetail.share')}>
          <Share2 size={18} strokeWidth={2.3} color={tokens.white} />
        </GlassButton>
        <GlassButton
          onPress={onToggleFavorite}
          accessibilityLabel={
            isFavorite ? t('itemDetail.removeFromFavorites') : t('itemDetail.saveToFavorites')
          }
        >
          <Heart
            size={19}
            strokeWidth={2.3}
            color={isFavorite ? tokens.error : tokens.white}
            fill={isFavorite ? tokens.error : 'none'}
          />
        </GlassButton>
      </AppView>
    </AppView>
  );
}

export type ItemTitleBarProps = {
  title: string;
  height: number;
  /** Driven by scroll position — 0 over the photos, 1 once they're gone. */
  opacity: Animated.AnimatedInterpolation<number>;
};

/**
 * Compact title bar that fades in as the gallery scrolls away, so you always
 * know which part you're looking at. `pointerEvents` is off — the floating
 * controls sit above it and stay tappable. The title shrinks to fit rather
 * than truncating.
 */
export function ItemTitleBar({ title, height, opacity }: ItemTitleBarProps) {
  const { tokens } = useThemeContext();
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height,
        opacity,
        backgroundColor: tokens.background,
        borderBottomWidth: 1,
        borderBottomColor: tokens.divider,
        justifyContent: 'flex-end',
        paddingBottom: 12,
        paddingHorizontal: 72,
      }}
    >
      <AppText
        family="accent"
        weight="bold"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ fontSize: 15, color: tokens.text, textAlign: 'center' }}
      >
        {title}
      </AppText>
    </Animated.View>
  );
}

export type ItemIdentityProps = {
  /** "Brand · Category" meta line from the catalog. */
  eyebrow: string;
  /** Optional corner-ribbon label ("Hot pick", "New"). */
  badge?: string;
  title: string;
  /** Qualifiers lifted out of the raw title by `normalizePartTitle` (vehicle
   *  model, side, spec code, volume). Keeps the title to one clean line. */
  titleDetail?: string;
  oem?: string;
  gm?: string;
};

/** Eyebrow + badge → title → lifted qualifiers → part-number chips. */
export function ItemIdentity({ eyebrow, badge, title, titleDetail, oem, gm }: ItemIdentityProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView gap={9}>
      {eyebrow || badge ? (
        <AppView row align="center" wrap gap={8}>
          {eyebrow ? (
            <AppText
              family="accent"
              weight="bold"
              style={{
                fontSize: 10.5,
                letterSpacing: 1,
                color: tokens.textMuted,
                textTransform: 'uppercase',
              }}
            >
              {eyebrow}
            </AppText>
          ) : null}
          {badge ? (
            <AppView rounded={999} px={8} py={3} style={{ backgroundColor: tokens.brandSoft }}>
              <AppText
                family="accent"
                weight="bold"
                style={{ fontSize: 10.5, color: tokens.brand }}
              >
                {badge}
              </AppText>
            </AppView>
          ) : null}
        </AppView>
      ) : null}

      <AppText
        family="heading"
        weight="bold"
        style={{ fontSize: 24, lineHeight: 30, color: tokens.text }}
      >
        {title}
      </AppText>

      {titleDetail ? (
        <AppText
          family="default"
          style={{ fontSize: 13.5, lineHeight: 18, color: tokens.textMuted, marginTop: -2 }}
        >
          {titleDetail}
        </AppText>
      ) : null}

      {oem || gm ? <AppOemPill oem={oem} gm={gm} /> : null}
    </AppView>
  );
}

export type ItemPriceRowProps = {
  /** Pre-formatted charged price — already the sale price when one applies. */
  price: string;
  /** Pre-discount price in UZS to strike through; 0 hides it. */
  wasUzs: number;
  /** The backend's own formatting of that price, when it applied the sale
   *  itself. Preferred over reformatting `wasUzs` so the server and the client
   *  never print the same number two ways. */
  wasLabel?: string;
  /** Discount percent; 0 hides the pill. */
  savePct: number;
  /** Name of the campaign behind the discount ("Осенняя распродажа"), when the
   *  backend resolved one. Omitted for a client-matched sale. */
  saleTitle?: string;
  /** Pre-formatted amount saved per unit; null when nothing is discounted. */
  savingsLabel: string | null;
};

/**
 * Price line: the charged price, the struck-through "was", and the discount
 * pill. All three come from the resolved sale (backend-applied when present,
 * `/v1/sales` matcher otherwise) — the same resolution the listing card uses,
 * so card and detail never disagree.
 */
export function ItemPriceRow({
  price,
  wasUzs,
  wasLabel,
  savePct,
  saleTitle,
  savingsLabel,
}: ItemPriceRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView gap={5}>
      <AppView row align="flex-end" wrap columnGap={10} rowGap={6}>
        <AppPrice value={price} size={32} color={tokens.text} />
        {wasUzs > 0 ? (
          <AppText
            family="default"
            style={{
              fontSize: 14,
              color: tokens.textMuted,
              textDecorationLine: 'line-through',
              marginBottom: 4,
            }}
          >
            {wasLabel
              ? noBreakDigits(wasLabel)
              : `${noBreakDigits(wasUzs.toLocaleString('ru-RU'))} ${t('common.currency')}`}
          </AppText>
        ) : null}
        {savePct > 0 ? (
          <AppView
            rounded={999}
            px={8}
            py={3}
            style={{ marginBottom: 4, backgroundColor: `${tokens.error}1a` }}
          >
            <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.error }}>
              {t('itemDetail.discountPercent', { percent: savePct })}
            </AppText>
          </AppView>
        ) : null}
      </AppView>
      {savingsLabel ? (
        <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.success }}>
          {t('itemDetail.youSave', { amount: savingsLabel })}
        </AppText>
      ) : null}
      {/* Which campaign the discount comes from — the backend names it, and a
       *  named sale reads as a real offer rather than an arbitrary markdown. */}
      {saleTitle ? (
        <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
          {saleTitle}
        </AppText>
      ) : null}
    </AppView>
  );
}
