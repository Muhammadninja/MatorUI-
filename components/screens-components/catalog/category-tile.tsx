import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AutoPartIcon from '@/components/screens-components/catalog/auto-part-icon';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type CategoryTileProps = {
  /** INTERNAL canonical name — icon fallback key only, never rendered. */
  name: string;
  /** Localized display text from the server (`label`). Falls back to `name`
   *  when the caller has no localized string. */
  label?: string;
  /** Server icon handle from `/v1/categories`; resolved before `name`. */
  iconKey?: string;
  /** Parts count shown under the label. */
  count: number;
  /** Takes no argument on purpose: the tile has both an internal `name` and a
   *  localized `label`, and handing either one back invites a caller to use
   *  the wrong string. The parent already knows the category it rendered. */
  onPress: () => void;
};

/** Label block floor: two lines at `lineHeight`, so a wrapped label and a
 *  single-word one keep their counts on the same baseline across a row. */
const LABEL_LINE_HEIGHT = 15;
const LABEL_BLOCK_HEIGHT = LABEL_LINE_HEIGHT * 2;

/**
 * Type size for a label, chosen from its LONGEST WORD.
 *
 * A grid cell is ~31.5% of the screen — about 110pt on a phone — and a single
 * Russian category name can be wider than that at the design size
 * ("Электрооборудование", "Стеклоочистители"). A word with nowhere to break
 * gets broken anyway, leaving an orphan syllable on its own line.
 *
 * Multi-word labels ("Масла и жидкости") wrap between words and keep the full
 * size; only the long single words step down. This is measured off character
 * count rather than left to `adjustsFontSizeToFit` alone because Android only
 * auto-shrinks when the text view's height is already bounded, which a
 * two-line block that is allowed to grow is not.
 */
function labelFontSize(label: string): number {
  const longestWord = label.split(/\s+/).reduce((max, word) => Math.max(max, word.length), 0);
  if (longestWord <= 12) return 12.5;
  if (longestWord <= 15) return 11.5;
  if (longestWord <= 19) return 10.5;
  return 9.5;
}

/**
 * `CategoryTile` — a single "Shop by category" grid cell: realistic part icon
 * + name + count on a bordered card. Presentational; the parent supplies the
 * data + tap handler.
 *
 * The label is never ellipsized and never broken mid-word: localized names are
 * far longer than the internal English ones, and a single Russian word can be
 * wider than a 31.5%-wide cell ("Стеклоочистители", "Электрооборудование") —
 * free wrapping split them across lines with an orphan letter below. Two lines
 * are allowed for multi-word names; anything that still doesn't fit SHRINKS
 * (`adjustsFontSizeToFit`) instead of breaking, which keeps whole words intact
 * and the counts on a shared baseline across the row.
 */
function CategoryTile({ name, label, iconKey, count, onPress }: CategoryTileProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  // Everything user-facing reads the localized label; `name` is only ever an
  // icon-resolution fallback.
  const display = label ?? name;
  const fontSize = labelFontSize(display);
  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={`${display}, ${t('category.partsCount', { count })}`}
      center
      style={{ width: '31.5%', paddingBottom: 5, gap: 10 }}
    >
      <AppView center style={{ width: 68, height: 68 }}>
        <AutoPartIcon name={name} iconKey={iconKey} size={60} />
      </AppView>
      <AppView align="center" style={{ alignSelf: 'stretch' }}>
        <AppView justify="center" style={{ minHeight: LABEL_BLOCK_HEIGHT, alignSelf: 'stretch' }}>
          <AppText
            family="accent"
            weight="bold"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={{
              fontSize,
              color: tokens.text,
              textAlign: 'center',
              lineHeight: LABEL_LINE_HEIGHT,
            }}
          >
            {display}
          </AppText>
        </AppView>
        <AppText family="default" style={{ fontSize: 10.5, color: tokens.textMuted, marginTop: 3 }}>
          {t('category.partsCount', { count })}
        </AppText>
      </AppView>
    </AppPressableView>
  );
}

export default memo(CategoryTile);
