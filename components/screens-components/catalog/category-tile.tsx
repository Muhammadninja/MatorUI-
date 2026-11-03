import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AutoPartIcon from '@/components/screens-components/catalog/auto-part-icon';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { softWrapLabel } from '@/utils/category-label';

export type CategoryTileProps = {
  /** INTERNAL canonical name — icon fallback key only, never rendered. */
  name: string;
  /** Localized display text (`label`). Falls back to `name` when the caller
   *  has no localized string. */
  label?: string;
  /** Icon handle; resolved before `name`. */
  iconKey?: string;
  /** Parts count shown under the label; no count line when omitted. */
  count?: number;
  /** Takes no argument on purpose: the tile has both an internal `name` and a
   *  localized `label`, and handing either one back invites a caller to use
   *  the wrong string. The parent already knows the category it rendered. */
  onPress: () => void;
  /** Cell width in points. Grids that compute equal columns pass it; others
   *  keep the 31.5% share. */
  width?: number;
};

/**
 * ONE type size for every label on every device.
 *
 * The grid is flexbox: a cell is a share of the row, so it already scales with
 * the screen, and the label's job is to wrap inside it — not to be re-measured
 * and re-sized per tile. Per-tile sizing is what made the grid read as a
 * jumble of different typefaces; a single size is what makes a Pro Max and a
 * small Android render the same picture.
 */
const LABEL_SIZE = 12;
/** Fixed leading, so a one-line label and a two-line one put their counts on
 *  the same baseline across the row. */
const LABEL_LINE_HEIGHT = 16;
const LABEL_BLOCK_HEIGHT = LABEL_LINE_HEIGHT * 2;

/**
 * Characters a cell fits on one line at `LABEL_SIZE`.
 *
 * A cell is 31.5% of the content width — ~110pt on a phone — and the bold
 * accent face runs ~0.64em per Cyrillic glyph, so ~13 of them fit. The number
 * survives a change of device precisely BECAUSE the cell is a percentage: a
 * wider screen gives a proportionally wider cell at the same type size.
 */
const LABEL_MAX_WORD = 13;

/**
 * `CategoryTile` — a single "Shop by category" grid cell: realistic part icon
 * + name (+ parts count, when the caller has one). Presentational; the parent
 * supplies the data + tap handler.
 *
 * The label is never ellipsized, never shrunk, and never snapped mid-syllable.
 * Localized names run far longer than the internal English ones, and a single
 * Russian word can outgrow a 31.5%-wide cell ("Стеклоочистители",
 * "Электрооборудование"): those get a break opportunity at their compound seam
 * (`softWrapLabel`), so flexbox wraps them as "Электро / оборудование" at the
 * same size every other tile uses.
 */
function CategoryTile({ name, label, iconKey, count, onPress, width }: CategoryTileProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  // Everything user-facing reads the localized label; `name` is only ever an
  // icon-resolution fallback.
  const display = label ?? name;
  // Invisible break hints only — the a11y label below keeps the raw string, so
  // a screen reader never meets a zero-width space.
  const wrapped = softWrapLabel(display, LABEL_MAX_WORD);
  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={
        count === undefined ? display : `${display}, ${t('category.partsCount', { count })}`
      }
      rounded={12}
      colorName="card"
      borderWidth={1}
      borderName="border"
      align="center"
      style={{ width: width ?? '31.5%', paddingHorizontal: 8, paddingVertical: 12, gap: 8 }}
    >
      <AppView center style={{ width: 68, height: 68 }}>
        <AutoPartIcon name={name} iconKey={iconKey} size={60} />
      </AppView>
      <AppView align="center" style={{ alignSelf: 'stretch' }}>
        <AppView justify="center" style={{ minHeight: LABEL_BLOCK_HEIGHT, alignSelf: 'stretch' }}>
          {/* Three lines, not two: two is what every real label needs, and the
           *  third is headroom so an unusually long translation grows the tile
           *  instead of losing its tail to an ellipsis. */}
          <AppText
            family="accent"
            weight="semibold"
            numberOfLines={3}
            style={{
              fontSize: LABEL_SIZE,
              color: tokens.text,
              textAlign: 'center',
              lineHeight: LABEL_LINE_HEIGHT,
            }}
          >
            {wrapped}
          </AppText>
        </AppView>
        {count === undefined ? null : (
          <AppText
            family="default"
            style={{ fontSize: 12, lineHeight: 16, color: tokens.textMuted, marginTop: 4 }}
          >
            {t('category.partsCount', { count })}
          </AppText>
        )}
      </AppView>
    </AppPressableView>
  );
}

export default memo(CategoryTile);
