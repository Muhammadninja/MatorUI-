import { Star } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { RADIUS_TAG } from '../radii';
import type { IconTone } from './signal';

export type RibbonIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  color?: string;
  fill?: string;
}>;

const SINGLE_HEIGHT = 18;
const COMPOSITE_HEIGHT = 22;
const NOTCH = 6;
const COMPOSITE_NOTCH = 8;

/**
 * Tiny price-tag ribbon — a flat dark block with a triangular notch on
 * its left side pointing AT the price. Sits at the flex-end of the
 * price row so the price reads first, then the eye glides right into
 * the signal (CHEAPEST / BESTSELLER / TOP / etc).
 *
 * Two visual modes:
 *  - Single signal: one icon, one label, 18px tall.
 *  - Composite (2+ signals): a single filled gold Michelin-style star
 *    in place of the icon cluster — instantly reads as "decorated /
 *    award-winning" without the icon row turning into noise — and a
 *    composite label ("MATOR PICK"). 22px tall.
 */
export default function Ribbon({
  label,
  icons,
  tone,
  composite,
}: {
  label: string;
  icons?: RibbonIcon[];
  tone?: IconTone;
  composite?: boolean;
}) {
  const { tokens } = useThemeContext();
  const bg = tokens.secondary;
  const fg = tokens.onSecondary;
  // Single-mode icons match the composite Mator Pick star: filled gold
  // shape so they pop against the dark ribbon. Tone can override (e.g.
  // value=green for Cheapest), otherwise default to accolade gold.
  const iconColor =
    tone === 'value' ? tokens.value : tokens.accolade;
  const height = composite ? COMPOSITE_HEIGHT : SINGLE_HEIGHT;
  const notch = composite ? COMPOSITE_NOTCH : NOTCH;
  const iconList = icons ?? [];
  const hasLeadingIcon = composite || iconList.length > 0;

  return (
    <AppView row align="center" mb={2} style={{ height }}>
      {/* Left triangular notch pointing toward the price. */}
      <AppView
        style={{
          width: 0,
          height: 0,
          borderTopWidth: height / 2,
          borderBottomWidth: height / 2,
          borderRightWidth: notch,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: bg,
        }}
      />
      <AppView
        style={{
          height,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 5,
          paddingRight: composite ? 9 : 8,
          backgroundColor: bg,
          borderTopRightRadius: RADIUS_TAG,
          borderBottomRightRadius: RADIUS_TAG,
        }}
      >
        {composite ? (
          // Composite: a single filled gold Michelin star, sized up
          // slightly. Replaces the icon cluster — one strong visual
          // mark instead of three small ones.
          <Star size={12} strokeWidth={2} color={tokens.accolade} fill={tokens.accolade} />
        ) : (
          iconList.map((Icon, i) => (
            <AppView key={i} style={{ marginLeft: i === 0 ? 0 : 2 }}>
              <Icon size={12} strokeWidth={2} color={iconColor} fill={iconColor} />
            </AppView>
          ))
        )}

        <AppText
          weight="bold"
          style={{
            color: fg,
            fontSize: composite ? 10 : 9,
            lineHeight: composite ? 11 : 10,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginLeft: hasLeadingIcon ? 4 : 0,
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        >
          {label}
        </AppText>
      </AppView>
    </AppView>
  );
}
