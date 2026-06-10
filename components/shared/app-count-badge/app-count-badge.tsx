import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type AppCountBadgeProps = {
  /** Numeric count to display. Values > `max` render as `${max}+`. */
  count: number;
  /** Cap; counts above this render with a "+" suffix. Defaults to 99. */
  max?: number;
  /** Where this badge anchors relative to its parent (the parent must
   *  be `position: 'relative'`). Defaults to `'top-right'`. */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  /** Background theme token. Defaults to `text` so it auto-inverts
   *  with the theme (dark pill in light mode, light pill in dark). */
  backgroundColorName?: ColorName;
  /** Text color theme token. Defaults to `background` to pair with
   *  the inverted background. */
  colorName?: ColorName;
};

const ANCHOR = {
  'top-right': { position: 'absolute', top: -6, right: -6 },
  'top-left': { position: 'absolute', top: -6, left: -6 },
  'bottom-right': { position: 'absolute', bottom: -6, right: -6 },
  'bottom-left': { position: 'absolute', bottom: -6, left: -6 },
  inline: {},
} as const;

/**
 * Small numeric notification badge — the count-overlay that sits on
 * top of icon buttons (cart truck, bell icons, etc). Defaults to an
 * auto-inverting monochrome treatment so it pops on any surface
 * without bringing in a brand color.
 *
 * Render INSIDE a `position: 'relative'` parent for the absolute
 * `position` variants, or pass `position="inline"` to flow as a
 * regular child.
 */
export function AppCountBadge({
  count,
  max = 99,
  position = 'top-right',
  backgroundColorName = 'text',
  colorName = 'background',
}: AppCountBadgeProps) {
  const { tokens } = useThemeContext();
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <AppView
      center
      rounded={36}
      style={{
        ...ANCHOR[position],
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        backgroundColor: tokens[backgroundColorName],
      }}
    >
      <AppText
        textVariant="bodyXs"
        weight="bold"
        style={{ color: tokens[colorName] }}
      >
        {label}
      </AppText>
    </AppView>
  );
}

export default AppCountBadge;
