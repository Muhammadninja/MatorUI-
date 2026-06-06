import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type CornerRibbonProps = {
  label: string;
  /** Background color override. Defaults to `tokens.secondary` (dark). */
  color?: string;
  /** Foreground (text) color override. Defaults to `tokens.onSecondary`. */
  textColor?: string;
  /** Corner radius of the ribbon. Defaults to 13. */
  radius?: number;
};

/**
 * Diagonal ribbon hanging across the top-left of the thumbnail. The
 * thumbnail's `overflow: hidden` clips the tilted strip's ends so it
 * reads as a ribbon emerging from the corner.
 */
export default function CornerRibbon({ label, color, textColor, radius  }: CornerRibbonProps) {
  const { tokens } = useThemeContext();
  // Scale font + letter-spacing to label length so short labels ("NEW",
  // "TOP") fill the same visual ribbon space as long ones ("CHEAPEST",
  // "FEATURED"). Otherwise short labels float in empty padding and the
  // card reads as visually unbalanced compared to its neighbours.
  const len = label.length;
  const fontSize = len <= 4 ? 11 : len <= 6 ? 10 : 8.5;
  const letterSpacing = len <= 4 ? 1.8 : len <= 6 ? 1 : 0.5;

  return (
    <AppView
      pointerEvents="none"
      center
      style={{
        position: 'absolute',
        top: 10,
        left: -25,
        width: 100,
        paddingVertical: 1.5,
        paddingHorizontal: 4,
        backgroundColor: color ?? tokens.secondary,
        transform: [{ rotate: '-45deg' }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 1.5,
        elevation: 2,
      }}
    >
      <AppText
        weight="bold"
        numberOfLines={1}
        style={{
          color: textColor ?? tokens.onSecondary,
          fontSize,
          letterSpacing,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        {label}
      </AppText>
    </AppView>
  );
}
