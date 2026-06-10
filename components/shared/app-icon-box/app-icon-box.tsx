import type { LucideLike } from '@/components/shared/app-icon-button/app-icon-button';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type AppIconBoxProps = {
  /** Lucide (or any component with `size/strokeWidth/color`) icon. */
  Icon: LucideLike;
  /** Outer square size in dp. Defaults to 34. */
  size?: number;
  /** Glyph size in dp. Defaults to 16. */
  iconSize?: number;
  /** Stroke width forwarded to the icon. Defaults to 2.1. */
  strokeWidth?: number;
  /** Corner radius. Defaults to 12 (subtle squircle). */
  rounded?: number;
  /** Background theme token. Defaults to `backgroundSecondary`. */
  backgroundColorName?: ColorName;
  /** Icon color theme token. Defaults to `icon`. */
  colorName?: ColorName;
};

/**
 * Non-interactive square that frames a small icon. Used for the
 * leading-icon affordance in profile section cards and list rows.
 * Replaces the local `iconBox()` helpers that were scattered across
 * screens.
 */
export function AppIconBox({
  Icon,
  size = 34,
  iconSize = 16,
  strokeWidth = 2.1,
  rounded = 12,
  backgroundColorName = 'backgroundSecondary',
  colorName = 'icon',
}: AppIconBoxProps) {
  const { tokens } = useThemeContext();
  return (
    <AppView
      center
      rounded={rounded}
      style={{
        width: size,
        height: size,
        backgroundColor: tokens[backgroundColorName],
      }}
    >
      <Icon size={iconSize} strokeWidth={strokeWidth} color={tokens[colorName]} />
    </AppView>
  );
}

export default AppIconBox;
