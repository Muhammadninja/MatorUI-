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

/** Label block height: two lines at `lineHeight`, so a wrapped label and a
 *  single-word one keep their counts on the same baseline across a row. */
const LABEL_LINE_HEIGHT = 15;
const LABEL_BLOCK_HEIGHT = LABEL_LINE_HEIGHT * 2;

/**
 * `CategoryTile` — a single "Shop by category" grid cell: realistic part icon
 * + name + count on a bordered card. Presentational; the parent supplies the
 * data + tap handler.
 *
 * The label wraps to two lines: localized names are far longer than the
 * internal English ones ("Электрооборудование", "Kuzov va tashqi qism") and a
 * single line ellipsized them mid-word. The block is a fixed two lines tall so
 * the counts stay aligned whether the label wraps or not.
 */
function CategoryTile({ name, label, iconKey, count, onPress }: CategoryTileProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  // Everything user-facing reads the localized label; `name` is only ever an
  // icon-resolution fallback.
  const display = label ?? name;
  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={`${display}, ${t('category.partsCount', { count })}`}
      center
      borderBottomWidth={0.6}
      borderName="border"
      style={{ width: '31.5%', paddingBottom: 5, gap: 10 }}
    >
      <AppView center style={{ width: 68, height: 68 }}>
        <AutoPartIcon name={name} iconKey={iconKey} size={60} />
      </AppView>
      <AppView align="center" style={{ alignSelf: 'stretch' }}>
        <AppView justify="center" style={{ height: LABEL_BLOCK_HEIGHT, alignSelf: 'stretch' }}>
          <AppText
            family="accent"
            weight="bold"
            style={{
              fontSize: 12.5,
              color: tokens.text,
              textAlign: 'center',
              lineHeight: LABEL_LINE_HEIGHT,
            }}
            numberOfLines={2}
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
